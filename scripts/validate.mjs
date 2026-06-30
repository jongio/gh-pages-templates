#!/usr/bin/env node
// validate.mjs — CI gate for the registry. Validates every template's manifest
// and Pages deploy workflow, and that the generator stamps it with no leftover
// placeholders. No deps; Node 18+.  Run:  node scripts/validate.mjs

import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { listTemplates, readManifest, stampTemplate } from "./new-site.mjs";
import { buildCatalog, serializeCatalog } from "./build-catalog.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_DIR = join(ROOT, "templates");

const TIERS = new Set(["static", "ssg", "spa", "data", "native"]);
const REQUIRED_FIELDS = ["name", "title", "tagline", "description", "framework", "tier", "language", "needsBuild", "output", "basePathMechanism", "deploy", "tags", "features", "order"];
const SENTINELS = ["__SITE_NAME__", "__SITE_URL__", "__SITE_ORIGIN__", "__BASE_PATH__", "__BASE_URL__", "__REPO_SLUG__", "__PKG_NAME__"];

const UNIVERSAL = ["permissions:", "pages: write", "id-token: write", "concurrency:", "group: pages", "actions/deploy-pages@", "name: github-pages"];
const FORBIDDEN = ["peaceiris/actions-gh-pages", "actions/upload-artifact@", "actions/deploy-pages@v3"];
const PER_TEMPLATE_ACTIONS = {
  "static-html": ["actions/configure-pages@", "actions/upload-pages-artifact@"],
  "astro": ["withastro/action@"],
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
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(abs)); else out.push(abs);
  }
  return out;
}

console.log("gh-pages-templates validation");

const names = listTemplates();

test("at least 5 templates present", () => assert.ok(names.length >= 5, `found ${names.length}`));

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
  const yaml = existsSync(wf) ? readFileSync(wf, "utf8") : "";
  test(`${name}: workflow has required Pages config, no tabs`, () => {
    assert.ok(!yaml.includes("\t"), "tab character");
    for (const n of UNIVERSAL) assert.ok(yaml.includes(n), `expected "${n}"`);
  });
  test(`${name}: workflow uses required actions, no deprecated ones`, () => {
    for (const n of PER_TEMPLATE_ACTIONS[name] || []) assert.ok(yaml.includes(n), `expected "${n}"`);
    for (const bad of FORBIDDEN) assert.ok(!yaml.includes(bad), `should not contain "${bad}"`);
  });
}

// generator stamps each template clean (no leftover sentinels)
const work = mkdtempSync(join(tmpdir(), "ghp-validate-"));
try {
  for (const name of names) {
    test(`${name}: stamps with no leftover placeholders`, () => {
      const { dir } = stampTemplate({ template: name, dir: join(work, name), repo: "octocat/demo-site" });
      for (const file of walk(dir)) {
        const buf = readFileSync(file);
        if (buf.includes(0)) continue;
        const text = buf.toString("utf8");
        for (const s of SENTINELS) assert.ok(!text.includes(s), `${file} still has ${s}`);
      }
    });
  }
} finally {
  rmSync(work, { recursive: true, force: true });
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
  assert.ok(existsSync(catalogFile), "site/templates.json missing — run `node scripts/build-catalog.mjs`");
  const onDisk = readFileSync(catalogFile, "utf8");
  assert.equal(onDisk, serializeCatalog(buildCatalog()), "site/templates.json is stale — run `node scripts/build-catalog.mjs`");
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
