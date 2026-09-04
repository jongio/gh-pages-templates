import type { SpectatorConfig } from "../../../spectator.config";

export interface FeedbackPage {
  relativePath: string;
  title?: string;
}

const REPO_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9._-]{1,100}$/;

function validatedRepo(repo: string): string {
  if (!REPO_PATTERN.test(repo) || repo.endsWith("/.") || repo.endsWith("/..")) {
    throw new Error(`Invalid GitHub repository slug: ${repo}`);
  }
  return repo;
}

function validatedPath(path: string, label: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid ${label}: ${path}`);
  }
  return normalized;
}

function encodedPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function sourcePath(config: SpectatorConfig, page: FeedbackPage): string {
  const root = validatedPath(config.contentRoot, "content root");
  const relative = validatedPath(page.relativePath, "page path");
  return `${root}/${relative}`;
}

function pageTitle(page: FeedbackPage): string {
  return page.title?.trim() || page.relativePath;
}

export function clipCodePoints(text: string, maximum: number): string {
  if (!Number.isInteger(maximum) || maximum < 1) {
    throw new Error("Selection limit must be a positive integer.");
  }
  const points = Array.from(text);
  if (points.length <= maximum) return text;
  if (maximum <= 3) return ".".repeat(maximum);
  return `${points.slice(0, maximum - 3).join("")}...`;
}

export function quoteMarkdown(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

export function publishedPageUrl(
  config: SpectatorConfig,
  page: FeedbackPage,
): string {
  const relative = validatedPath(page.relativePath, "page path")
    .replace(/\.md$/i, "")
    .replace(/(^|\/)index$/i, "$1");
  const base = config.siteUrl.endsWith("/") ? config.siteUrl : `${config.siteUrl}/`;
  return new URL(relative, base).toString();
}

export function buildEditUrl(
  config: SpectatorConfig,
  page: FeedbackPage,
): string {
  const repo = validatedRepo(config.repo);
  const branch = validatedPath(config.branch, "branch");
  return `https://github.com/${repo}/edit/${encodedPath(branch)}/${encodedPath(sourcePath(config, page))}`;
}

export function buildSourceUrl(
  config: SpectatorConfig,
  page: FeedbackPage,
): string {
  const repo = validatedRepo(config.repo);
  const branch = validatedPath(config.branch, "branch");
  return `https://github.com/${repo}/blob/${encodedPath(branch)}/${encodedPath(sourcePath(config, page))}`;
}

function issueUrl(
  config: SpectatorConfig,
  title: string,
  body: string,
): string {
  const repo = validatedRepo(config.repo);
  const url = new URL(`https://github.com/${repo}/issues/new`);
  if (config.feedback.label.trim()) {
    url.searchParams.set("labels", config.feedback.label.trim());
  }
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  return url.toString();
}

export function buildGeneralFeedbackUrl(config: SpectatorConfig): string {
  return issueUrl(
    config,
    `Feedback: ${config.siteName}`,
    `**Site:** ${config.siteUrl}\n\n**What is inaccurate, unclear, or missing?**\n\n`,
  );
}

export function buildPageFeedbackUrl(
  config: SpectatorConfig,
  page: FeedbackPage,
): string {
  const body = [
    `**Source page:** [\`${sourcePath(config, page)}\`](${buildSourceUrl(config, page)})`,
    `**Published page:** ${publishedPageUrl(config, page)}`,
    "",
    "**What is inaccurate, unclear, or missing?**",
    "",
  ].join("\n");
  return issueUrl(config, `Feedback: ${pageTitle(page)}`, body);
}

export function buildSelectionFeedbackUrl(
  config: SpectatorConfig,
  page: FeedbackPage,
  selection: string,
): string {
  if (!selection.trim()) {
    throw new Error("Selected text must not be empty.");
  }
  const clipped = clipCodePoints(
    selection.trim(),
    config.feedback.maxSelectionCodePoints,
  );
  const body = [
    `**Source page:** [\`${sourcePath(config, page)}\`](${buildSourceUrl(config, page)})`,
    `**Published page:** ${publishedPageUrl(config, page)}`,
    "",
    "**Selected text:**",
    "",
    quoteMarkdown(clipped),
    "",
    "**What is inaccurate, unclear, or missing?**",
    "",
  ].join("\n");
  return issueUrl(config, `Feedback: ${pageTitle(page)}`, body);
}
