# The Lexicon — instructions for Claude

The Lexicon is Dave's wiki for his long-running D&D continuity, live at
**https://davidjette.github.io/lexicon/** (repo `davidjette/lexicon`, public; `main` deploys through
GitHub Pages on every push). Markdown in this repo is the source of truth. `README.md` is the operating
manual; read it when you need detail this file does not give.

The world has no name: the site is "The Lexicon". If a universe name is ever unavoidable,
it is "Infantaverse". Individual places have their own names.

## Keep git current — every session

1. **Start:** `git pull --rebase`. Contributors edit from the browser, so `main` moves without you.
   If anything came in from someone other than Dave or Claude, run the `lexicon-review` skill first.
2. **After every verified change:** commit and push. Small commits, one subject each. Do not batch a
   session's work into one push at the end, and never leave work uncommitted.
3. `canon/` is a **separate private git repo**: commit there too (`git -C canon ...`), never push it.
4. Never force-push `main`. Never rewrite published history.

Commit messages end with the attribution lines the session gives you.

## Non-negotiables

- **`canon/` never reaches the public repo or the site.** It is gitignored. Do not copy CANON text into
  an article, a commit message, a skill or this file. Articles may *cite* "CANON.md 5x" in `sources`.
- **Player-safe only.** Nothing from the DM-only files (`C:\dev\sharn-campaign\worldanvil\dmnotes\`,
  `handouts\hells-bells-intel-web.md`, the Korranberg module files). `npm run qa` checks this.
- **Nico has the same authority as Dave** (Dave, 2026-09-13). Her edits are canon: never revert or
  second-guess her content; only fix technical problems (a broken build, a leak, a broken link) and
  tell her or Dave. Other contributors' edits are reviewed normally.
- **Never invent facts** (`house/STYLE.md` §0, §6). Dave's statements in chat are sources: save them
  verbatim to `sources/dave/YYYY-MM-DD-<topic>.md` before using them, and cite that file.
- **Where Dave's retelling and a contemporary session document disagree, the document wins**
  (CANON 5y) — unless Dave says he is correcting the document. Ask when it is unclear.
- **Notes to Claude (`<!-- @claude: -->`) are never committed.** `scripts/notes.py` applies and removes
  them; the pre-commit hook refuses them (`git config core.hooksPath .githooks` once per clone).
- **Obliviated content is sealed, not deleted:** `:redacted[...]{...}`, `:::redacted`, or front matter
  `redacted:` with `names:` for aliases (every sentence naming or linking it is then sealed site-wide).
- **Do not type passwords or tokens into a browser.** Contributor passwords and the GitHub token are
  entered by Dave (`worker/README.md`).
- For people in the wiki, use the pronouns the sources use (Stonecypher is she).

## Before any push

```
npm run qa            # must be CLEAN (warnings are fine)
npm run build         # or build:fresh — see gotchas
npm run links         # 0 broken links, 0 missing images, 0 notes in output
```

When code changed, also run the self-tests that cover it: `npm run qa:test`, `npm run test:refs`,
`python scripts/test_notes.py`, `npm run test:editor`, `node worker/test-api.mjs` (needs `wrangler dev`).
After pushing, confirm the deploy: `gh run watch --repo davidjette/lexicon`, then load the changed page.

## Where things are

| Path | What |
|---|---|
| `src/content/docs/<kind>/<slug>.md` | Articles. Kinds: people, places, organizations, history, sessions, items, lore, species |
| `src/content.config.ts` | Front matter schema |
| `house/STYLE.md` | The article specification (read its Lexicon addendum first) |
| `canon/CANON.md` | Private canon register: names, spellings, dates, Dave's rulings |
| `sources/` | Source material, including `sources/dave/` for Dave's chat statements |
| `scripts/qa.py`, `scripts/notes.py` | QA, and the notes-to-Claude loop |
| `src/plugins/` | Markdown: strip comments, redactions, sealed references |
| `src/components/` | Starlight overrides (MarkdownContent, PageTitle, EditLink), Home, infobox, gallery |
| `src/pages/` | Sealed Records, redactions.json, maps, the editor, `llms.txt` and `articles.json` for outside models |
| `public/images/` | cards, site, maps, uploads (from the browser editor) |
| `worker/` | The browser editor's Cloudflare Worker |
| `legacy/` | June 2026 pages, not built, awaiting a merge |

## Skills

| Skill | Use when |
|---|---|
| `lexicon-content` | Dave gives facts, corrections or rulings; new or changed articles; sealing something |
| `lexicon-ingest` | A session transcript, recap or summary should become article updates |
| `lexicon-review` | Pulled commits from contributors need checking |
| `lexicon-dev` | Changing how the site works: components, plugins, scripts, the editor |

## Gotchas

- **After changing a markdown plugin or an MDX-rendered component, use `npm run build:fresh`.** Astro
  caches rendered content by file; a plain build serves stale pages and every check still passes.
- Files are LF (`.gitattributes`). Write with `newline='\n'` from Python.
- In Bash heredocs, backslashes inside Python get mangled (`'\\'` becomes `'\'`). Write scripts with the
  Write tool or build paths with `os.path.join`.
- The Python QA reads the DM files at `C:\dev\sharn-campaign`; it cannot run in CI.
- `C:\dev\sharn-campaign\worldanvil\` is the frozen World Anvil import. Do not edit it; `MOVED.md` there
  says where everything went. `npm run import:wa` refuses to overwrite articles edited since import.
- The editor is off until `src/data/editor.json` has the Worker address.
- A stale `astro preview` can hold a port for days; check `netstat -ano | grep :43` before assuming.
