// Corrections to the generated character records (heroes-data.js), written by hand from a newer
// or fuller sheet than the 2026-10-11 export. Each entry names its source. Fields given here
// replace the generated ones; `features` and `options` are added to them.
//
// Every character also carries the sheet it was read from, so a player can see which version of
// the character they are running: { source, date } here, and the level from the record itself.

export const DEFAULT_SHEET = { source: 'D&D Beyond export', date: '2026-10-11' };

const weapon = (name, toHit, dmg, type, extra = []) => ({ name, toHit, save: null, dc: null, dmg, type, extra, melee: false, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false });

export const SHEET_UPDATES = {
  // D&D Beyond PDF of 2026-10-12 (sydiot_9833865.pdf): Fighter 14. The sheet names no Martial
  // Archetype; at the table he is a Gunslinger (Matthew Mercer's archetype, v1.2,
  // Rules\563826-Gunslinger_Martial_Archetype_1.2.pdf), so its features are added here.
  // Table rulings (Dave, 2026-10-12): misfire and reload are not tracked (a feat of his removes
  // reload), and the Arms trick shot is left out.
  // The sheet's two firearms are stand-ins for his own (Dave, 2026-10-12), simplified here:
  //   Sandalwood Guns: the twin revolvers cast from Ironbane. A pistol's 1d10 piercing at the
  //     sheet's pistol numbers (+9, +2), plus Ironbane's 1d8 fire.
  //   Arcane Blaster rifle (Rules\ARCANE BLASTER.docx): Powerful action 3d10+3, Rifle barrel +2
  //     to hit, so +11 with Dexterity, proficiency and Archery. Force damage and the choice of
  //     the Powerful action are readings, not written; charges per shot are not tracked.
  //   Roland's Cube (Rules\ROLAND'S CUBE.pdf) is in the item book.
  'hero-roland-deschain': {
    sheet: { source: 'D&D Beyond PDF (sydiot_9833865.pdf)', date: '2026-10-12' },
    classLine: 'Human Fighter 14 (Gunslinger)',
    subclasses: { fighter: 'gunslinger' },
    attacks: [
      weapon('Sandalwood Guns', 9, '1d10+2', 'piercing', [['1d8', 'fire']]),
      weapon('Arcane Blaster rifle', 11, '3d10+3', 'force'),
      { name: 'Unarmed Strike', toHit: 7, save: null, dc: null, dmg: '3', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false },
    ],
    items: [{ name: "roland's cube", attuned: true, homebrew: true, kind: 'wondrous item' }],
    features: { grit: {}, 'deadeye shot': {}, quickdraw: {}, 'violent shot': {}, 'trick shot': {} },
  },
};

export function withUpdates(h) {
  const u = SHEET_UPDATES[h.id];
  if (!u) return { ...h, sheet: DEFAULT_SHEET };
  return { ...h, ...u, features: { ...(h.features || {}), ...(u.features || {}) }, options: [...(h.options || []), ...(u.options || [])] };
}
