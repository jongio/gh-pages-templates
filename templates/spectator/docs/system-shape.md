# System shape

![Spectator illustration: a document with a highlighted decision path.](/images/page-example.svg)

Spectator keeps the runtime deliberately small.

```text
Markdown pages
  -> VitePress build
  -> static GitHub Pages site

Reviewer action
  -> prefilled GitHub issue
  -> repository triage

Proposed correction
  -> GitHub editor
  -> pull request
```

## Components

| Component | Responsibility |
| --- | --- |
| VitePress | Static generation, navigation, local search, page outlines, code rendering, and appearance. |
| Spectator config | Repository identity, branch, content root, navigation, and feedback policy. |
| Feedback prompt | Page-level issue creation. |
| Selection actions | Selected-text issue creation and direct page editing. |
| Content validator | Links, anchors, navigation, assets, and unresolved marker checks. |
| GitHub Actions | Reproducible Pages build and deployment. |

## Failure boundaries

If client JavaScript fails, the static content and ordinary links remain readable.
If GitHub is unavailable, reading still works and review actions fail as normal
external links rather than blocking the site.
