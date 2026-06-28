# gh-pages-templates

A registry of ready-to-deploy **GitHub Pages** starter templates, with a
browsable gallery — **live previews included** — that deploys itself to Pages.

Each template ships the current official GitHub Actions Pages workflow and the
correct **base-path** setup, so it deploys correctly to a user site (`/`) or a
project site (`/repo/`) with no fiddling.

> Browse the gallery: **https://jongio.github.io/gh-pages-templates/** *(after
> the first deploy — see [Deploy the gallery](#deploy-the-gallery))*.

## Templates

| Template | Use it for | Base path | Build |
| --- | --- | --- | --- |
| `static-html` | landing pages, a few hand-made pages | relative URLs (immune) | none |
| `astro` | content sites, blogs, docs, marketing | `base` in `astro.config.mjs` | `astro build` |
| `react-vite` | interactive SPAs / dashboards | `base` + `404.html` fallback | `vite build` |
| `eleventy` | data/Markdown-driven sites | `pathPrefix` via env + `url` filter | `eleventy` |
| `jekyll` | GitHub-native / existing Jekyll | `baseurl` in `_config.yml` | Jekyll |

All deploy via the GitHub Actions Pages source using the current first-party
actions (`configure-pages@v5` → `upload-pages-artifact@v3` → `deploy-pages@v4`;
Astro/Jekyll use their official actions). No `gh-pages` branch.

## Use a template

**With the Copilot skill** (recommended) — install
[`create-gh-pages-site`](https://github.com/jongio/skills/tree/main/skills/create-gh-pages-site)
and describe the site you want; it scaffolds from this registry:

```
/create-gh-pages-site an Astro blog for octocat/blog
```

**With the generator** — directly from a clone of this repo:

```sh
node scripts/new-site.mjs astro --repo octocat/blog --site-name "Octocat's Blog"
```

…or from anywhere, pointing at this registry (needs git + access):

```sh
node scripts/new-site.mjs astro --repo octocat/blog --registry jongio/gh-pages-templates
```

Then push to `main` and set **Settings → Pages → Source → GitHub Actions**.

## The gallery + live previews

The gallery (`gallery/`) is a static site that lists every template. The build
script stamps each template through the generator with the gallery's base path,
**builds it**, and serves the result at `preview/<name>/`, so each card links to a
live, working demo.

Build it locally:

```sh
# Live previews for the JS/static templates (Jekyll needs Ruby):
node scripts/build-site.mjs
npx serve site
```

`site/` is the deployable output (gallery shell + `templates.json` + `preview/*`).
Set `PAGES_BASE` to preview at a non-root base (CI does this automatically):

```sh
PAGES_BASE="/gh-pages-templates/" node scripts/build-site.mjs
```

## Deploy the gallery

This repo deploys its own gallery to GitHub Pages:

1. Push to `main`.
2. **Settings → Pages → Source → GitHub Actions**.
3. `.github/workflows/deploy.yml` builds the gallery (with previews; Ruby is set up
   for the Jekyll preview) and publishes it. The live URL appears in the Actions run.

## Validate / contribute

```sh
node scripts/validate.mjs   # manifests + workflows + generator stamp checks
```

Add a template by dropping a folder under `templates/<name>/` with a
`template.json` manifest, a `.github/workflows/deploy.yml`, and base-path handling
via the generator's sentinels — see [`CONTRIBUTING.md`](CONTRIBUTING.md). CI
(`validate.yml`) gates every PR.

## Layout

```
templates/<name>/          Registry source (with __SENTINEL__ placeholders)
  template.json            Manifest (gallery + generator read this)
  .github/workflows/deploy.yml
gallery/                   Browse UI (static; copied into site/ at build)
scripts/
  new-site.mjs             Generator — stamp a site, inject the base path
  build-catalog.mjs        Catalog from manifests (library)
  build-site.mjs           Assemble site/ = gallery + catalog + live previews
  validate.mjs             CI gate (manifests + workflows + stamp)
.github/workflows/
  deploy.yml               Build + deploy the gallery to Pages
  validate.yml             Validate templates on push/PR
```

## License

MIT — see [LICENSE](./LICENSE).
