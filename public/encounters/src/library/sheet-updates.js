// Corrections to the generated character records (heroes-data.js), written by hand from a newer
// or fuller sheet than the 2026-10-11 export. Each entry names its source. Fields given here
// replace the generated ones; `features` and `options` are added to them.
//
// Every character also carries the sheet it was read from, so a player can see which version of
// the character they are running: { source, date } here, and the level from the record itself.

export const DEFAULT_SHEET = { source: 'D&D Beyond export', date: '2026-10-11' };

const weapon = (name, toHit, dmg, type, props = []) => ({ name, toHit, save: null, dc: null, dmg, type, melee: false, spell: false, slot: 0, count: 1, props, conc: false, martialArts: false });

export const SHEET_UPDATES = {
  // D&D Beyond PDF of 2026-10-12 (sydiot_9833865.pdf): Fighter 14 with two firearms. The sheet
  // names no Martial Archetype; at the table he is a Gunslinger (Matthew Mercer's archetype, v1.2,
  // Rules\563826-Gunslinger_Martial_Archetype_1.2.pdf), so its features are added here.
  // Table rulings (Dave, 2026-10-12): misfire and reload are not tracked, and the Arms trick shot
  // is left out. Attack numbers are the sheet's own: the rifle is at +5 there.
  'hero-roland-deschain': {
    sheet: { source: 'D&D Beyond PDF (sydiot_9833865.pdf)', date: '2026-10-12' },
    classLine: 'Human Fighter 14 (Gunslinger)',
    subclasses: { fighter: 'gunslinger' },
    attacks: [
      weapon('Repeating Shot Pistol', 9, '1d10+2', 'piercing', ['vex']),
      weapon('Antimatter Rifle, +1', 5, '6d8+3', 'necrotic', ['two-handed', 'sap']),
      { name: 'Unarmed Strike', toHit: 7, save: null, dc: null, dmg: '3', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false },
    ],
    features: { grit: {}, 'deadeye shot': {}, quickdraw: {}, 'violent shot': {}, 'trick shot': {} },
  },
};

export function withUpdates(h) {
  const u = SHEET_UPDATES[h.id];
  if (!u) return { ...h, sheet: DEFAULT_SHEET };
  return { ...h, ...u, features: { ...(h.features || {}), ...(u.features || {}) }, options: [...(h.options || []), ...(u.options || [])] };
}
