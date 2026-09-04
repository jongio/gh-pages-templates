# Contributing a template

Templates are self-contained folders under `templates/<name>/`. Adding one is a
folder plus a manifest — the generator and the site catalog pick it up
automatically.

## Anatomy of a template

```text
templates/<name>/
  template.json                 Manifest (required — see below)
  .github/workflows/deploy.yml  Pages deploy workflow (required)
  package-lock.json/Gemfile.lock Locked graph for buildable templates
  README.md                     Human docs for the stamped site (required)
  <site files…>                 index.html / src/ / _config.yml / etc.
  .gitignore                    What the user's repo should ignore (recommended)
```

`template.json`, a registry-only `spec.md`, `node_modules`, `dist`, `_site`, and
`.git` are **never** copied into a stamped site (the generator excludes them).

## The manifest (`template.json`)

```json
{
  "name": "my-template",              // must equal the folder name
  "title": "My Template",             // shown in the site catalog
  "tagline": "One-line pitch.",       // short
  "description": "A sentence or two on what it is and when to pick it.",
  "framework": "Svelte",              // human-readable
  "tier": "ssg",                      // static | ssg | spa | data | native
  "language": "JavaScript",
  "thumbnail": "assets/thumbnails/my-template.png",
  "needsBuild": true,                 // false for zero-build static
  "build": "vite build",              // build command, or null
  "output": "dist",                   // build output dir, or "." for static
  "basePathMechanism": "base in svelte.config.js",
  "deploy": "configure-pages + upload-pages-artifact + deploy-pages",
  "tags": ["svelte", "ssg"],
  "features": ["Light/dark toggle", "GitHub source link"],
  "order": 6                          // catalog sort order
}
```

`output` must name a POSIX-style relative directory inside the stamped template. Absolute,
traversing, file, and symbolic-link outputs are rejected before publication.

Every template needs a 1024 by 1024 PNG thumbnail at
`site/assets/thumbnails/<name>.png`. Use the shared Azure GPT Image 2 process
documented in `docs/thumbnail-prompts.md`, and add the exact prompt to
`scripts/thumbnail-prompts.json`.

After editing manifests, regenerate the committed catalog:

```sh
node scripts/build-catalog.mjs   # writes site/templates.json
```

(`validate.mjs` fails if `site/templates.json` is out of sync.)

## Base-path handling (the important part)

A project site is served from `https://USER.github.io/REPO/`, so the template must
make its base path configurable. Use these sentinels — the generator replaces them
when stamping, deriving values from `--repo` (and detecting `USER.github.io` user
sites, where the base collapses to `/`):

| Sentinel | Replaced with | Use for |
| --- | --- | --- |
| `__BASE_PATH__` | `/repo/` (or `/`) — trailing slash | Vite/Astro `base`, Eleventy `pathPrefix`, the workflow's `PATH_PREFIX` |
| `__BASE_URL__` | `/repo` (or ``) — no trailing slash | Jekyll `baseurl` |
| `__SITE_NAME__` | the human title | page titles, headings |
| `__SITE_URL__` | `https://user.github.io/repo/` | meta, README |
| `__SITE_ORIGIN__` | `https://user.github.io` | Astro `site`, Jekyll `url` |
| `__REPO_SLUG__` | `owner/repo` | links to the repo |
| `__PKG_NAME__` | npm-safe name | `package.json` `name` |

If the framework needs no base path (all relative links), you don't need
`__BASE_PATH__` at all — see `static-html`.

For VitePress, set `base` to `__BASE_PATH__`. Use VitePress-aware Markdown links
for pages and public assets, and verify both `/` and a nested project base.

## The deploy workflow

Use the official **GitHub Actions** Pages flow (Source = "GitHub Actions"):

```text
actions/configure-pages@v6 → build → actions/upload-pages-artifact@v5 → actions/deploy-pages@v5
```

Use current supported action releases. New templates should pin every action to
its full commit SHA. The creation skill normalizes known legacy action tags to
reviewed immutable pins before applying a template.

Every `deploy.yml` MUST declare:

- top-level `permissions: { contents: read }`
- build-job `permissions: { contents: read, pages: read }`
- deploy-job `permissions: { pages: write, id-token: write }`
- both jobs guarded to `refs/heads/__DEFAULT_BRANCH__`
- exactly one `actions/deploy-pages` step in the privileged deploy job
- `persist-credentials: false` on checkout steps
- a timeout on every runner job
- `concurrency: { group: pages, cancel-in-progress: false }`
- the `github-pages` environment on the deploy job
- only first-party actions — no `peaceiris/actions-gh-pages`, no
  `actions/upload-artifact`, no pre-cutover `deploy-pages` majors

`scripts/validate.mjs` enforces all of this.

## Validate

```sh
npm test                                   # validate.mjs: manifests + workflows + stamp + catalog sync
npm run build                              # build all seven previews; requires Node 24 and Ruby 4
node scripts/new-site.mjs my-template --repo octocat/demo --dir /tmp/x
cd /tmp/x && npm ci --ignore-scripts && npm run build  # if it builds
```

Confirm the built output's asset/link URLs carry the project prefix (`/repo/…`),
not bare `/…`. Then open a PR.
