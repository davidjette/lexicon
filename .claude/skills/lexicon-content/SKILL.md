---
name: lexicon-content
description: Change Lexicon content from Dave's instructions - new facts, corrections, canon rulings, new articles, sealing obliviated content, adding images. Use when Dave says what is true in the world, asks for an article to be written, fixed or expanded, or says something was obliviated.
---

# Changing Lexicon content

Work in `C:\Users\djett\Desktop\infantaverse-wiki`. Read `CLAUDE.md` first if you have not this session.

## 1. Sync

`git pull --rebase`. If commits arrived from contributors, run `lexicon-review` before editing.

## 2. Record the source before using it

- Dave's words in chat → save **verbatim** to `sources/dave/YYYY-MM-DD-<topic>.md` (append follow-ups
  to the same file under "Follow-up N"). Commit it with the change.
- A ruling that settles names, dates, spellings or disputed canon → add a dated section to
  `canon/CANON.md` quoting Dave, then `git -C canon add CANON.md && git -C canon commit -m "..."`.
  If Dave says something CANON flags as secret is now known to players, update that flag.
- Contradiction with a contemporary session document? The document wins unless Dave is correcting it.
  If you cannot tell, ask one short question.

## 3. Find every article it touches

Grep the corpus for the names and their spellings (`canon/CANON.md` §4 lists variants):
`grep -rli "name1\|name2" src/content/docs`. Include articles that should link to a new article.

## 4. Make the change — two ways

**Few, precise edits:** edit the markdown yourself, following `house/STYLE.md` (defining lead, no
process language, quotes verbatim, no editorial brackets, links only to existing files).

**Many articles, or prose rewrites:** leave notes and run the loop, which applies STYLE and CANON with a
QA gate and commits each article separately:

```
<!-- @claude: Per sources/dave/2026-09-13-x.md and CANON 5aa: ... Add the source to sources. -->
python scripts/notes.py            # list
python scripts/notes.py --run      # apply (about $1 per article; runs in the background fine)
```

Do not edit other repo files while `--run` is going: its guard rejects any change outside the article.
**Always review the diff afterwards** (`git diff <before>..HEAD -- src/content`): the loop has added
unrequested markers before. Fix anything off by hand.

## 5. Specific kinds of change

- **New article:** `src/content/docs/<kind>/<slug>.md`. Copy the front matter shape of a sibling
  (title, description ≤160 chars, type, kind, tags, fields, sources). Stat line, `*Also known as:*`,
  defining lead, sections in chronological order.
- **Obliviated:** a phrase `:redacted[text]{label="" reason="" source=""}`, a passage
  `:::redacted{...}` … `:::`, or a whole article with front matter
  `redacted: {names: [Alias, Alias], label: "...", reason: "...", source: "..."}`. Names seal every
  sentence elsewhere that mentions or links the article. Check `/sealed-records/` after building.
- **Images:** put the file under `public/images/` (webp, ≤1200px wide for portraits; `sharp` is
  installed) and set `image: {src, alt, caption}` or add to `gallery:`.

## 6. Verify and publish

```
npm run qa && npm run build && npm run links
git add ... && git commit && git push
gh run watch --repo davidjette/lexicon
```

Load one changed page on the live site. Tell Dave what changed in plain terms and anything you could
not settle.
