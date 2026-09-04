<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useData, useRoute } from "vitepress";
import { spectatorConfig } from "../../../spectator.config";
import {
  buildEditUrl,
  buildSelectionFeedbackUrl,
} from "./feedback-links";

const { page } = useData();
const route = useRoute();
const visible = ref(false);
const top = ref(0);
const left = ref(0);
const selectedText = ref("");
const toolbar = ref<HTMLElement | null>(null);
const issueButton = ref<HTMLButtonElement | null>(null);
let animationFrame: number | undefined;
let focusIssueAction = false;

const currentPage = computed(() => ({
  relativePath: page.value.relativePath,
  title: page.value.title,
}));

const editUrl = computed(() => buildEditUrl(spectatorConfig, currentPage.value));

function parentElement(node: Node | null): Element | null {
  return node instanceof Element ? node : node?.parentElement ?? null;
}

function isArticleSelection(selection: Selection): boolean {
  const anchor = parentElement(selection.anchorNode);
  const focus = parentElement(selection.focusNode);
  const anchorArticle = anchor?.closest(".vp-doc");
  return Boolean(anchorArticle && focus?.closest(".vp-doc") === anchorArticle);
}

function hide(): void {
  visible.value = false;
  focusIssueAction = false;
}

function refresh(): void {
  animationFrame = undefined;
  const selection = window.getSelection();
  if (
    !selection ||
    selection.isCollapsed ||
    selection.rangeCount === 0 ||
    !isArticleSelection(selection)
  ) {
    if (visible.value && toolbar.value?.contains(document.activeElement)) {
      return;
    }
    hide();
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    hide();
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    hide();
    return;
  }

  selectedText.value = text;
  visible.value = true;

  void nextTick(() => {
    const width = toolbar.value?.offsetWidth || 240;
    const height = toolbar.value?.offsetHeight || 38;
    const margin = 8;
    const center = rect.left + rect.width / 2;
    left.value = Math.min(
      Math.max(center, width / 2 + margin),
      window.innerWidth - width / 2 - margin,
    );
    const preferredTop = rect.top - height - margin;
    top.value =
      preferredTop >= margin
        ? preferredTop
        : Math.min(rect.bottom + margin, window.innerHeight - height - margin);
    if (focusIssueAction) {
      issueButton.value?.focus();
      focusIssueAction = false;
    }
  });
}

function scheduleRefresh(shouldFocus = false): void {
  focusIssueAction ||= shouldFocus;
  if (animationFrame !== undefined) {
    window.cancelAnimationFrame(animationFrame);
  }
  animationFrame = window.requestAnimationFrame(refresh);
}

function onSelectionEvent(): void {
  scheduleRefresh();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hide();
    return;
  }
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    scheduleRefresh(true);
  }
}

function openIssue(): void {
  const url = buildSelectionFeedbackUrl(
    spectatorConfig,
    currentPage.value,
    selectedText.value,
  );
  window.open(url, "_blank", "noopener,noreferrer");
  window.getSelection()?.removeAllRanges();
  hide();
}

function clearSelectionContext(): void {
  window.getSelection()?.removeAllRanges();
  hide();
}

watch(
  () => route.path,
  () => {
    if (typeof window !== "undefined") clearSelectionContext();
  },
);

onMounted(() => {
  document.addEventListener("selectionchange", onSelectionEvent);
  document.addEventListener("mouseup", onSelectionEvent);
  document.addEventListener("touchend", onSelectionEvent);
  document.addEventListener("keyup", onSelectionEvent);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", onSelectionEvent, true);
  window.addEventListener("resize", onSelectionEvent);
});

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", onSelectionEvent);
  document.removeEventListener("mouseup", onSelectionEvent);
  document.removeEventListener("touchend", onSelectionEvent);
  document.removeEventListener("keyup", onSelectionEvent);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("scroll", onSelectionEvent, true);
  window.removeEventListener("resize", onSelectionEvent);
  if (animationFrame !== undefined) {
    window.cancelAnimationFrame(animationFrame);
  }
});
</script>

<template>
  <div
    v-if="spectatorConfig.feedback.enabled && visible"
    ref="toolbar"
    class="selection-toolbar"
    role="toolbar"
    aria-label="Review selected text"
    :style="{ top: `${top}px`, left: `${left}px` }"
    @pointerdown.prevent
  >
    <button
      ref="issueButton"
      type="button"
      class="selection-action"
      aria-label="Create a GitHub issue with the selected text"
      title="Create issue (Alt+Shift+F)"
      @click="openIssue"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
      </svg>
      Create issue
    </button>
    <span class="selection-divider" aria-hidden="true" />
    <a
      class="selection-action"
      :href="editUrl"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Edit this page on GitHub and open a pull request"
      @click="clearSelectionContext"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.757l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064L11.189 6.25Z" />
      </svg>
      Edit page
    </a>
  </div>
</template>

<style scoped>
.selection-toolbar {
  position: fixed;
  z-index: 100;
  display: inline-flex;
  align-items: stretch;
  padding: 2px;
  transform: translateX(-50%);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-elv, var(--vp-c-bg));
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
  white-space: nowrap;
  user-select: none;
}

.selection-action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.45rem 0.65rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
}

.selection-action:hover,
.selection-action:focus-visible {
  background: var(--vp-c-default-soft, var(--vp-c-bg-soft));
  color: var(--vp-c-brand-1);
}

.selection-action:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}

.selection-action svg {
  flex: none;
  color: var(--vp-c-brand-1);
}

.selection-divider {
  width: 1px;
  margin: 4px 1px;
  background: var(--vp-c-divider);
}

@media (prefers-reduced-motion: reduce) {
  .selection-toolbar,
  .selection-action {
    transition: none;
  }
}
</style>
