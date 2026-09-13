# Infantaverse Wiki — Session Notes

A working log for the wiki build, so any session can pick up where the last left off.

## 2026-09-12: The Lexicon, step one (branch `lexicon`, not pushed)
The site is now **The Lexicon**, built from the frozen World Anvil corpus (`C:\dev\sharn-campaign\worldanvil`).
World Anvil is frozen; markdown here is the source of truth. Plan: `~/.claude/plans/what-s-the-status-of-sparkling-snail.md`.
- `python scripts/wa_import.py` converts 404 BBCode+JSON articles to `src/content/docs/<kind>/<slug>.md`.
  Re-runnable; it refuses to overwrite a file edited since import (hashes in `docs/import-manifest.json`).
- `python scripts/corpus_report.py` → `docs/corpus-report.md`. `python scripts/check_links.py` after a build.
- Kinds (folders) come from `scripts/wa_common.py` `KIND_OF_TYPE`. Albert Spear is linked 9 times but has no article.
- **Redactions** (obliviated content): `:redacted[text]{id="…" label="…" reason="…" source="…"}` inline,
  `:::redacted{…}` … `:::` block, `redacted: {label, reason, source}` front matter for a whole article.
  Registry at `/sealed-records/` and `/redactions.json`. Duplicate ids fail the build. Example page:
  `lore/redaction-test.md` (draft, dev only). Stonecypher is the first sealed article.
- The June pages (below) moved to `legacy/docs/` for later merge; the WA corpus superseded them.

## What this is
Astro + Starlight community wiki for **The Infantaverse**, a shared D&D multi-campaign setting.
- Theme: parchment/"midnight archive" via `src/styles/homebrewery.css`.
- Custom components: `Oblivia.astro` (sealed-record spoiler reveal for in-world *erased* lore),
  `Infobox.astro` (right-rail entity card), `Gallery.astro`.
- **Strict sourcing rule** (enforced by `src/content.config.ts` frontmatter): every lore page
  cites real source files in `sources:` or is flagged `needsSource`. Nothing invented.
- Dev server: `npm run dev` → http://localhost:4321/ (logs to `.devserver.log`).
- Not a git repo yet.

## Ingesting new content (READ THIS when Dave feeds prose)
Dave will feed prose from handwritten work and other sources. The repeatable loop is documented in
**`INGEST.md`** (repo root). In short:
- Raw source material lives in the in-repo **`sources/`** inbox (`handwritten/ transcripts/
  documents/ _converted/`) — NOT published. If Dave pastes prose in chat, **save it to a file in
  `sources/` first** so the page can cite a real path (strict-sourcing).
- Log each source in `sources/MANIFEST.md` (source → pages it feeds → status).
- Build pages from the per-type skeletons in **`templates/`** (character/faction/location/item/
  creature/concept/event), into `src/content/docs/<category>/`, citing the source in frontmatter.
- External campaign canon stays at `Desktop/D&D/`. The `oblivia-registry` is NOT canon — never cite.

