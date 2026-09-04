# Spectator template specification

Status: Reviewed, implementation-ready

Reference implementation: `coreai-microsoft/eval-authoring-guide` at commit
`eeca9bd320f3bd6dd520257ee86d46076b9ef476`

Template registry: `jongio/gh-pages-templates` at commit
`6dfb2e8152d140ed0c924fd49ba8b1ba4764d76b`

## 1. Executive summary

Spectator is an opinionated GitHub Pages template for publishing technical
specifications as readable, searchable, reviewable websites.

The template turns Markdown into a static VitePress site with:

- a polished landing page and curated specification navigation;
- responsive reading views, local search, light and dark themes, page outlines,
  syntax highlighting, code copy controls, permalinks, and previous and next links;
- a reusable plain-language callout for difficult concepts;
- global, page-level, and selected-text feedback through prefilled GitHub issues;
- direct page editing through GitHub pull requests;
- deterministic publishing checks for links, anchors, configured navigation,
  referenced assets, and unresolved placeholders;
- secure, base-path-aware deployment to GitHub Pages;
- an authoring contract that the `create-gh-pages-site` Copilot skill can populate
  from repository context without inventing unsupported facts.

Spectator is not a clone of the Eval Authoring Guide's subject matter or branding.
It preserves the site's successful product patterns and adapts them into a neutral,
configurable specification publishing system.

## 2. Product definition

### 2.1 Problem

Technical specifications are commonly distributed as long Markdown files,
documents, or issue descriptions. These formats make it difficult to:

1. understand the complete proposal without losing orientation;
2. find a specific requirement or decision quickly;
3. distinguish normative requirements from background research;
4. provide feedback tied to a page or exact passage;
5. propose an edit through the repository's normal review workflow;
6. publish a stable, shareable version without maintaining a custom website.

### 2.2 Product outcome

Given a repository and a description of a feature, system, policy, or proposal,
Copilot can select Spectator through `create-gh-pages-site`, author a complete
specification site from the available evidence, build it, and prepare it for
GitHub Pages.

A reviewer can then read the specification at a stable URL, search it, navigate
between focused pages, comment on a whole page or selected text through GitHub
issues, and propose direct edits through GitHub.

### 2.3 Primary users

| User | Need |
| --- | --- |
| Spec author | Convert repository context and design intent into a coherent published specification. |
| Reviewer | Read efficiently, keep orientation, and leave feedback with precise context. |
| Approver | Find goals, requirements, risks, alternatives, unresolved decisions, and acceptance criteria. |
| Maintainer | Update Markdown, validate content integrity, and publish without custom infrastructure. |
| Copilot | Generate the right pages, navigation, configuration, links, and review affordances from explicit context. |

## 3. Goals

1. Reproduce every generally useful design and interaction pattern in the Eval
   Authoring Guide.
2. Make repository identity, site identity, content, navigation, and feedback
   targets configurable from one typed source.
3. Support user sites served at `/` and project sites served at `/repo/`.
4. Keep review on GitHub so the published site needs no database, authentication
   service, or comment backend.
5. Give Copilot a deterministic authoring contract for turning supplied context
   into a complete specification.
6. Provide a polished fictional example for the template gallery while requiring
   `create-gh-pages-site` to replace all sample content in generated sites.
7. Fail builds for broken links, broken anchors, stale configured navigation,
   unresolved generation markers, and other publishing-integrity failures.
8. Meet WCAG 2.2 AA for template-owned interfaces.

## 4. Non-goals

1. Hosting comments directly inside the static site.
2. Replacing GitHub issues, pull requests, or repository permissions.
3. Providing real-time collaborative editing.
4. Generating architecture or product claims that are absent from the supplied
   repository and user context.
5. Prescribing one software development methodology.
6. Requiring every specification to use every optional page.
7. Copying the Eval Authoring Guide's amber visual identity or illustration set.
8. Publishing private repository content to a public Pages site without an
   explicit user decision.

## 5. Product principles

### 5.1 Reading before decoration

Typography, hierarchy, navigation, and review context take priority over visual
effects. The site should feel like a serious technical publication.

### 5.2 Evidence before assertion

Generated pages distinguish facts found in the repository, decisions provided by
the user, proposals, assumptions, and unresolved questions.

### 5.3 Intentional information architecture

Navigation should reflect the author's chosen reading experience rather than a
file-system dump. Spectator supports curated, minimal, and unconventional
structures without imposing a required outline.

### 5.4 Comments become durable work

Feedback opens a GitHub issue with enough context to act on. Direct corrections
open the GitHub editor so changes proceed through a pull request.

### 5.5 Static by default

All core reading and navigation work from the generated static output. Client
JavaScript is limited to VitePress navigation, local search, theme state, and the
selected-text review control.

## 6. Reverse-engineered reference system

### 6.1 Reference architecture

The Eval Authoring Guide is a static VitePress 1.6.4 application with 18 Markdown
pages, 2,573 lines of published Markdown, 16 raster illustrations, three custom
theme files, two Vue feedback components, and three Node content-integrity tests.

| Layer | Reference behavior | Evidence |
| --- | --- | --- |
| Content | Markdown under `docs/` is the publication source. | `eval-authoring-guide/docs/` |
| Site configuration | One VitePress config owns metadata, curated top navigation, sidebar, local search, edit links, social links, and footer. | `eval-authoring-guide/docs/.vitepress/config.mts:14-129` |
| Theme extension | The default VitePress layout is extended rather than replaced. | `eval-authoring-guide/docs/.vitepress/theme/index.ts:10-17` |
| Review UI | A page footer and a selected-text toolbar create prefilled GitHub issues. | `eval-authoring-guide/docs/.vitepress/theme/Feedback.vue:5-25`, `SelectionIssue.vue:5-144` |
| Reading aid | A Markdown container renders a semantic "In Plain English" aside. | `eval-authoring-guide/docs/.vitepress/config.mts:20-50` |
| Visual layer | Small CSS overrides customize callouts and illustrations while retaining VitePress defaults. | `eval-authoring-guide/docs/.vitepress/theme/custom.css:10-119` |
| Validation | Node tests enforce clean internal links, route existence, anchor existence, and domain citation contracts. | `eval-authoring-guide/tests/docs-links.test.mjs:28-130`, `docs-qualify-rules.test.mjs:28-94` |
| Accessibility support | The rendered site includes a skip link, semantic navigation landmarks, ARIA labels, keyboard-accessible controls, and responsive navigation. | `eval-authoring-guide/docs/.vitepress/dist/index.html:20-28` |
| Deployment | Pushes to `main` build with Node 24 and pnpm, then publish the VitePress output through first-party Pages actions. | `eval-authoring-guide/.github/workflows/deploy-pages.yml:1-58` |

