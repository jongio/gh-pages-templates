---
title: Review Helper
tagline: Reviews changes for correctness, reliability, and maintainability.
useWhen: You want a focused second pass before opening a pull request.
repoPath: skills/review-helper
thumb: images/thumb-review-helper.svg
install:
  - label: Skills CLI
    cmd: npx skills add __REPO_SLUG__ --skill review-helper
order: 2
---

## What it does

Review Helper is example content for a skill that inspects a change set and reports actionable findings.

## Suggested workflow

1. Finish the implementation.
2. Run the relevant tests.
3. Invoke the skill with the changed files in context.
4. Address confirmed findings.
