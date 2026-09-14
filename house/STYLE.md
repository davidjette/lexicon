# INFANTAVERSE house style — the article specification

> ## The Lexicon (markdown) — read this first
>
> This spec was written for the World Anvil pipeline (2026-09-10/11). World Anvil is frozen
> (2026-09-12) and the Lexicon's markdown is now the source of truth. **Every rule about content,
> voice, leads, process language, quotation and sourcing (§0, §1, §1b, §3 rules, §4, §6) stands
> unchanged.** Only the mechanics move:
>
> | World Anvil spec | The Lexicon |
> |---|---|
> | `.bbcode` + `.json` per article (§7) | one file, `src/content/docs/<kind>/<slug>.md`, YAML front matter + markdown body |
> | `excerpt` (≤160 chars) | `description` in front matter |
> | `"fields"` in the `.json` (§3) | `fields:` map in front matter, same keys |
> | `[b]` `[i]` `[h2]` `[ul][li]` `[hr]` | `**bold**` `*italic*` `## Heading` `- item` `---` |
> | `[quote]…[/quote]` | `> ` blockquote |
> | `[small]…[/small]` | `<small>…</small>` |
> | `[url=/w/infantaverse-sydiot/a/<slug>]Name[/url]` | `[Name](/<kind>/<slug>/)` — the target file must exist; never invent a slug |
> | `registry.tsv` for slugs | the files under `src/content/docs/` |
> | `worldanvil/CANON.md` | `canon/CANON.md` — private, never committed to this public repo |
> | `sources/…` paths in §8 | `C:/dev/sharn-campaign/worldanvil/sources/…` (the frozen import folder) |
>
> **§4b in markdown.** Brackets no longer break a parser, but the quotation half of the rule is the
> important half and it stands: no editorial brackets in prose, ever. A `[` that is not link or
> redaction syntax is a QA failure, because it is almost always a smoothed quotation.
>
> **Obliviated content** is sealed with a redaction, never deleted and never paraphrased away:
> `:redacted[text]{label="…" reason="…" source="…"}` inline, `:::redacted{…}` … `:::` for a
> passage, or `redacted: {label, reason, source}` in front matter for a whole article.
>
> **Player-safe, and not-yet-revealed.** CANON is a DM register. Anything it marks as not yet
> revealed in-world, and anything from the DM-only files in §6.2, never goes on the site.
>
> **Oral Histories** are the players' Facebook Messenger game chats (Temporal Holdings, The Inevitables,
> Battle of River Lis), 2017 onward. The transcripts are private (`canon/oral-histories/`) because they mix
> the game with real life. Cite them as `Oral Histories: <Chat title>, YYYY-MM-DD`, in `sources` and in an
> inline `<small>`. Quote only in-game content, verbatim. Dave's own messages are close to canon.
> Everyone else's are speculation or color, and must be attributed as such (Dave, 2026-09-14,
> `sources/dave/2026-09-14-oral-histories-cast.md`).
>
> **Notes to Claude** are HTML comments in an article: `<!-- @claude: what to change -->`.
> `python scripts/notes.py --run` applies them (see `README.md`).
>
> **QA:** `npm run qa` runs the markdown ports of `qa_style`, `qa_brackets`, `qa_excerpts`,
> `qa_links` and `qa_leaks` (`scripts/qa.py`). All must be clean before a push.

Derived from the two articles Dave named as the quality model:
`sources/wa/uriel-qualanthri-person.txt` (structure and voice) and
`sources/wa/esther-crona-person.txt` (the fullest template instance — copy its sidebar and
Personality/Social blocks). Read both before writing anything.

**The bar:** Uriel's article answers eighteen different kinds of question about her. A campaign
recap answers two — what happened, and what it meant. Length is not the gap. **Dimensionality is.**

---

## 0. THE OVERRIDING RULE — this is a wiki, not a character study

Dave, 2026-09-10, on the Dario article:

> *"There is a lot of interpretive language in this one. You're making judgements about his character
> and things, that's not what a wiki article is supposed to be. Maybe you're overclocking my Uriel
> content, but this should be mostly fact based because it's a wiki. Sources should be quoted or
> referenced if qualitative stuff like this 'Dario believes...' content is used."*

**Articles are records of what happened and what is known. They are not readings of a character.**

