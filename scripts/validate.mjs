#!/usr/bin/env node
// validate.mjs - CI gate for the registry. Validates every template's manifest
// and Pages deploy workflow, and that the generator stamps it with no leftover
// placeholders. No deps; Node 24+.  Run:  node scripts/validate.mjs

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
  registryCloneUrl,
  rewriteTree,
  stampTemplate,
} from "./new-site.mjs";
import { validateWorkflowText } from "./workflow-security.mjs";
import { dependencyInstallFor } from "./build-site.mjs";
import { buildCatalog, serializeCatalog } from "./build-catalog.mjs";
import { NPM_POLICY, validateTemplateDependencies } from "./template-dependencies.mjs";

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
function assertNotIgnored(path) {
  const ignored = spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", path], { cwd: ROOT });
  if (ignored.status === null || ignored.status === 128) return;
  assert.equal(ignored.status, 1, `${path} is ignored`);
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
console.log("gh-pages-templates validation");

const names = listTemplates();

test("at least 6 templates present", () => assert.ok(names.length >= 6, `found ${names.length}`));

test("repository npm runtime and release policies are enforced", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.engines?.node, ">=24.0.0");
  assert.equal(pkg.engines?.npm, ">=11.10.0");
  assert.equal(readFileSync(join(ROOT, ".npmrc"), "utf8").replace(/\r\n/g, "\n"), NPM_POLICY);
  assert.doesNotThrow(() =>
    validateTemplateDependencies(ROOT, {
      build: "node scripts/build-site.mjs",
      needsBuild: true,
      language: "JavaScript",
    }),
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
    /unsupported run command/,
  );
  assert.doesNotThrow(() =>
    validateWorkflowText(
      safe.replace(
        "run: npm ci --ignore-scripts --no-audit --no-fund",
        "run: |-\n          npm ci --ignore-scripts --no-audit --no-fund",
      ),
      "literal-block.yml",
    ),
  );
  const unsafeCases = [
    ["scalar permissions", safe.replace(/permissions:\r?\n/, "permissions: write-all\n"), /block mapping/],
    ["commented permission", safe.replace("contents: read", "contents: write # unsafe"), /unsafe permission/],
    ["duplicate top-level permission", safe.replace("  contents: read", "  contents: read\n  contents: read"), /duplicate permission/],
    ["duplicate job permission", safe.replace("      pages: read", "      pages: read\n      pages: read"), /duplicate permission/],
    ["quoted run", safe.replace("run: npm run build", "run: \"echo # ${{ github.ref }}\""), /interpolates workflow context/],
    ["folded run", safe.replace("run: npm run build", "run: >-\n          npm run build"), /folded run block/],
    ["comment-like run interpolation", safe.replace("run: npm run build", "run: echo tag #x ${{ github.ref }}"), /interpolates workflow context/],
    ["plain multiline run interpolation", safe.replace("run: npm run build", "run:\n          echo ${{ github.ref }}"), /interpolates workflow context/],
    ["top-level deployment permissions", safe.replace(/permissions:\r?\n  contents: read/, "permissions:\n  contents: read\n  pages: write\n  id-token: write"), /top-level permissions/],
    ["privileged run step", safe.replace("      - name: Deploy to GitHub Pages", "      - name: Exfiltrate\n        run: env\n      - name: Deploy to GitHub Pages"), /privileged job/],
    ["privileged shorthand run", safe.replace("      - name: Deploy to GitHub Pages", "      - run: env\n      - name: Deploy to GitHub Pages"), /privileged job/],
    ["privileged shorthand action", safe.replace("      - name: Deploy to GitHub Pages", "      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9\n      - name: Deploy to GitHub Pages"), /one deploy-pages step/],
    ["privileged environment variables", safe.replace("    environment:\n      name: github-pages", "    env:\n      TOKEN: ${{ github.token }}\n    environment:\n      name: github-pages"), /privileged job/],
    ["arbitrary build command", safe.replace("run: npm run build", "run: curl https://example.invalid"), /unsupported run command/],
    ["shell override", safe.replace("run: npm run build", "shell: bash -c '{0}; curl https://example.invalid'\n        run: npm run build"), /overrides the workflow shell/],
    ["case-variant checkout", safe.replace(/actions\/checkout@([a-f0-9]{40})/, "Actions/Checkout@$1").replace(/^\s*persist-credentials:\s*false\r?\n/m, ""), /disable checkout credentials/],
    ["duplicate checkout input", safe.replace("persist-credentials: false", "persist-credentials: false\n          persist-credentials: true"), /disable checkout credentials/],
    ["misnested checkout input", safe.replace("with:\n          persist-credentials: false", "env:\n          persist-credentials: false"), /disable checkout credentials/],
    ["block checkout input", safe.replace("with:\n          persist-credentials: false", "with: |-\n          persist-credentials: false"), /disable checkout credentials/],
    ["mutable npm install", safe.replace("npm ci --ignore-scripts", "npm install --ignore-scripts"), /unsupported run command/],
    ["yarn lifecycle install", safe.replace("run: npm run build", "run: yarn install"), /unsupported run command/],
    ["chained npm suppression", safe.replace("run: npm run build", "run: npm ci && echo --ignore-scripts"), /unsupported run command/],
    ["missing effective Pages permission", safe.replace(/^\s{6}pages:\s*read\r?\n/m, ""), /effective Pages access/],
    ["unapproved action", safe.replace(/actions\/checkout@([a-f0-9]{40})/, "octocat/checkout@$1"), /unapproved action/],
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
  assert.throws(
    () => validateWorkflowText(
      safe.replace(
        "run: npm ci --ignore-scripts --no-audit --no-fund",
        "run: npm ci --ignore-scripts --no-audit --no-fund\n          ; curl https://example.invalid",
      ),
      "plain-scalar-continuation.yml",
    ),
    /unsupported parsed run command/,
  );
  assert.throws(
    () => validateWorkflowText(
      safe.replace(
        "  build:\n",
        "  ? elevated\n  :\n    ? permissions\n    : write-all\n    steps:\n      - name: Exfiltrate\n        run: npm run build\n  build:\n",
      ),
      "explicit-mapping.yml",
    ),
    /unsupported jobs key elevated/,
  );
});

