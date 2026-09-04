import { defineConfig } from "vitepress";
import mdContainer from "markdown-it-container";
import { spectatorConfig } from "../../spectator.config";
import {
  buildGeneralFeedbackUrl,
  publishedPageUrl,
} from "./theme/feedback-links";

const plainLanguageIcon =
  '<span class="plain-language__icon" aria-hidden="true">i</span>';

const feedbackNav = spectatorConfig.feedback.enabled
  ? [
      {
        text: "Feedback",
        link: buildGeneralFeedbackUrl(spectatorConfig),
      },
    ]
  : [];

export default defineConfig({
  title: spectatorConfig.siteName,
  description: spectatorConfig.description,
  base: spectatorConfig.basePath,
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["public/**/*.md"],
  sitemap: {
    hostname: spectatorConfig.siteUrl,
  },
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: `${spectatorConfig.basePath}images/favicon.svg`,
      },
    ],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: spectatorConfig.siteName }],
    ["meta", { property: "og:description", content: spectatorConfig.description }],
    [
      "meta",
      {
        property: "og:image",
        content: `${spectatorConfig.siteUrl}images/og.png`,
      },
    ],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],
  transformHead({ pageData }) {
    const canonical = publishedPageUrl(spectatorConfig, {
      relativePath: pageData.relativePath,
      title: pageData.title,
    });
    return [
      ["link", { rel: "canonical", href: canonical }],
      ["meta", { property: "og:url", content: canonical }],
    ];
  },
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
    config(md) {
      md.use(mdContainer, "plain-language", {
        render(tokens: { nesting: number; info: string }[], index: number) {
          if (tokens[index].nesting === 1) {
            const info = (tokens[index].info || "").trim();
            const term = info.replace(/^plain-language\s*/i, "").trim();
            const termHtml = term
              ? `<span class="plain-language__term">${md.utils.escapeHtml(term)}</span>`
              : "";
            return (
              '<aside class="plain-language" role="note" aria-label="In plain language">' +
              '<div class="plain-language__head">' +
              plainLanguageIcon +
              '<span class="plain-language__label">In plain language</span>' +
              "</div>" +
              termHtml +
              '<div class="plain-language__body">'
            );
          }
          return "</div></aside>\n";
        },
      });
    },
  },
  themeConfig: {
    nav: [...spectatorConfig.navigation.top, ...feedbackNav],
    sidebar: spectatorConfig.navigation.sidebar,
    outline: [2, 3],
    search: {
      provider: "local",
    },
    editLink: {
      pattern: `https://github.com/${spectatorConfig.repo}/edit/${spectatorConfig.branch}/${spectatorConfig.contentRoot}/:path`,
      text: "Edit this page on GitHub",
    },
    socialLinks: [
      {
        icon: "github",
        link: `https://github.com/${spectatorConfig.repo}`,
      },
    ],
    footer: {
      message: spectatorConfig.footerMessage,
      copyright: "Published with Spectator",
    },
  },
});
