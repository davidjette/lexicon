// DM ONLY. The preset fights of the finale and the slab-room replay. Sources:
// bestiary-doves-and-dead.md Part Eight and ivory-lazaret-dm.md ("Uriel in Three Fights").
// No imports: see monsters.js.

export default function (api) {
const { engage, hasRoom } = api;
const M = api.M;
const X = api.X;

// Stage three of Uriel: cutting the bond while the working is under way.
const cutBond = (bonus, skill) => ({
  kind: 'special', name: `Cut the bond (${skill})`, noTarget: true,
  when: (E, c) => E.enemiesOf(c).some((t) => t.memo.working),
  run(E, c) {
    const u = E.enemiesOf(c).find((t) => t.memo.working);
    if (!u) return;
    if (!hasRoom(E, u) && !c.engaged.has(u.id)) return E.log('info', `${c.name} cannot get to ${u.name}.`, c);
    engage(c, u);
    E.log('act', `${c.name} tries to cut the bond between ${u.name} and the child.`, c);
    if (bonus === 'auto' || E.check(c, bonus, 19, `${skill} check`)) {
      E.log('end', `The bond is cut. The child lives.`, c);
      u.memo.working = 0;
      u.memo.risen = true;
      u.fx = [];
      E.kill(u, c, 'the bond is cut');
    }
  },
});

// The characters learn to cut the bond only when this pack is loaded.
const SKILL = { eric: [10, 'Religion'], dario: [5, 'Medicine'], gemma: [2, 'Medicine'] };
const withBond = (tpl) => {
  const [bonus, skill] = SKILL[tpl.id] || [0, 'Medicine'];
  const brain = tpl.brain;
  return {
    ...tpl,
    actions: { ...tpl.actions, cutBond: cutBond(bonus, skill) },
    brain(E, c) {
      if (c.turn.action && E.usable(c, 'cutBond')) {
        const others = E.enemiesOf(c).some((t) => !t.down && !t.memo.working);
        if (!others || E.rng.chance(0.5)) return { act: 'cutBond', targets: [] };
      }
      return brain(E, c);
    },
  };
};

const PRESETS = [
  {
    id: 'uriel1',
    name: 'Uriel 1: The White Death',
    where: "The Emperor's chamber (area P13)",
    blurb: 'Uriel with Surgeon Marshall and three Sisters of the Blood at the bed. Five more sisters arrive at the end of round two and two at the end of round three. She uses no lair actions here, and leaves by word of recall at half her hit points.',
    monsters: [['uriel1', 1], ['surgeonMarshall', 1], ['sisterBlood', 3]],
    switches: [
      { key: 'polygon', label: 'The Polygon stands (she regains 20 HP a turn)', on: true },
      { key: 'reinforce', label: 'The other seven Sisters of the Blood arrive', on: true },
    ],
    scenario: (sw) => ({
      flags: { polygon: sw.polygon, focusBoss: true },
      endOnFlee: true,
      waves: sw.reinforce ? [
        { round: 2, spawn: [[M.sisterBlood, 5]], label: 'Five more Sisters of the Blood reach the bed' },
        { round: 3, spawn: [[M.sisterBlood, 2]], label: 'The last two Sisters of the Blood arrive' },
      ] : [],
    }),
  },
  {
    id: 'uriel2',
    bg: 'lazaret.webp',
    name: 'Uriel 2: The Holy Empress',
    where: 'The forecourt of Nos Matre (area L32)',
    blurb: 'Uriel with two Sisters of the Light, the Tall Sister and four white guards. She rings the Original, and eight white guards reach the forecourt every round after that. She goes below at half her hit points.',
    monsters: [['uriel2', 1], ['sisterLight', 2], ['tallSister', 1], ['whiteGuard', 4]],
    switches: [
      { key: 'polygon', label: 'The Polygon stands (she regains 20 HP a turn)', on: true },
      { key: 'eden', label: 'Eden arrives the round after the bell with eight units', on: false },
      { key: 'estherWith', label: 'Esther stands beside Uriel', on: false },
      { key: 'estherAgainst', label: 'Esther turns on Uriel', on: false },
      { key: 'enoch', label: "E'noch has joined her", on: false },
    ],
    extra: (sw) => ({
      monsters: [...(sw.estherWith ? [['estherRaised', 1]] : []), ...(sw.enoch ? [['enoch', 1]] : [])],
      allies: sw.estherAgainst ? [['estherRaised', 1]] : [],
    }),
    scenario: (sw) => ({
      flags: { polygon: sw.polygon, focusBoss: true },
      endOnFlee: true,
      waves: sw.eden ? [{
        round: 1, every: 1, once: true, side: 'pc', if: (E) => !!E.flags.bell,
        spawn: [[M.eden, 1], [M.edenUnit, 8]], label: 'Eden and eight of her units come over the wall and go straight for the Empress',
      }] : [],
    }),
  },
  {
    id: 'uriel3',
    name: 'Uriel 3: Mother of the Heir',
    where: 'The Sept of Bones (areas S4 and S5)',
    bg: 'ossuary.webp',
    blurb: 'Uriel at full power: two turns a round, AC 20, 330 HP, DC 21, and eight white guards out of the bone floor on every lair action. At 0 she begins the working that makes her a lich unless the bond is cut.',
    monsters: [['uriel3', 1]],
    switches: [
      { key: 'polygon', label: 'The Polygon still stands', on: false },
      { key: 'zeroOne', label: 'Zero-One is with the party (cuts the bond without a check)', on: false },
      { key: 'estherAgainst', label: 'Esther turns on Uriel', on: false },
      { key: 'enoch', label: "E'noch has joined her", on: false },
      { key: 'noMillions', label: 'Leave out the Millions (no white guards from the floor)', on: false },
    ],
    extra: (sw) => ({
      monsters: sw.enoch ? [['enoch', 1]] : [],
      allies: [...(sw.zeroOne ? [['zeroOne', 1]] : []), ...(sw.estherAgainst ? [['estherRaised', 1]] : [])],
    }),
    scenario: (sw) => ({ flags: { polygon: sw.polygon, focusBoss: true, noLair: sw.noMillions } }),
  },
  {
    id: 'dorn',
    name: 'Maelis Dorn in the Westhouse',
    where: 'Area L71',
    blurb: 'She does not fight. She rings the house bell on her first turn: the tall guard post arrives that round and the sisters of the house the round after.',
    monsters: [['maelisDorn', 1]],
    switches: [{ key: 'bell', label: 'She can ring the house bell', on: true }],
    scenario: (sw) => ({ flags: { houseBell: sw.bell, focusBoss: true } }),
  },
  {
    id: 'tallSister',
    name: 'The Tall Sister among the dead',
    where: 'The undercroft, or anywhere the order stores its corpses',
    blurb: 'The Tall Sister with four white guards and a floor of corpses to raise.',
    monsters: [['tallSister', 1], ['whiteGuard', 4]],
    switches: [{ key: 'corpses', label: 'Eight corpses already lie on the field', on: true }],
    scenario: (sw) => ({ corpses: sw.corpses ? 8 : 0, flags: { focusBoss: true } }),
  },
  {
    id: 'esther',
    name: 'Esther Crona',
    where: 'Wherever she is met',
    blurb: 'Esther alone. Raised is the full block with the sword in her hand; Half-Raised is the block the bestiary says to use until she has a blade.',
    monsters: [],
    switches: [
      { key: 'raised', label: 'Raised (CR 16), with a blade', on: true },
      { key: 'guards', label: 'Four white guards answer her voice', on: false },
    ],
    extra: (sw) => ({ monsters: [[sw.raised ? 'estherRaised' : 'estherHalf', 1], ...(sw.guards ? [['whiteGuard', 4]] : [])] }),
    scenario: () => ({ flags: { focusBoss: true } }),
  },
  {
    id: 'enoch',
    name: "E'noch in his hall",
    where: 'The vampire lair (areas V1 to V9)',
    blurb: "E'noch, who calls three spawn out of the walls and leaves through the wall below a third of his hit points. With the whole brood it is past deadly by the book.",
    monsters: [['enoch', 1]],
    switches: [{ key: 'brood', label: 'Trillo, Lady Ophelia and four spawn are with him', on: false }],
    extra: (sw) => ({ monsters: sw.brood ? [['trillo', 1], ['ophelia', 1], ['vampireSpawn', 4]] : [] }),
    scenario: () => ({ flags: { focusBoss: true }, endOnFlee: true }),
  },
  {
    id: 'emperor',
    name: 'The rod is pulled',
    where: "The Emperor's chamber (area P13)",
    blurb: 'The Emperor waking, guarded by the ghost of Varyn Crona. In round four he is Kaius, the Crimson Sun, which the bestiary says is past anything the party can fight.',
    monsters: [['emperorWaking', 1], ['varyn', 1]],
    switches: [],
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'bridge',
    bg: 'imperial-garden.webp',
    name: 'The Heatherhill bridge',
    where: 'Areas P1 and P2',
    blurb: 'The Big Ones. One is a hard fight for three 14th-level characters, two are deadly, and there are nine.',
    monsters: [['bigOne', 2]],
    switches: [],
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'tallPost',
    bg: 'lazaret.webp',
    name: 'A tall guard post',
    where: 'The middle ring (areas L57 to L80)',
    blurb: 'Four tall guards. The bestiary calls this deadly and meant to be avoided.',
    monsters: [['tallGuard', 4]],
    switches: [{ key: 'sister', label: 'A Sister of Standing is on the stair behind them', on: false }],
    extra: (sw) => ({ monsters: sw.sister ? [['sisterStanding', 1]] : [] }),
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'whitePair',
    bg: 'lazaret.webp',
    name: 'White guards at a door',
    where: 'The outer ring (areas L1 to L56)',
    blurb: 'A pair of white guards, as at any door in the valley.',
    monsters: [['whiteGuard', 2]],
    switches: [{ key: 'sister', label: 'A Sister of Standing is on the stair behind them', on: false }],
    extra: (sw) => ({ monsters: sw.sister ? [['sisterStanding', 1]] : [] }),
    scenario: () => ({ flags: {} }),
  },
  {
    id: 'replaySlab',
    replay: true,
    name: 'Replay: the slab room, 10/2',
    where: 'The hospital under Nos Matre, level three',
    blurb: 'The party at level 12 against a Choir, two Sorrowful Sisters as they were run, Maelis Dorn (who left after about 40 damage), two Battle Sisters through the door in round three and Esther rising in round four. The party left by dimension door after round seven. At the table: Gemma dropped once, Eric fell to about 20 HP.',
    level12: true,
    party: ['gemma', 'eric', 'dario'],
    monsters: [['choir', 1], ['slabSister', 2], ['maelisDornSlab', 1]],
    switches: [],
    scenario: () => ({
      flags: { closeQuarters: true },
      partyLeavesAfter: 7,
      endOnFlee: false,
      waves: [
        { round: 2, spawn: [[M.battleSister, 2]], label: 'Two Battle Sisters come through the door' },
        { round: 3, spawn: [[X.estherSlab, 1]], label: 'Esther Crona sits up on the slab' },
      ],
    }),
  },
];

api.register({ presets: PRESETS.map((p) => (p.replay ? p : { ...p, name: `As written: ${p.name}` })), pcExt: [withBond] });
}