test("repository workflows use least-privilege credentials", () => {
  const deploy = readFileSync(join(ROOT, ".github", "workflows", "deploy.yml"), "utf8");
  assert.doesNotThrow(() => validateWorkflowText(deploy, ".github/workflows/deploy.yml"));

  const validate = readFileSync(join(ROOT, ".github", "workflows", "validate.yml"), "utf8");
  assert.match(validate, /^permissions:\r?\n  contents: read$/m);
  assert.match(validate, /^    timeout-minutes:\s*\d+$/m);
  assert.match(
    validate,
    /uses: actions\/checkout@[0-9a-f]{40}\s+#\s+v[\w.-]+\r?\n\s+with:\r?\n\s+persist-credentials: false/,
  );
});

test("preview builds use locked dependency installs", () => {
  const npm = dependencyInstallFor({ language: "JavaScript" });
  assert.match(npm.command, /^npm(?:\.cmd)?$/);
  assert.deepEqual(npm.args, ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"]);
  assert.deepEqual(npm.env, {});

  const bundler = dependencyInstallFor({ language: "Ruby" });
  assert.match(bundler.command, /^bundle(?:\.cmd)?$/);
  assert.deepEqual(bundler.args, ["install"]);
  assert.deepEqual(bundler.env, { BUNDLE_FROZEN: "true" });
});

test("template dependency policy rejects untrusted sources and lifecycle scripts", () => {
  const source = join(TEMPLATES_DIR, "skills-catalog");
  const root = mkdtempSync(join(tmpdir(), "ghp-dependency-policy-"));
  try {
    for (const file of ["package.json", "package-lock.json", ".npmrc"]) {
      writeFileSync(join(root, file), readFileSync(join(source, file)));
    }
    const manifest = readManifest(source);
    assert.doesNotThrow(() => validateTemplateDependencies(root, manifest));

    const lockFile = join(root, "package-lock.json");
    const lock = readFileSync(lockFile, "utf8");
    writeFileSync(lockFile, lock.replace("https://registry.npmjs.org/", "https://packages.invalid/"));
    assert.throws(() => validateTemplateDependencies(root, manifest), /non-registry dependency/);
    writeFileSync(lockFile, lock);

    const packageFile = join(root, "package.json");
    const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
    pkg.scripts.postinstall = "node install.js";
    writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
    assert.throws(() => validateTemplateDependencies(root, manifest), /forbidden lifecycle script/);
    delete pkg.scripts.postinstall;
    pkg.scripts.build = "node exfiltrate.js";
    writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
    assert.throws(() => validateTemplateDependencies(root, manifest), /unapproved build script/);
  } finally {
    rmSync(root, { recursive: true, force: true });
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

  if (m.needsBuild) {
    test(`${name}: dependency sources, locks, runtimes, and scripts meet policy`, () => {
      assert.doesNotThrow(() => validateTemplateDependencies(tdir, m));
      const lockName = m.language === "Ruby" ? "Gemfile.lock" : "package-lock.json";
      const lockPath = join("templates", name, lockName).replaceAll("\\", "/");
      assertNotIgnored(lockPath);
    });
  }

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
  });
}

test("remote registries require immutable commit revisions", () => {
  assert.equal(
    assertFullCommitSha("0123456789abcdef0123456789abcdef01234567"),
    "0123456789abcdef0123456789abcdef01234567",
  );
  assert.throws(() => assertFullCommitSha("main"), /full 40-character commit SHA/);
  assert.equal(
    registryCloneUrl("jongio/gh-pages-templates"),
    "https://github.com/jongio/gh-pages-templates.git",
  );
  assert.equal(
    registryCloneUrl("https://github.com/jongio/gh-pages-templates.git"),
    "https://github.com/jongio/gh-pages-templates.git",
  );
  assert.throws(() => registryCloneUrl("octocat/templates"), /must be jongio\/gh-pages-templates/);
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
    assert.match(result.stdout, /npm ci --ignore-scripts --no-audit --no-fund/);
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