### 6.2 Reference information architecture

The reference site uses five reader-oriented groups:

1. Start here
2. Design
3. Apply
4. Recommendations
5. Research

The home page introduces the central problem, states the conceptual model, offers
three starting actions, and summarizes three value propositions. Detailed pages
use a persistent sidebar, an "On this page" outline, heading permalinks, and
previous and next navigation.

This structure separates:

- accessible orientation from precise guidance;
- conceptual guidance from worked examples;
- normative checklists from explanatory prose;
- recommendations from current behavior;
- claims from their research sources.

### 6.3 Reference visual system

The site keeps VitePress's restrained documentation layout and adds:

- one wide home hero illustration;
- one centered spot illustration beneath each page title;
- light and dark code themes matching GitHub;
- amber plain-language notes that float beside prose above 900 pixels and become
  full-width blocks on smaller screens;
- limited border radii and shadows used only for hierarchy;
- a compact floating selected-text toolbar that uses existing VitePress tokens.

The home page uses a large title, outcome-focused tagline, three actions, three
feature summaries, then the opening argument. Document pages use a three-column
reading model on wide screens: curated sidebar, article, and page outline.

### 6.4 Reference content patterns

The published content demonstrates:

- ordinary Markdown headings and paragraphs;
- comparison tables;
- numbered workflows;
- checklists;
- blockquote callouts;
- syntax-highlighted code samples with copy controls;
- explicit good and bad examples;
- glossary entries with deep links;
- research pages with direct primary-source links;
- descriptive image alternative text;
- a plain-language layer for readers who do not know the domain vocabulary.

### 6.5 Reference review paths

| Review path | Trigger | Result |
| --- | --- | --- |
| Global feedback | Top navigation link | New GitHub issue with a feedback label and general title. |
| Page feedback | Footer prompt on every document | New issue with the page title and source path. |
| Selected-text feedback | Select text inside article content | Floating action opens a new issue with a quoted excerpt, capped at 1,500 characters. |
| Direct edit | Footer edit link or selected-text toolbar | GitHub editor opens for the current Markdown source file. |

### 6.6 Reference platform features inherited from VitePress

Spectator must preserve the following platform behavior:

1. server-rendered static HTML;
2. clean URLs without `.html`;
3. generated 404 page;
4. responsive top navigation and sidebar;
5. local full-text search with a keyboard shortcut;
6. light, dark, and system appearance behavior without a flash of the wrong theme;
7. active navigation states;
8. page outline from headings;
9. heading permalinks;
10. syntax highlighting in both themes;
11. code copy controls;
12. last-updated metadata from Git history;
13. previous and next page navigation;
14. social source link;
15. skip-to-content link;
16. keyboard-accessible mobile menus;
17. prefetching of internal routes.

### 6.7 Reference gaps that Spectator must harden

| Gap | Evidence | Spectator requirement |
| --- | --- | --- |
| Missing favicon | Browser inspection of the reference home page returned `404` for `/favicon.ico`. | Ship a favicon and reference it through a base-path-safe URL. |
| Duplicated repository constants | `Feedback.vue:5` and `SelectionIssue.vue:5` each hardcode the same repository. | Import one typed Spectator configuration object. |
| Mouse-only activation | `SelectionIssue.vue:97-102` listens for `mouseup`, selection changes, keyboard Escape, and scroll, but not keyboard selection completion, touch, or resize. | Support mouse, keyboard, touch, scroll, and viewport resize. |
| Root-only base | The reference config sets `base: "/"` at `config.mts:17`. | Use `__BASE_PATH__` and validate both root and nested deployments. |
| Feedback URL logic is embedded in components | Each component builds URLs independently. | Extract pure, tested feedback-link helpers. |
| No automated interaction tests | Existing tests cover content contracts but not the feedback controls. | Add browser tests for review actions and responsive behavior. |

## 7. Feature disposition

| Reference feature | Spectator disposition | Notes |
| --- | --- | --- |
| VitePress default documentation shell | Include | Best fit for multi-page technical specifications. |
| Home hero and feature cards | Adapt | Populate from the target specification's problem, outcome, and key properties. |
| Curated top navigation | Adapt | Use specification-oriented destinations. |
| Curated grouped sidebar | Adapt | Generate from the actual page plan, not directly from the directory tree. |
| Local search | Include | No external search service or data transfer. |
| Light, dark, and system themes | Include | Preserve VitePress behavior. |
| Page outline | Include | Required for long technical pages. |
| Heading permalinks | Include | Required for precise review links. |
| Previous and next links | Include | Follow curated sidebar order. |
| Last updated | Include | Derive from Git. |
| Edit page on GitHub | Include | Build from shared repository, branch, and content-root configuration. |
| Global feedback issue | Include | Configurable label and issue title. |
| Page feedback issue | Include | Add source path and canonical page URL. |
| Selected-text issue | Include and harden | Preserve quoting and clipping, then add keyboard, touch, and resize support. |
| Selected-text edit action | Include | Open the current source page in GitHub's editor. |
| Plain-language callout | Include | Rename only if the generated site's editorial voice requires it. |
| Jargon audit | Adapt | Make the term list and thresholds project-owned and optional. |
| Domain rule-code allowlist | Exclude | Specific to Vally and not reusable. |
| Link, route, and anchor tests | Include | Universal publishing integrity checks. |
| Page illustrations | Adapt | Use neutral placeholders and ask the user for real images. |
| Eval amber branding | Exclude | Spectator uses a neutral default and configurable accent. |
| Research/source hierarchy | Include | Claims should link directly to sources, with a references page for the complete catalog. |

## 8. Functional requirements

