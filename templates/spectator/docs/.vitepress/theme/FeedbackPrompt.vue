<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { spectatorConfig } from "../../../spectator.config";
import { buildPageFeedbackUrl } from "./feedback-links";

const { page } = useData();

const issueUrl = computed(() =>
  buildPageFeedbackUrl(spectatorConfig, {
    relativePath: page.value.relativePath,
    title: page.value.title,
  }),
);
</script>

<template>
  <div v-if="spectatorConfig.feedback.enabled" class="page-feedback">
    <span>Found something inaccurate, unclear, or missing on this page?</span>
    <a :href="issueUrl" target="_blank" rel="noopener noreferrer">
      Open a GitHub issue
    </a>
  </div>
</template>

<style scoped>
.page-feedback {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  line-height: 1.6;
}

.page-feedback a {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.page-feedback a:hover {
  text-decoration: underline;
}
</style>
