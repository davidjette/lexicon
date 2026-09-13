# The Lexicon editor service

A Cloudflare Worker (`lexicon-editor`) that lets named contributors edit the Lexicon from the browser
at `/edit/`. It holds the GitHub token, checks each contributor's own password, and turns every save
into a commit on `davidjette/lexicon` with the contributor's name on it. GitHub Pages rebuilds the site
from that commit in about two minutes. Git is the version history: each article's History view lists
every version, shows the differences, and restores any of them as a new commit.

It runs on **Dave's personal Cloudflare account**. `wr.mjs` keeps that login in `worker/.wrangler-home/`,
so it never touches the Innovent Capital wrangler login used by other projects.

## One-time setup

1. **Sign in to Cloudflare** (a free personal account is enough):
   `npm run editor:login`
2. **Deploy the Worker** and note the `https://lexicon-editor.<you>.workers.dev` address it prints:
   `npm run editor:deploy`
3. **Create a GitHub token** at https://github.com/settings/personal-access-tokens/new
   - Resource owner: davidjette. Repository access: *Only select repositories* → `lexicon`.
   - Permissions → Repository → **Contents: Read and write**. Nothing else.
   - Then store it in the Worker (paste when asked):
     `node worker/wr.mjs secret put GITHUB_TOKEN`
4. **Create the server secrets** (random, generated locally, kept in `worker/.secrets.json`):
   `npm run editor:secrets`
5. **Add contributors**, one at a time. You type each password, or press Enter to generate one:
   `npm run editor:add -- Nico`
6. **Switch the editor on**: put the Worker address in `src/data/editor.json` as `"api"`, then commit
   and push. "Edit this page" and "History" appear on every article.

## Day to day

| Task | Command |
|---|---|
| Add or reset a contributor | `npm run editor:add -- <name>` |
| Revoke a contributor (immediate) | `npm run editor:remove -- <name>` |
| List contributors | `npm run editor:list` |
| Redeploy after changing `src/index.js` | `npm run editor:deploy` |
| Watch live logs | `node worker/wr.mjs tail` |

After contributors have been editing, pull before working locally (`git pull`) and run `npm run qa`:
the leak check only runs on this machine, so it is the review step for browser edits.

## What the service refuses

Saves outside `src/content/docs/<kind>/<slug>.md`; front matter that would break the build; notes to
Claude (the repo is public); raw HTML other than `<small>`, `<br>`, `<strong>`, `<em>`, `<sup>`, `<sub>`;
event-handler attributes and `javascript:` links; a save made from a copy someone else has changed
since (it asks the contributor to reload); images that are not png/jpg/webp/gif or are over 3 MB.

## Testing

`node worker/test-api.mjs` runs 22 checks against `wrangler dev` (`node worker/wr.mjs dev --local`),
using a `worker/.dev.vars` that points `BRANCH` at a throwaway branch. Delete the branch and the
`.dev.vars` afterwards.