### 8.1 Generation and configuration

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-001 | The template must be selectable by the name `spectator` through the registry generator. | Must |
| FR-002 | The template must use only the existing registry sentinels: `__SITE_NAME__`, `__SITE_URL__`, `__SITE_ORIGIN__`, `__BASE_PATH__`, `__BASE_URL__`, `__REPO_SLUG__`, and `__PKG_NAME__`. | Must |
| FR-003 | A single typed configuration module must define repository slug, default branch, content root, site title, description, footer, feedback settings, and specification navigation. | Must |
| FR-004 | VitePress, Vue components, and feedback-link helpers must import the shared configuration instead of duplicating repository data. | Must |
| FR-005 | A stamped template must contain no unresolved registry sentinel. | Must |
| FR-006 | `create-gh-pages-site` must map requests for a specification, RFC, architecture proposal, design proposal, technical decision, or policy proposal to Spectator unless the user names another framework. | Must |
| FR-007 | The skill must replace all fictional gallery content with target-specific content before reporting completion. | Must |
| FR-008 | The skill must not fabricate requirements, APIs, dates, owners, security claims, or decisions. Missing facts must become explicit questions or clearly marked open items. | Must |

### 8.2 Publication and navigation

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-009 | The template must support both a VitePress home layout and a document-style home page so the author can choose the right entry experience. | Must |
| FR-010 | The VitePress home layout must support configurable hero copy, actions, feature summaries, and follow-on Markdown content without requiring any of them. | Must |
| FR-011 | When curated navigation is configured, every published page must be reachable from it or explicitly configured as standalone. | Must |
| FR-012 | Desktop document pages must provide a global top bar, grouped sidebar, article, and page outline. | Must |
| FR-013 | Mobile document pages must provide keyboard-accessible controls for global navigation, the sidebar, and the current-page outline. | Must |
| FR-014 | Internal routes must use clean URLs and work at both `/` and `__BASE_PATH__`. | Must |
| FR-015 | The site must provide local search without an external service. | Must |
| FR-016 | Document pages must provide heading permalinks, code copy buttons, previous and next links, last-updated metadata, and an edit-page link. | Must |
| FR-017 | The site must generate a useful 404 page with links to the home page, search, and source repository. | Should |

### 8.3 Content and specification model

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-018 | The template must not require fixed pages, headings, or semantic sections. Authors and Copilot may organize content freely. | Must |
| FR-019 | The creation skill must derive pages and navigation from the supplied context rather than force a standard specification outline. | Must |
| FR-020 | The template must provide optional visual labels for current behavior, proposed behavior, decisions, assumptions, risks, and open questions. | Should |
| FR-021 | The template must support stable requirement identifiers but must not require them. | Should |
| FR-022 | Publishing-integrity checks may validate identifiers and links that exist, but must not require requirements, acceptance criteria, decisions, risks, or sources. | Must |
| FR-023 | The creation skill must link claims to supplied evidence when it uses that evidence, but the template validator must not judge specification completeness. | Must |
| FR-024 | Each technical term that blocks a general reader must be defined in place, in a glossary, or in a plain-language callout. | Should |
| FR-025 | Illustrations and screenshots must have meaningful alternative text and an entry in the image handoff manifest. | Must |

### 8.4 Review and feedback

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-026 | A top-navigation Feedback action must open a new GitHub issue for general site feedback. | Must |
| FR-027 | Every document footer must offer a page-specific feedback issue. | Must |
| FR-028 | The page-specific issue body must include the source path, canonical published URL, and a prompt asking what is inaccurate, unclear, or missing. | Must |
| FR-029 | Selecting non-empty text inside article content must reveal a compact review toolbar near the selection. | Must |
| FR-030 | The selection toolbar must offer Create issue and Edit page actions. | Must |
| FR-031 | The selected-text issue body must include the source path, canonical URL, quoted selected text, and a review prompt. | Must |
| FR-032 | Selected text must be clipped at a configurable limit of 1,500 Unicode code points without splitting a Unicode character. | Must |
| FR-033 | The toolbar must activate after mouse, keyboard, and touch selection, reposition on scroll and resize, and dismiss on collapsed selection, Escape, route change, or completed action. | Must |
| FR-034 | The toolbar must never appear for selections outside `.vp-doc`. | Must |
| FR-035 | Feedback links must open GitHub in a new tab with opener access disabled. | Must |
| FR-036 | Feedback components must render safely during VitePress server-side generation without accessing browser globals before mount. | Must |
| FR-037 | Disabling feedback in configuration must remove all global, page, and selected-text issue actions while retaining edit links when editing remains enabled. | Should |

### 8.5 Appearance and media

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-038 | The site must support light, dark, and system appearance modes. | Must |
| FR-039 | Template-owned colors must meet WCAG 2.2 AA contrast in light and dark modes. | Must |
| FR-040 | The default visual identity must be neutral, publication-focused, and configurable through a small documented token set. | Must |
| FR-041 | The template must include base-path-safe favicon, social card, logo, home hero, and page illustration placeholders plus `IMAGES.md`. | Must |
| FR-042 | The generated site must reference only images it actually uses. | Must |
| FR-043 | Plain-language notes must float only when sufficient horizontal space remains and must become full-width blocks at or below the documented breakpoint. | Must |

## 9. Non-functional requirements

| ID | Requirement | Measure |
| --- | --- | --- |
| NFR-001 | Accessibility | WCAG 2.2 AA for template-owned pages and interactions. |
| NFR-002 | Static availability | Core content, navigation, and source links remain available from generated HTML if client hydration fails. |
| NFR-003 | Performance | Lighthouse desktop scores of at least 95 for performance, accessibility, best practices, and SEO on the fictional sample site. |
| NFR-004 | Privacy | No analytics, trackers, cookies, or network requests beyond user-invoked GitHub links and page assets. |
| NFR-005 | Security | No user content is interpolated into HTML outside framework escaping. URLs are constructed through URL APIs. GitHub Actions use least privilege and immutable commit pins. |
| NFR-006 | Portability | Build and link checks pass for root base `/` and nested base `/demo-site/`. |
| NFR-007 | Reproducibility | The template commits a lockfile and CI installs with `npm ci` on Node 24. |
| NFR-008 | Maintainability | Custom Vue components stay focused, share pure URL helpers, and keep browser APIs inside lifecycle-driven code. |
| NFR-009 | Browser support | Current stable Chromium, Firefox, and WebKit, plus responsive layouts from 360 to 1,920 CSS pixels. |
| NFR-010 | Content integrity | Broken internal routes, anchors, configured navigation entries, unresolved markers, and missing referenced assets fail validation. |
| NFR-011 | Publishing safety | The skill must ask before publishing repository-derived content when repository visibility and Pages visibility could differ. |

## 10. Information architecture

### 10.1 Optional starter blueprint

Spectator imposes no required information architecture. The following blueprint
is an optional starting point that Copilot may adapt, combine, reorder, replace,
or omit based on the supplied context.

