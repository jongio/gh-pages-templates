#!/usr/bin/env node
// new-site.mjs - scaffold a GitHub Pages site from a template.
//
//   node scripts/new-site.mjs <template> --repo <owner/name> [options]
//
// It copies the chosen template, then injects the correct base path everywhere
// the framework needs it (config, workflow env, links) so the site works at a
// project URL (https://USER.github.io/REPO/) or a user URL (https://USER.github.io/).
//
// Options:
//   --repo <owner/name>   Target GitHub repo. Drives the base path and URLs.
//   --base </path/>       Override the base path (e.g. "/my-repo/" or "/").
//   --dir <path>          Output directory (default: ./<repo-name or template>).
//   --site-name <title>   Human title (default: derived from the repo name).
//   --author <name>       Author display name (default: repository owner).
//   --description <text>  Site description (default: catalog description).
//   --package-name <id>   Package identifier (default: repository name).
//   --marketplace-id <id> Marketplace identifier (default: owner-repository).
//   --default-branch <id>  Repository default branch (default: main).
//   --registry <owner/repo>  Fetch the template from a remote registry repo.
//   --registry-ref <sha>     Required full commit SHA for a remote registry.
//   --force               Write into a non-empty directory.
//   --list                List available templates and exit.
//   --help                Show this help.
//
// Either --repo or --base is required (base path correctness is the point).

