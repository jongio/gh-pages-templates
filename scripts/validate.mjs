#!/usr/bin/env node
// validate.mjs - CI gate for the registry. Validates every template's manifest
// and Pages deploy workflow, and that the generator stamps it with no leftover
// placeholders. No deps; Node 18+.  Run:  node scripts/validate.mjs

import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, mkdirSync, mkdtempSync, rmSync, lstatSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve, dirname, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import {
  assertFullCommitSha,
  assertSafeDestination,
  computeReplacements,
  listTemplates,
  readManifest,
  rewriteTree,
  stampTemplate,
} from "./new-site.mjs";
import { validateWorkflowText } from "./workflow-security.mjs";
import { buildCatalog, serializeCatalog } from "./build-catalog.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_DIR = join(ROOT, "templates");

const TIERS = new Set(["static", "ssg", "spa", "data", "native"]);
const REQUIRED_FIELDS = ["name", "title", "tagline", "description", "framework", "tier", "language", "needsBuild", "output", "basePathMechanism", "deploy", "tags", "features", "order"];
const SENTINELS = [
  "__SITE_NAME__",
  "__SITE_DESCRIPTION__",
  "__SITE_URL__",
  "__SITE_ORIGIN__",
  "__BASE_PATH__",
  "__BASE_URL__",
  "__REPO_SLUG__",
  "__REPO_OWNER__",
  "__REPO_NAME__",
  "__AUTHOR_NAME__",
  "__PKG_NAME__",
  "__MARKETPLACE_ID__",
  "__DEFAULT_BRANCH__",
];

const UNIVERSAL = ["permissions:", "pages: write", "id-token: write", "concurrency:", "group: pages", "actions/deploy-pages@", "name: github-pages"];
const FORBIDDEN = ["peaceiris/actions-gh-pages", "actions/upload-artifact@", "actions/deploy-pages@v3"];
const PER_TEMPLATE_ACTIONS = {
  "static-html": ["actions/configure-pages@", "actions/upload-pages-artifact@"],
  "astro": ["actions/setup-node@", "actions/configure-pages@", "actions/upload-pages-artifact@"],
  "skills-catalog": ["actions/setup-node@", "actions/configure-pages@", "actions/upload-pages-artifact@"],
  "react-vite": ["actions/setup-node@", "actions/configure-pages@", "actions/upload-pages-artifact@"],
  "eleventy": ["actions/setup-node@", "actions/configure-pages@", "actions/upload-pages-artifact@"],
  "jekyll": ["actions/configure-pages@", "actions/jekyll-build-pages@", "actions/upload-pages-artifact@"],
};

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}
function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "_site"].includes(ent.name)) continue;
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(abs)); else out.push(abs);
  }
  return out;
}
export function workflowRunBlocks(yaml) {
  const lines = yaml.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);
    if (!match) continue;
    let block = match[2];
    if (/^[|>]/.test(block)) {
      if (/^>/.test(block)) {
        throw new Error("Folded YAML run blocks are not supported.");
      }
      if (!/^\|(?:[1-9][+-]?|[+-][1-9]?)?$/.test(block)) {
        throw new Error(`Unsupported YAML block scalar indicator: ${block}`);
      }
      const indent = match[1].length;
      const body = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const nextIndent = next.match(/^\s*/)?.[0].length ?? 0;
        if (next.trim() && nextIndent <= indent) break;
        body.push(next);
        i++;
      }

      block = body.join("\n");
    }
    blocks.push(block);
  }
  return blocks;
}

function assertRunnerJobsHaveTimeouts(yaml) {
  const lines = yaml.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (!/^    runs-on:\s*\S+/.test(lines[index])) continue;
    let start = index;
    while (start > 0 && !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[start])) start--;
    let end = index + 1;
    while (
      end < lines.length &&
      !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[end]) &&
      !(/^\S/.test(lines[end]) && lines[end].trim())
    ) {
      end++;
    }

    assert.match(
      lines.slice(start, end).join("\n"),
      /^    timeout-minutes:\s*\d+$/m,
      `runner job at line ${index + 1} has no timeout`,
    );
  }
}

