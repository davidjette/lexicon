// Instructions for a model (or a script) that reads and edits the Lexicon. Served at /lexicon/llms.txt.
import type { APIRoute } from 'astro';
import editor from '../data/editor.json';
import { getArticles, KINDS } from '../lib/articles';

export const GET: APIRoute = async () => {
	const site = 'https://davidjette.github.io/lexicon';
	const raw = 'https://raw.githubusercontent.com/davidjette/lexicon/main';
	const api = editor.api || '(the editor service is not switched on)';
	const count = (await getArticles()).length;
	const kinds = Object.entries(KINDS).map(([k, label]) => `${k} (${label})`).join(', ');

	const text = `# The Lexicon — instructions for models

> The Lexicon is the wiki of a long-running D&D continuity: ${count} articles about its people, places,
> organizations, history, sessions, items, lore and species. Site: ${site}/
> This file tells a model how to find articles and how to change them through the Lexicon's editing API.
> Every change is a git commit under your contributor name, live on the site about two minutes later,
> and can be undone from the article's history.

## 1. Before you start

- You need a contributor account (a name and password) from Dave. Use only your own. Never put the
  password in an article, a summary, or anything you publish.
- Read the house style before writing a word: ${raw}/house/STYLE.md
  Start with its "Lexicon (markdown)" section at the top. The rules below are the short form, not a
  replacement. STYLE mentions a CANON register; that document is private and you cannot see it.
- Your edits go live immediately and are reviewed afterwards. Change only what you were asked to change.

## 2. Finding articles

- Index of every article (title, kind, repo path, live URL, raw markdown URL, description, tags, image,
  word count, sealed flag): ${site}/articles.json
- Raw markdown of any article, no sign-in needed: ${raw}/<path>
  e.g. ${raw}/src/content/docs/people/kara.md
- Live page: ${site}/<kind>/<slug>/
- Kinds (the folder an article lives in): ${kinds}
- Maps: ${site}/maps/   Sealed (obliviated) records: ${site}/sealed-records/

## 3. What an article file looks like

Path: src/content/docs/<kind>/<slug>.md — the file name is the slug; lowercase letters, digits, dashes.

\`\`\`
---
title: Kara
description: One sentence under 160 characters, shown in listings and search results.
type: person
kind: people
tags:
- Kara
- Temple Holdings LLC
fields:
  gender: Female
  residence: Snowdown
image:
  src: /images/cards/kara.webp
  alt: Kara
sources:
- sources/infantaverse/Temple Holdings LLC__1 - Hope in Exile__Hope in Exile - Part I.txt
---

**Human · Sorcerer 16 / Wizard 2 · Temple Holdings LLC · Level 18 · Alive**

*Also known as:* Kara of Paenis

**Kara** is a human sorceress and wizard of [Temple Holdings LLC](/lore/temple-holdings-llc/), and ...

## A section heading
\`\`\`

Keep every front matter key you do not mean to change exactly as it is (fields, sources, wa, sidebar,
redacted, gallery). Values in \`fields\` are text. \`tags\` and \`sources\` are lists.

## 4. Writing rules (short form of STYLE)

1. The first sentence defines the subject by category: "<Title> is a <category> ...". Then its history
   in chronological order. No thesis, no commentary.
2. Never invent a fact. Everything must come from the article itself, another Lexicon article, or what
   you were given. If something is not known, say so once, plainly ("Her birthplace is not recorded.").
3. No process language: never "this article", "the wiki", "the record gives", "the sources", "presumably",
   "evidently", closing taglines, or talk about how the article was written.
4. Quote exactly. Never tidy a quotation; never put editorial [brackets] inside one. Mark errors (sic).
5. Present tense for current state, past tense for events. No character judgements; attribute beliefs
   and motives to a source or a speaker.
6. Link other articles as [Name](/<kind>/<slug>/). The target must exist in articles.json; never invent
   a slug. Link an entity on its first mention in a section.
7. Formatting: **bold** for labels and first mentions, *italic*, ## headings, > quotations, - lists,
   <small>…</small> for citations and asides. No other HTML.
8. Articles grow by adding facts to the right section. Do not rewrite or delete existing prose unless told to.

## 5. Obliviated (sealed) content

Some lore is erased in-world. It is hidden behind a black bar that readers click to reveal. Never delete
sealed content and never paraphrase it into the open.

- Seal a phrase:   :redacted[the hidden words]{label="What it is" reason="Why it was erased"}
- Seal a passage:  :::redacted{label="..."}  (paragraphs)  :::
- Seal an article: front matter  redacted: {names: [Alias, Alias], label: "...", reason: "..."}
  Any sentence elsewhere that links to that article or uses one of its names is sealed automatically.
- Articles marked "sealed": true in articles.json are hidden on the site. Do not reveal them elsewhere.

## 6. The editing API

Base URL: ${api}
All requests and responses are JSON. After signing in, send \`Authorization: Bearer <token>\` on every call.
Sessions last 30 days.

| Call | Body or query | Returns |
|---|---|---|
| POST /api/login | {"name": "...", "password": "..."} | {"token": "...", "name": "..."} |
| GET /api/me | | {"name": "..."} |
| GET /api/file?path=<path> | optional &ref=<commit sha> for an old version | {"path", "sha", "content"} |
| PUT /api/file | {"path", "content", "sha", "summary"} | {"ok": true, "sha", "commit"} |
| GET /api/history?path=<path> | | {"versions": [{"sha", "date", "author", "message"}]} |
| POST /api/restore | {"path", "ref": "<commit sha>"} | {"ok": true, "sha", "commit"} |
| POST /api/image | {"filename": "name.webp", "data": "<base64>"} | {"src": "/images/uploads/..."} |

- Editing: GET the file, change \`content\`, PUT it back with the \`sha\` you received. \`summary\` is a short
  note shown in the history ("added the Battle of the River Lis").
- Creating: PUT with no \`sha\` to a path that does not exist yet.
- Errors come back as {"error": "..."} with a status: 400 the content was refused (the message says why),
  401 sign in again, 404 no such article, 409 someone saved after you read it — GET again, reapply your
  change, PUT again. Do not retry a 400 unchanged.
- The service refuses: paths outside src/content/docs/<kind>/<slug>.md; front matter that does not parse
  or lacks a title; HTML other than small, br, strong, em, b, i, sup, sub, u, s; attributes and
  javascript: links; notes addressed to Claude; images that are not png, jpg, webp or gif, or over 3 MB.

## 7. Working at scale

- One article per request. Do them one after another (not in parallel), a second or two apart.
- Read the current version immediately before each change; never write from a copy you fetched earlier.
- Keep a list of what you changed (path, commit) and report it at the end.
- The site rebuilds after each commit; a burst of edits is published together once the last rebuild runs.
- To undo your own mistake: GET /api/history, then POST /api/restore with the version before yours.

## 8. Example

\`\`\`
POST ${api}/api/login           {"name":"your-name","password":"..."}
GET  ${api}/api/file?path=src/content/docs/items/knell.md
PUT  ${api}/api/file            {"path":"src/content/docs/items/knell.md","content":"---\\ntitle: KNELL\\n...","sha":"<sha from GET>","summary":"added who carries it now"}
\`\`\`
`;
	return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
