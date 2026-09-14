---
name: lexicon-ingest
description: Turn a D&D session transcript, recap, summary or DM document into Lexicon updates - a session article plus deltas to every person, place, item and faction it touches. Use when Dave shares or points at a session file, says "update the wiki from last session", or a new recap exists in C:\dev\sharn-campaign.
---

# Ingesting a session into the Lexicon

Work in `C:\Users\djett\Desktop\infantaverse-wiki`. Pull first (`git pull --rebase`).

## 1. Get player-safe text

- Audio or video: use the `transcribe` skill first.
- Recaps and summaries live in `C:\dev\sharn-campaign\session-YYYY-MM-DD-*.md`. **Player-safe:** recaps,
  summaries, published handouts. **Never:** module files, session plans, `dmnotes/`, the intel web, or
  `[DM: ...]` passages and HTML comments inside otherwise safe files.
- If the only record is a transcript, prefer quotes from it over paraphrase, verbatim with `(sic)`.

Copy the text you will cite into `sources/sessions/` (player-safe material only; the repo is public).

**Oral Histories** (the Messenger game chats) are the exception. They stay private in
`canon/oral-histories/` (transcripts, per-quarter `findings/`, and `REPORT-*.md`, built by
`scripts/oral_histories.py`). Do not copy them into `sources/`. Cite them as
`Oral Histories: <Chat title>, YYYY-MM-DD` and quote only in-game lines (STYLE addendum).

## 2. Plan the deltas and show Dave before writing

Read `canon/CANON.md` §1–2 (campaign names and episode numbering: episode titles are arc-prefixed,
e.g. `Korth Ep 14 — ...`). List, in a short table:

- the session article to create (`src/content/docs/sessions/<arc>-ep-<n>-<slug>.md`, with
  `sidebar: {order: N}` matching its siblings — Korth is 300 + episode, Sharn 200 + episode);
- each existing article that gains a fact (one line: what is added);
- new articles for people or places that now have enough recorded to stand alone;
- status changes (deaths, captures) — newest episode wins (CANON §6).

Dave prefers plans surfaced step by step: show this table, then proceed on his go-ahead.

## 3. Write

- The session article: stat line (`**Arc · Episode N · DM: name**`), defining lead ("Korth Ep 14 — X is
  the fourteenth session of the Korth arc of Unforeseen Strikes Back, run by Dave."), `## Summary`,
  `## Revelations`, `## Cast` — copy a recent sibling's shape.
- Deltas to existing articles: append to the relevant section in chronological order; never rewrite
  what is there (STYLE §2 item 14). For many articles, leave `<!-- @claude: -->` notes naming the source
  file and run `python scripts/notes.py --run`, then review the diff.
- Link new mentions to existing articles; never invent a slug.

## 4. Verify, publish, report

`npm run qa && npm run build && npm run links`, commit, push, watch the deploy. Report to Dave: the new
session page, which articles changed, and open questions (unclear names, conflicts with CANON).
