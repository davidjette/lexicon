// DM ONLY. The finale as Dave described it on 2026-10-10, built on the revised blocks (revised.js).
// A PROPOSAL: none of this is in the campaign files yet. No imports: see monsters.js.

export default function (api) {
const M = api.M;

// Who may be with the party. Dave: Zero-One and the Matheny defectors "will be allies in the final
// fights"; Roberts' help is possible.
const allySwitches = (on) => [
  { key: 'zeroOne', label: 'Zero-One is with them', on },
  { key: 'defectors', label: "Matheny's defectors are with them", on },
  { key: 'roberts', label: "Roberts' four swashbucklers are with them", on: false },
];
const allies = (sw) => [
  ...(sw.zeroOne ? [['zeroOneR', 1]] : []),
  ...(sw.defectors ? [['defectors', 1]] : []),
  ...(sw.roberts ? [['swashbuckler', 4]] : []),
];
// Companions added 2026-10-11 (evening): the two dragons, and the band with the horn.
const dragonSwitches = [
  { key: 'aurorix', label: 'Aurorix fights beside them (young gold in strength, half hit points). With Valtrex too, the dragons fight each other and neither helps', on: false },
  { key: 'valtrex', label: 'Valtrex fights beside them (young black in strength)', on: false },
];
// One dragon or the other. If both are there they go for each other and neither helps the party.
const dragons = (sw) => (sw.aurorix && sw.valtrex ? [] : [...(sw.aurorix ? [['aurorix', 1]] : []), ...(sw.valtrex ? [['valtrex', 1]] : [])]);
const named = (E, tag) => E.list.some((c) => c.tpl.id === tag && E.alive(c) && !c.down);

const PRESETS = [
  {
    id: 'garden',
    bg: 'imperial-garden.webp',
    name: '1. The garden: Dorn and Mary Christmas',
    where: "The Emperor's Gardens, the parterre (area L76)",
    blurb: 'The audience goes wrong. Maelis Dorn, Sister Mary Christmas and a post of four white guards, with a squad of five novices arriving every round. By default the party breaks for the palace at the end of round five; turn that off to fight until both named sisters are down.',
    monsters: [['dornR', 1], ['maryR', 1], ['whiteGuardR', 4]],
    switches: [{ key: 'dash', label: 'The party breaks for the palace after five rounds', on: true }, { key: 'doves', label: 'Novices keep arriving, five a round', on: true }, ...allySwitches(false)],
    extra: (sw) => ({ allies: allies(sw) }),
    scenario: (sw) => ({
      flags: { focusBoss: true },
      partyLeavesAfter: sw.dash ? 5 : 0,
      waves: sw.doves ? [{ round: 1, every: 1, spawn: [[M.novice, 5]], label: 'More novices come down the walks', until: (E) => !named(E, 'dornR') && !named(E, 'maryR') }] : [],
    }),
  },
  {
    id: 'hospital',
    name: '2. The hospital: Esther and her keepers',
    where: 'The hospital under the hill, the last ward (area L50)',
    blurb: 'Esther is held by the doves who are breaking her: two choirs of novices, two Sorrowful Sisters and a Sister of the Light. If the party can turn her she rises in round two and fights beside them, Half-Raised and without her sword.',
    monsters: [['choirNovices', 2], ['sorrowfulR', 2], ['whiteSister', 2], ['whiteGuardR', 2]],
    switches: [{ key: 'esther', label: 'Esther is turned, and fights beside the party from round two', on: false }, ...allySwitches(false)],
    extra: (sw) => ({ allies: allies(sw) }),
    scenario: (sw) => ({
      flags: { closeQuarters: true },
      waves: sw.esther ? [{ round: 1, side: 'pc', spawn: [[M.estherHalf, 1]], label: 'Esther Crona tears free of the slab' }] : [],
    }),
  },
  {
    id: 'door',
    bg: 'imperial-garden.webp',
    name: '3. A palace door: one Cursed Soldier',
    where: 'Heatherhill, the bridge and forecourts (areas P1 and P2)',
    blurb: 'One Cursed Soldier at a door, against the three of them. There is one at each door.',
    monsters: [['cursedSoldier', 1]],
    switches: [{ key: 'two', label: 'Two at this door', on: false }, ...allySwitches(false)],
    extra: (sw) => ({ monsters: sw.two ? [['cursedSoldier', 1]] : [], allies: allies(sw) }),
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'lobby',
    name: '4. The lobby: Sisters of the Blood',
    where: 'Heatherhill, the entrance hall (area P3)',
    blurb: 'Four Sisters of the Blood stand their ground between the doors and the stair.',
    monsters: [['redSister', 6]],
    switches: [...allySwitches(false)],
    extra: (sw) => ({ allies: allies(sw) }),
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'wing',
    name: '5. The wing toward the children',
    where: 'Heatherhill, the long corridor (area P5)',
    blurb: 'Three Sisters of the Blood hold the corridor to the daughters\' hall.',
    monsters: [['redSister', 5], ['redMinion', 5]],
    switches: [{ key: 'more', label: 'Five more arrive as minions at the end of round two', on: false }, ...allySwitches(false)],
    extra: (sw) => ({ allies: allies(sw) }),
    scenario: (sw) => ({ flags: {}, waves: sw.more ? [{ round: 2, spawn: [[M.redMinion, 5]], label: 'More red sisters run in from the hall' }] : [] }),
  },
  {
    id: 'daughters',
    name: '6. The Daughters of Vol',
    where: "Heatherhill, the daughters' hall (area P10)",
    blurb: 'All thirteen, by themselves: Muriel, the four aged nine to eleven, the four aged five to eight, and the four youngest as minions. Each is fragile, and together they bite with advantage and breathe.',
    monsters: [['muriel', 1], ['drakiel', 1], ['purell', 1], ['enwe', 1], ['fenwe', 1], ['chanel', 1], ['azriel', 1], ['duracell', 1], ['seraphiel', 1], ['littleDaughter', 4]],
    switches: [{ key: 'knight', label: 'The Cursed Knight comes in on round two', on: false }, ...allySwitches(false)],
    extra: (sw) => ({ allies: allies(sw) }),
    scenario: (sw) => ({
      flags: { closeQuarters: true },
      waves: sw.knight ? [{ round: 1, spawn: [[M.cursedKnight, 1]], label: 'The Cursed Knight steps in from the flower court' }] : [],
    }),
  },
  {
    id: 'stairs',
    name: '7. The stairs',
    where: 'Heatherhill, the upper landing (area P12)',
    blurb: 'Two Sisters of the Blood on the landing, with five more as minions behind them.',
    monsters: [['redSister', 4], ['redMinion', 5]],
    switches: [...allySwitches(false)],
    extra: (sw) => ({ allies: allies(sw) }),
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'bedchamber',
    name: '8. The bedchamber: Uriel, Holy Empress',
    where: "The Emperor's chamber (area P13)",
    blurb: 'Sister Marshall and three Sisters of the Blood around the bed. Uriel keeps herself between the party and the child and does not strike until she is hurt or only one sister is left; then she fights for three rounds, or to half her hit points, and leaves for Nos Matre.',
    monsters: [['urielBed', 1], ['marshallR', 1], ['redSister', 4]],
    switches: [
      { key: 'more', label: 'Four more sisters arrive as minions at the end of round two', on: false },
      { key: 'child', label: 'The party threatens the child: the shadow of Varyn Crona steps out', on: false },
      { key: 'rod', label: 'The rod is pulled in round one: the Emperor feeds', on: false },
      { key: 'polygon', label: 'The Polygon stands (she regains 20 HP a turn)', on: false },
      ...allySwitches(false),
    ],
    extra: (sw) => ({ allies: allies(sw), monsters: [...(sw.child ? [['varyn', 1]] : []), ...(sw.rod ? [['emperorFeeding', 1]] : [])] }),
    scenario: (sw) => ({
      flags: { polygon: sw.polygon },
      endOnFlee: true,
      waves: sw.more ? [{ round: 2, spawn: [[M.redMinion, 4]], label: 'Four more red sisters reach the chamber' }] : [],
    }),
  },
  {
    id: 'nosMatre',
    bg: 'lazaret.webp',
    name: '9. Nos Matre: the Reckoning',
    where: 'The forecourt of Nos Matre (area L32)',
    level: 14,
    blurb: 'Uriel floats above the cathedral and rings the Original. Four risen guards climb out of the hill every round and the bell shakes the living. Two Sisters of the Light and a choir of novices are with her. Brought to 0 she does not die: the labour takes her and she goes below. The party is level 14.',
    monsters: [['urielReckoning', 1], ['whiteSister', 1], ['choirNovices', 2]],
    switches: [
      { key: 'polygon', label: 'The Polygon stands (she regains 20 HP a turn)', on: false },
      { key: 'eden', label: 'Eden (elite) and four of her units are on the field: Uriel\'s under the bell, their own again if the band plays', on: false },
      { key: 'band', label: 'The Plaza Band plays the fanfare of dawn (no madness, and Uriel loses control of Eden; the risen dead keep coming)', on: false },
      { key: 'esther', label: 'Esther fights beside the party (Half-Raised)', on: false },
      ...dragonSwitches,
      ...allySwitches(true),
    ],
    extra: (sw) => ({
      allies: [...allies(sw), ...dragons(sw), ...(sw.band ? [['plazaBand', 1]] : []), ...(sw.esther ? [['estherHalf', 1]] : []),
        ...(sw.eden && sw.band ? [['edenZAlly', 1], ['edenUnitZAlly', 4]] : [])],
      monsters: sw.eden && !sw.band ? [['edenZ', 1], ['edenUnitZ', 4]] : [],
    }),
    scenario: (sw) => ({ flags: { polygon: sw.polygon, focusBoss: true, counterTone: !!sw.band, toneKeepsMadness: !!sw.toneKeepsMadness, toneFellsDead: !!sw.toneFellsDead }, endOnFlee: true }),
  },
  {
    id: 'sept',
    name: '10. The Sept of Bones: Uriel and the child',
    where: 'The Sept of Bones (areas S4 and S5)',
    bg: 'ossuary.webp',
    level: 15,
    dials: { eric: { useTopSlot: true }, dario: { smite: 'always' } },
    blurb: 'Uriel and the Heir of Vol, joined by the cord. Four risen guards come out of the bone floor on every lair action. If the child is destroyed she can no longer cast spells. The party is level 15 and holds nothing back.',
    monsters: [['urielSept', 1], ['heir', 1]],
    switches: [
      { key: 'millions', label: 'The dead keep rising from the floor, four a round', on: true },
      { key: 'spare', label: 'The party will not strike the child (Kitsune\'s order)', on: false },
      { key: 'cord', label: 'The cord is cut at the end of round two: Uriel is doomed, the Heir is free, and the party must last three more rounds to get out', on: false },
      { key: 'esther', label: 'Esther fights beside the party (Half-Raised)', on: false },
      ...allySwitches(true),
    ],
    extra: (sw) => ({ allies: [...allies(sw), ...(sw.esther ? [['estherHalf', 1]] : [])] }),
    scenario: (sw) => ({ flags: { focusBoss: true, noLair: !sw.millions, spare: sw.spare ? 'heir' : null, cutCord: sw.cord ? 2 : 0, fleeAfter: 3 } }),
  },
  {
    id: 'enochDining',
    name: "11a. E'noch's lair in pieces: the dining hall",
    where: 'The vampire lair, the dining hall (area V3)',
    blurb: 'Lady Ophelia and Lord Lieutenant Trillo with four spawn as minions, met without their master. Retuned blocks.',
    monsters: [['opheliaR', 1], ['trilloR', 1], ['spawnMinion', 6]],
    switches: [...allySwitches(false)],
    extra: (sw) => ({ allies: allies(sw) }),
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'enochAlone',
    name: "11b. E'noch's lair in pieces: E'noch at the blood pool",
    where: 'The vampire lair, the blood pool (area V9)',
    blurb: "E'noch after his lieutenants are dead, with the six spawn he calls out of the walls. Two forms: the wizard, and at 0 hit points the Huge master vampire.",
    monsters: [['enochR2', 1]],
    switches: [...dragonSwitches, ...allySwitches(false)],
    extra: (sw) => ({ allies: [...allies(sw), ...dragons(sw)] }),
    scenario: () => ({ flags: { focusBoss: true }, endOnFlee: true }),
  },
  {
    id: 'enochPool',
    name: "11c. E'noch's lair all together",
    where: 'The vampire lair, the blood pool (area V9)',
    blurb: "E'noch, Ophelia and Trillo at once, with six spawn as minions. Retuned blocks. This is what happens if the party does not meet them in pieces.",
    monsters: [['enochR2', 1], ['opheliaR', 1], ['trilloR', 1], ['spawnMinion', 6]],
    switches: [...dragonSwitches, ...allySwitches(false)],
    extra: (sw) => ({ allies: [...allies(sw), ...dragons(sw)] }),
    scenario: () => ({ flags: { focusBoss: true }, endOnFlee: true }),
  },
  {
    id: 'guardDoor',
    bg: 'lazaret.webp',
    name: '12a. White guards at a door',
    where: 'Anywhere in the outer ring',
    blurb: 'A pair of white guards on the revised block.',
    monsters: [['whiteGuardR', 2]],
    switches: [{ key: 'sister', label: 'A choir of novices sings behind them', on: false }],
    extra: (sw) => ({ monsters: sw.sister ? [['choirNovices', 1]] : [] }),
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'tallPostR',
    bg: 'lazaret.webp',
    name: '12b. A tall guard post',
    where: 'The gardens and the Westhouse',
    blurb: 'Four tall guards on the revised block.',
    monsters: [['tallGuardR', 4]],
    switches: [{ key: 'sister', label: 'A Sister of the Light directs them', on: false }],
    extra: (sw) => ({ monsters: sw.sister ? [['whiteSister', 1]] : [] }),
    scenario: () => ({ flags: {} }),
  },
];

api.register({ presets: PRESETS });
}