import { existsSync, readdirSync, readFileSync, writeFileSync, lstatSync, cpSync, mkdirSync, rmSync, mkdtempSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve, dirname, basename, relative, isAbsolute, parse, posix, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { validateWorkflowTree } from "./workflow-security.mjs";
import { validateTemplateDependencies } from "./template-dependencies.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, "..", "templates");
const TRUSTED_REGISTRY = "jongio/gh-pages-templates";

// Files/dirs never copied into a stamped site.
const SKIP_ENTRIES = new Set([
  "node_modules",
  "dist",
  "_site",
  ".git",
  ".cache",
  ".jekyll-cache",
  "template.json",
  "spec.md",
]);

// Sentinels replaced during stamping. Replacement is a single pass over a
// combined regex so an injected value (e.g. a --site-name that happens to
// contain "__BASE_PATH__") is never re-scanned and substituted again.
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
const SENTINEL_RE = new RegExp(SENTINELS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
const SENTINEL_SET = new Set(SENTINELS);
const ANY_SENTINEL_RE = /__[A-Z][A-Z0-9_]+__/g;
const FULL_COMMIT_SHA_RE = /^[0-9a-f]{40}$/i;
const GIT_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** Normalize a base path to a leading+trailing-slash form ("/", "/repo/"). */
export function normalizeBase(input) {
  if (!input || input === "/") return "/";
  let b = String(input).trim();
  if (!b.startsWith("/")) b = "/" + b;
  if (!b.endsWith("/")) b = b + "/";
  return b.replace(/\/{2,}/g, "/");
}

/** Title-case a repo/dir slug: "my-cool-site" -> "My Cool Site". */
export function titleize(slug) {
  return String(slug)
    .replace(/\.github\.io$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "My Site";
}

/** Sanitize a string into a valid npm package name. */
export function pkgNameOf(slug) {
  return (
    String(slug)
      .toLowerCase()
      .replace(/[^a-z0-9-_.]/g, "-")
      .replace(/^[-_.]+/, "")
      .replace(/[-_.]+$/, "") || "my-site"
  );
}

function safeTemplateText(value, label, maximumLength) {
  const text = String(value);
  if (!text || text.length > maximumLength || !/^[\p{L}\p{N} .,'()/_+!?-]+$/u.test(text)) {
    throw new Error(`${label} contains characters or a length that is unsafe for template substitution.`);
  }
  return text;
}

function safeRepoComponent(value, label) {
  const component = String(value);
  if (
    component.length > 100 ||
    !/^[A-Za-z0-9_.-]+$/.test(component) ||
    component === "." ||
    component === ".."
  ) {
    throw new Error(`${label} is not a valid GitHub repository component.`);
  }

  return component;
}

function safeDefaultBranch(value) {
  const branch = String(value || "main").trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(branch)) {
    throw new Error("--default-branch must be a lowercase GitHub branch identifier.");
  }
  return branch;
}

function validateBasePath(basePath) {
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(basePath) || basePath.split("/").includes("..")) {
    throw new Error("--base contains characters or traversal segments that are unsafe for template substitution.");
  }
  return basePath;
}

export function assertFullCommitSha(ref) {
  if (!FULL_COMMIT_SHA_RE.test(String(ref || ""))) {
    throw new Error(`Registry revision must be a full 40-character commit SHA, got "${ref || ""}".`);
  }
  return String(ref).toLowerCase();
}

export function resolveInside(root, child, label = "Path") {
  const resolvedRoot = resolve(root);
  const resolvedChild = resolve(resolvedRoot, child);
  const rel = relative(resolvedRoot, resolvedChild);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} resolves outside ${resolvedRoot}: ${child}`);
  }
  return resolvedChild;
}

/**
 * Compute every sentinel replacement from the user's inputs.
 * @param {{
 *   repo?: string,
 *   base?: string,
 *   siteName?: string,
 *   author?: string,
 *   description?: string,
 *   packageName?: string,
 *   marketplaceId?: string,
 *   dir?: string
 * }} opts
 */
export function computeReplacements({
  repo,
  base,
  siteName,
  author,
  description,
  packageName,
  marketplaceId,
  defaultBranch,
  dir,
} = {}) {
  let owner = "USERNAME";
  let repoName = dir ? basename(dir) : "my-site";

  if (repo) {
    const m = String(repo).trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
    const parts = m.split("/").filter(Boolean);
    if (parts.length !== 2) throw new Error(`--repo must be "owner/name", got "${repo}"`);
    owner = safeRepoComponent(parts[0], "Repository owner");
    repoName = safeRepoComponent(parts[1], "Repository name");
  }

  const isUserSite = repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`;

  let basePath;
  if (base != null && base !== "") basePath = validateBasePath(normalizeBase(base));
  else if (repo) basePath = isUserSite ? "/" : `/${repoName}/`;
  else throw new Error("Provide --repo <owner/name> or --base </path/> so the base path can be set.");

  const baseUrl = basePath === "/" ? "" : basePath.replace(/\/$/, ""); // "/repo" or ""
  const siteOrigin = `https://${owner.toLowerCase()}.github.io`;
  const siteUrl = basePath === "/" ? `${siteOrigin}/` : `${siteOrigin}${basePath}`;
  const title = safeTemplateText(siteName || titleize(repoName), "--site-name", 200);
  const safeDescription = description
    ? safeTemplateText(description, "--description", 1000)
    : `${title} is a searchable catalog of reusable agent skills from ${owner}/${repoName}.`;
  const safeAuthor = safeTemplateText(author || owner, "--author", 200);
  const packageId = pkgNameOf(packageName || repoName);
  const marketplace = pkgNameOf(marketplaceId || `${owner}-${repoName}`);

  return {
    __SITE_NAME__: title,
    __SITE_DESCRIPTION__: safeDescription,
    __SITE_URL__: siteUrl,
    __SITE_ORIGIN__: siteOrigin,
    __BASE_PATH__: basePath,
    __BASE_URL__: baseUrl,
    __REPO_SLUG__: `${owner}/${repoName}`,
    __REPO_OWNER__: owner,
    __REPO_NAME__: repoName,
    __AUTHOR_NAME__: safeAuthor,
    __PKG_NAME__: packageId,
    __MARKETPLACE_ID__: marketplace,
    __DEFAULT_BRANCH__: safeDefaultBranch(defaultBranch),
  };
}

/** True if the buffer looks like binary (has a NUL in the first 8 KB). */
function looksBinary(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Replace every sentinel in a single pass (injected values are never re-scanned). */
export function applyReplacements(text, replacements) {
  return text.replace(SENTINEL_RE, (m) => (m in replacements ? replacements[m] : m));
}

/** List bundled template names (folders with a template.json). */
export function listTemplates(dir = TEMPLATES_DIR) {
  if (!existsSync(dir)) return [];
  if (lstatSync(dir).isSymbolicLink() || !lstatSync(dir).isDirectory()) {
    throw new Error(`Templates root ${dir} must be a real directory, not a symbolic link.`);
  }
  return readdirSync(dir)
    .filter((name) => {
      const templateDir = join(dir, name);
      const manifest = join(templateDir, "template.json");
      return (
        existsSync(manifest) &&
        lstatSync(templateDir).isDirectory() &&
        !lstatSync(templateDir).isSymbolicLink() &&
        !lstatSync(manifest).isSymbolicLink()
      );
    })
    .sort((a, b) => {
      const oa = readManifest(join(dir, a)).order ?? 99;
      const ob = readManifest(join(dir, b)).order ?? 99;
      return oa - ob || a.localeCompare(b);
    });
}

export function readManifest(templateDir) {
  const file = join(templateDir, "template.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Invalid template manifest ${file}: ${error.message}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`Invalid template manifest ${file}: expected an object.`);
  }
  for (const field of ["name", "title", "tagline"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
      throw new Error(`Invalid template manifest ${file}: ${field} must be a non-empty string.`);
    }
  }
  if (manifest.name !== basename(templateDir)) {
    throw new Error(`Invalid template manifest ${file}: name must match its directory.`);
  }
  if (
    typeof manifest.output !== "string" ||
    !manifest.output ||
    manifest.output.includes("\0") ||
    manifest.output.includes("\\") ||
    posix.isAbsolute(manifest.output) ||
    win32.isAbsolute(manifest.output) ||
    manifest.output.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`Invalid template manifest ${file}: output must be a portable relative path inside the template.`);
  }
  return manifest;
}

// ---------------------------------------------------------------------------
// Filesystem operations
// ---------------------------------------------------------------------------

function copyTemplate(srcDir, destDir) {
  assertNoSymlinks(srcDir);
  cpSync(srcDir, destDir, {
    recursive: true,
    force: true,
    filter: (src) => !SKIP_ENTRIES.has(basename(src)),
  });
}

export function assertNoSymlinks(root, label = "Template") {
  const stack = [resolve(root)];
  while (stack.length) {
    const current = stack.pop();
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`${label} contains a symbolic link: ${current}`);
    if (!stat.isDirectory()) continue;
    for (const entry of readdirSync(current)) stack.push(join(current, entry));
  }
}

