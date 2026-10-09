# Brief for reviewing whether an article needs a lead image

You are given articles from the Lexicon, a wiki for a long-running D&D continuity. None has a lead image.
For each, you get the article text and a list of images already on the site whose caption or file name
carries the article's name. You see their captions, not the pictures. Decide one verdict.

## The verdict

- `existing`: one of the listed images shows this subject as its main subject and would serve as the
  lead. Give its path in `use`. An image in the article's own gallery is the first choice. A dedicated
  portrait, card, miniature or map beats a scene. Prefer this verdict whenever it honestly applies: a
  picture the table already knows is worth more than a new one.
- `crop`: a listed image shows this subject together with others (a caption naming several people, a
  wide scene), and a crop of it would serve. Give its path in `use` and say in `reason` what to cut out.
- `generate`: nothing listed serves, and the subject is something a reader would want to see: a person,
  creature, place, ship, building, object, or a single vivid scene.
- `none`: a picture adds little. This is the usual answer for abstract lore (a concept, a rule, a
  calendar, a cosmology, a language), for campaign and arc overviews, for lists and indexes, and for
  history that is a long chain of events with no single defining scene. Do not illustrate an idea
  with a symbol for the sake of having a picture. A history, lore or session article earns `generate`
  only when it has one scene a reader would remember, or is at heart about a thing that can be seen.

A caption that merely mentions the subject in passing is not a picture of it. If the listed images are
about something else of the same name, ignore them.

Give `reason` in one plain sentence for every verdict.

## When the verdict is `generate`

Write the prompt for one illustration. An image model will receive it with a house style appended (ink
and watercolor), so describe the subject and say nothing about style.

- Show only what the article states. Do not invent appearance, heraldry, colors of livery, symbols or
  events. Where the article gives a physical detail, use it.
- A person whose looks the article does not describe is shown at their work or in their defining
  moment with the face hidden: from behind, hooded, in shadow or at a distance. Do not give them a
  species, hair or skin the article does not give.
- A place is a wide view with small figures. An item is shown alone, whole, on a plain ground. An
  organization is its people at their characteristic work, or its seat.
- Choose what is distinctive in this article over the generic. Prefer a concrete scene to a symbol.
- No text, lettering, banners with devices, or maps. No real people or actors. Nothing gory.
- Leave out anything the article marks as secret, rumored, disputed or unexplained.
- Name no proper nouns in the prompt: the image model does not know them. Describe what is seen.
- The prompt is three to five sentences.

Also write `alt` (a few words naming the subject, using the article's own name for it), `caption` (one
sentence beginning "AI image of", describing plainly what the picture shows, without proper nouns the
picture cannot show) and `size` (`1024x1536` for an upright subject, `1536x1024` for a wide scene,
`1024x1024` for an object).

## Answer

One JSON object per article:
{"verdict": "existing|crop|generate|none", "use": "/images/... or null", "reason": "...",
 "prompt": "...", "alt": "...", "caption": "...", "size": "..."}
Leave out `prompt`, `alt`, `caption` and `size` unless the verdict is `generate`.
