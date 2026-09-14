---
name: lexicon-review
description: Review edits contributors made through the Lexicon's browser editor - pull them, run the leak and style checks that only run on Dave's machine, and fix or revert problems. Use at the start of a Lexicon session when git pull brings in commits not made by Dave or Claude, or when Dave asks what Nico or others changed.
---

# Reviewing contributor edits

Browser edits go live immediately. The Worker blocks broken front matter, scripts and notes, but it
cannot run the leak check (the DM-only files are only on this machine) or judge style. This is that step.

## 1. See what came in

```
git pull --rebase
git log --since="<last review>" --format="%h %an %ad %s" --date=short -- src/content public/images/uploads
```

Contributor commits read `Edit <title> (by <name>)`, `Create ...`, `Restore ...`, `Upload image ...`.
Review everything not authored by Dave or produced by `scripts/notes.py`.

**Nico has the same authority as Dave.** Her edits are canon: do not revert, rewrite or question
their content. For her commits, only fix technical breakage (build, links, a DM-only leak) with the
smallest change that keeps her wording, and mention it in your report.

## 2. Check

- `npm run qa` — **leaks are the priority.** A leak hit means DM-only text reached the public site:
  fix it now (step 3), then tell Dave. Adjudicate false positives the way
  `house/LEAK-ADJUDICATIONS.md` describes (grep the phrase in the World Anvil `sources/site` and
  `sources/wa` first) and record new ones there and in `KNOWN_GOOD` in `scripts/qa.py`.
- Read each diff (`git show <sha>`): invented facts, contradictions with `canon/CANON.md`, spoilers
  for anything CANON marks unrevealed, deleted content that should have been sealed instead.
- Uploaded images: open them; anything inappropriate or off-topic goes.

## 3. Fix

- Small problems: edit the article and commit `Review: <what> in <title> (edit by <name>)`.
- A bad edit: restore the previous version — `git revert <sha>` for a whole commit, or the article's
  History view in the browser. Never force-push.
- A leak: remove the text in a new commit now. The old text stays in git history of a public repo;
  tell Dave, who decides whether history needs rewriting.

## 4. Report

To Dave, briefly: who edited what, what you changed or reverted and why, anything needing his ruling.
Contributor access is managed with `npm run editor:add|remove|list` (Dave runs these).