This supersedes anything below it. Earlier versions of this spec described a "partisan in-world
encyclopedia" register and pointed at Dave's Uriel article as the model. That was an over-reading:
Uriel's page is Dave's own voice about his own NPC, and it licensed a swarm to write literary
judgement across three hundred articles that nobody asked for.

### What is not allowed

- **Contrast clips: "not X but Y", "is not X. It is Y", "X, not Y", "It is not a grand title. It is a property
  purchase."** Dave, 2026-09-14: *"don't do these cliips not-but-this it reads as ai slop. use my style, my quotes, and
  factual reporting like a wikipedia."* State the fact directly ("The name comes from a property purchase."). Say what a
  thing is; do not stage it against what it is not. Quote Dave and the session record instead of paraphrasing into
  aphorism.

- **Character judgement.** "He is not gentle. He is consistent." "the party's conscience and its
  bookkeeper of the dead." "That marriage is not incidental." Delete on sight.
- **Unattributed `X believes...`.** A beliefs claim is an interpretation unless a source states it or
  a character says it. See the attribution rule below.
- **Editorial framing of events.** "a bloodier speech than the man who took Sharn three years ago
  would have made, and the room wanted it" — the speech is a fact, the comparison and the room's
  appetite are invention.
- **Rhetorical closers and theses.** A tagline asserting what a person *means* is a judgement.
- **Significance claims.** "which is the whole point", "that is why it mattered", "the first thing
  the party watched become a lie" — unless a source says so, the reader draws the conclusion.

### What is allowed, and how

**Facts, plainly.** What happened, when, where, who was present, what was recovered, what was said.
Present tense for current state, past tense for events.

**Qualitative material — only with attribution.** If the sources support a belief, a motive or a
character trait, it must carry its source in the sentence or in an adjacent `[small]`:

- Good: `At the Korth assembly Dario announced he had broken three bells and would break every one,
  and that the Empress and everyone helping her must be cut down without quarter. [small](Korth Ep 12)[/small]`
- Good: `Uriel's own dossier states her belief that any elves who stand against her "are unworthy of
  their immortality and must have it taken from them."`
- Bad: `He believes a squire's job is to swing when nobody else will.`

Prefer **showing the sourced action** over asserting the trait it implies. "He prayed alone in a
chapel in a torn tabard after the hospital bell and named his dead aloud, adding Izaak, whom nobody
has confirmed is dead" is a fact, and it does the work that "he is the party's conscience" was doing
badly.

**Quote exactly.** Direct speech must be verbatim from a source, with the source named. Do not tidy,
condense, or reconstruct a line from indirect narration — inventing quotes was the single most common
serious defect found in the audits. Dave's correction: the article had
`"We have children. Forgive us."` where the record reads **"may our children forgive us"**.

### The three article shapes (structure only, not licence for voice)

- **Person** — stat line, aliases, description, then named sections per campaign event, then the
  inline fields. Sourced facts throughout.
- **Organization** — where the intelligence came from, then sections by actual source document.
  Where sources conflict, present both and say who said which. **Never invent a document**, and never
  put a real fact under a false attribution.
- **Place** — founding history, present state, then `Places of Interest:` as bolded name → one line.
  Model: `sources/wa/newham-settlement.txt`.

---

## 1. THE LEAD — how every article begins (Dave, 2026-09-11)

Dave, on finding *"Very little, and the gap is worth stating plainly rather than filling"* in
`the-glass-throne`:

> *"I want you to remove any of this trace of your own thought process in writing these articles, and
> revise them to be more fact based wikipedia style, especially in how articles BEGIN. There should be
> a standard way to introduce an item… then an article would proceed through sections, history in
> vaguely chrono order… and factoids closer to the bottom."*

**The model he supplied, which is the specification:**

> *"The Anachron is an Eldritch Machine and a part of the propulsion system of the vessel which carried
> ZOTH, a cosmic creature and child of CTHULHU to Toril in ancient times. It was recovered by the Sword
> Coast Trading Company and researched as the basis for the Arcane Core, and later transferred to the
> Arcaneum for chronomantic research. After their raid on the Arcaneum, TEMPLE HOLDINGS LLC took the
> Anachron and used it to power their vessel the Ariel, copied the mind of the defunct LEXICON into it,
> making it a sentient superintelligence with vast predictive and magical powers, and used its time
> traveling power to chase Wainwright St. Cloud into the past and stop his plan to summon CTHULHU to
> Toril."*