function workflowJobBlocks(yaml) {
  const lines = yaml.split("\n");
  const jobs = new Map();
  const jobsIndex = lines.findIndex((line) => line === "jobs:");
  if (jobsIndex < 0) return jobs;
  for (let index = jobsIndex + 1; index < lines.length; index++) {
    const match = lines[index].match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (!match) continue;
    let end = index + 1;
    while (end < lines.length && !/^  [A-Za-z0-9_-]+:\s*$/.test(lines[end])) {
      if (/^\S/.test(lines[end]) && lines[end].trim()) break;
      end++;
    }
    jobs.set(match[1], lines.slice(index, end).join("\n"));
    index = end - 1;
  }
  return jobs;
}

console.log("gh-pages-templates validation");

const names = listTemplates();

test("at least 6 templates present", () => assert.ok(names.length >= 6, `found ${names.length}`));

test("workflow parser handles literal YAML block scalar indicators", () => {
  const blocks = workflowRunBlocks(`steps:
  - run: |-
      echo \${{ github.ref }}
  - run: |2-
      npm ci --ignore-scripts
`);
  assert.equal(blocks.length, 2);
  assert.ok(blocks[0].includes("${{ github.ref }}"));
  assert.ok(blocks[1].includes("npm ci --ignore-scripts"));
  assert.throws(
    () => workflowRunBlocks("steps:\n  - run: >-\n      npm ci --ignore-scripts\n"),
    /Folded YAML run blocks/,
  );
});

test("runtime workflow validation rejects unsafe stamped workflows", () => {
  const safe = readFileSync(
    join(TEMPLATES_DIR, "skills-catalog", ".github", "workflows", "deploy.yml"),
    "utf8",
  );
  assert.throws(
    () => validateWorkflowText(
      safe.replace(/actions\/checkout@[a-f0-9]{40}/, "actions/checkout@v7"),
      "unpinned.yml",
    ),
    /unpinned action/,
  );
  assert.throws(
    () => validateWorkflowText(
      safe.replace(" --ignore-scripts", ""),
      "lifecycle.yml",
    ),
    /lifecycle-capable install/,
  );
  const unsafeCases = [
    ["scalar permissions", safe.replace(/permissions:\r?\n/, "permissions: write-all\n"), /block mapping/],
    ["commented permission", safe.replace("contents: read", "contents: write # unsafe"), /unsafe permission/],
    ["quoted run", safe.replace("run: npm run build", "run: \"echo # ${{ github.ref }}\""), /interpolates workflow context/],
    ["comment-like run interpolation", safe.replace("run: npm run build", "run: echo tag #x ${{ github.ref }}"), /interpolates workflow context/],
    ["plain multiline run interpolation", safe.replace("run: npm run build", "run:\n          echo ${{ github.ref }}"), /interpolates workflow context/],
    ["top-level deployment permissions", safe.replace(/permissions:\r?\n  contents: read/, "permissions:\n  contents: read\n  pages: write\n  id-token: write"), /top-level permissions/],
    ["case-variant checkout", safe.replace(/actions\/checkout@([a-f0-9]{40})/, "Actions/Checkout@$1").replace(/^\s*persist-credentials:\s*false\r?\n/m, ""), /disable checkout credentials/],
    ["yarn lifecycle install", safe.replace("run: npm run build", "run: yarn install"), /lifecycle-capable install/],
    ["chained npm suppression", safe.replace("run: npm run build", "run: npm ci && echo --ignore-scripts"), /lifecycle-capable install/],
    ["missing effective Pages permission", safe.replace(/^\s{6}pages:\s*read\r?\n/m, ""), /effective Pages access/],
    ["Docker action", safe.replace(/uses: actions\/checkout@[a-f0-9]{40}/, "uses: docker://alpine:latest"), /unsupported action syntax/],
    ["flow mapping", `${safe}\nevil: { permissions: write-all }\n`, /flow-style mapping/],
    ["flow-mapped Docker action", safe.replace(/uses: actions\/checkout@[a-f0-9]{40}/, "- { uses: docker://alpine:latest }"), /flow-style mapping/],
    ["YAML anchor", `${safe}\nevil: &unsafe value\n`, /anchor, alias, tag, or merge key/],
    ["sequence YAML anchor", safe.replace("- name: Checkout", "- &unsafe"), /anchor, alias, tag, or merge key/],
    ["sequence YAML tag", safe.replace("- name: Checkout", "- !unsafe"), /anchor, alias, tag, or merge key/],
  ];
  for (const [name, workflow, expected] of unsafeCases) {
    assert.throws(() => validateWorkflowText(workflow, `${name}.yml`), expected, name);
  }
});

