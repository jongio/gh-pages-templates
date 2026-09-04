# gh-pages-templates

A registry of ready-to-deploy **GitHub Pages** starter templates, with a
browsable gallery — **live previews included** — that deploys itself to Pages.

Each template ships the current official GitHub Actions Pages workflow and the
correct **base-path** setup, so it deploys correctly to a user site (`/`) or a
project site (`/repo/`) with no fiddling.

> Browse the gallery: **https://jongio.github.io/gh-pages-templates/**.

## Templates

| Template | Use it for | Base path | Build |
| --- | --- | --- | --- |
| `static-html` | landing pages, a few hand-made pages | relative URLs (immune) | none |
| `astro` | content sites, blogs, docs, marketing | `base` in `astro.config.mjs` | `astro build` |
| `react-vite` | interactive SPAs / dashboards | `base` + `404.html` fallback | `vite build` |
| `eleventy` | data/Markdown-driven sites | `pathPrefix` via env + `url` filter | `eleventy` |
| `jekyll` | GitHub-native / existing Jekyll | `baseurl` in `_config.yml` | Jekyll |
| `skills-catalog` | searchable agent skill marketplaces | `base` in `astro.config.mjs` | `astro build` |
| `spectator` | reviewable specifications and technical proposals | VitePress `base` | `vitepress build` |

All deploy via the GitHub Actions Pages source using the current first-party
actions (`configure-pages@v6`, `upload-pages-artifact@v5`, and
`deploy-pages@v5`). Jekyll also uses `jekyll-build-pages@v1`. No `gh-pages`
branch.

## Use a template

**With the Copilot skill** (recommended) — the
[`create-gh-pages-site`](https://github.com/jongio/skills/tree/main/skills/create-gh-pages-site)
skill scaffolds from this registry. Install it by asking Copilot:

```text
install create-gh-pages-site from jongio/skills
```

Or with the [skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add jongio/skills --skill create-gh-pages-site -g --agent github-copilot
```

Then reload with `/skills reload` (or start a new session) and describe the site
you want — it scaffolds from this registry:

Every catalog card uses a generated 1024 by 1024 thumbnail. Prompt provenance
and the Azure GPT Image 2 generation command live in
[`docs/thumbnail-prompts.md`](docs/thumbnail-prompts.md).

```text
/create-gh-pages-site an Astro blog for octocat/blog
```

**With the generator** — directly from a clone of this repo:

```sh
node scripts/new-site.mjs astro --repo octocat/blog --site-name "Octocat's Blog"
```

…or from anywhere, pointing at this registry (needs git + access):

```sh
node scripts/new-site.mjs astro --repo octocat/blog \
  --registry jongio/gh-pages-templates \
  --registry-ref 0123456789abcdef0123456789abcdef01234567
```

Review the referenced registry commit before running generated build commands.
Templates contain executable framework configuration and source code.

Remote registries require a full commit SHA. Branches and tags are rejected.
Template paths, symbolic links, workflow security, and metadata are validated
before the destination is replaced.

Then push to the configured default branch and set **Settings → Pages → Source → GitHub Actions**.

## The site + live previews

The site lives in **`site/`** — a single, committed source folder you edit directly:
`index.html`, `assets/`, and `templates.json` (the catalog). It uses relative links,
so it's base-path-proof and you can open it as-is.

`scripts/build-site.mjs` regenerates the two derived pieces: it rewrites
`site/templates.json` from the template manifests, and builds a live preview of each
template into **`site/preview/<name>/`** — which is **gitignored**. You never commit
the previews; CI runs this on every deploy.

```sh
# Regenerate the catalog + build previews (Jekyll needs Ruby), then serve:
node scripts/build-site.mjs
npx serve site
```

Set `PAGES_BASE` to preview at a non-root base (CI does this automatically):

```sh
PAGES_BASE="/gh-pages-templates/" node scripts/build-site.mjs
```

If you only changed a manifest and just want to refresh the committed catalog
(without building previews):

```sh
node scripts/build-catalog.mjs   # writes site/templates.json
```

## Deploy the site

This repo deploys its own site to GitHub Pages:

1. Push to `main`.
2. **Settings → Pages → Source → GitHub Actions**.
3. `.github/workflows/deploy.yml` checks out the repository, runs the validation
   script, then runs `build-site.mjs` to regenerate the catalog and build the live previews into
   `site/preview/` (Ruby is set up for the Jekyll preview), and publishes `site/`.
   The live URL appears in the Actions run.

## Validate / contribute

```sh
npm test        # manifests, workflows, dependency policy, and generator checks
npm run build   # clean build of all seven previews; requires Node 24 and Ruby 4
```

Add a template by dropping a folder under `templates/<name>/` with a
`template.json` manifest, a gallery thumbnail, a `.github/workflows/deploy.yml`,
and base-path handling via the generator's sentinels — see
[`CONTRIBUTING.md`](CONTRIBUTING.md). CI (`validate.yml`) gates every PR.

## Layout

```text
templates/<name>/          Registry source (with __SENTINEL__ placeholders)
  template.json            Manifest (site catalog + generator read this)
  .github/workflows/deploy.yml
site/                      The site — committed source you edit + deploy
  index.html               Browse UI (static, base-path-proof)
  assets/
    app.js  styles.css
    thumbnails/            One generated 1024px PNG per template
  templates.json           Catalog (generated from manifests by build-catalog.mjs)
  preview/                 Live template previews (gitignored; built by build-site.mjs)
scripts/
  new-site.mjs             Generator — stamp a site, inject the base path
  build-catalog.mjs        Write site/templates.json from manifests
  build-site.mjs           Regenerate catalog + build previews into site/preview/
  repository-workflow-security.mjs
                            Enforce root workflow structure and approved actions
  generate-thumbnails.mjs  Generate gallery thumbnails with Azure GPT Image 2
  thumbnail-prompts.json   Reproducible thumbnail prompt source
  validate.mjs             CI gate (manifests, workflows, stamping, catalog, previews)
docs/
  thumbnail-prompts.md     Generated thumbnail provenance and reproduction guide
.github/workflows/
  codeql.yml                Scan JavaScript with CodeQL on PR/push/schedule/manual runs
  deploy.yml               Build previews + deploy site/ from main to Pages
  validate.yml             Validate on push/PR/manual; build previews off push
.github/CODEOWNERS          Require owner review for the executable CI trust base
```

## License

MIT — see [LICENSE](./LICENSE).
