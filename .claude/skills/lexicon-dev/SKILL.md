---
name: lexicon-dev
description: Change how the Lexicon site works - Astro/Starlight components and overrides, markdown plugins (redactions, sealed references, comment stripping), the front page, maps, QA and notes scripts, the import scripts, or the browser editor's Cloudflare Worker. Use for any code change in the Lexicon repo rather than a content change.
---

# Developing the Lexicon

Astro 6 + Starlight 0.39, static output, base path `/lexicon`, deployed by `.github/workflows/deploy.yml`
on push to `main`. Pull first; commit and push each verified change.

## Map of the moving parts

| Concern | Files | Self-test |
|---|---|---|
| Schema | `src/content.config.ts` | build |
| Hidden comments / notes | `src/plugins/remark-strip-comments.mjs` | `npm run links` fails on a note in `dist/` |
| Redaction directives | `src/plugins/remark-redacted.mjs`, `src/lib/redactions.mjs` | duplicate id fails the build |
| Sealed references | `src/plugins/remark-sealed-refs.mjs`, `src/lib/sealed.mjs` | `npm run test:refs` |
| Sealing UI, infobox, gallery | `src/components/MarkdownContent.astro`, `ArticleInfobox`, `ArticleGallery`, `src/styles/redacted.css` | browser |
| Descriptions and TOC of sealed pages | `src/routeData.ts` | inspect `<meta name=description>` |
| Front page | `src/components/Home.astro`, `src/lib/home.ts` (article of the day: 600+ words, not sessions, not sealed) | browser |
| Registry, listings | `src/pages/sealed-records.astro`, `redactions.json.ts`, `src/lib/articles.ts`, `KindIndex.astro` | build |
| Maps | `src/data/maps.json`, `src/lib/maps.ts`, `src/pages/maps/` | `npm run links` |
| Editor UI | `src/pages/edit.astro`, `src/scripts/editor-client.ts`, `src/components/EditLink.astro`, `src/data/editor.json` | `npm run test:editor` (front matter round-trip) |
| Editor service | `worker/src/index.js`, `worker/wrangler.toml`, `worker/contributors.mjs` | `node worker/test-api.mjs` |
| QA and notes loop | `scripts/qa.py`, `scripts/notes.py` | `npm run qa:test`, `python scripts/test_notes.py` |
| Imports | `scripts/wa_import.py`, `scripts/import_images.mjs` | re-run is idempotent |

## Working rules

- **`npm run build:fresh` after changing a remark plugin or a component rendered inside MDX/markdown.**
  A plain build reuses cached renders and hides the change.
- Starlight overrides are registered in `astro.config.mjs` → `components`. Import Starlight's own
  component as `Default` and wrap it, as `MarkdownContent.astro` does. Icons come from
  `import { Icon } from '@astrojs/starlight/components'`.
- Root-relative links and image `src` in markdown get the base path from `rehypeBaseLinks`; in
  components use `import.meta.env.BASE_URL`.
- In `.astro` templates never self-close `textarea`, `select`, `p` or other non-void elements, and keep
  `{...}`-looking strings out of quoted attributes (use `attr={JSON.stringify(x)}`).
- Anything that hides sealed content must also keep it out of Pagefind (`data-pagefind-ignore`), page
  descriptions, listings and the table of contents.
- Worker: deploy with `npm run editor:deploy` (Dave's personal Cloudflare login, isolated in
  `worker/.wrangler-home`). Test locally with `node worker/wr.mjs dev --local` and a `.dev.vars` whose
  `BRANCH` is a throwaway branch; delete both afterwards. Never commit `.dev.vars` or `.secrets.json`.
- Browser checks: `npx astro preview` serves `dist/`; stop it when done (a stale one holds the port).
  If Chrome screenshots time out, open a fresh tab.

## Done means

`npm run qa` clean, the relevant self-tests passing, `npm run build` (fresh when needed) and
`npm run links` clean, the change seen in a browser when it is visual, committed, pushed, and the deploy
watched to success.
