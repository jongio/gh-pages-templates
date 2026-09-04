# __SITE_NAME__

A statically-rendered **[Astro](https://astro.build)** site for GitHub Pages.

Site URL: __SITE_URL__

## Why this template

- **Fast by default.** Astro ships zero JavaScript unless a component opts into
  hydration ("islands").
- **Base path solved.** `site` and `base` in `astro.config.mjs` are set from your
  repo, and links use `import.meta.env.BASE_URL`, so a project site at
  `/REPO/` and a user site at `/` both work unchanged.
- **Official deploy.** Uses pinned first-party Pages actions and a locked npm
  install.

## Develop locally

Requires Node.js 24 or later and npm 11.10 or later.

```sh
npm ci
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
npm run preview  # serve the production build
```

## Deploy

1. Push to the repository's `__DEFAULT_BRANCH__` branch.
2. **Settings → Pages → Source → GitHub Actions**.
3. `.github/workflows/deploy.yml` builds and publishes on every push to
   `__DEFAULT_BRANCH__`.

> If you rename the repo, update `base` in `astro.config.mjs` to `/NEW-NAME/`.

## Structure

```text
astro.config.mjs           site + base for GitHub Pages
src/
  pages/                   file-based routes (index.astro, about.astro)
  layouts/Layout.astro     HTML shell + base-aware nav
  components/Card.astro    example component
public/                    static assets copied verbatim (favicon.svg)
.github/workflows/deploy.yml
```