| Example navigation group | Example page | Possible content |
| --- | --- | --- |
| Start here | Overview | Status, audience, problem, outcome, scope, primary review action, document map. |
| Proposal | Goals and non-goals | Explicit outcomes, boundaries, and excluded work. |
| Proposal | User experience | Personas, user journeys, scenarios, and externally visible behavior. |
| Proposal | Requirements | Stable functional and non-functional requirement identifiers. |
| Design | Architecture | Components, boundaries, dependencies, data flow, and diagrams where useful. |
| Design | Interfaces and data | APIs, commands, events, schemas, persistence, compatibility, and examples as applicable. |
| Assurance | Security and privacy | Trust boundaries, permissions, abuse cases, data handling, and mitigations. |
| Assurance | Reliability and operations | Failure modes, observability, deployment, support, recovery, and ownership as applicable. |
| Delivery | Testing and acceptance | Test strategy, requirement traceability, rollout validation, and done criteria. |
| Delivery | Rollout and migration | Sequencing, compatibility, migration, rollback, and deprecation as applicable. |
| Decisions | Alternatives and decisions | Considered approaches, tradeoffs, decisions, and consequences. |
| Decisions | Open questions | Owner, decision needed, impact, and target date for each unresolved question. |
| Reference | Glossary | Definitions and links to full treatment. |
| Reference | Sources | Primary references and repository evidence. |

### 10.2 Other possible pages

Copilot may add any pages supported by the context, including:

- visual and interaction design;
- protocol specification;
- database schema and migration;
- threat model;
- performance model;
- cost model;
- compliance;
- internationalization;
- accessibility details;
- experiment design;
- compatibility matrix;
- implementation plan;
- API reference;
- decision log;
- appendices.

### 10.3 Home page options

The author may use a VitePress home layout, an ordinary Markdown document, or a
custom page. The VitePress home layout supports:

1. site name;
2. proposal title;
3. one-sentence outcome;
4. status badge rendered in visible page content;
5. primary action to begin reading;
6. secondary action to review requirements;
7. secondary action to inspect open decisions;
8. three context-specific feature or principle summaries;
9. hero illustration;
10. short problem statement;
11. system or proposal model;
12. link to source repository.

When these elements are used, they must remain useful when shared as the first
page a reviewer sees. Generic copy such as "Welcome to Spectator" is forbidden in
generated sites.

## 11. Editorial model

### 11.1 Evidence labels

Generated prose uses these labels where status may be ambiguous:

| Label | Meaning |
| --- | --- |
| Current | Verified behavior in the source repository or deployed system. |
| Decision | A selected direction with an identified authority. |
| Proposed | Behavior this specification recommends but that is not implemented. |
| Assumption | A premise that needs validation. |
| Risk | A possible negative outcome with impact and mitigation. |
| Open question | A decision or fact that remains unresolved. |
| Example | Illustrative material that is not itself normative. |

### 11.2 Requirement language

- Use "must" for mandatory behavior.
- Use "should" for a preferred behavior that may have a documented exception.
- Use "may" for optional behavior.
- Give every normative requirement a stable identifier.
- Keep hard safety, security, privacy, and compatibility requirements separate
  from weighted preferences or quality scores.

### 11.3 Plain-language support

The template provides an `::: plain-language [term]` Markdown container. It renders
as a semantic `aside` with `role="note"` and a visible "In plain language" label.

The fictional gallery example demonstrates it. Generated sites use it when a
section introduces several domain terms that would block the stated audience.
Projects may define a term list and density threshold for an optional jargon
audit, but the template must not ship the Eval Authoring Guide's domain term list.

### 11.4 Content quality rules

1. Lead with the decision, outcome, or user impact.
2. Separate current behavior from proposed behavior.
3. Prefer tables for comparisons and contract summaries.
4. Use concrete examples and counterexamples.
5. State limitations beside the claim they constrain.
6. Link research claims to primary sources when available.
7. Keep generated navigation synchronized with content.
8. Do not leave generated TODO markers in a site reported as complete.
9. Preserve open questions only when the user intentionally leaves them open, and
   assign each an owner or decision path.

## 12. Interaction design

### 12.1 Global navigation

Desktop order:

1. site title;
2. search;
3. key specification destinations;
4. Feedback;
5. appearance control;
6. GitHub source link.

At narrower widths, VitePress collapses lower-priority navigation into accessible
menus. Search, mobile navigation, sidebar, and page-outline controls remain
keyboard accessible and carry clear accessible names.

### 12.2 Document reading view

Wide layout:

```text
Top navigation

Curated sidebar | Article content | On this page
                | Footer review  |
                | Previous/next  |
```

Narrow layout:

```text
Top bar
Sidebar control | On this page control
Article content
Footer review
Previous/next
```

Article width prioritizes readable line length. Tables may scroll horizontally
without forcing the whole viewport to overflow.

### 12.3 Page feedback

Every document footer displays:

```text
Found something inaccurate, unclear, or missing on this page?
Open a GitHub issue
```

The issue uses:

- title: the prefix `Feedback: ` followed by the current page title;
- label: configured feedback label, default `feedback`;
- body fields: source page, published page, selected text when present, feedback
  prompt.

If the repository does not contain the configured label, GitHub may omit it. The
issue creation flow must still work.

### 12.4 Selected-text review

When a reviewer selects text within `.vp-doc`, a fixed-position toolbar appears
near the selection. Placement is clamped so the toolbar remains inside the
viewport. If insufficient space exists above the selection, it appears below.

The toolbar contains:

1. Create issue
2. Edit page

Behavior:

- `mouseup`, `touchend`, and keyboard selection changes schedule measurement after
  the browser finalizes the selection;
- scroll and resize recalculate placement;
- route changes dismiss the toolbar and clear stale page context;
- Escape dismisses the toolbar;
- clicking within the toolbar must not collapse the selection before the action
  reads it;
- the toolbar uses a real button for issue creation and a link for GitHub editing;
- focus moves to the toolbar only when the reviewer invokes a keyboard command,
  so mouse selection does not unexpectedly steal focus;
- `aria-label` text describes both actions;
- the toolbar respects reduced-motion preferences.

### 12.5 Theme

The template inherits VitePress's light, dark, and system appearance behavior. A
small token layer defines:

- brand accent;
- accent-soft background;
- note accent, background, border, badge, and label colors;
- optional status colors;
- illustration corner radius.

