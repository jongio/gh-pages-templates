# Template thumbnail prompts

Every gallery thumbnail is generated from the source of truth in
`scripts/thumbnail-prompts.json`.

## Generation settings

| Setting | Value |
| --- | --- |
| Provider | azure-openai |
| Model | gpt-image-2 |
| Deployment | gpt-image-2 |
| Endpoint | https://jong-image-westus3.openai.azure.com |
| API version | 2025-04-01-preview |
| Size | 1024x1024 |
| Quality | high |

Generate all thumbnails:

```powershell
$env:AOAI_TOKEN = az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv
node scripts/generate-thumbnails.mjs
```

Pass one or more template IDs to generate only those images. Existing files are
preserved unless `--force` is supplied.

## Static HTML

Output: `site/assets/thumbnails/static-html.png`

> Flat vector illustration app thumbnail on a pure white background, 1024x1024, centered composition. Use one clear hero surface, clean modern rounded geometry, medium-weight outlines, soft long shadows, subtle dashed guide lines, tiny sparkles, and generous white space. Show a clear transformation or publishing flow. Include a small black GitHub Octocat mark near the upper-right connected by a thin dotted guide line. Use small green status checks where appropriate. Crisp professional developer-tools catalog finish. No words, no letters, no numerals, no fake text, no photorealism, no 3D render, no dark background, no gradients, no clutter. Use a warm coral, amber, charcoal, and GitHub green palette. Center a large cream-white browser window outlined in charcoal. On the left, show three simple source tiles with abstract angle-bracket shapes and color swatches. A short coral arrow moves them into the browser, whose right side shows a finished landing page with a hero block, two text lines, and three tidy content cards. Add a small green check badge to the browser corner. The concept must read as hand-authored files becoming a complete zero-build website.

## Astro

Output: `site/assets/thumbnails/astro.png`

> Flat vector illustration app thumbnail on a pure white background, 1024x1024, centered composition. Use one clear hero surface, clean modern rounded geometry, medium-weight outlines, soft long shadows, subtle dashed guide lines, tiny sparkles, and generous white space. Show a clear transformation or publishing flow. Include a small black GitHub Octocat mark near the upper-right connected by a thin dotted guide line. Use small green status checks where appropriate. Crisp professional developer-tools catalog finish. No words, no letters, no numerals, no fake text, no photorealism, no 3D render, no dark background, no gradients, no clutter. Use a midnight navy, warm orange, soft lavender, and GitHub green palette. Center a large light browser surface with a subtle starfield motif contained inside its top area. On the left, show a small stack of abstract content cards and geometric component tiles with image shapes and short neutral lines only. A bright orange comet-like path carries them through a compact assembly ring into a finished fast static site on the right, marked by one green check and tiny sparkles. The concept must read as content and components becoming a lightweight static site. Do not place typography icons, alphabet letters, code glyphs, or readable characters on any tile.

## React and Vite

Output: `site/assets/thumbnails/react-vite.png`

> Flat vector illustration app thumbnail on a pure white background, 1024x1024, centered composition. Use one clear hero surface, clean modern rounded geometry, medium-weight outlines, soft long shadows, subtle dashed guide lines, tiny sparkles, and generous white space. Show a clear transformation or publishing flow. Include a small black GitHub Octocat mark near the upper-right connected by a thin dotted guide line. Use small green status checks where appropriate. Crisp professional developer-tools catalog finish. No words, no letters, no numerals, no fake text, no photorealism, no 3D render, no dark background, no gradients, no clutter. Use electric cobalt, bright yellow, teal, charcoal, and GitHub green. Center a large interactive dashboard window as the hero surface. On the left, show three reusable component tiles connected like an atom diagram. A yellow lightning path moves them into the dashboard on the right, which contains a chart, a toggle, and a form card with a green completion badge. Include one subtle route branch line below the window. The concept must read as reusable components rapidly assembling into an interactive single-page app.

## Eleventy

Output: `site/assets/thumbnails/eleventy.png`

