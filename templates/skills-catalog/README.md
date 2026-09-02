# __SITE_NAME__

__SITE_DESCRIPTION__

This Astro starter is a searchable catalog for reusable agent skills. It includes:

- Astro content collections with example skill entries
- Responsive grid and list views with persisted preferences
- Live search and detail pages
- Copy controls for install commands
- Light and dark themes
- Base-path-safe links for project and user GitHub Pages sites
- A least-privilege, SHA-pinned GitHub Pages workflow
- Placeholder thumbnails that are ready to replace

## Customize

1. Edit or remove the examples in `src/content/skills/`.
2. Add thumbnail files under `public/images/`.
3. Update each entry's `thumb`, `repoPath`, install commands, and descriptive content.
4. Replace `public/images/og.svg` and `public/favicon.svg` with your own artwork.

The content schema is in `src/content.config.ts`.

## Develop

Requires Node.js 24 or later and npm 11.10 or later.

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

The generated site uses `__BASE_PATH__` and deploys to __SITE_URL__.

## Catalog identity

- Display name: __SITE_NAME__
- Author: __AUTHOR_NAME__
- Repository: `__REPO_SLUG__`
- Package: `__PKG_NAME__`
- Marketplace: `__MARKETPLACE_ID__`

## Deploy

1. Push the generated project to `__REPO_SLUG__`.
2. In repository settings, set Pages source to **GitHub Actions**.
3. Push to `__DEFAULT_BRANCH__` or run the workflow manually.

The workflow grants top-level `contents: read`, build-job `pages: read`, and
deploy-job `pages: write` plus `id-token: write`.