Generated sites may change the accent but must validate contrast in both themes.
The default must avoid purple and indigo as generic AI styling.

### 12.6 Media

The template ships labeled placeholders for:

| File | Purpose | Recommended size |
| --- | --- | --- |
| `public/images/favicon.svg` | Browser and bookmark identity | Square vector |
| `public/images/og.png` | Link previews | 1200 by 630 |
| `public/images/logo.svg` | Optional navigation identity | Square vector |
| `public/images/hero.png` | Home proposal model or product view | 1280 by 640 |
| `public/images/page-example.png` | Example page illustration | 880 by 560 |

`public/images/IMAGES.md` records which files remain placeholders. The creation
skill reuses existing repository images first, requests only images the site uses,
and leaves a visible labeled placeholder when no real image is available.

## 13. Technical architecture

### 13.1 Technology choice

Spectator uses VitePress and Vue.

VitePress is preferred over Astro, Eleventy, Jekyll, and a custom React
application because the current requirement is a specification publication
system, not a general marketing site or client application. It provides the
required documentation navigation, page outline, local search, Markdown pipeline,
code rendering, accessibility baseline, and static generation without custom
implementations for each capability.

### 13.2 Template layout

```text
templates/spectator/
  template.json
  README.md
  package.json
  package-lock.json
  .gitignore
  .github/
    workflows/
      deploy.yml
  spectator.config.ts
  docs/
    index.md
    proposal/
      goals.md
      user-experience.md
      requirements.md
    design/
      architecture.md
      interfaces-and-data.md
    assurance/
      security-and-privacy.md
      reliability-and-operations.md
    delivery/
      testing-and-acceptance.md
      rollout-and-migration.md
    decisions/
      alternatives-and-decisions.md
      open-questions.md
    reference/
      glossary.md
      sources.md
    public/
      images/
        favicon.svg
        og.png
        logo.svg
        hero.png
        page-example.png
        IMAGES.md
    .vitepress/
      config.mts
      theme/
        index.ts
        custom.css
        FeedbackPrompt.vue
        SelectionActions.vue
        feedback-links.ts
  scripts/
    validate-content.mjs
  tests/
    feedback-links.test.mjs
    content-contract.test.mjs
    e2e/
      spectator.spec.ts
  playwright.config.ts
```

`spec.md` is a registry development artifact and is not copied into generated
sites because the registry generator must add it to its skipped template entries.
If the generator does not skip it, the implementation must move this file to the
registry's contributor documentation before Spectator is released.

### 13.3 Shared configuration

`spectator.config.ts` is data-only and safe to import from both VitePress config
and browser-bundled Vue code.

It defines:

```ts
interface SpectatorConfig {
  siteName: string;
  description: string;
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
    top: NavItem[];
    sidebar: SidebarGroup[];
  };
}
```

Default sentinel-backed values:

| Field | Value |
| --- | --- |
| `siteName` | `__SITE_NAME__` |
| `repo` | `__REPO_SLUG__` |
| VitePress `base` | `__BASE_PATH__` |
| canonical site URL | `__SITE_URL__` |
| `branch` | `main` |
| `contentRoot` | `docs` |
| feedback label | `feedback` |
| selection limit | `1500` |

The implementation must use explicit types and validation at build time. An
invalid repository slug, branch, content root, navigation route, or selection
limit fails the build with a useful error.

### 13.4 Feedback helpers

`feedback-links.ts` contains pure functions for:

1. source page URL;
2. GitHub edit URL;
3. general feedback issue URL;
4. page feedback issue URL;
5. selected-text feedback issue URL;
6. Unicode-safe text clipping;
7. Markdown blockquote formatting.

Use `URL` and `URLSearchParams` to encode query values. Treat page metadata and
selected text as untrusted data. Do not inject either through `innerHTML`.

### 13.5 Server-side rendering boundary

The custom theme may import browser-independent configuration and URL helpers at
module scope. Access to `window`, `document`, `Node`, `Element`, `Selection`,
`Range`, and viewport geometry must occur only after component mount or behind a
browser guard.

All global listeners must be removed before unmount. Timers scheduled for
selection measurement must be canceled before unmount and route changes.

### 13.6 Base-path strategy

VitePress configuration uses:

```ts
base: "__BASE_PATH__"
```

Rules:

1. use VitePress-aware internal links in Markdown;
2. use `withBase()` or `import.meta.env.BASE_URL` for custom component assets and
   routes;
3. never hardcode a root-only asset URL;
4. validate a user-site base of `/`;
5. validate a project-site base of `/demo-site/`;
6. confirm the built favicon, social image, article images, scripts, styles,
   search index, and navigation resolve under both bases.

### 13.7 Deployment

The template ships `.github/workflows/deploy.yml` with:

- triggers for pushes to `main` and manual dispatch;
- `contents: read`, `pages: write`, and `id-token: write`;
- one Pages concurrency group with `cancel-in-progress: false`;
- Node 24;
- `npm ci`;
- `npm run build`;
- `actions/configure-pages`, `actions/upload-pages-artifact`, and
  `actions/deploy-pages`;
- upload path `docs/.vitepress/dist`;
- the `github-pages` environment and deployed page URL.

At implementation time, use the latest stable major accepted by GitHub Pages. The
current create skill contract expects `configure-pages@v6`,
`upload-pages-artifact@v5`, and `deploy-pages@v5`. Pin each action to an immutable
commit SHA and retain a version comment.

### 13.8 No backend

Spectator has no application server, database, API, authentication layer, or
runtime secret. GitHub handles issue creation, repository editing, authorization,
and pull requests after the reviewer follows an explicit link.

## 14. Template registry integration

### 14.1 Proposed manifest

```json
{
  "name": "spectator",
  "title": "Spectator",
  "tagline": "Publish specifications built for review.",
  "description": "A VitePress specification site with curated navigation, local search, plain-language notes, GitHub issue feedback for pages and selected text, and direct edit links.",
  "framework": "VitePress",
  "tier": "ssg",
  "language": "TypeScript",
  "needsBuild": true,
  "build": "vitepress build docs",
  "output": "docs/.vitepress/dist",
  "basePathMechanism": "base in VitePress config with base-aware links and assets",
  "deploy": "configure-pages + upload-pages-artifact + deploy-pages",
  "tags": ["vitepress", "specification", "docs", "review", "feedback"],
  "features": [
    "Curated specification navigation",
    "Local search and page outlines",
    "Light and dark themes",
    "Page and selected-text GitHub feedback",
    "Direct GitHub edit links",
    "Plain-language callouts",
    "Content integrity checks"
  ],
  "order": 6
}
```

