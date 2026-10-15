// Characters added through the bestiary inbox (the Encounter Builder's "Add to library" form).
// Each record is read from an uploaded sheet by Claude (skill: bestiary-inbox) and has the same shape
// as a record in heroes-data.js, so buildHero() runs it the same way. Kept apart from heroes-data.js
// because tools/import_sheets.mjs rewrites that file whole. Public characters only: a DM-only
// character goes in src/dm/added.js as a stat block with side: 'pc'.
//
// Shape (see heroes-data.js for full examples):
//   { id: 'hero-<slug>', name, campaign, classLine: 'Human Fighter 5', level: 5,
//     abil: { str, dex, con, int, wis, cha }, ac, hp, init, saves: { dex: 5 }, resist: [], perAction: 1,
//     attacks: [{ name, toHit, save, dc, dmg: '1d8+3', type: 'slashing', melee: true, spell: false, slot: 0, count: 1 }],
//     spells: { 'fire bolt': 0, fireball: 3 }, dc, spellHit, spellMod, slots: { 1: 4, 2: 3 } | null, pact: null,
//     classes: { fighter: 5 }, subclasses: {}, features: { 'Second Wind': { act: 'bonus', uses: 1, reset: 'short' } },
//     feats: [], options: [], items: [{ name, attuned, kind }],
//     sheet: { source: 'inbox/<submission folder>', date: 'YYYY-MM-DD' } }

export const ADDED_HEROES = [
];
