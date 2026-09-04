import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "..");

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".vitepress" || entry.name === "public") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

function routeFor(docsRoot, file) {
  return (
    "/" +
    relative(docsRoot, file)
      .replaceAll("\\", "/")
      .replace(/\.md$/i, "")
      .replace(/(^|\/)index$/i, "$1")
  ).replace(/\/$/, "") || "/";
}

function headingSlug(heading) {
  const slug = heading
    .replace(/`/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-");
  return /^\d/.test(slug) ? `_${slug}` : slug;
}

function navigationLinks(configPath) {
  if (!existsSync(configPath)) return [];
  const source = readFileSync(configPath, "utf8");
  return [...source.matchAll(/\blink:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
}

function internalTarget(target) {
  if (/^(?:https?:|mailto:|#)/.test(target)) return null;
  const [path, anchor = ""] = target.split("#", 2);
  return { path: path.replace(/\/$/, "") || "/", anchor };
}

export function inspectContent(root = DEFAULT_ROOT) {
  const projectRoot = resolve(root);
  const docsRoot = join(projectRoot, "docs");
  const configPath = join(projectRoot, "spectator.config.ts");
  const errors = [];
  let linkCount = 0;
  let imageCount = 0;

  if (!existsSync(docsRoot)) {
    return { errors: [`Missing docs directory: ${docsRoot}`], pages: 0, links: 0, images: 0 };
  }

  const files = markdownFiles(docsRoot);
  const routes = new Map();
  const anchors = new Map();

  for (const file of files) {
    const route = routeFor(docsRoot, file);
    const source = readFileSync(file, "utf8");
    routes.set(route, file);
    anchors.set(
      route,
      new Set(
        [...source.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((match) =>
          headingSlug(match[1]),
        ),
      ),
    );
    for (const marker of source.matchAll(/__[A-Z][A-Z0-9_]*__/g)) {
      errors.push(`${relative(projectRoot, file)}: unresolved marker ${marker[0]}`);
    }
  }

  const checkTarget = (file, rawTarget) => {
    const target = internalTarget(rawTarget);
    if (!target) return;
    linkCount++;
    if (!rawTarget.startsWith("/") || /\.md(?:#|$)/i.test(rawTarget)) {
      errors.push(`${relative(projectRoot, file)}: internal link must be a root-relative clean URL: ${rawTarget}`);
      return;
    }
    if (!routes.has(target.path)) {
      errors.push(`${relative(projectRoot, file)}: missing route ${target.path}`);
      return;
    }
    if (target.anchor && !anchors.get(target.path)?.has(target.anchor)) {
      errors.push(`${relative(projectRoot, file)}: missing anchor ${target.path}#${target.anchor}`);
    }
  };

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?<!!)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      checkTarget(file, match[1]);
    }
    for (const match of source.matchAll(/!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      imageCount++;
      const alt = match[1].trim();
      const target = match[2];
      if (!alt) {
        errors.push(`${relative(projectRoot, file)}: image is missing alternative text`);
      }
      if (target.startsWith("/")) {
        const asset = join(docsRoot, "public", target.replace(/^\/+/, ""));
        if (!existsSync(asset)) {
          errors.push(`${relative(projectRoot, file)}: missing image ${target}`);
        }
      }
    }
  }

  const configuredInternal = navigationLinks(configPath).filter((link) =>
    link.startsWith("/"),
  );
  for (const link of configuredInternal) checkTarget(configPath, link);

  const configuredRoutes = new Set(
    configuredInternal.map((link) => link.split("#", 1)[0].replace(/\/$/, "") || "/"),
  );
  for (const route of routes.keys()) {
    if (!configuredRoutes.has(route)) {
      errors.push(`${relative(projectRoot, routes.get(route))}: page is absent from configured navigation`);
    }
  }

  const imageManifest = join(docsRoot, "public", "images", "IMAGES.md");
  if (!existsSync(imageManifest)) {
    errors.push("docs/public/images/IMAGES.md: image handoff manifest is missing");
  }

  return {
    errors,
    pages: files.length,
    links: linkCount,
    images: imageCount,
  };
}

export function validateContent(root = DEFAULT_ROOT) {
  const result = inspectContent(root);
  if (result.errors.length) {
    throw new Error(`Content validation failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = validateContent();
    console.log(
      `Content valid: ${result.pages} pages, ${result.links} internal links, ${result.images} images.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