### 14.2 Registry changes required with implementation

1. Add the complete `templates/spectator/` template.
2. Update `scripts/new-site.mjs` so `spec.md` is not copied, or relocate this
   development specification before release.
3. Add `spectator` to `PER_TEMPLATE_ACTIONS` in `scripts/validate.mjs`.
4. Add validation that every buildable template's output path exists after its
   preview build.
5. Regenerate `site/templates.json`.
6. Build the gallery preview at `site/preview/spectator/`.
7. Update the registry README template table.
8. Update contributing documentation with VitePress base-path guidance.
9. Reconcile the registry's documented Pages action majors with the installed
   creation skill's current action contract.

## 15. `create-gh-pages-site` integration

The template alone is discoverable only when the user names `spectator`.
Automatic selection requires a companion change to the skill.

### 15.1 Selection rule

Choose Spectator when the user asks for:

- a published specification;
- a technical spec;
- an RFC;
- a design proposal;
- an architecture proposal;
- an engineering decision document;
- a policy proposal intended for structured review;
- a site like the Eval Authoring Guide whose primary content is a proposal or
  specification.

Do not choose Spectator for:

- a general documentation portal without a proposal;
- a blog;
- a marketing landing page;
- an interactive dashboard;
- an API reference whose primary need is generated API documentation.

### 15.2 Authoring inputs

Before authoring, the skill resolves:

1. target repository and Pages base;
2. specification subject;
3. intended reviewers;
4. decision the specification should enable;
5. known status and decision authority;
6. repository evidence available to substantiate current behavior;
7. visibility constraints for publishing repository-derived content.

The skill should ask only for missing information. It can begin with repository
evidence, but it must not infer a decision authority or publication approval.

### 15.3 Authoring pipeline

```text
User context and repository digest
  -> classify specification type
  -> inventory relevant repository evidence
  -> design a context-specific free-form information architecture
  -> resolve material design decisions with the user
  -> stamp Spectator
  -> replace fictional sample content
  -> generate the chosen navigation structure
  -> generate or reuse images
  -> validate claims and publishing integrity
  -> build at the target base path
  -> request publication approval
```

### 15.4 Generation rules

1. Use real repository names, commands, APIs, components, paths, and constraints.
2. Cite repository evidence using source links or file paths.
3. Preserve user-provided decisions as decisions.
4. Mark recommendations as proposed until the user accepts them.
5. Ask about material alternatives rather than silently choosing.
6. Do not report a specification as complete with unresolved placeholders.
7. An intentionally open question may remain only when its impact and decision
   path are documented.
8. When navigation is curated, regenerate it after creating, moving, or removing
   a page.
9. Replace every fictional sample title, feature, requirement, source, and image
   reference.
10. Run content checks, unit tests, browser tests, and a production build.

### 15.5 Stock-content detection

The fictional preview must expose a machine-readable list of sample markers, or
the skill must maintain a known list. Generated-site validation fails if any
marker remains outside README or contributor guidance.

Markers must include:

- fictional project name;
- fictional repository slug;
- sample requirement identifiers;
- sample owner names;
- sample source links;
- "replace this" authoring prompts.

## 16. Security and privacy

### 16.1 Trust boundaries

| Input | Trust level | Handling |
| --- | --- | --- |
| Repository slug and branch | Configuration input | Validate format before constructing GitHub URLs. |
| VitePress page title and path | Generated metadata | Encode through URL query APIs. |
| Selected text | Untrusted reviewer-controlled content | Clip, quote as Markdown text, and encode as a query value. |
| Markdown content | Repository-controlled content | Render through VitePress without raw HTML injection from runtime input. |
| External links | Author-controlled content | Use clear link text and safe external-link behavior. |

### 16.2 Privacy behavior

- No selected text leaves the page until the reviewer activates Create issue.
- No issue is created automatically. GitHub displays its normal confirmation
  surface.
- The site does not read GitHub identity, issue data, or repository permissions.
- The template ships no analytics.
- The specification warns authors before publishing private or sensitive source
  material to a public Pages site.

### 16.3 Workflow security

- GitHub Actions receive only the minimum Pages permissions.
- Third-party deployment actions are forbidden.
- Action references use immutable commit SHAs.
- Dependency installation uses the committed lockfile.
- The workflow does not expose secrets to pull-request builds.

## 17. Accessibility

The implementation must verify:

1. skip-to-content works;
2. all menus, search, theme, feedback, and edit actions are keyboard operable;
3. visible focus indicators meet contrast requirements;
4. the selected-text toolbar is reachable without relying on a pointer;
5. touch selection does not trap scrolling;
6. headings follow a logical hierarchy;
7. page illustrations have descriptive alternative text;
8. decorative icons are hidden from assistive technology;
9. controls have accessible names;
10. status is not communicated by color alone;
11. tables retain headers and scroll within their own container on small screens;
12. light and dark themes meet AA contrast;
13. zoom to 200 percent does not hide content or controls;
14. reduced-motion preferences are respected;
15. the page remains understandable without custom CSS.

## 18. Search, metadata, and discoverability

The template must configure:

- title and title template;
- description;
- canonical site URL;
- favicon;
- Open Graph title, description, type, URL, and image;
- social card metadata;
- local search;
- clean URLs;
- sitemap when a canonical hostname is available;
- useful 404 metadata;
- source repository social link.

Search indexing must include published specification content and exclude internal
generation instructions, tests, and development artifacts.

## 19. Test strategy

### 19.1 Unit tests

Test every feedback helper for:

- root and nested Pages bases;
- ordinary and Unicode page titles;
- spaces and reserved characters in source paths;
- configured branch and content root;
- issue labels;
- canonical page URL;
- multiline selected text;
- Markdown-significant selected text;
- empty selection;
- exactly 1,500 code points;
- over-limit text with an ellipsis;
- surrogate pairs and combined characters;
- opener-safe external links.

### 19.2 Content-contract tests

Tests must fail for:

1. relative internal Markdown links that do not follow the chosen clean-link
   convention;
2. links to missing pages;
3. links to missing heading anchors;
4. pages absent from configured curated navigation;
5. configured navigation routes with no page;
6. duplicate requirement identifiers;
7. unresolved registry sentinels;
8. unresolved generation markers;
9. image references with no file;
10. images without non-empty alternative text;
11. missing `IMAGES.md`;
12. hardcoded repository slugs outside the shared configuration and tests.