> Flat vector illustration app thumbnail on a pure white background, 1024x1024, centered composition. Use one clear hero surface, clean modern rounded geometry, medium-weight outlines, soft long shadows, subtle dashed guide lines, tiny sparkles, and generous white space. Show a clear transformation or publishing flow. Include a small black GitHub Octocat mark near the upper-right connected by a thin dotted guide line. Use small green status checks where appropriate. Crisp professional developer-tools catalog finish. No words, no letters, no numerals, no fake text, no photorealism, no 3D render, no dark background, no gradients, no clutter. Use forest green, warm ochre, slate blue, charcoal, and GitHub green. Center a large tidy publishing workbench with a light file-tree sidebar and a page preview surface. On the left, show Markdown document tiles and small structured-data nodes. Dashed green connectors pass through a compact gear-like build wheel and emerge as an organized multi-page site on the right with collection cards and pagination dots. Add one green check badge. The concept must read as Markdown plus data becoming a structured static website.

## Jekyll

Output: `site/assets/thumbnails/jekyll.png`

> Flat vector illustration app thumbnail on a pure white background, 1024x1024, centered composition. Use one clear hero surface, clean modern rounded geometry, medium-weight outlines, soft long shadows, subtle dashed guide lines, tiny sparkles, and generous white space. Show a clear transformation or publishing flow. Include a small black GitHub Octocat mark near the upper-right connected by a thin dotted guide line. Use small green status checks where appropriate. Crisp professional developer-tools catalog finish. No words, no letters, no numerals, no fake text, no photorealism, no 3D render, no dark background, no gradients, no clutter. Use ruby red, deep navy, soft rose, charcoal, and GitHub green. Center an elegant GitHub-style repository window with a faceted ruby gemstone resting above a stack of abstract document pages. A clean red path passes through a Liquid-like droplet template shape and lands in a finished blog preview with image cards and a green Pages deployment check. Keep the gemstone and repository as the dominant objects. The concept must read as GitHub-native Markdown publishing. Do not place Markdown letters, alphabet characters, code symbols, or readable labels on any document.

## Skills Catalog

Output: `site/assets/thumbnails/skills-catalog.png`

> Flat vector illustration app thumbnail on a pure white background, 1024x1024, centered composition. Use one clear hero surface, clean modern rounded geometry, medium-weight outlines, soft long shadows, subtle dashed guide lines, tiny sparkles, and generous white space. Show a clear transformation or publishing flow. Include a small black GitHub Octocat mark near the upper-right connected by a thin dotted guide line. Use small green status checks where appropriate. Crisp professional developer-tools catalog finish. No words, no letters, no numerals, no fake text, no photorealism, no 3D render, no dark background, no gradients, no clutter. Use cobalt blue, teal green, warm amber, charcoal, and GitHub green. Center a large searchable marketplace browser as the hero surface. On the left, show one tidy agent-skill package entering through a dotted connector. Inside the browser, show a clean search control above a grid of six distinct skill cards with simple tool symbols and status badges. A small branch line connects one selected card to a polished detail panel on the right with an install-copy control and green completion check. The concept must read as reusable agent skills becoming an organized searchable catalog.

## Spectator

Output: `site/assets/thumbnails/spectator.png`

> Flat vector illustration app thumbnail on a pure white background, 1024x1024, centered composition. Use one clear hero surface, clean modern rounded geometry, medium-weight outlines, soft long shadows, subtle dashed guide lines, tiny sparkles, and generous white space. Show a clear transformation or publishing flow. Include a small black GitHub Octocat mark near the upper-right connected by a thin dotted guide line. Use small green status checks where appropriate. Crisp professional developer-tools catalog finish. No words, no letters, no numerals, no fake text, no photorealism, no 3D render, no dark background, no gradients, no clutter. Use deep teal, cool slate, warm amber, charcoal, and GitHub green. Center a large technical specification page inside a refined browser frame. Highlight one passage with a translucent amber selection bar. A small contextual review toolbar beside it branches through two clean dotted paths: one to an issue card with a comment bubble, the other to a pull-request card with a pencil and green check. Add a narrow page-outline rail and a search lens inside the frame. The concept must read as a published specification becoming precise GitHub review work.
