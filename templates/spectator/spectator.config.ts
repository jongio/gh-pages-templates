export interface SpectatorNavItem {
  text: string;
  link: string;
}

export interface SpectatorSidebarGroup {
  text: string;
  items: SpectatorNavItem[];
}

export interface SpectatorConfig {
  siteName: string;
  description: string;
  siteUrl: string;
  basePath: string;
  repo: string;
  branch: string;
  contentRoot: string;
  footerMessage: string;
  feedback: {
    enabled: boolean;
    label: string;
    maxSelectionCodePoints: number;
  };
  navigation: {
    top: SpectatorNavItem[];
    sidebar: SpectatorSidebarGroup[];
  };
}

export const spectatorConfig: SpectatorConfig = {
  siteName: "__SITE_NAME__",
  description: "A reviewable specification published with Spectator.",
  siteUrl: "__SITE_URL__",
  basePath: "__BASE_PATH__",
  repo: "__REPO_SLUG__",
  branch: "__DEFAULT_BRANCH__",
  contentRoot: "docs",
  footerMessage: "A specification published for clear, durable review.",
  feedback: {
    enabled: true,
    label: "feedback",
    maxSelectionCodePoints: 1500,
  },
  navigation: {
    top: [
      { text: "Proposal", link: "/proposal" },
      { text: "System shape", link: "/system-shape" },
      { text: "Review guide", link: "/review-guide" },
      { text: "Sources", link: "/sources" },
    ],
    sidebar: [
      {
        text: "Project Northstar",
        items: [
          { text: "Overview", link: "/" },
          { text: "Proposal", link: "/proposal" },
          { text: "System shape", link: "/system-shape" },
        ],
      },
      {
        text: "Review",
        items: [
          { text: "Review guide", link: "/review-guide" },
          { text: "Sources", link: "/sources" },
        ],
      },
    ],
  },
};