### 19.3 Component tests

Verify:

- footer feedback content and URL;
- selected-text visibility rules;
- issue and edit actions;
- Escape dismissal;
- dismissal on route change;
- listener and timer cleanup;
- disabled-feedback behavior;
- server-side rendering without browser globals.

### 19.4 Browser tests

Run Playwright with a line reporter against production builds for `/` and
`/demo-site/`.

Verify:

1. home page loads without console errors or failed requests;
2. favicon and social image resolve;
3. internal navigation works;
4. local search finds a known requirement;
5. light and dark themes render;
6. code copy works;
7. desktop sidebar and page outline work;
8. mobile navigation, sidebar, and page outline work at 390 by 844;
9. mouse-selected article text opens the toolbar;
10. keyboard-selected article text opens the toolbar;
11. touch selection opens the toolbar where browser support permits;
12. the issue URL contains encoded page and selected-text context;
13. the edit link targets the current Markdown file;
14. selection outside article content does not open the toolbar;
15. Escape and route changes dismiss the toolbar;
16. a clean URL can be loaded directly;
17. the 404 page links back to valid content.

### 19.5 Registry validation

From `gh-pages-templates`:

```powershell
npm test
node scripts/new-site.mjs spectator --repo octocat/demo-site --dir <temp>
```

From the stamped temporary site:

```powershell
npm ci
npm test
npm run build
```

Validation must also inspect the built HTML and assets to prove that nested links
carry `/demo-site/` where required.

## 20. Acceptance criteria

| ID | Acceptance criterion | Requirements |
| --- | --- | --- |
| AC-001 | `node scripts/new-site.mjs spectator --repo octocat/demo-site` produces a complete buildable site with no unresolved sentinel. | FR-001 to FR-005 |
| AC-002 | The creation skill selects Spectator from a natural-language request for a published technical specification. | FR-006 |
| AC-003 | Generated content uses a context-specific free-form structure, reflects supplied repository and user context, and contains no fictional preview content or unsupported claim. | FR-007, FR-008, FR-018 to FR-025 |
| AC-004 | The site provides the complete desktop and mobile reading experience listed in Sections 6 and 12. | FR-009 to FR-017 |
| AC-005 | Global, page, selected-text, and direct-edit review paths generate correct GitHub URLs. | FR-026 to FR-037 |
| AC-006 | Selection feedback works for mouse and keyboard and does not activate outside article content. | FR-029 to FR-036 |
| AC-007 | Light and dark themes, media placeholders, favicon, social card, and responsive plain-language notes meet design requirements. | FR-038 to FR-043 |
| AC-008 | Root and nested production builds pass all content, unit, component, browser, accessibility, and asset checks. | NFR-001 to NFR-010 |
| AC-009 | GitHub Pages workflow uses current first-party actions, immutable pins, least privilege, Node 24, and `npm ci`. | NFR-005, NFR-007 |
| AC-010 | The template appears in the registry catalog and has a working live preview. | Section 14 |
| AC-011 | Publishing private or sensitive repository-derived content requires an explicit user decision. | NFR-011 |

## Impact Scan

| Surface | Expected implementation impact |
| --- | --- |
| `templates/spectator/` | Add the complete VitePress template, sample content, review components, validation, tests, media placeholders, and documentation. |
| `scripts/new-site.mjs` | Exclude this development specification from stamped sites or relocate it before release. |
| `scripts/validate.mjs` | Register Spectator's required Pages actions and add template-specific build assertions. |
| `site/templates.json` | Regenerate the committed catalog from manifests. |
| `site/preview/spectator/` | Build as a derived gallery artifact, not committed source. |
| `README.md` and `CONTRIBUTING.md` | Document Spectator, VitePress base paths, local development, and contribution checks. |
| `create-gh-pages-site` skill | Add template selection, authoring guidance, validation, and eval scenarios in the skill's source repository. |
| `eval-authoring-guide` | Read-only reference. No source change is required. |

## Convention Discovery

The specification follows these established repository contracts:

1. A template is a self-contained folder with `template.json`, a Pages workflow,
   README, and site files
   (`gh-pages-templates/CONTRIBUTING.md:7-19`).
2. The manifest supplies catalog metadata, build command, output directory,
   base-path mechanism, tags, features, and order
   (`gh-pages-templates/scripts/validate.mjs:18-20`).
3. Existing sentinels are replaced in one pass and must not remain in stamped
   output (`gh-pages-templates/scripts/new-site.mjs:33-39`, `121-168`).
4. The registry catalog and live previews are derived from manifests
   (`gh-pages-templates/scripts/build-catalog.mjs:16-31`,
   `scripts/build-site.mjs:55-126`).
5. Existing JavaScript templates use npm, and the gallery preview builder runs
   `npm install` followed by `npm run build`
   (`gh-pages-templates/scripts/build-site.mjs:87-93`).
6. The reference site extends VitePress's default theme instead of replacing the
   reading shell (`eval-authoring-guide/docs/.vitepress/theme/index.ts:10-17`).
7. Browser and selection APIs remain inside lifecycle-driven Vue code so static
   generation stays safe
   (`eval-authoring-guide/docs/.vitepress/theme/SelectionIssue.vue:97-109`).

## Gut-Check Results

| Lens | Result |
| --- | --- |
| Greenfield reframe | VitePress remains the preferred choice for a specification publishing template because it directly supplies the required documentation behavior. |
| Proportionality | The shared typed configuration and feedback helper module are justified by multiple consumers: VitePress config, footer feedback, selection feedback, edit links, metadata, and tests. No plugin system or framework abstraction is proposed. |
| Sunk cost | The choice is not based only on the reference implementation. Astro, Astro with Starlight, Docusaurus, and a custom application were considered. VitePress has the smallest custom surface for the current requirements. |
| User-selected flexibility | Fully free-form content weakens semantic completeness checks, but this is an explicit product decision. Spectator validates publishing integrity and leaves content structure to authors and Copilot. |

## Pre-Completion Interview

The review on September 3, 2026 resolved every material design question:

| Decision | Resolution |
| --- | --- |
| Framework | Keep VitePress and its minimal Vue theme layer. |
| Information architecture | Allow fully free-form pages and content. Validate publishing integrity only. |
| Feedback system | Use GitHub issues for comments and GitHub pull requests for edits. |
| Visual identity | Preserve the restrained layout and illustration pattern with a neutral configurable accent. |

