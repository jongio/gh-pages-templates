// @vitest-environment node

import { h } from "vue";
import { renderToString } from "@vue/server-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("vitepress", () => ({
  useData: () => ({
    page: {
      value: {
        relativePath: "proposal.md",
        title: "Proposal",
      },
    },
  }),
  useRoute: () => ({ path: "/proposal" }),
}));

import FeedbackPrompt from "../docs/.vitepress/theme/FeedbackPrompt.vue";
import SelectionActions from "../docs/.vitepress/theme/SelectionActions.vue";

describe("server rendering", () => {
  it("renders feedback without browser globals", async () => {
    const html = await renderToString(h(FeedbackPrompt));
    expect(html).toContain("Open a GitHub issue");
  });

  it("renders selection actions without browser globals", async () => {
    await expect(renderToString(h(SelectionActions))).resolves.toMatch(
      /^<!--.*-->$/,
    );
  });
});
