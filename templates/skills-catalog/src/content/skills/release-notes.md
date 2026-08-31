---
title: Release Notes
tagline: Turns commits and pull requests into concise release notes.
useWhen: You are preparing a release or sharing a shipped change.
repoPath: skills/release-notes
thumb: images/thumb-release-notes.svg
install:
  - label: Skills CLI
    cmd: npx skills add __REPO_SLUG__ --skill release-notes
order: 3
---

## What it does

This example represents a writing skill that groups user-facing changes and produces a clear release summary.

## Inputs

- The release range
- Merged pull requests
- Audience and tone
- Known upgrade notes