function publishStage(stage, destDir, force) {
  const parent = dirname(destDir);
  mkdirSync(parent, { recursive: true });
  const publish = mkdtempSync(join(parent, `.${basename(destDir)}.publish-`));
  const backup = join(parent, `.${basename(destDir)}.backup-${randomUUID()}`);
  const hadDestination = existsSync(destDir);
  let backedUp = false;
  try {
    if (hadDestination) assertNoSymlinks(destDir);
    if (hadDestination && force) cpSync(destDir, publish, { recursive: true, force: true });
    cpSync(stage, publish, { recursive: true, force: true });
    if (hadDestination) {
      renameSync(destDir, backup);
      backedUp = true;
    }

    renameSync(publish, destDir);
    if (backedUp) rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    rmSync(publish, { recursive: true, force: true });
    if (backedUp && !existsSync(destDir)) renameSync(backup, destDir);
    throw error;
  }
}

export function assertSafeDestination(destination) {
  const resolved = resolve(destination);
  if (resolved === parse(resolved).root) {
    throw new Error(`Refusing to publish a site to filesystem root ${resolved}.`);
  }
  return resolved;
}

/** Rewrite sentinels in every regular text file under dir. */
export function rewriteTree(dir, replacements) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = lstatSync(full);
    if (st.isSymbolicLink()) throw new Error(`Template contains a symbolic link: ${full}`);
    if (st.isDirectory()) {
      rewriteTree(full, replacements);
    } else if (st.isFile()) {
      const buf = readFileSync(full);
      if (looksBinary(buf)) continue;
      const text = buf.toString("utf8");
      const unknown = [...text.matchAll(ANY_SENTINEL_RE)]
        .map(([sentinel]) => sentinel)
        .filter((sentinel) => !SENTINEL_SET.has(sentinel));
      if (unknown.length > 0) {
        throw new Error(`Template contains unknown sentinel ${unknown[0]}: ${full}`);
      }
      const next = applyReplacements(text, replacements);
      if (next !== text) writeFileSync(full, next);
    }
  }
}

