# qa_leaks.py adjudications

`qa_leaks.py` compares article text against `dmnotes/` (DM-only recovered documents). A match is not
automatically a leak: several DM notes are supersets of text that is ALSO on the public campaign site,
so the shared sentences are player-safe and the DM-only part is what must be excluded.

## CLEARED 2026-09-11 — `hallorn-d-lyrandar` / "a daredevil and a bon vivant…"

- **Flagged shingles:** "a daredevil and a bon vivant racing horses airships sailboats and even
  dragons for sport".
- **Verdict: PLAYER-SAFE, publish.** The sentence appears verbatim on the public campaign site
  (`sources/site/key-figures.txt`) and in the already-published World Anvil article
  (`sources/wa/hallorn-d-lyrandar-person-1.txt`). `dmnotes/preview(2).txt` merely reproduces the same
  public bio.
- **Why it tripped now and not before:** the published article reads "sailboat" (singular); the wave-1
  rewrite corrected it to "sailboats", matching both the public site AND the DM note, so the shingle
  stopped being excluded as a known-public string.
- **The Iron Veil linkage is also public.** The article does say Hallorn built airships "for the
  family monopoly and for the Iron Veil" (5 mentions), and the public campaign site states exactly
  that: "propelled him to oversee the development and production of airships for the family's
  monopoly and for the Iron Veil" (`sources/site/key-figures.txt`). So it publishes.
  [An earlier draft of this note claimed the Iron Veil material was absent from the article. That was
  wrong - it is present, and it is public.]

**Rule:** before dismissing any future qa_leaks hit, grep the phrase in `sources/site/` and
`sources/wa/`. If it is there, it is public. If it is only in `dmnotes/`, it is a real leak and the
article must be fixed before publishing.

## CLEARED 2026-09-13 — `uriel-qualanthri` / "she believes Kaius is a dragon in disguise…"

- **Flagged shingles:** "birth to the next dragon elf demigod she believes kaius is a dragon in
  disguise".
- **Verdict: PLAYER-SAFE, publish.** The sentence is Dave's own, in the already-published World Anvil
  Uriel article (`sources/wa/uriel-qualanthri-person.txt`), which reads "She believes Caius is a
  dragon in disguise". `dmnotes/preview(4).txt` reproduces the same paragraph.
- **Why it tripped:** the 2026-09-11 ruling A4 normalised Caius/Kiaus to **Kaius** across the corpus.
  The published source still says "Caius", so the article's shingles stopped matching it.

## CLEARED 2026-09-14 - `the-bright-dawn-crimson-sun-unbound` / "in the forge's crimson light, Priest E'noch oversaw the completion of..."

- **Flagged shingles:** "s crimson light priest e noch oversaw the completion of", from Nico's browser edits of
  2026-09-14, which also added E'noch's second rite layered over the Eternal Guardian binding.
- **Verdict: PUBLISH, by ruling.** The text exists only in `dmnotes/preview(9).txt`, so under the rule below it
  would be a real leak. Dave, 2026-09-14: *"Yes on Enoch, Nico has smae authority."* Nico holds Dave's authority
  and published it deliberately.
- **Rule this adds:** a leak hit on text Nico wrote is still reported, but Dave (or Nico) may clear it as a
  deliberate reveal. Record it here and in `KNOWN_GOOD`.

## Where this check lives now (2026-09-13)

`scripts/qa.py` in the Lexicon repo is the markdown port of `qa_leaks.py`. It reads the same DM-only
files from `C:\dev\sharn-campaign` (they are never copied into the repo), and its `KNOWN_GOOD` set
carries every adjudication above.

## CLEARED 2026-09-14 — `varyn-crona` / Nico's "Official Historical Record" (scribes VI–VIII)

- **Flagged:** the scribes' record of Kaius I's reign (Loras Thul, Selanne ir'Darr, 896–910 YK) matched
  `dmnotes/preview(9).txt`.
- **Verdict: PLAYER-SAFE, publish.** Nico, the Sharn arc's DM, posted the same text to the players in The
  Inevitables chat on 2026-08-22 ("I hinted at that here…. VI. THIRD SCRIBE – 896–897 YK / Recorded by Historian
  Loras Thul…"). Dave has ruled everything in the chats public (`sources/dave/2026-09-14-oral-histories-cast.md`)
  and gives Nico the same authority over her material (CANON 5ad). The article cites it as
  "Oral Histories: The Inevitables, 2026-08-22".
- **Rule, extended:** a leak-check hit is also public if the phrase appears in the Oral Histories chat transcripts
  (`canon/oral-histories/`). Check there as well as `sources/site/` and `sources/wa/`.