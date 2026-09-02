import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export const NPM_POLICY = "engine-strict=true\nmin-release-age=3\n";
const ALLOWED_BUILD_SCRIPTS = new Set([
  "astro build",
  "eleventy",
  "node scripts/build-site.mjs",
  "vite build",
]);

function displayPath(file) {
  return relative(process.cwd(), file) || file;
}

function readRequired(file) {
  if (!existsSync(file)) throw new Error(`Missing dependency file ${displayPath(file)}.`);
  return readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function parseJson(file) {
  try {
    return JSON.parse(readRequired(file));
  } catch (error) {
    throw new Error(`Invalid JSON in ${displayPath(file)}: ${error.message}`);
  }
}

function assertSameRecord(actual = {}, expected = {}, label) {
  const actualEntries = Object.entries(actual).sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) => left.localeCompare(right));
  if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
    throw new Error(`${label} does not match package.json.`);
  }
}

function validateScriptApprovals(pkg, packages, file) {
  const lifecycleScripts = ["preinstall", "install", "postinstall", "prepare"];
  for (const script of lifecycleScripts) {
    if (pkg.scripts?.[script]) {
      throw new Error(`${displayPath(file)} declares forbidden lifecycle script ${script}.`);
    }
  }

  for (const [approval, enabled] of Object.entries(pkg.allowScripts ?? {})) {
    const separator = approval.lastIndexOf("@");
    if (separator <= 0 || enabled !== true) {
      throw new Error(`${displayPath(file)} has invalid allowScripts entry ${approval}.`);
    }
    const dependency = approval.slice(0, separator);
    const version = approval.slice(separator + 1);
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error(`${displayPath(file)} has unpinned allowScripts entry ${approval}.`);
    }
    if (packages[`node_modules/${dependency}`]?.version !== version) {
      throw new Error(`${displayPath(file)} approves ${approval}, which is absent from the lockfile.`);
    }
  }
}

function validateNpmTemplate(root, manifest) {
  const packageFile = join(root, "package.json");
  const lockFile = join(root, "package-lock.json");
  const pkg = parseJson(packageFile);
  const lock = parseJson(lockFile);

  if (pkg.engines?.node !== ">=24.0.0" || pkg.engines?.npm !== ">=11.10.0") {
    throw new Error(`${displayPath(packageFile)} has an unsupported Node or npm policy.`);
  }
  if (readRequired(join(root, ".npmrc")) !== NPM_POLICY) {
    throw new Error(`${displayPath(join(root, ".npmrc"))} has an invalid npm policy.`);
  }
  if (lock.lockfileVersion !== 3 || !lock.packages?.[""]) {
    throw new Error(`${displayPath(lockFile)} is not an npm lockfile v3.`);
  }
  if (
    !ALLOWED_BUILD_SCRIPTS.has(manifest.build) ||
    pkg.scripts?.build !== manifest.build ||
    pkg.scripts?.prebuild ||
    (pkg.scripts?.postbuild && pkg.scripts.postbuild !== "node copy-404.mjs")
  ) {
    throw new Error(`${displayPath(packageFile)} has an unapproved build script.`);
  }

  assertSameRecord(lock.packages[""].dependencies, pkg.dependencies, `${displayPath(lockFile)} dependencies`);
  assertSameRecord(lock.packages[""].devDependencies, pkg.devDependencies, `${displayPath(lockFile)} devDependencies`);
  validateScriptApprovals(pkg, lock.packages, packageFile);

  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path || !entry.version) continue;
    if (entry.link || !entry.resolved?.startsWith("https://registry.npmjs.org/")) {
      throw new Error(`${displayPath(lockFile)} contains non-registry dependency ${path}.`);
    }
    if (!/^sha512-/.test(entry.integrity ?? "")) {
      throw new Error(`${displayPath(lockFile)} contains dependency without SHA-512 integrity: ${path}.`);
    }
  }
}

function validateBundlerTemplate(root) {
  const gemfile = readRequired(join(root, "Gemfile"));
  const lock = readRequired(join(root, "Gemfile.lock"));
  if (!/^source "https:\/\/rubygems\.org"$/m.test(gemfile)) {
    throw new Error(`${displayPath(join(root, "Gemfile"))} has an unapproved gem source.`);
  }
  if (!/^  remote: https:\/\/rubygems\.org\/$/m.test(lock) || /^(?:GIT|PATH|PLUGIN SOURCE)$/m.test(lock)) {
    throw new Error(`${displayPath(join(root, "Gemfile.lock"))} has an unapproved dependency source.`);
  }
  if (!/^CHECKSUMS$/m.test(lock)) {
    throw new Error(`${displayPath(join(root, "Gemfile.lock"))} has no checksum section.`);
  }
}

export function validateTemplateDependencies(root, manifest) {
  if (!manifest.needsBuild) return;
  if (manifest.language === "Ruby") {
    validateBundlerTemplate(root);
  } else {
    validateNpmTemplate(root, manifest);
  }
}
