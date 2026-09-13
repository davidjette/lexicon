# The Lexicon

The record of a long-running D&D continuity, published at **https://davidjette.github.io/lexicon/**.

Markdown in this repo is the source of truth. Astro + Starlight build it into a static site, and every
push to `main` redeploys through GitHub Pages (`.github/workflows/deploy.yml`).

## Layout

| Path | What it is |
|---|---|
| `src/content/docs/<kind>/<slug>.md` | The articles. The folder is the kind (people, places, organizations, history, sessions, items, lore, species), the file name is the slug. |
| `house/STYLE.md` | The article specification. Read the Lexicon addendum at the top first. |
| `house/LEAK-ADJUDICATIONS.md` | Leak-check hits that were verified as player-safe. |
| `canon/` | **Private.** Dave's CANON register and the notes log. Its own local git repo, ignored by this one, never pushed. |
| `scripts/` | Import, QA, the notes loop, and their self-tests. |
| `sources/` | Source material the articles cite. |
| `legacy/` | The June 2026 pages, superseded by the World Anvil import, kept for a later merge. |

## Editing

Edit the markdown directly, in any editor. Front matter carries `title`, `description` (one sentence,
under 160 characters), `tags`, `fields` and `sources`. Internal links are `[Name](/<kind>/<slug>/)`.

After a clone, turn on the hook that refuses to commit a note to Claude:

```
git config core.hooksPath .githooks
```

## Contributors and the browser editor

Named contributors (Nico and others) sign in at `/edit/` with their own password and edit articles in
the browser. Every save is a commit with their name; each article's History shows every version and
restores any of them. Setup and contributor management: `worker/README.md`. Their edits go live at once,
so pull and run `npm run qa` regularly (the leak check only runs on Dave's machine).

## Models editing at scale

Point any model with HTTP access at **https://davidjette.github.io/lexicon/llms.txt**: it explains the
article format, the writing rules, the index of every article (`/lexicon/articles.json`) and the editing
API. Give each model its own contributor account (`npm run editor:add -- <model-name>`) so its edits are
attributed in History and can be revoked. Review its edits like any contributor's (`lexicon-review`).
The page is generated from `src/pages/llms.txt.ts`; update it when the API or the rules change.

## Images and maps

Articles take `image: {src, alt, caption}` (shown in the infobox) and `gallery:`. Images live in
`public/images/`: `cards/` (ally cards), `site/` (campaign site), `maps/` (60 maps, each with a page
under `/maps/`), `uploads/` (browser editor, which shrinks uploads to WebP at most 1600px wide). `npm run images` re-imports from the source folders.

## Front page

Article of the day (the same for everyone each day; 600+ words, not a session, not sealed), section
tiles, the latest sessions, recently updated articles with who changed them, and maps.

## Notes to Claude

Leave an instruction for Claude inside an article, as an HTML comment:

```
<!-- @claude: add her time as a general at the Battle of the River Lis -->
```

```
npm run notes              # list pending notes, change nothing
npm run notes -- --run     # apply them: one article, one commit at a time
python scripts/notes.py --run kara --push   # just Kara, then build, check and push
```

Claude reads `house/STYLE.md` and `canon/CANON.md`, carries out the notes, and removes them. The rewrite
is kept only if no other file changed, every note is gone, the front matter parses, and QA finds no new
problem. Otherwise the article is restored exactly as it was, and the reason goes to
`canon/notes-log.md`. Notes never reach the public repo or the site: the build strips comments,
`npm run links` fails if one survives, and the pre-commit hook refuses a staged note.

A note Claude declines (it would contradict CANON or publish something unrevealed) stays in the
article, with the explanation in the log.

## Obliviated content

Seal it rather than delete it:

```
:redacted[the hidden words]{label="What it is" reason="Why it was erased" source="where it comes from"}

:::redacted{label="A whole passage"}
Hidden paragraphs.
:::
```

or `redacted: {label, reason, source}` in front matter to seal a whole article. Readers click to reveal.
Every redaction is listed, without its text, at `/sealed-records/` and `/redactions.json`.
An example page is `src/content/docs/lore/redaction-test.md` (a draft: shown by `npm run dev` only).

## Checks

```
npm run qa          # style, brackets, descriptions, links, leaks and stray notes, over every article
npm run build       # the site; a duplicate redaction id fails it
npm run links       # every internal link in dist/ resolves, and no note reached the output
npm run qa:test     # the QA checks catch planted defects
python scripts/test_notes.py   # the notes loop rejects every kind of bad rewrite
```

The leak check compares articles with the DM-only files in `C:\dev\sharn-campaign`, so it only runs on
Dave's machine.

## Importing from World Anvil

World Anvil is frozen. `npm run import:wa` re-reads `C:\dev\sharn-campaign\worldanvil` and rewrites the
imported articles, but it skips any file edited since the last import (hashes in
`docs/import-manifest.json`). `docs/corpus-report.md` describes that corpus.
