// DM ONLY. Monsters and characters added through the bestiary inbox and marked "DM only" on the form.
// No imports: see monsters.js. A character here is a stat block with side: 'pc' (like Zero-One in
// extras.js), read from the uploaded sheet by Claude (skill: bestiary-inbox). Every entry carries
// `campaign` (its picker group, "Added (DM): <campaign>") and `sheet: { source, date }`.

export default function (api) {
const { melee, ranged, save, multi, cond, prone, saveOr, hold, summon, emanation, healing, parry } = api;
const D = {};
const def = (id, t) => {
  D[id] = { id, side: 'monster', pos: 'front', ...t };
  return D[id];
};
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });

// ---- entries below this line ----

// ---- entries above this line ----

const groups = {};
for (const t of Object.values(D)) (groups[t.campaign || 'Inbox'] = groups[t.campaign || 'Inbox'] || []).push(t.id);
api.register({
  creatures: D,
  library: Object.entries(groups).map(([campaign, ids]) => ({ group: `Added (DM): ${campaign}`, ids, ally: ids.every((id) => D[id].side === 'pc') })),
});
}
