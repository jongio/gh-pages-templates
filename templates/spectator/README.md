# __SITE_NAME__

A reviewable specification website built with
[Spectator](https://github.com/jongio/gh-pages-templates) and VitePress.

Site URL: __SITE_URL__

## Develop locally

```sh
npm ci
npm run dev
```

Build and validate:

```sh
npm test
npm run build
npm run test:e2e
```

## Author freely

Spectator does not require a fixed specification outline. Add, rename, combine,
or remove Markdown pages under `docs/`, then update navigation in
`spectator.config.ts` if the site uses curated navigation.

The fictional Project Northstar content demonstrates the template. Replace it
with the real specification before publishing.

## Review workflow

- **Feedback** in the top navigation opens a general GitHub issue.
- **Open a GitHub issue** at the bottom of a page includes that page in the draft.
- Selecting article text reveals **Create issue** and **Edit page** actions.
- **Edit this page on GitHub** opens the Markdown source for a pull-request change.

Repository, branch, content root, navigation, and feedback settings live in
`spectator.config.ts`.

## Images

Replace the labeled assets in `docs/public/images/`. See
`docs/public/images/IMAGES.md` for the handoff checklist.

## Deploy

1. Push to the repository's `main` branch.
2. Set **Settings > Pages > Source** to **GitHub Actions**.
3. The included workflow builds and publishes `docs/.vitepress/dist`.

The template supports user sites at `/` and project sites at `/REPO/`.