test("site publication rejects filesystem roots", () => {
  const root = parse(resolve(".")).root;
  assert.throws(() => assertSafeDestination(root), /filesystem root/);
});

for (const name of names) {
  const tdir = join(TEMPLATES_DIR, name);
  const m = readManifest(tdir);

  test(`${name}: manifest has all required fields`, () => {
    for (const f of REQUIRED_FIELDS) assert.ok(m[f] !== undefined && m[f] !== "", `missing "${f}"`);
  });
  test(`${name}: manifest.name matches folder, tier + types valid`, () => {
    assert.equal(m.name, name);
    assert.ok(TIERS.has(m.tier), `bad tier "${m.tier}"`);
    assert.equal(typeof m.needsBuild, "boolean");
    assert.equal(typeof m.order, "number");
    assert.ok(Array.isArray(m.tags) && m.tags.length > 0);
  });

  const wf = join(tdir, ".github", "workflows", "deploy.yml");
  test(`${name}: ships a deploy workflow`, () => assert.ok(existsSync(wf)));
  const yaml = existsSync(wf) ? readFileSync(wf, "utf8").replace(/\r\n/g, "\n") : "";
  test(`${name}: workflow has required Pages config, no tabs`, () => {
    assert.ok(!yaml.includes("\t"), "tab character");
    for (const n of UNIVERSAL) assert.ok(yaml.includes(n), `expected "${n}"`);
  });
  test(`${name}: workflow uses required actions, no deprecated ones`, () => {
    for (const n of PER_TEMPLATE_ACTIONS[name] || []) assert.ok(yaml.includes(n), `expected "${n}"`);
    for (const bad of FORBIDDEN) assert.ok(!yaml.includes(bad), `should not contain "${bad}"`);
  });
  test(`${name}: workflow meets the registry security contract`, () => {
    assert.doesNotThrow(() => validateWorkflowText(yaml, wf));
    const onStart = yaml.indexOf("on:\n");
    assert.notEqual(onStart, -1, "workflow trigger block is missing");
    const afterOn = yaml.slice(onStart + "on:\n".length);
    const nextTopLevel = afterOn.search(/^\S/m);
    const triggerBlock = nextTopLevel === -1 ? afterOn : afterOn.slice(0, nextTopLevel);
    const triggers = [...triggerBlock.matchAll(/^  ([\w-]+):/gm)].map((match) => match[1]).sort();
    assert.deepEqual(triggers, ["push", "workflow_dispatch"], `unexpected triggers: ${triggers.join(", ")}`);

    const permissions = Object.fromEntries(
      [...yaml.matchAll(/^  (contents|pages|id-token):\s+(\w+)$/gm)].map((match) => [match[1], match[2]]),
    );
    assert.deepEqual(permissions, { contents: "read" });
    const jobs = workflowJobBlocks(yaml);
    assert.ok(jobs.has("deploy"), "deploy job is missing");
    for (const [jobName, job] of jobs) {
      const writes = Object.fromEntries(
        [...job.matchAll(/^      (contents|pages|id-token):\s+(\w+)$/gm)]
          .map((match) => [match[1], match[2]]),
      );
      assert.deepEqual(
        writes,
        jobName === "deploy"
          ? { contents: "read", pages: "write", "id-token": "write" }
          : jobName === "build"
            ? { contents: "read", pages: "read" }
            : {},
        `${jobName} has unexpected job permissions`,
      );
    }
    assertRunnerJobsHaveTimeouts(yaml);

    const actionLines = yaml.match(/^\s*uses:\s+.+$/gm) || [];
    assert.ok(actionLines.length > 0, "no workflow actions found");
    for (const line of actionLines) {
      assert.match(line, /@[0-9a-f]{40}(?:\s+#\s+v[\w.-]+)?$/, `action is not SHA-pinned: ${line.trim()}`);
    }

    const checkoutStart = yaml.indexOf("uses: actions/checkout@");
    assert.notEqual(checkoutStart, -1, "actions/checkout is missing");
    const nextStep = yaml.indexOf("\n      - name:", checkoutStart);
    const checkoutStep = yaml.slice(checkoutStart, nextStep === -1 ? undefined : nextStep);
    assert.match(checkoutStep, /\n\s+with:\s*\n\s+persist-credentials:\s+false\b/, "checkout must disable persisted credentials");

    for (const block of workflowRunBlocks(yaml)) {
      assert.ok(!block.includes("${{"), "run directly interpolates a GitHub expression");
      for (const install of block.matchAll(/(?:^|\n)\s*((?:npm|pnpm|yarn|bun)\s+(?:install|ci)[^\n]*)/g)) {
        assert.match(install[1], /(?:--ignore-scripts|--enable-scripts=false)\b/, `install runs lifecycle scripts: ${install[1]}`);
      }
    }
  });
}

test("remote registries require immutable commit revisions", () => {
  assert.equal(
    assertFullCommitSha("0123456789abcdef0123456789abcdef01234567"),
    "0123456789abcdef0123456789abcdef01234567",
  );
  assert.throws(() => assertFullCommitSha("main"), /full 40-character commit SHA/);
  const root = mkdtempSync(join(tmpdir(), "ghp-registry-ref-"));
  try {
    const target = join(root, "site");
    assert.throws(
      () => stampTemplate({
        template: "astro",
        dir: target,
        base: "/",
        registry: "octocat/templates",
      }),
      /full 40-character commit SHA/,
    );
    assert.ok(!existsSync(target), "a rejected registry revision must not create the target");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("template metadata rejects code and markup injection", () => {
  assert.throws(
    () => computeReplacements({ repo: "octocat/site", siteName: '"><script>alert(1)</script>' }),
    /unsafe for template substitution/,
  );
  assert.throws(
    () => computeReplacements({ repo: "octocat/site", description: "line one\nline two" }),
    /unsafe for template substitution/,
  );
  assert.throws(
    () => computeReplacements({ repo: "../site" }),
    /valid GitHub repository component/,
  );
});

test("template paths cannot escape the registry root", () => {
  const root = mkdtempSync(join(tmpdir(), "ghp-path-containment-"));
  try {
    const target = join(root, "site");
    assert.throws(
      () => stampTemplate({ template: "../../scripts", dir: target, base: "/" }),
      /resolves outside/,
    );
    assert.ok(!existsSync(target), "a rejected template path must not create the target");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime rewriting rejects unknown template sentinels", () => {
  const root = mkdtempSync(join(tmpdir(), "ghp-unknown-sentinel-"));
  try {
    const file = join(root, "index.html");
    writeFileSync(file, "<title>__SITE_NMAE__</title>\n");
    assert.throws(
      () => rewriteTree(root, {}),
      /unknown sentinel __SITE_NMAE__/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("forced publication rejects destination symlinks without mutation", () => {
  const root = mkdtempSync(join(tmpdir(), "ghp-force-symlink-"));
  const external = mkdtempSync(join(tmpdir(), "ghp-force-external-"));
  try {
    const target = join(root, "site");
    mkdirSync(target);
    writeFileSync(join(external, "preserved.txt"), "preserved\n");
    symlinkSync(external, join(target, "linked"), "junction");
    assert.throws(
      () =>
        stampTemplate({
          template: "static-html",
          dir: target,
          repo: "octocat/site",
          force: true,
        }),
      /symbolic link/,
    );
    assert.equal(readFileSync(join(external, "preserved.txt"), "utf8"), "preserved\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});

test("CLI help and template listing are complete", () => {
  const script = join(ROOT, "scripts", "new-site.mjs");
  const help = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--registry-ref <sha>/);
  const list = spawnSync(process.execPath, [script, "--list"], { encoding: "utf8" });
  assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /skills-catalog/);
});

test("CLI failures return a nonzero exit and actionable output", () => {
  const script = join(ROOT, "scripts", "new-site.mjs");
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing <template>/);
});

test("CLI rejects options whose values are missing", () => {
  const script = join(ROOT, "scripts", "new-site.mjs");
  const result = spawnSync(
    process.execPath,
    [script, "skills-catalog", "--base", "/", "--dir", "--force"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Option --dir requires a value/);
});

test("CLI success reports the created directory, base path, and URL", () => {
  const root = mkdtempSync(join(tmpdir(), "ghp-cli-"));
  try {
    const target = join(root, "site");
    const script = join(ROOT, "scripts", "new-site.mjs");
    const result = spawnSync(
      process.execPath,
      [script, "skills-catalog", "--repo", "octocat/catalog", "--dir", target, "--default-branch", "trunk"],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Created Skills Catalog site/);
    assert.ok(result.stdout.includes(target), "CLI output must identify the target directory");
    assert.match(result.stdout, /base path:\s+\/catalog\//);
    assert.match(result.stdout, /site URL:\s+https:\/\/octocat\.github\.io\/catalog\//);
    assert.match(result.stdout, /repo's trunk branch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const skillsTemplate = join(TEMPLATES_DIR, "skills-catalog");
test("skills-catalog: source has no product-owner literals, unsafe root links, or dash glyphs", () => {
  for (const file of walk(skillsTemplate)) {
    const stat = lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), `${file} is a symlink`);
    if (!stat.isFile()) continue;
    const buf = readFileSync(file);
    if (buf.includes(0)) continue;
    const text = buf.toString("utf8");
    assert.doesNotMatch(text, /\bjongio\b|Jon Gallant/i, `${file} contains a product-owner literal`);
    assert.doesNotMatch(text, /[\u2013\u2014]/, `${file} contains an en dash or em dash`);
    if (/\.(?:astro|html|md)$/.test(file)) {
      assert.doesNotMatch(text, /\b(?:href|src)=["']\//, `${file} contains a root-relative link`);
    }
  }
});

// generator stamps each template clean (no leftover sentinels)
const work = mkdtempSync(join(tmpdir(), "ghp-validate-"));
try {
  for (const name of names) {
    test(`${name}: stamps with no leftover placeholders`, () => {
      const { dir } = stampTemplate({
        template: name,
        dir: join(work, name),
        repo: "octocat/demo-site",
        defaultBranch: "trunk",
      });
      for (const file of walk(dir)) {
        const buf = readFileSync(file);
        if (buf.includes(0)) continue;
        const text = buf.toString("utf8");
        for (const s of SENTINELS) assert.ok(!text.includes(s), `${file} still has ${s}`);
        assert.doesNotMatch(text, /__[A-Z][A-Z0-9_]+__/, `${file} has an unresolved sentinel`);
      }
      assert.match(
        readFileSync(join(dir, ".github", "workflows", "deploy.yml"), "utf8"),
        /branches:\s*\[trunk\]/,
      );
    });
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const site of [
  {
    label: "project site",
    repo: "octocat/agent-skills",
    expectedBase: "/agent-skills/",
    expectedUrl: "https://octocat.github.io/agent-skills/",
  },
  {
    label: "user site",
    repo: "octocat/octocat.github.io",
    expectedBase: "/",
    expectedUrl: "https://octocat.github.io/",
  },
]) {
  const target = mkdtempSync(join(tmpdir(), "ghp-skills-catalog-"));
  try {
    test(`skills-catalog: stamps a clean ${site.label} with custom identity`, () => {
      const { dir, replacements } = stampTemplate({
        template: "skills-catalog",
        dir: target,
        repo: site.repo,
        siteName: "Agent Skill Library",
        author: "Example Author",
        description: "A catalog for the example organization.",
        packageName: "agent-skill-library",
        marketplaceId: "example-marketplace",
        defaultBranch: "trunk",
        force: true,
      });
      assert.equal(replacements.__BASE_PATH__, site.expectedBase);
      assert.equal(replacements.__SITE_URL__, site.expectedUrl);
      assert.equal(replacements.__REPO_OWNER__, "octocat");
      assert.equal(replacements.__REPO_NAME__, site.repo.split("/")[1]);
      assert.equal(replacements.__DEFAULT_BRANCH__, "trunk");

      const config = readFileSync(join(dir, "astro.config.mjs"), "utf8");
      assert.ok(config.includes('site: "https://octocat.github.io"'));
      assert.ok(config.includes(`base: "${site.expectedBase}"`));
      assert.equal(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name, "agent-skill-library");

      const source = readFileSync(join(dir, "src", "pages", "about.astro"), "utf8");
      assert.ok(source.includes("Example Author"));
      assert.ok(source.includes("A catalog for the example organization."));
      assert.ok(source.includes("example-marketplace"));
      assert.ok(readFileSync(join(dir, ".github", "workflows", "deploy.yml"), "utf8").includes("branches: [trunk]"));
      assert.ok(readFileSync(join(dir, "src", "pages", "catalog", "[slug].astro"), "utf8").includes("/tree/trunk/"));
      assert.ok(readFileSync(join(dir, "README.md"), "utf8").includes("Push to `trunk`"));

      for (const file of walk(dir)) {
        const stat = lstatSync(file);
        assert.ok(!stat.isSymbolicLink(), `${file} is a symlink`);
        if (!stat.isFile()) continue;
        const buf = readFileSync(file);
        if (buf.includes(0)) continue;
        const text = buf.toString("utf8");
        assert.doesNotMatch(text, /__[A-Z][A-Z0-9_]+__/, `${file} has an unresolved sentinel`);
        assert.doesNotMatch(text, /\bjongio\b|Jon Gallant/i, `${file} contains a product-owner literal`);
      }
    });
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
}

// catalog builder: every template, sorted, with a non-empty features[]
const catalog = buildCatalog();
test("buildCatalog includes every template", () => {
  assert.equal(catalog.length, names.length);
});
test("buildCatalog is serializable and sorted by order", () => {
  const s = serializeCatalog(catalog);
  assert.equal(JSON.parse(s).length, names.length);
  const orders = catalog.map((t) => t.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});
test("every template documents features for the gallery", () => {
  for (const t of catalog) {
    assert.ok(Array.isArray(t.features) && t.features.length > 0, `${t.name} has no features[]`);
  }
});
test("site/templates.json is committed and in sync with the manifests", () => {
  const catalogFile = join(ROOT, "site", "templates.json");
  assert.ok(existsSync(catalogFile), "site/templates.json missing; run `node scripts/build-catalog.mjs`");
  const onDisk = readFileSync(catalogFile, "utf8");
  assert.equal(onDisk, serializeCatalog(buildCatalog()), "site/templates.json is stale; run `node scripts/build-catalog.mjs`");
});

// build-site assembler: a static-tier template stamps with the preview base and
// carries the GitHub source link (the static-copy path build-site publishes).
const swork = mkdtempSync(join(tmpdir(), "ghp-buildsite-"));
try {
  test("static preview stamps at a nested base with a source link", () => {
    const { dir } = stampTemplate({
      template: "static-html",
      dir: join(swork, "static-html"),
      repo: "jongio/gh-pages-templates",
      base: "/gh-pages-templates/preview/static-html/",
      force: true,
    });
    const html = readFileSync(join(dir, "index.html"), "utf8");
    assert.ok(html.includes("github.com/jongio/gh-pages-templates"), "missing source link");
    assert.ok(html.includes("theme-toggle"), "missing theme toggle");
  });
} finally {
  rmSync(swork, { recursive: true, force: true });
}

console.log(`\n${passed} checks passed`);
