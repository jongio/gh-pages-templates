#!/usr/bin/env node
// build-site.mjs — assemble the browsable Pages site into ./site:
//   1. copy the gallery shell (gallery/ → site/)
//   2. build a LIVE PREVIEW of each template by stamping it through the
//      generator with the preview base path, building it, and copying the
//      output into site/preview/<name>/
//   3. write site/templates.json (the catalog, annotated with which previews built)
//
// The gallery itself uses relative links, so it's base-path-proof. Previews need
// the real base, taken from PAGES_BASE (e.g. "/gh-pages-templates/"); defaults to
// "/" for local runs.  Usage:  node scripts/build-site.mjs
//
// Previews that need a toolchain that isn't installed (e.g. Ruby for Jekyll) are
// skipped gracefully and shown as "No preview" in the gallery.

import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync, readdirSync, mkdtempSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { stampTemplate, normalizeBase } from "./new-site.mjs";
import { buildCatalog } from "./build-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const GALLERY = join(ROOT, "gallery");
const SITE = join(ROOT, "site");
const REPO = process.env.PAGES_REPO || "jongio/gh-pages-templates";
const PAGES_BASE = normalizeBase(process.env.PAGES_BASE || "/");

const IS_WIN = process.platform === "win32";
const NPM = IS_WIN ? "npm.cmd" : "npm";
const BUNDLE = IS_WIN ? "bundle.cmd" : "bundle";

function run(cmd, args, cwd, extraEnv = {}) {
  const opts = { cwd, env: { ...process.env, ...extraEnv }, stdio: "pipe", encoding: "utf8" };
  if (IS_WIN) {
    // Windows needs a shell to resolve npm.cmd/bundle.cmd. Pass a single command
    // string (no args array) to avoid the DEP0190 shell+args warning. Every arg
    // here is static and trusted (no user input), so concatenation is safe.
    return spawnSync([cmd, ...args].join(" "), { ...opts, shell: true });
  }
  return spawnSync(cmd, args, opts);
}

function copyDir(src, dest, { exclude = [] } = {}) {
  cpSync(src, dest, {
    recursive: true,
    filter: (s) => !exclude.includes(basename(s)),
  });
}

/** Build one template's preview into site/preview/<name>. Returns true on success. */
function buildPreview(template, manifest) {
  const name = template;
  const previewBase = `${PAGES_BASE}preview/${name}/`;
  const work = mkdtempSync(join(tmpdir(), `ghp-prev-${name}-`));
  const out = join(SITE, "preview", name);

  try {
    // Skip Jekyll when Ruby/Bundler isn't available (CI installs it).
    if (manifest.language === "Ruby") {
      const probe = run(BUNDLE, ["--version"], work);
      if (probe.status !== 0) {
        console.log(`  • ${name}: skipped (no Bundler/Ruby for the Jekyll preview)`);
        return false;
      }
    }

    const { dir } = stampTemplate({ template: name, dir: join(work, "site"), repo: REPO, base: previewBase, siteName: manifest.title, force: true });

    if (!manifest.needsBuild) {
      // Zero-build static: publish the source as-is (minus dev/CI files).
      mkdirSync(out, { recursive: true });
      copyDir(dir, out, { exclude: [".github", "README.md", ".gitignore"] });
      console.log(`  • ${name}: preview built (static copy)`);
      return true;
    }

    if (manifest.language === "Ruby") {
      let r = run(BUNDLE, ["install"], dir);
      if (r.status !== 0) { console.warn(`  • ${name}: bundle install failed\n${r.stderr || r.stdout}`); return false; }
      r = run(BUNDLE, ["exec", "jekyll", "build"], dir);
      if (r.status !== 0) { console.warn(`  • ${name}: jekyll build failed\n${r.stderr || r.stdout}`); return false; }
    } else {
      let r = run(NPM, ["install", "--no-audit", "--no-fund", "--loglevel=error"], dir);
      if (r.status !== 0) { console.warn(`  • ${name}: npm install failed\n${r.stderr || r.stdout}`); return false; }
      // Eleventy reads its base from PATH_PREFIX at build time.
      const extraEnv = name === "eleventy" ? { PATH_PREFIX: previewBase } : {};
      r = run(NPM, ["run", "build"], dir, extraEnv);
      if (r.status !== 0) { console.warn(`  • ${name}: build failed\n${r.stderr || r.stdout}`); return false; }
    }

    const built = join(dir, manifest.output);
    if (!existsSync(built)) { console.warn(`  • ${name}: expected output ${manifest.output} not found`); return false; }
    mkdirSync(out, { recursive: true });
    copyDir(built, out);
    console.log(`  • ${name}: preview built (${manifest.output})`);
    return true;
  } catch (err) {
    console.warn(`  • ${name}: preview error — ${err.message}`);
    return false;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function main() {
  console.log(`Building site (base ${PAGES_BASE}, repo ${REPO})`);

  // 1. fresh site/ from the gallery shell
  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(SITE, { recursive: true });
  copyDir(GALLERY, SITE);

  // 2. live previews
  console.log("Previews:");
  const catalog = buildCatalog();
  const annotated = catalog.map((t) => ({ ...t, preview: buildPreview(t.name, t) }));

  // 3. catalog the gallery reads
  writeFileSync(join(SITE, "templates.json"), JSON.stringify(annotated, null, 2) + "\n");

  const built = annotated.filter((t) => t.preview).map((t) => t.name);
  console.log(`\nsite/ ready — ${catalog.length} templates, ${built.length} live previews: ${built.join(", ") || "(none)"}`);
}

main();
