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
  {
    id: 'hero-everest', name: 'Everest', campaign: 'Inbox', classLine: 'Human Cleric 1 (Life Domain)', level: 1,
    classes: { cleric: 1 }, subclasses: { cleric: 'life domain' }, prof: 2,
    abil: { str: 17, dex: 14, con: 18, int: 15, wis: 20, cha: 15 },
    ac: 15, init: 2, hp: 12,
    saves: { str: 3, dex: 2, con: 4, int: 2, wis: 7, cha: 4 },
    resist: [], perAction: 1,
    attacks: [
      { name: 'Mace', toHit: 5, save: null, dc: null, dmg: '1d6+3', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false },
      { name: 'Spear', toHit: 5, save: null, dc: null, dmg: '1d6+3', type: 'piercing', melee: true, spell: false, slot: 0, count: 1, props: ['thrown', 'versatile'], conc: false, martialArts: false },
      { name: 'Unarmed Strike', toHit: 5, save: null, dc: null, dmg: '4', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false },
    ],
    spells: {
      mending: 0, 'sacred flame': 0, guidance: 0,
      bane: 1, bless: 1, command: 1, 'create or destroy water': 1, 'cure wounds': 1, 'detect evil and good': 1, 'detect magic': 1,
      'detect poison and disease': 1, 'guiding bolt': 1, 'healing word': 1, 'inflict wounds': 1, 'protection from evil and good': 1,
      'purify food and drink': 1, sanctuary: 1, 'shield of faith': 1,
    },
    dc: 15, spellHit: 7, spellMod: 5, slots: { 1: 2 }, pact: null,
    features: { spellcasting: {}, 'divine domain': {}, 'bonus proficiency': {}, 'disciple of life': {}, 'ability score increase': {}, languages: {} },
    feats: [], options: [],
    items: [{ name: 'leather', kind: 'armor' }, { name: 'shield', kind: 'armor' }, { name: 'mace', kind: 'weapon' }, { name: 'spear', kind: 'weapon' }],
    potions: {}, rogue: 0, barbarian: 0, fighter: 0, monk: 0, paladin: 0,
    sheet: { source: 'inbox/submissions/2026-10-15-everett-mv9olfgv', date: '2026-10-15' },
  },
];
