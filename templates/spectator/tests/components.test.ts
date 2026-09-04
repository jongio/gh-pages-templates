import { h, nextTick } from "vue";
import { renderToString } from "@vue/server-renderer";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const vitePressState = vi.hoisted(() => ({
  page: {
    value: {
      relativePath: "proposal.md",
      title: "Proposal",
    },
  },
  route: {
    path: "/proposal",
  },
}));

vi.mock("vitepress", () => ({
  useData: () => ({ page: vitePressState.page }),
  useRoute: () => vitePressState.route,
}));

import FeedbackPrompt from "../docs/.vitepress/theme/FeedbackPrompt.vue";
import SelectionActions from "../docs/.vitepress/theme/SelectionActions.vue";

function installAnimationFrame(): void {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

describe("review components", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installAnimationFrame();
  });

  it("renders page feedback with source and published context", () => {
    const wrapper = mount(FeedbackPrompt);
    const link = wrapper.get("a");
    const url = new URL(link.attributes("href"));
    expect(link.text()).toContain("Open a GitHub issue");
    expect(url.searchParams.get("body")).toContain("docs/proposal.md");
    expect(url.searchParams.get("body")).toContain("/proposal");
  });

  it("shows actions only for a non-empty selection inside article content", async () => {
    const article = document.createElement("article");
    article.className = "vp-doc";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Review this exact sentence.";
    article.append(paragraph);
    document.body.append(article);

    const selected = {
      anchorNode: paragraph.firstChild,
      focusNode: paragraph.firstChild,
      isCollapsed: false,
      rangeCount: 1,
      toString: () => paragraph.textContent || "",
      getRangeAt: () => ({
        getBoundingClientRect: () => ({
          top: 120,
          bottom: 140,
          left: 80,
          width: 220,
          height: 20,
        }),
      }),
      removeAllRanges: vi.fn(),
    };
    vi.spyOn(window, "getSelection").mockImplementation(() => selected);

    const wrapper = mount(SelectionActions, { attachTo: document.body });
    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();
    await nextTick();

    expect(wrapper.get('[role="toolbar"]').isVisible()).toBe(true);
    expect(wrapper.get("button").text()).toContain("Create issue");
    expect(wrapper.get("a").attributes("href")).toContain(
      "/edit/main/docs/proposal.md",
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(false);
  });

  it("does not show review actions for selection outside article content", async () => {
    const outside = document.createElement("p");
    outside.textContent = "Navigation text";
    document.body.append(outside);
    vi.spyOn(window, "getSelection").mockImplementation(() => ({
      anchorNode: outside.firstChild,
      focusNode: outside.firstChild,
      isCollapsed: false,
      rangeCount: 1,
      toString: () => outside.textContent || "",
      getRangeAt: () => ({
        getBoundingClientRect: () => ({
          top: 10,
          bottom: 30,
          left: 10,
          width: 100,
          height: 20,
        }),
      }),
      removeAllRanges: vi.fn(),
    }));

    const wrapper = mount(SelectionActions, { attachTo: document.body });
    document.dispatchEvent(new Event("selectionchange"));
    await nextTick();
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(false);
  });

  it("renders safely without mounting browser listeners", async () => {
    await expect(renderToString(h(SelectionActions))).resolves.toContain("");
  });
});