/** Build the canonical clone URL for the trusted public template registry. */
export function registryCloneUrl(registry) {
  const value = String(registry ?? "").trim();
  const repository = value
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  if (repository.toLowerCase() !== TRUSTED_REGISTRY) {
    throw new Error(`Remote registry must be ${TRUSTED_REGISTRY}.`);
  }
  return `https://github.com/${TRUSTED_REGISTRY}.git`;
}

/** Fetch a template subdir from a remote registry into a temp dir; returns its path. */
function fetchFromRegistry(registry, template, registryRef) {
  const ref = assertFullCommitSha(registryRef);
  const tmp = mkdtempSync(join(tmpdir(), "ghp-registry-"));
  const url = registryCloneUrl(registry);
  try {
    execFileSync("git", ["init", "--quiet", tmp], { stdio: "pipe", timeout: GIT_TIMEOUT_MS });
    execFileSync("git", ["remote", "add", "origin", url], {
      cwd: tmp,
      stdio: "pipe",
      timeout: GIT_TIMEOUT_MS,
    });
    execFileSync("git", ["fetch", "--quiet", "--depth", "1", "origin", ref], {
      cwd: tmp,
      stdio: "pipe",
      timeout: GIT_TIMEOUT_MS,
    });
    execFileSync("git", ["checkout", "--quiet", "--detach", ref], {
      cwd: tmp,
      stdio: "pipe",
      timeout: GIT_TIMEOUT_MS,
    });
    const actual = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: tmp,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: GIT_TIMEOUT_MS,
    }).toString().trim().toLowerCase();
    if (actual !== ref) throw new Error(`Registry commit mismatch: expected ${ref}, checked out ${actual}.`);
    assertNoSymlinks(tmp);
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true });
    const detail = err.stderr ? err.stderr.toString().trim() : err.message;
    throw new Error(`Failed to clone registry ${registry}: ${detail}`);
  }
  const sub = resolveInside(tmp, join("templates", template), "Template path");
  if (!existsSync(sub)) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(`Template "${template}" not found in registry ${registry} (expected templates/${template}).`);
  }
  return { dir: sub, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

/**
 * Stamp a template into a target directory.
 * @returns {{ dir: string, replacements: object, manifest: object }}
 */
export function stampTemplate({
  template,
  dir,
  repo,
  base,
  siteName,
  author,
  description,
  packageName,
  marketplaceId,
  defaultBranch,
  registry,
  registryRef,
  force = false,
} = {}) {
  let srcDir = resolveInside(TEMPLATES_DIR, template, "Template path");
  let cleanup = null;

  if (registry) {
    const fetched = fetchFromRegistry(registry, template, registryRef);
    srcDir = fetched.dir;
    cleanup = fetched.cleanup;
  }
  try {
    if (!existsSync(join(srcDir, "template.json"))) {
      const avail = listTemplates().join(", ") || "(none)";
      throw new Error(`Unknown template "${template}". Available: ${avail}`);
    }

    const manifest = readManifest(srcDir);
    const replacements = computeReplacements({
      repo,
      base,
      siteName,
      author,
      description,
      packageName,
      marketplaceId,
      defaultBranch,
      dir,
    });
    const destDir = assertSafeDestination(dir || replacements.__PKG_NAME__);

    if (existsSync(destDir) && readdirSync(destDir).length > 0 && !force) {
      throw new Error(`Target ${destDir} is not empty. Use --force to write into it.`);
    }
    const stage = mkdtempSync(join(tmpdir(), "ghp-stage-"));
    try {
      copyTemplate(srcDir, stage);
      rewriteTree(stage, replacements);
      validateWorkflowTree(stage);
      validateTemplateDependencies(stage, manifest);
      publishStage(stage, destDir, force);
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }

    return { dir: destDir, replacements, manifest };
  } finally {
    if (cleanup) cleanup();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const VALUE_OPTIONS = new Set([
  "author",
  "base",
  "description",
  "default-branch",
  "dir",
  "marketplace-id",
  "package-name",
  "registry",
  "registry-ref",
  "repo",
  "site-name",
]);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--list") args.list = true;
    else if (a === "--force") args.force = true;
    else if (a.startsWith("--")) {
      const name = a.slice(2);
      if (!VALUE_OPTIONS.has(name)) throw new Error(`Unknown option ${a}.`);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Option ${a} requires a value.`);
      }
      args[name] = value;
      i++;
    }
    else args._.push(a);
  }
  return args;
}

const HELP = `
create-gh-pages-site - scaffold a GitHub Pages site from a template.

Usage:
  node scripts/new-site.mjs <template> --repo <owner/name> [options]

Templates: ${listTemplates().join(", ") || "(none found)"}

Options:
  --repo <owner/name>      Target GitHub repo (drives base path + URLs)
  --base </path/>          Override base path (e.g. "/my-repo/" or "/")
  --dir <path>             Output directory (default: ./<repo-name>)
  --site-name <title>      Human title (default: from repo name)
  --author <name>          Author display name (default: repository owner)
  --description <text>     Site description (default: catalog description)
  --default-branch <id>    Repository default branch (default: main)
  --package-name <id>      Package identifier (default: repository name)
  --marketplace-id <id>    Marketplace identifier (default: owner-repository)
  --registry <owner/repo>  Fetch from the trusted ${TRUSTED_REGISTRY} registry
  --registry-ref <sha>     Required full commit SHA for a remote registry
  --force                  Write into a non-empty directory
  --list                   List templates and exit
  --help                   Show this help

Examples:
  node scripts/new-site.mjs astro --repo octocat/my-astro-site
  node scripts/new-site.mjs react-vite --repo octocat/dashboard --site-name "Dashboard"
  node scripts/new-site.mjs static-html --base / --dir ./site   # user site / local
`;

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args.list) {
    for (const name of listTemplates()) {
      const m = readManifest(join(TEMPLATES_DIR, name));
      console.log(`  ${name.padEnd(14)} ${m.tagline}`);
    }
    return;
  }

  const template = args._[0];
  if (!template) {
    console.error("Error: missing <template>.\n" + HELP);
    process.exit(1);
  }

  try {
    const { dir, replacements, manifest } = stampTemplate({
      template,
      dir: args.dir,
      repo: args.repo,
      base: args.base,
      siteName: args["site-name"],
      author: args.author,
      description: args.description,
      defaultBranch: args["default-branch"],
      packageName: args["package-name"],
      marketplaceId: args["marketplace-id"],
      registry: args.registry,
      registryRef: args["registry-ref"],
      force: args.force,
    });

    console.log(`\n✓ Created ${manifest.title} site in ${dir}`);
    console.log(`  base path: ${replacements.__BASE_PATH__}`);
    console.log(`  site URL:  ${replacements.__SITE_URL__}\n`);
    if (args.registry) {
      console.warn(`  Security: review trusted registry commit ${args["registry-ref"]} before running build commands.\n`);
    }
    console.log("Next steps:");
    let step = 1;
    if (manifest.needsBuild) {
      if (manifest.language === "Ruby") {
        console.log(`  ${step++}. cd ${dir} && bundle install   # uses the committed Gemfile.lock`);
      } else {
        console.log(`  ${step++}. cd ${dir} && npm ci --ignore-scripts --no-audit --no-fund && npm run build`);
      }
    }
    console.log(`  ${step++}. Commit and push to the repo's ${replacements.__DEFAULT_BRANCH__} branch.`);
    console.log(`  ${step++}. Settings > Pages > Source > "GitHub Actions".`);
    console.log(`  ${step++}. The deploy workflow publishes on push; the URL appears in the Actions run.\n`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