No blocking or near-term specification decision remains open.

## 21. Implementation sequence

### Phase 1: Registry foundation

1. Finalize review decisions in Section 24.
2. Create manifest, package files, VitePress config, shared configuration, and
   fictional sample content.
3. Add base-path-aware Pages deployment.
4. Add the registry validator entry and catalog metadata.

Quality gate:

- Spectator stamps and builds at root and nested bases.
- Registry validation recognizes the template.

### Phase 2: Reading and visual system

1. Configure home, top navigation, sidebar, page outline, footer, search, theme,
   metadata, favicon, 404 page, and media placeholders.
2. Add the plain-language Markdown container and responsive styles.
3. Verify desktop, mobile, light, dark, zoom, and reduced-motion behavior.

Quality gate:

- Reading, navigation, search, appearance, and media acceptance criteria pass.

### Phase 3: GitHub review system

1. Implement shared feedback URL helpers.
2. Implement page footer feedback.
3. Implement selected-text actions with complete lifecycle cleanup.
4. Add unit, component, and browser tests.

Quality gate:

- All four review paths generate correct URLs.
- Mouse and keyboard review interactions pass in supported browsers.
- Server-side rendering has no browser-global failure.

### Phase 4: Authoring and content integrity

1. Implement the fictional sample and demonstrate free-form content organization.
2. Implement link, anchor, configured navigation, identifier, image, and marker
   checks.
3. Add stock-content detection.
4. Document the authoring contract and image handoff.

Quality gate:

- Invalid fixture sites fail for the intended reason.
- The fictional sample passes every content contract.

### Phase 5: Copilot skill integration

1. Add Spectator to the skill's template selection guidance.
2. Add the specification interview and generation pipeline.
3. Add skill eval cases for explicit and inferred Spectator selection.
4. Verify the skill replaces sample content, preserves evidence boundaries, and
   asks before public publication.

Quality gate:

- Explicit and natural-language generation scenarios produce a complete
  target-specific Spectator site.

### Phase 6: Gallery and release

1. Generate `site/templates.json`.
2. Build the live preview.
3. Run the complete registry and stamped-site validation matrix.
4. Review generated output for content accuracy, accessibility, visual quality,
   security, privacy, base paths, and stock copy.

Quality gate:

- All acceptance criteria pass with no console error, failed asset, broken link,
  unresolved marker, or sample-content leak.

## 22. Quality gates

The implementation is not complete unless every gate passes.

| Gate | Required result |
| --- | --- |
| Registry contract | Manifest, workflow, catalog, generator stamp, and live preview pass. |
| Root base | Production site works from `/`. |
| Project base | Production site works from `/demo-site/`. |
| Content integrity | All routes, anchors, configured navigation, identifiers, and images pass. |
| Unit tests | All feedback-link and clipping cases pass. |
| Component tests | Rendering, interaction, cleanup, disabled state, and server-side generation pass. |
| Browser tests | Chromium, Firefox, and WebKit pass required interactions. |
| Accessibility | Automated checks pass and keyboard, zoom, contrast, mobile, and screen-reader landmarks receive manual review. |
| Security and privacy | URL encoding, untrusted text handling, workflow permissions, action pins, and no-telemetry claims pass review. |
| Performance | Required Lighthouse thresholds pass on the fictional sample. |
| Content replacement | No stock marker remains in a generated target site. |
| Skill selection | Explicit and inferred specification prompts select Spectator. |
| Publication safety | Public publishing is never inferred for private or sensitive context. |

## 23. Done definition

Spectator is done when:

1. all review decisions are resolved;
2. all functional and non-functional requirements have implementation evidence;
3. every acceptance criterion passes;
4. the template builds with a committed lockfile on Node 24;
5. root and nested Pages bases both work;
6. all GitHub review links contain correct repository, branch, page, canonical URL,
   and selection context;
7. custom interactions pass unit, component, and browser tests;
8. there are no browser console errors, failed requests, broken links, missing
   assets, unresolved markers, or leaked fictional content;
9. the live registry preview works;
10. the creation skill selects and authors Spectator correctly;
11. README and contribution documentation explain local development, content
    authoring, configuration, image replacement, testing, Pages enablement, and
    review behavior;
12. the final implementation receives code, architecture, accessibility, and
    security review with no unresolved blocking finding.

## 24. Decisions for review

### D-001: Framework

Decision: Keep VitePress and its minimal Vue theme layer.

Rationale: It directly provides the complete specification reading model and is
the architecture proven by the Eval Authoring Guide. Recreating its sidebar,
outline, search, Markdown, edit metadata, and static generation in a general
framework would add complexity without a product benefit. Most page output is
static HTML, and replacing VitePress only to use React would not improve the
specification workflow.

Status: Approved during review

### D-002: Information architecture

Decision: Use fully free-form pages and content. Spectator validates publishing
integrity, not specification completeness. The template may offer an optional
starter blueprint, but authors and Copilot can replace or omit every section.

Rationale: Maximum flexibility is more important than enforcing consistent
specification structure through the website template.

Status: Approved during review

### D-003: Feedback system

Decision: Use GitHub issues for comments and the GitHub editor for proposed
changes. Do not add GitHub Discussions or an embedded comment service.

Rationale: This exactly matches the proven review model, works with a static site,
and keeps comments actionable in the repository workflow.

Status: Approved during review

### D-004: Visual identity

Decision: Preserve the Eval Authoring Guide's restrained publication layout and
illustration pattern, but use a neutral configurable accent rather than its amber
identity.

Rationale: The layout is reusable. The amber palette belongs to the reference
guide and would make unrelated specifications appear to share its brand.

Status: Approved during review

## 25. Traceability to the request

| Requested outcome | Specification coverage |
| --- | --- |
| A specification website like the Eval Authoring Guide | Sections 6, 7, 8, 10, 11, and 12 |
| Publish the website | Sections 13.6, 13.7, 14, and 20 |
| Let people review and comment | Sections 6.5, 8.4, 12.3, 12.4, and 15 |
| Put all reusable design and functionality into a template | Sections 7 through 19 |
| Reuse the template for future specifications | Sections 2, 8.1, 10, 11, and 15 |
| Invoke it through `create-gh-pages-site` | Section 15 |
| Place the specification in `templates/spectator` | This file |
| Deeply reverse engineer the Eval Authoring Guide | Section 6 and the feature disposition in Section 7 |
| Review the specification together | Section 24 |
