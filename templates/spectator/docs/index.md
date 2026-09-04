---
layout: home
title: __SITE_NAME__
titleTemplate: false

hero:
  name: Project Northstar
  text: A calmer way to review consequential changes
  tagline: A fictional specification showing how Spectator turns free-form Markdown into a focused review website.
  image:
    src: /images/hero.svg
    alt: A blueprint of connected specification pages converging on one reviewed decision.
  actions:
    - theme: brand
      text: Read the proposal
      link: /proposal
    - theme: alt
      text: Inspect the system shape
      link: /system-shape
    - theme: alt
      text: Start a review
      link: /review-guide

features:
  - title: Read without losing context
    details: Search locally, follow a curated path, and use the page outline to move through long technical arguments.
  - title: Comment on the exact concern
    details: Open a GitHub issue for the page or select a passage to include it directly in the feedback draft.
  - title: Propose the correction
    details: Open the current source page in GitHub and turn a precise edit into a pull request.
---

## What this preview demonstrates

Project Northstar is fictional. Its content is intentionally compact and its page
structure is only an example. Spectator does not require a fixed specification
outline.

The template supplies the publishing and review system:

```text
Repository context
  -> free-form Markdown
  -> reviewable static site
  -> GitHub issues and pull-request edits
```

Use the navigation to inspect a proposal, a system diagram, a review checklist,
and source notes. When `create-gh-pages-site` generates a real site, it replaces
every Northstar reference with evidence from the target repository and the
author's context.
