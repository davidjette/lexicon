// Public monsters and NPCs added through the bestiary inbox (the Encounter Builder's "Add to library"
// form). Each block is read from an uploaded stat block by Claude (skill: bestiary-inbox), in the same
// form as npcs.js. Every entry carries `campaign`, which names its picker group ("Added: <campaign>"),
// and `sheet: { source: 'inbox/<submission folder>', date }`. DM-only blocks go in src/dm/added.js.

import { melee, ranged, save, multi, cond, prone, saveOr, hold, summon, emanation, healing, parry } from '../data/lib.js?v=mv9oo28y';
import { register } from '../data/registry.js?v=mv9oo28y';

const N = {};
const def = (id, t) => { N[id] = { id, side: 'monster', pos: 'front', ...t }; return N[id]; };
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });

// ---- entries below this line ----

// ---- entries above this line ----

const groups = {};
for (const t of Object.values(N)) (groups[t.campaign || 'Inbox'] = groups[t.campaign || 'Inbox'] || []).push(t.id);
register({
  creatures: N,
  library: Object.entries(groups).map(([campaign, ids]) => ({ group: `Added: ${campaign}`, ids, ally: ids.every((id) => N[id].side === 'pc') })),
});