## Source material
Canon lives in **`C:\Users\djett\Desktop\D&D\`** — NOT inside the wiki repo. Key folders:
`Temple Holdings LLC/` (8 numbered arc folders of `.docx` session docs), `Dead Mans Hand/`
(cards, items, oblivia-registry, character list), plus `Arcaneum/`, `NPCs/`, `Maps/`,
`Character Sheets/`, `Quests/`.
- **`.docx` → text:** `pandoc "file.docx" -t plain -o out.txt` (pandoc at
  `~/AppData/Local/Pandoc/pandoc`; `python-docx` also available). PDFs/xlsx as needed.

## Progress
- **Scaffold:** done (home, About/sourcing, 4 campaign landing pages, 7 category index stubs).
- **ALL EIGHT Temple Holdings arc pages WRITTEN** in the rich, quote-woven format, each in
  `src/content/docs/events/`, sourced from the real `.docx` session docs, ~3 Oblivia reveals each,
  cross-linked in a chain (each arc's closing bridge → next), and linked from `events/index.md`
  and the Temple Holdings campaign hub. `npx astro build` passes clean (22 pages).
  - I — `hope-in-exile.mdx` (rewritten rich): Evening Star, deep-hold baelnorn, Bask Falls
    cosmology, Star Quendi's charge, the Snowy Mountain machine.
  - II — `motherstone.mdx`: the Lexicon & Obliviator (origin of the Forgetting), Yoshi/Tylerjynex,
    Calix's buried-throne gambit; Mara's lullaby + Calix's verse as pull-quotes.
  - III — `age-of-the-infanta.mdx`: Council of Forgetting, 10-yr skip, Wainwright St. Cloud,
    Excelsior, the Infanta-hunt (Marcus, Jacob, Una), the "Leviathan" star-chart.
  - IV — `the-infernal-machines.mdx`: Sigil/City of Doors, Dox collective, the SCTC Archives
    machines, St. Cloud = Alphalpha Beginnigin, the Mammon-Machine/Leviathan plan.
  - V — `starfall.mdx`: time-travel to the Moon's past, the Traveler & Kay, June's revelation —
    **Time IS the Obliviator**, Zoth-Ommog / blind Cthulhu, the Watcher.
  - VI — `time-of-troubles.mdx`: Kara's Wish (rewritten past), Camelot/Mordred/Merlin/Avalon,
    Maab & Perfect Dark, the moonblade siblings remembering, Ayror = "error", the Chronicle.
  - VII — `leviathan.mdx`: Brightmantle's death (Throne of Tears), the muster of all allies,
    Civis's Weave/Nether cosmology, the Apotheosis of Man, march on Zeal.
  - VIII — `end-of-the-infanta.mdx`: the Egg, Lady of Pain & Marcus slay Asmodeus, the Lost Train
    (the father/the game), Cthulhu boss, and the Obliviator-Wish = the **End of the Infanta** that
    creates the Oblivia. The chronicle ends by erasing itself.
- **Note:** these are summaries from prep docs (heavier on stat-blocks than prose for the later
  arcs); episodic arcs organized by movement rather than literal Part I–N. Dave's read: "not great
  but a good start" — acceptable as the narrative spine; entity pages are the real destination.

## Convention decisions (revisit if Dave wants otherwise)
- Arc pages live under **Events & Arcs** (`/events/`), one `.mdx` per arc, `sidebar.order` =
  arc number. Campaign pages stay high-level indexes.
- Treat each doc's opening **recap paragraph as canon** ("what happened"); treat the rest as
  setting/branching DM-prep and don't assert which branch the party actually took.
- **Oblivia = in-world spoilers/secrets**, used sparingly for the biggest reveals.

## PART B — entity-level wiki (IN PROGRESS)
Per the approved plan (`~/.claude/plans/i-want-a-full-whimsical-crescent.md`). Sourced ONLY from
real session docs — NOT the oblivia-registry (Claude-generated, not canon). `astro build` clean
at 47 pages.

**25 load-bearing entity pages written** (typed via `entityType`, Infobox + sectioned body,
Oblivia reveals, richly cross-linked entity↔entity and entity→arc):
- Characters: Calix, Elistrae, Wainwright St. Cloud, Star Quendi, Tylerjinex, Marcus, Mara Mageblood
- Factions: House Gallidann, Sword Coast Trading Company, the Mundi, the Drek, the Lusmundii
- Locations: Motherstone, Snowdown, Sigil, the Egg
- Items: the Obliviator, the Lexicon, the Mammon Machine, the Anachron, Silverbane
- Concepts: the Oblivia, the Infanta, moonstone
- Creatures: the Leviathan
- **All 6 category index stubs upgraded → real landing pages** (linked entity hubs).

### Remaining for Part B
1. ~~**Arc → entity backlinking**~~ — **DONE 2026-06-17.** All 8 `events/*.mdx` arc pages now link
   the first in-body mention of each of the 25 entity pages to its page (79 links total; bold
   preserved where present; links kept out of collapsed Oblivia reveals and blockquotes so they
   stay visible). Every entity page is reachable from at least one arc. `astro build` clean at 47
   pages. Convention: first-mention-only per arc page (Dave's call, 2026-06-17).
2. More entities: PCs (Drefan, Kara, Roland, Yoshi, Zanzibar, Magnus…), secondary NPCs (Untari,
   Chad, Flex Gimble, the St. Cloud brothers, Jacob, Una…), more locations (Sigil wards, Zeal,
   Camelot, Waterdeep, the Underglow), items (Quicksilver Sextant, Moonstone Crown, the diadems,
   the moonblade siblings, the music box), creatures (Warforged, clockwork constructs, the Aboleth),
   concepts (the Weave/Nether, the Time of Troubles, the planar cosmology, Ayror=error).
3. **Other campaigns:** Dead Man's Hand, Starfall: TNG, Arcaneum — once Dave feeds their prose.
   (Verify provenance of any Dead Man's Hand files before citing — the registry there is not canon.)

_Last session: 2026-06-09 — wrote all 8 arc pages + 25 entity pages + category landing pages._

## NOW LIVE + UNDER GIT (2026-06-17)
The wiki is deployed to **GitHub Pages: https://davidjette.github.io/infantaverse/**
- Repo: **davidjette/infantaverse** (public). `git init` done; `main` is the deploy branch.
- CI: `.github/workflows/deploy.yml` (withastro/action, Node 22 pinned, deploy-pages). **Every
  push to `main` auto-rebuilds + redeploys** (~30-60s). Watch with `gh run watch`.
- Base-path note: it's a project site, so `base: '/infantaverse'` is set in `astro.config.mjs`.
  Astro does NOT base-prefix hand-written root-relative links in markdown, so a small **rehype
  plugin in astro.config.mjs rewrites `<a href="/...">` to prepend the base** at build time.
  Keep writing content links as `/characters/foo/` (NO base) — the plugin handles it. The ONLY
  spot that needs the base hardcoded is Starlight **hero `actions[].link`** frontmatter
  (index.mdx) — the plugin can't reach frontmatter.
- Build: `npx astro build` clean at **53 pages**.

## Pick up here (next session — set 2026-06-17)
Two things done this session: (1) Arc → entity backlinking COMPLETE (item #1 above); (2) the
**6 core-party PC pages** are written, live, and backlinked from the arcs:
**Kara, Drefan, Roland (Deschain), Yoshi, Brother Magnus, Zanzibar** — narrative + a
`## Character sheet` stats section pulled from `Desktop/D&D/Character Sheets/` PDFs (Kara=Human
Sorc16/Wiz2, Drefan=Wood Elf Druid, Roland=Human gunslinger Ranger, Yoshi=Copper Dragonborn
Eldritch Knight, Magnus=Hill Dwarf Cleric of Brightmantle; Zanzibar has no sheet on file).
Note: the image-based sheet PDFs have no text layer — render page 1 to PNG via PyMuPDF
(`fitz`, matrix 2x) then Read the PNG; `pdftoppm` is NOT installed.

**Recommended next step:** keep growing the entity set (Remaining item #2). Remaining PCs with
sheets in the folder: Cuthbert, Cedric, Stoth, Fulori Splitheal (+docx), Brad, Everest, etc.
Then recurring NPCs (Untari, Flex Gimble, the St. Cloud brothers, June/the Traveler, the Lady of
Pain, Chad of the Mundi). Optional polish: per-arc first-mention links for the new PCs in arcs
II-VIII (currently each is linked once, from its introducing arc). Portraits exist for Kara
(`Kara Headshot.jpg` etc.) if we want to wire up Infobox images. Source ONLY from real session
docs at `Desktop/D&D/Temple Holdings LLC/` (NOT the oblivia-registry).

**Or, if Dave brings prose:** run the INGEST loop (`INGEST.md`) for more entities (PCs Drefan/
Kara/Roland/Yoshi/Zanzibar/Magnus; NPCs Untari/Jacob/Una/St. Cloud brothers; locations Zeal/
Camelot/Waterdeep/Sigil wards; items Quicksilver Sextant/Moonstone Crown/moonblade siblings) or a
new campaign (Dead Man's Hand / Starfall: TNG / Arcaneum — DMH provenance must be verified;
`oblivia-registry` is NOT canon).

Reminders: source canon lives outside the repo at `Desktop/D&D/`; not a git repo yet (`git init`
is an optional infra step).
