import { describe, expect, it } from "vitest";
import type { SpectatorConfig } from "../spectator.config";
import {
  buildEditUrl,
  buildGeneralFeedbackUrl,
  buildPageFeedbackUrl,
  buildSelectionFeedbackUrl,
  clipCodePoints,
  publishedPageUrl,
  quoteMarkdown,
} from "../docs/.vitepress/theme/feedback-links";

const config: SpectatorConfig = {
  siteName: "Demo Spec",
  description: "A demo.",
  siteUrl: "https://octocat.github.io/demo-site/",
  basePath: "/demo-site/",
  repo: "octocat/demo-site",
  branch: "main",
  contentRoot: "docs",
  footerMessage: "Review it.",
  feedback: {
    enabled: true,
    label: "feedback",
    maxSelectionCodePoints: 8,
  },
  navigation: {
    top: [],
    sidebar: [],
  },
};

describe("feedback links", () => {
  it("builds base-aware published and edit URLs", () => {
    const page = { relativePath: "design/data model.md", title: "Data model" };
    expect(publishedPageUrl(config, page)).toBe(
      "https://octocat.github.io/demo-site/design/data%20model",
    );
    expect(buildEditUrl(config, page)).toBe(
      "https://github.com/octocat/demo-site/edit/main/docs/design/data%20model.md",
    );
  });

  it("builds a general feedback issue", () => {
    const url = new URL(buildGeneralFeedbackUrl(config));
    expect(url.pathname).toBe("/octocat/demo-site/issues/new");
    expect(url.searchParams.get("labels")).toBe("feedback");
    expect(url.searchParams.get("title")).toBe("Feedback: Demo Spec");
    expect(url.searchParams.get("body")).toContain(config.siteUrl);
  });

  it("includes page source and published URL in page feedback", () => {
    const url = new URL(
      buildPageFeedbackUrl(config, {
        relativePath: "proposal.md",
        title: "Proposal",
      }),
    );
    expect(url.searchParams.get("title")).toBe("Feedback: Proposal");
    expect(url.searchParams.get("body")).toContain("docs/proposal.md");
    expect(url.searchParams.get("body")).toContain(
      "https://octocat.github.io/demo-site/proposal",
    );
  });

  it("quotes and clips selected Unicode text without splitting a code point", () => {
    const url = new URL(
      buildSelectionFeedbackUrl(
        config,
        { relativePath: "proposal.md", title: "Proposal" },
        "alpha\n😀bravo",
      ),
    );
    const body = url.searchParams.get("body") || "";
    expect(body).toContain("> alpha...");
    expect(body).not.toContain("😀");
    expect(Array.from(clipCodePoints("12345😀789", 8))).toHaveLength(8);
  });

  it("honors exact and over-limit selection lengths", () => {
    expect(clipCodePoints("a".repeat(1500), 1500)).toHaveLength(1500);
    const clipped = clipCodePoints("a".repeat(1501), 1500);
    expect(clipped).toHaveLength(1500);
    expect(clipped.endsWith("...")).toBe(true);
  });

  it("supports root Pages sites and rejects empty selections", () => {
    const rootConfig = {
      ...config,
      siteUrl: "https://octocat.github.io/",
      basePath: "/",
    };
    expect(
      publishedPageUrl(rootConfig, {
        relativePath: "proposal.md",
        title: "Proposal",
      }),
    ).toBe("https://octocat.github.io/proposal");
    expect(() =>
      buildSelectionFeedbackUrl(
        config,
        { relativePath: "proposal.md", title: "Proposal" },
        "   ",
      ),
    ).toThrow(/must not be empty/);
  });

  it("formats multiline Markdown quotes", () => {
    expect(quoteMarkdown("one\n\ntwo")).toBe("> one\n> \n> two");
  });

  it("rejects unsafe repository and source paths", () => {
    expect(() =>
      buildEditUrl(
        { ...config, repo: "octocat/<script>" },
        { relativePath: "proposal.md" },
      ),
    ).toThrow(/Invalid GitHub repository slug/);
    expect(() =>
      buildEditUrl(config, { relativePath: "../outside.md" }),
    ).toThrow(/Invalid page path/);
  });
});