Read what that does: **first clause defines the subject by category** ("is an Eldritch Machine and a
part of the propulsion system of…"), then **the history runs forward in order**, each step naming the
actor and what they did with it. No thesis. No commentary. No sourcing apparatus. Nothing about what
the record does or does not say.

### The rule

1. **Sentence one defines the subject.** `<Subject> is a <category> …` — the category being what a
   reader needs in order to place it: an Eldritch Machine, a humanitarian medical order, the imperial
   seat of the Cormyrean Empire, a Sharn public transit vehicle. Past tense only if the subject no
   longer exists.
2. **The rest of the lead is the history in chronological order**, compressed — who made or found it,
   who held it, what was done with it, where it ended. One paragraph, two at most.
3. **Then the sections**, history in roughly chronological order (looping time is understood; use the
   order the party experienced where the world's order is undefined).
4. **Factoids, inline fields and template blocks go near the bottom.** Items, Holdings, Contacts,
   Likes & Dislikes, capabilities — reference material after the narrative, never before it.
5. **The stat line and `Also known as:` stay** where they are, above the lead. They are a header, not
   the lead.

### This supersedes three things in §2 below

- **Item 16, CLOSING TAGLINE, is DELETED.** A one-line thesis asserting what a subject *means* is the
  purest form of the thing Dave is asking to remove. Strip existing ones; never write another.
  **One exception: Dave's own prose is never stripped.** Uriel's closing line, "The future
  empress and mother of the God of Death.", is his, on his own model article, and stays -
  the same reason Esther keeps her Hygiene field. Strip only lines written by an agent.
- **Item 9's "Ends on a live hook" and item 14's "end on a hook" are DELETED.** Sections end when the
  facts end.
- Item 14 otherwise stands: articles **grow by appending** sections, never by rewriting.

## 1b. NO PROCESS LANGUAGE — the article never discusses its own making

An article is a record. It is not a report on the difficulty of writing the record. **Nothing in an
article may refer to the research behind it**, and that includes all of the following, every one of
which is currently in the corpus:

| Banned | Why |
|---|---|
| "the gap is worth stating plainly rather than filling" | commentary on my own method |
| "No surviving source consulted describes…" | *consulted* by whom? the article has no author |
| "What the record gives is…", "the sources do not agree" | frames the article as an investigation |
| "which is itself informative", "which is the whole point" | tells the reader what to conclude |
| "this article", "the wiki", "the corpus", "this file is a composite" | the record referring to itself |
| "presumably", "evidently", "one suspects", "it is tempting to" | hedging is interpretation |
| "Everything else in this record is downstream of that fact" | thesis statement |

**How to state a genuine gap:** as a plain fact, once, at the end of the relevant section or the lead.
`The Throne's origin, material and maker are not described in any surviving source.` That is all. Do
not build a section around it, do not give it a heading, do not explain what its absence means.

**Sourcing notes:** delete `[small]` notes that discuss where material came from or when Dave said it
(*"the DM's own account, recorded 2026-09-10"*, *"the surviving session text refers to this only in
passing"*). **Keep** the canon-mandated tag `[small]Recovered from the Oblivia.[/small]` (CANON 5f),
and **keep** in-text attribution for quotations and for qualitative claims, which §0 requires — that
attribution is in-world provenance, not research process.

## 2. Person article — required order

```
TITLE                  optionally honorific-prefixed:
                       "High Inquisitor of the Crimson Sun Esther Crona"
STAT LINE              Species · Class/Role · Faction · Level · Alive/Dead
ALIASES                Also known as: …
PORTRAIT               [img:<id>|none]   (omit if no image id is known)

1  PHYSICAL DESCRIPTION   60–90w. Dress, colours, heraldry, named weapons, marks/scars
                          and WHERE ON THE BODY, eye colour. Present tense. No events.
2  THE ORDER / WORLD      100–140w. Describe the institution, not the person.
3  PUBLIC vs PRIVATE      120–160w. Explicit contrast: what outsiders see; what is true.
4  COMPETENCE & CIRCLE    60–80w. Who they associate with. An heirloom item and where
                          its previous owner is now.
5  SECRET / BLOODLINE     50–70w. What this article knows and the world does not.
6  BELIEFS                exactly 3 sentences, each opening "She believes…" / "He believes…"
7  CONDUCT IN ROLE        70–90w. Behaviour on the job; how they hide.
8  ORIGIN                 150–200w. Past tense.
9  RIGHT NOW              40–60w. PRESENT TENSE. Current project. Ends on a live hook.
10 Organizations / Groups:   bold-labelled inline field
11 Holdings:                 places owned, founded, or haunted
12 Items:                    one line each — what it is, where found, condition
13 [Signature Capability]:   a NAMED bold-labelled ability and its on-screen uses
                             (Uriel's is "Sex Magic:")
14 NAMED SUBSECTIONS         one [h2] per campaign revelation. Open past, close present,
                             end on a hook. Articles GROW by appending these — never by
                             rewriting what is already there.
15 QUOTE BLOCK               at least one direct quote, attributed. [quote]…[/quote]
16 CLOSING TAGLINE           one line, ≤12 words, the article's thesis.
                             Uriel's: "The future empress and mother of the God of Death."
```

### Template blocks — World Anvil supplies these headings, use them
```
Personality Characteristics
  Motivation                one line
  Likes & Dislikes          Likes: / Dislikes: — 6–12 items each, SPECIFIC AND PETTY.
                            Esther's include "Decapitating Enemies" and "Cleanliness".
  Vices & Personality flaws one line ("She fills her loneliness with sex and booze.")
Social
  Contacts & Relations      4–8 entries: named person, one line of relationship,
                            current status
  Hobbies & Pets            named pets ("Phantom Steed Warhorse named Trigger")
```

---

## 3. Sidebar fields — fill from sources, or write "Unknown"

Never leave a field silently blank; blanks render as an empty right-hand column and are the single
most visible difference between a thin article and a real one.

**Only fill a template block when the sources support it. Blocks are optional; uniformity is not a goal.**
Dave's instruction, 2026-09-10: *"those lower interpretive blocks are not critical and I'm not concerned
about cutting them if unsourced. Yes some of the more voluminous would be needed but I don't need 100%
uniformity if such things aren't in the text."* So `Beliefs`, `Motivation`, `Likes & Dislikes`,
`Vices` and `Hobbies & Pets` are written **only** where the sources give you something real. A major
character with pages of material should have them. A minor character with two recorded sentences
should not, and padding one out is a defect, not a courtesy.

**`Hygiene` is removed from this spec entirely.** World Anvil does supply the field, but only one of
the 54 original articles ever used it — Esther's, where Dave wrote "Shes a neat freak!". This spec
generalised that single joke into a required field for every character, and agents duly invented
eighty of them. It has been stripped from all 79 other articles. Do not reintroduce it.
[small]Esther keeps hers; it is Dave's own line.[/small]

**NEVER invent a value to fill a field.** This instruction, in its earlier form, is what caused
the worst defects in the 2026-09 corpus: faced with a required `Hygiene` field and no source, agents
wrote fiction — *"engine-oil under the nails and no apology for it"*, *"he lives in a drainpipe. The
weapons are immaculate"* — eleven of them, one per character, all plausible, none real. The same
mechanism produced invented species (Candice Kurt as "Half-elf", Graves and Martin Kross as "Human",
none of them recorded anywhere) and a run of coined aliases presented as in-world epithets.

**`Unknown` is the correct answer far more often than it feels like it is.** A field reading
`Unknown` costs the article nothing. A fabricated field is a lie in a reference work, and it is
indistinguishable from fact to every future reader — including the next agent, which will build on it.

Three rules for fields:
1. A value must trace to a source. If it does not, write `Unknown`.
2. Never infer species, age, ancestry or appearance from a portrait, a name, or a vibe.
3. Never coin an alias. An "Also known as" entry must be a name somebody actually used in a source.

Emit these in the article's `.json` under `"fields"`, keyed by World Anvil form-field name:

`rpgAlignment` · `ggmtitle` (honorary & occupational titles) · `dobDisplay` · `birthplace` ·
`children` · `residence` · `gender` · `age` · `eyes` · `hair` · `skin` · `height` · `weight`

Also always set:
- **`excerpt`** — one sentence, ≤160 chars. Drives the listing card. Currently empty on every
  article I wrote, which is why they look bare in indexes.
- **`icon`** — a FontAwesome name, e.g. `fa-person`, `fa-crown`, `fa-bell`, `fa-skull`.

---

## 4. Tags — 8–12 per article

Tags are the world's connective tissue: they drive search and cross-discovery. Include the
canonical name, short forms, **aliases and known misspellings**, factions, locations, and themes.
Esther's real tag list runs `Esther Crona,Esther,Crona,Vayrn Crona,Fairhaven,Varyn,Crimson Sun,
Hexblade,Vengeance…` — note it carries **both** `Vayrn Crona` and `Varyn`, deliberately.

---

## 4b. NEVER use square brackets for anything but BBCode

World Anvil parses `[...]` as BBCode. A bracket used for any other purpose is read as an unknown
tag, and World Anvil does not fail gracefully — it strips the bracket and **breaks the real tags
after it in the same paragraph**. Dave found this live on The Mammon Machine, where the article read:

> One of the Infernal Machines, kin to the url=/w/infantaverse-sydiot/a/the-lexiconLexicon and the
> url=/w/infantaverse-sydiot/a/the-obliviatorObliviator.

The source file was perfectly valid BBCode. The cause was `[doomed Netheril]` earlier in the same
paragraph — a scholarly editorial insertion inside a quotation. It poisoned both `[url]` tags that
followed it.

So, inside articles:

- **Editorial insertion into a quote** — use parentheses: `"the greatest treasure of (doomed Netheril)"`.
- **Elision inside a quote** — use a bare ellipsis `…`, never `[…]`.
- **Uncertainty or a reading note** — put it in `[small]...[/small]` after the quote, not in brackets
  inside it.

### A bracket inside a quotation is also a confession that the quote was altered

This is the more important half of the rule. On 2026-09-10 a tightened `qa_brackets.py` found eight
more brackets across seven articles, and **every single one was an editorial "correction" of a
source quotation**:

| Written | Source actually reads |
|---|---|
| `are one [and] the same` | "are one in the same" |
| `and I [saw] five blades` | "and I five blades" |
| `hiding [it] in an unknown tomb` | "hiding them in an unknown tomb" |

That is the same defect Dave caught on Dario's page: the writer tidied the source's grammar and
marked the tidying with brackets. **So when you see a bracket inside a quotation, do not just delete
the bracket — go back to the source, because the quote is wrong.** The correct fix is to quote the
source exactly, typo and all, and add `[small](sic)[/small]`. Never smooth a quotation.

`python qa_brackets.py` has four checks: editorial brackets, brackets glued to a word (`generate[s]`
— the nastiest, because `[s]` is valid BBCode and strikes through the rest of the paragraph),
unknown bare-word brackets, and unbalanced paired tags. Run it before any publish, and never
re-add the skip for short bare words.

## 5. Formatting

The editor is sceditor. Available and currently under-used:
`[quote]` · `[table]` · `[ul]/[li]` · `[hr]` · `[url=…]` · `[small]` · `[img:ID|none]` ·
`[p]` · `[b]` · `[i]` · `[h2]` · `[h3]`

Rules:
- **Vary the texture.** A page of identical paragraphs is the failure mode. Use bold-labelled
  inline fields (`Items:`, `Holdings:`) as pseudo-headings, lists for Likes/Dislikes and Contacts,
  and at least one `[quote]` block.
- **Cross-link entities** that have their own article:
  `[url=/w/infantaverse-sydiot/a/<slug>]Name[/url]`. Slugs come from `registry.tsv` — never invent
  one. Bold is for labels and first-mention emphasis, not for entity names.
- Use `[small]` for parenthetical or archival asides, as Esther's article does.

---

## 6. Hard rules

1. **Never invent facts.** Everything must trace to a source file, or to published Eberron canon
   (Sharn's epithet "the City of Towers", the Last War, the dragonmarked houses and so on are real
   setting material and count as sourced — mark them `[small](published Eberron canon)[/small]` where
   it matters). What does not count is inference, atmosphere, or a plausible-sounding detail that
   fills a gap. If a required section has no source, either omit the section or state the absence in
   one plain sentence of fact (`His birthplace is not recorded.`) — a visible gap is correct, a
   fabrication is not. **But state it once, as a fact, and never write about the gap**: no paragraph
   on what the silence means, no heading over it, no note on which sources were searched. See §1b.
2. **Player-safe only.** NEVER use `worldanvil/dmnotes/`, `handouts/hells-bells-intel-web.md`, or
   the Korranberg module files. The Homebrewery Uriel document is a *voice* source only — take its
   epithet stack and read-aloud register, leave the stat blocks, DCs and ward mechanics out.
   Campaign 1's `THE UNFORESEEN.docx` **is** cleared for publication.
3. **Obey `CANON.md`** for every name, date, spelling and status. It resolves three episode
   numberings and twenty spelling variants. Esther is 19 / 29 / 31 at different times and all three
   are correct.
4. **Additive-restructure on existing articles.** For any article whose registry row says
   `EXISTING`, read the current body from `sources/wa/<slug>.txt` and **preserve every fact and
   every sentence**. You may reorder into the template and add missing blocks. You may not delete
   or paraphrase away Dave's or NicoPico's prose.
5. **Newest source wins** on status fields. The site's Key Figures page is stale — it still lists
   Hillary Heinrick, Dr. Menka, Sister Nora and Vex d'Lyrandar as Active after later episodes kill
   or execute them.

---

## 7. Output contract

For each article write **two files** into `worldanvil/articles/`:

**`<slug>.bbcode`** — the body only. No title line, no front matter.

**`<slug>.json`**
```json
{
  "slug": "gemma-corso",
  "title": "Gemma Corso",
  "type": "person",
  "category_uuid": "67461b3f-c659-4ba6-b7be-1705e995ba98",
  "wa_uuid": "3b35188d-…" ,
  "status": "EXISTING",
  "excerpt": "One sentence, under 160 characters.",
  "icon": "fa-person",
  "tags": ["Gemma Corso", "Foxtale", "…"],
  "fields": { "rpgAlignment": "Chaotic Good", "age": "31", "eyes": "…" },
  "sources": ["sources/site/korth-episode-summaries.txt", "…"]
}
```

`status` is `EXISTING` (has `wa_uuid`) or `NEW` (`wa_uuid` null).

**Return to the orchestrator ONLY a manifest — one line per article:**
```
<slug> | <words> | <sections filled>/16 | <tags> | NEW|EXISTING | <flags>
```
**Never return article prose.** Returning bodies would exhaust the orchestrator's context and
defeat the entire design. The files on disk are the deliverable.

---

## 8. Source map

| Need | File |
|---|---|
| Quality model — structure & voice | `sources/wa/uriel-qualanthri-person.txt` |
| Quality model — sidebar & template blocks | `sources/wa/esther-crona-person.txt` |
| Dossier register model | `sources/wa/blood-of-vol-organization.txt` |
| Place register model | `sources/wa/newham-settlement.txt` |
| Current body of any existing article | `sources/wa/<slug>.txt` (54 files) |
| Sharn episodes 1–19 | `sources/site/sharn-episode-summaries.txt` |
| Korth episodes 1–13 | `sources/site/korth-episode-summaries.txt` |
| Factions, key figures, BioTec, EBT-7, POSÉ, Children of Ember | `sources/site/*.txt` |
| Campaign 1 (publishable) | `Desktop/D&D/The Unforeseen/THE UNFORESEEN.docx` (converted in `sources/infantaverse/`) |
| Infantaverse / Temple Holdings | `sources/infantaverse/*.txt` (72 files) |
| Already-written entity pages to PORT | `Desktop/infantaverse-wiki/src/content/docs/**` (50 pages) |
| Session recaps and current state | `C:/dev/sharn-campaign/*.md` — in `current-state.md` ONLY the party-state, character-status and inventory sections are player-safe; the module-conformance changelog at the bottom is DM-only |
| Player handouts (published, safe) | `C:/dev/sharn-campaign/handouts/` except `hells-bells-intel-web.md` |
| Names, dates, spellings | `worldanvil/CANON.md` |
| Slugs and categories | `worldanvil/registry.tsv` |
| Image subjects | `worldanvil/images/manifest.tsv` |
