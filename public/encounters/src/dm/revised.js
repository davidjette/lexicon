// DM ONLY. The revised Lazaret bestiary: a PROPOSAL, tuned in the simulator and not yet in the
// campaign files. It follows Dave's notes of 2026-10-10: fewer kinds of dove, minions and crowds for
// numbers, no paralysis from the rank and file, Cursed Soldiers in place of the Big Ones, and Uriel
// re-staged. The blocks as written stay available beside these for comparison.
// No imports: see monsters.js.

export default function (api) {
const {
  melee, ranged, save, multi, toll, cond, prone, saveOr, order, summon, hold, banishment,
  emanation, hasAura, harm, healing, standAt, parry, isHonourDead, isSister, rollDice, areaTargets, breakAll,
} = api;
const { holdTheLine, lament, dispel, sentinelAtDeathsDoor, honour } = api.kit;
const M = api.M;
const R = {};
const def = (id, t) => {
  R[id] = { id, side: 'monster', pos: 'front', revised: true, ...t };
  M[id] = R[id];
  return R[id];
};
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });
const nextTurnEnd = { who: 'tgt', when: 'end', turns: 1 };
const engagedCount = (E, c) => [...c.engaged].filter((id) => E.present(E.get(id))).length;
const undeadAllies = (E, c) => E.alliesOf(c).filter((a) => a.tpl.type === 'undead' && E.active(a));
// "slowed": the stand-in for paralysis on rank-and-file abilities
const stilled = (name) => [cond('speed0', { name, dur: nextTurnEnd }), cond('noReactions', { name, dur: nextTurnEnd })];

// =====================================================================================
// Doves
// =====================================================================================
// Minion: 1 hit point, fixed damage, no conditions. Five to a squad, one initiative.
def('novice', {
  name: 'Novice (minion)', cr: 0.5, type: 'humanoid', tags: ['sister', 'singer'], minion: true, pos: 'mid',
  ac: 12, hp: 1, abil: A(10, 12, 10, 10, 13, 10), saves: { wis: 3 }, resist: ['necrotic'], img: 'black-dove.webp',
  actions: {
    knife: melee('Mercy Knife', 5, [['6', 'necrotic']]),
    toll: save('Toll', 'wis', 13, [['6', 'necrotic']], {}),
  },
  plan: [{ use: 'knife', if: (E, c) => engagedCount(E, c) > 0 || E.rng.chance(0.5) }, 'toll'],
  basic: 'toll', oa: 'knife',
});

// Crowd: six novices as one creature. Double damage from areas; half strength below half hit points.
def('choirNovices', {
  name: 'Choir of Novices (crowd of six)', cr: 5, type: 'humanoid', tags: ['sister', 'singer'], pos: 'mid', areaVuln: true,
  ac: 13, hp: 90, abil: A(10, 12, 12, 10, 14, 10), saves: { wis: 4 }, resist: ['necrotic'],
  condImmune: ['grappled', 'restrained', 'prone'], img: 'black-dove.webp',
  outMult: (E, c) => (c.hp < 45 ? 0.5 : 1),
  actions: {
    knives: melee('Knives', 5, [['3d6', 'necrotic']], { also: 2 }),
    toll: save('Toll', 'wis', 14, [['2d10', 'necrotic']], { area: { type: 'all', max: 2 } }),
    direct: order('Direct the Dead', { n: 1, filter: isHonourDead, cost: 'bonus' }),
  },
  plan: [{ use: 'knives', if: (E, c) => engagedCount(E, c) > 0, chance: 0.5 }, 'toll'],
  bonusPlan: ['direct'],
  basic: 'toll', oa: 'knives',
});

def('whiteSister', {
  name: 'Sister of the Light', battler: 'doveWhite', cr: 8, type: 'humanoid', tags: ['sister', 'white'], pos: 'back', smart: true, rank: 3,
  ac: 16, hp: 110, abil: A(10, 16, 14, 14, 18, 18), saves: { dex: 6, wis: 7, cha: 7 },
  resist: ['necrotic', 'radiant'], condImmune: ['charmed', 'frightened'], img: 'black-dove-white.webp',
  actions: {
    light: ranged('Light of Aerenal', 8, [['3d8+4', 'radiant']]),
    cradle: save('Cradle of Pain', 'con', 16, [['6d8', 'necrotic']], { half: true, recharge: 5, onFail: stilled('Cradle of Pain') }),
    multi: multi(['light', 'light'], ['light', 'cradle']),
    command: order('Command', { n: 1, filter: isSister, cost: 'bonus', text: "acts on the white sister's command" }),
  },
  plan: [{ use: 'multi', opt: (E, c) => (c.ready.cradle !== false ? 1 : 0) }],
  bonusPlan: ['command'],
  reactions: [{ ...sentinelAtDeathsDoor, uses: 1 }],
  basic: 'light',
});

const redActions = (dc, hit) => ({
  lancet: melee('Lancet', hit, [['1d4+3', 'piercing'], ['3d6', 'necrotic']], { onHit: [{ fx: 'healSelf', amount: 'halfDealt', label: 'the lancet' }] }),
  bloodletting: save('Bloodletting', 'con', dc, [['4d8', 'necrotic']], {
    half: true, notUndead: true, onFail: [cond('noHeal', { name: 'Bloodletting', dur: { who: 'src', when: 'start', turns: 1 } })],
  }),
  // Torpor no longer paralyses: speed 0 and no reactions until the end of the target's next turn.
  torpor: save('Torpor', 'con', dc, null, { recharge: 6, onFail: stilled('Torpor') }),
  multi: multi(['lancet', 'lancet'], ['lancet', 'bloodletting']),
  transfusion: healing('Transfusion', '2d8+2', { cost: 'bonus', uses: 3, below: 0.5 }),
});

def('redSister', {
  name: 'Sister of the Blood', battler: 'doveRed', cr: 7, type: 'humanoid', tags: ['sister', 'red'], smart: true, rank: 3,
  ac: 15, hp: 95, abil: A(12, 16, 16, 18, 16, 14), saves: { con: 6, int: 7, wis: 6 },
  resist: ['necrotic'], immune: ['poison'], condImmune: ['poisoned'], img: 'sister-of-the-blood.webp',
  actions: redActions(15, 7),
  plan: [{ use: 'torpor', chance: 0.5 }, { use: 'multi', opt: (E) => (E.rng.chance(0.4) ? 1 : 0) }],
  bonusPlan: ['transfusion'],
  basic: 'lancet', oa: 'lancet',
});

def('redMinion', {
  name: 'Sister of the Blood (minion)', cr: 1, type: 'humanoid', tags: ['sister', 'red'], minion: true,
  ac: 14, hp: 1, abil: A(12, 16, 14, 14, 14, 12), saves: { con: 4, wis: 4 }, resist: ['necrotic'], immune: ['poison'],
  condImmune: ['poisoned'], img: 'sister-of-the-blood.webp',
  actions: { lancet: melee('Lancet', 6, [['9', 'necrotic']]) },
  basic: 'lancet', oa: 'lancet',
});

def('sorrowfulR', {
  name: 'Sorrowful Sister', cr: 5, type: 'undead', tags: ['sister', 'wight'], pos: 'mid',
  ac: 14, hp: 75, abil: A(12, 14, 14, 12, 16, 16), saves: { wis: 6, cha: 6 },
  resist: ['necrotic', 'psychic'], condImmune: ['charmed', 'exhaustion', 'frightened', 'poisoned'], img: 'black-dove.webp',
  actions: {
    hand: melee('Grave Hand', 6, [['2d6+3', 'necrotic']], {
      onHit: [saveOr('con', 13, [{ fx: 'maxHp', amount: 8, label: 'life drain' }], { oncePerTurn: 'drain' })],
    }),
    toll: toll(14, '3d10'),
    multi: multi(['hand', 'hand'], ['toll', 'toll']),
  },
  plan: [{ use: 'multi', opt: (E, c) => (engagedCount(E, c) ? 0 : 1) }],
  reactions: [{ ...lament, id: 'lamentR' }],
  basic: 'toll', oa: 'hand',
});

// ---- named sisters ----
def('dornR', {
  name: 'Sister-Inquisitor Maelis Dorn', cr: 11, type: 'humanoid', tags: ['sister', 'singer'], pos: 'back', smart: true, boss: true, rank: 5,
  ac: 17, hp: 150, abil: A(14, 12, 18, 18, 20, 16), saves: { con: 8, int: 8, wis: 9 },
  resist: ['necrotic'], condImmune: ['charmed', 'frightened'], lr: 2, leg: 3, img: 'maelis-dorn.webp',
  actions: {
    staff: melee('Staff', 7, [['1d8+2', 'bludgeoning'], ['3d6', 'necrotic']]),
    toll: toll(17, '4d12'),
    multi: multi(['staff', 'staff'], ['staff', 'toll']),
    holdMonster: hold('Hold Monster', 17, { uses: 1 }),
    banishment: banishment(17, { uses: 1 }),
    dispel: dispel(5, 2),
    order: order('Order', { n: 1, filter: (E, a) => isSister(E, a) || isHonourDead(E, a), cost: 'leg' }),
  },
  plan: [
    { use: 'dispel', chance: 0.6 },
    { use: 'holdMonster', if: (E, c) => !c.conc && E.round >= 2, chance: 0.5 },
    { use: 'banishment', if: (E, c) => !c.conc && E.round >= 2, chance: 0.35 },
    { use: 'multi', if: (E, c) => engagedCount(E, c) > 0, opt: 1 },
    'toll',
  ],
  legs: [{ act: 'order', cost: 1, w: 3 }, { act: 'toll', cost: 2, w: 2 }],
  basic: 'toll', oa: 'staff',
});

// Mary Christmas takes over the Tall Sister's work with the dead.
def('maryR', {
  name: 'Sister Mary Christmas', cr: 11, type: 'humanoid', tags: ['sister', 'singer'], smart: true, boss: true, rank: 4,
  ac: 18, hp: 170, speed: 40, abil: A(20, 16, 18, 12, 18, 14), saves: { str: 9, con: 8, wis: 8 },
  resist: ['necrotic'], condImmune: ['frightened'], lr: 1, leg: 2, img: 'tall-sister.webp',
  actions: {
    scythe: melee('Scythe', 9, [['1d10+5', 'slashing'], ['2d6', 'necrotic']]),
    multi: multi(['scythe', 'scythe', 'scythe']),
    reap: save('Reap', 'dex', 16, [['5d10', 'slashing']], { half: true, recharge: 5, onFail: [prone], area: { type: 'engaged' } }),
    callRank: summon('Call the Rank', () => [[M.guardMinion, 6]], { uses: 1 }),
    direct: order('Direct', { n: 1, filter: isHonourDead, cost: 'leg' }),
  },
  plan: [{ use: 'callRank', if: (E) => E.round >= 2 }, { use: 'reap', min: 2 }, 'multi', 'reap'],
  legs: [{ act: 'scythe', cost: 1, w: 3, if: (E, c) => engagedCount(E, c) > 0 }, { act: 'direct', cost: 1, w: 2 }],
  basic: 'scythe', oa: 'scythe',
});

def('marshallR', {
  name: 'Sister Marshall', cr: 10, type: 'humanoid', tags: ['sister', 'red'], smart: true, boss: true, rank: 4,
  ac: 16, hp: 150, abil: A(12, 16, 16, 18, 18, 14), saves: { con: 7, int: 8, wis: 8 },
  resist: ['necrotic'], immune: ['poison'], condImmune: ['poisoned'], lr: 1, img: 'sister-of-the-blood.webp',
  actions: {
    ...redActions(16, 8),
    // the one paralysing effect left among the red sisters, once a fight
    holdHim: save('Hold Him', 'con', 16, null, { uses: 1, area: { type: 'all', max: 3 }, onFail: [cond('paralysed', { name: 'Hold Him', dur: nextTurnEnd })] }),
  },
  plan: [{ use: 'holdHim', if: (E) => E.round >= 2 }, { use: 'torpor', chance: 0.5 }, { use: 'multi', opt: (E) => (E.rng.chance(0.4) ? 1 : 0) }],
  bonusPlan: ['transfusion'],
  reactions: [standAt('triage', 'Triage', 20, (E, t) => t.tpl.id === 'redSister', { uses: 2 })],
  basic: 'lancet', oa: 'lancet',
});

// DRAFT (no block exists in the campaign files). She will not fight a sister: she heals, and she
// strikes only the dead.
def('lusFayina', {
  name: 'Sister Lus Fayina (draft)', cr: 5, type: 'humanoid', tags: ['sister'], side: 'pc', pos: 'back',
  ac: 15, hp: 70, abil: A(10, 12, 14, 14, 17, 14), saves: { wis: 6 }, resist: ['necrotic'], img: 'black-dove.webp',
  actions: {
    toll: save('Toll', 'wis', 14, [['3d10', 'necrotic']], { only: (E, t) => !E.hasTag(t, 'sister') }),
    mercy: healing('Mercy', '2d8+3', { cost: 'bonus', uses: 3, below: 0.5 }),
  },
  plan: ['toll'],
  bonusPlan: ['mercy'],
  basic: 'toll',
});

// =====================================================================================
// Guards
// =====================================================================================
def('whiteGuardR', {
  ...honour, name: 'White Guard', cr: 5, ac: 17, hp: 75, abil: A(18, 12, 18, 6, 14, 5), saves: { con: 7, wis: 5 },
  resist: ['necrotic'], img: 'white-knight.webp',
  actions: {
    glaive: melee('Glaive', 7, [['1d10+4', 'slashing'], ['1d6', 'necrotic']], {
      onHit: [saveOr('con', 14, [cond('quiet', { name: 'The Quiet', dur: nextTurnEnd })], { oncePerTurn: 'quiet' })],
    }),
    multi: multi(['glaive', 'glaive']),
  },
  basic: 'glaive', oa: 'glaive',
});

def('guardMinion', {
  ...honour, name: 'Risen Guard (minion)', cr: 1, minion: true, crossedBlades: false, tags: ['honourDead', 'risen'],
  ac: 15, hp: 1, abil: A(16, 10, 14, 6, 10, 5), saves: { con: 4 }, resist: ['necrotic'], noCorpse: true, img: 'white-knight.webp',
  actions: { glaive: melee('Glaive', 7, [['9', 'slashing']]) },
  basic: 'glaive', oa: 'glaive',
});

def('tallGuardR', {
  ...honour, name: 'Tall Guard', cr: 8, ac: 17, hp: 120, abil: A(22, 10, 20, 6, 12, 5), saves: { str: 9, con: 8 },
  resist: ['necrotic'], undeadFortitude: true, img: 'white-knight.webp',
  actions: {
    halberd: melee('Halberd', 9, [['2d10+5', 'slashing'], ['2d6', 'necrotic']]),
    shove: save('Shove', 'str', 16, null, { melee: true, onFail: [prone] }),
    multi: multi(['halberd', 'halberd'], ['halberd', 'shove']),
  },
  plan: [{ use: 'multi', opt: (E) => (E.rng.chance(0.3) ? 1 : 0) }],
  reactions: [holdTheLine('Hold the Line', 'halberd')],
  basic: 'halberd', oa: 'halberd',
});

// The Big Ones, re-read as Cursed Soldiers: huge undead of celestial or infernal origin, enslaved to
// the Empress's will. A hill giant's chassis, scaled so that one at a door is a fair fight.
def('cursedSoldier', {
  name: 'Cursed Soldier', cr: 10, type: 'undead', tags: ['honourDead', 'cursed'], size: 'huge', eyeless: true,
  ac: 17, hp: 280, speed: 40, abil: A(25, 8, 21, 6, 12, 6), saves: { str: 11, con: 9, wis: 5 },
  resist: ['necrotic', 'radiant', 'fire'], immune: ['poison'], condImmune: ['charmed', 'exhaustion', 'frightened', 'poisoned', 'paralysed'],
  img: 'white-knight.webp',
  actions: {
    greatpole: melee('Greatpole', 12, [['3d10+8', 'bludgeoning']]),
    multi: multi(['greatpole', 'greatpole', 'greatpole']),
    sweep: save('Sweep', 'dex', 18, [['7d10', 'bludgeoning']], { half: true, recharge: 5, onFail: [prone], area: { type: 'near', max: 3, spread: 0.15 } }),
  },
  plan: [{ use: 'sweep', if: (E, c) => engagedCount(E, c) >= 2 }, 'multi'],
  basic: 'greatpole', oa: 'greatpole',
});

// =====================================================================================
// The Daughters of Vol: all thirteen, scaled by age. Dangerous in a pack and very fragile.
// (Dave, 2026-10-11: "it should be 13 Daughters of Vol, they should be dangerous but very fragile,
// scale them in ages if need be".) Names, ages and breaths are the bestiary's own table.
// =====================================================================================
const wailOf = (dice) => (E, c, ctx) => {
  const near = (ctx.wasEngaged || []).filter((t) => E.present(t) && t.tpl.type !== 'undead' && t.side !== c.side);
  if (dice && near.length) E.saveEffect(c, { name: 'Wail of Rejection', save: 'wis', dc: 14, dmg: [[dice, 'psychic']], half: true }, near);
};
const TIERS = {
  // ages 9 to 11
  elder: { cr: 4, ac: 15, hp: 42, hit: 6, bite: '2d6+3', rider: '1d6', claw: '1d8+3', dc: 15, breath: '7d6', wail: '3d6', recharge: 6 },
  // ages 5 to 8
  middle: { cr: 2, ac: 14, hp: 26, hit: 5, bite: '1d8+2', rider: '1d6', claw: '1d6+2', dc: 14, breath: '5d6', wail: '2d6', recharge: 5 },
};
const daughter = (id, name, age, type, tier) => {
  const t = TIERS[tier];
  return def(id, {
    name: `${name}, age ${age}`, cr: t.cr, type: 'dragon', tags: ['daughter'], packTactics: 'daughter', pos: 'front',
    ac: t.ac, hp: t.hp, abil: A(12, 16, 12, 14, 12, 16), saves: { dex: t.hit - 1, cha: t.hit - 1 },
    resist: ['necrotic'], immune: [type], img: 'daughters.webp',
    actions: {
      bite: melee('Bite', t.hit, [[t.bite, 'piercing'], [t.rider, type]]),
      claw: melee('Claw', t.hit, [[t.claw, 'slashing']]),
      multi: multi(['bite', 'claw']),
      breath: save(`${type[0].toUpperCase()}${type.slice(1)} Breath`, type === 'cold' ? 'con' : 'dex', t.dc, [[t.breath, type]], { half: true, recharge: t.recharge, area: { type: 'near', max: 3, spread: 0.25 } }),
    },
    plan: ['breath', 'multi'],
    hooks: { onDeath: wailOf(t.wail) },
    basic: 'bite', oa: 'bite',
  });
};
def('muriel', {
  name: 'Muriel, the Eldest, age 12', cr: 6, type: 'dragon', tags: ['daughter'], packTactics: 'daughter', smart: true, boss: true,
  ac: 16, hp: 75, abil: A(14, 16, 16, 16, 12, 18), saves: { dex: 6, con: 6, cha: 7 }, resist: ['necrotic'], immune: ['lightning'], img: 'daughters.webp',
  actions: {
    bite: melee('Bite', 7, [['2d6+3', 'piercing'], ['2d6', 'lightning']]),
    claw: melee('Claw', 7, [['1d10+3', 'slashing']]),
    multi: multi(['bite', 'claw']),
    breath: save('Lightning Breath', 'dex', 16, [['8d6', 'lightning']], { half: true, recharge: 5, area: { type: 'near', max: 3, spread: 0.3 } }),
    speak: order('Speak for Us', { n: 1, filter: (E, a) => E.hasTag(a, 'daughter') && !a.tpl.minion, cost: 'bonus', text: "bites on her sister's word" }),
    mothersToll: save("Mother's Daughter: Toll the Dead", 'wis', 15, [['4d12', 'necrotic']], { uses: 1, spell: true }),
  },
  plan: ['breath', { use: 'mothersToll', chance: 0.5 }, 'multi'],
  bonusPlan: ['speak'],
  hooks: { onDeath: wailOf('4d6') },
  basic: 'bite', oa: 'bite',
});
daughter('drakiel', 'Drakiel', 11, 'fire', 'elder');
daughter('purell', 'Purell', 10, 'acid', 'elder');
daughter('enwe', 'Enwe', 9, 'cold', 'elder');
daughter('fenwe', 'Fenwe', 9, 'cold', 'elder');
daughter('chanel', 'Chanel', 8, 'lightning', 'middle');
daughter('azriel', 'Azriel', 7, 'acid', 'middle');
daughter('duracell', 'Duracell', 6, 'lightning', 'middle');
daughter('seraphiel', 'Seraphiel', 5, 'fire', 'middle');
// ages 1 to 4: minions. They bite, and that is all.
def('littleDaughter', {
  name: 'Youngest Daughter (minion, ages 1 to 4)', cr: 0.25, type: 'dragon', tags: ['daughter'], packTactics: 'daughter', minion: true,
  ac: 13, hp: 1, abil: A(6, 14, 10, 10, 10, 14), saves: { dex: 4 }, resist: ['necrotic'], immune: ['fire'], img: 'daughters.webp',
  actions: { bite: melee('Bite', 4, [['3', 'piercing'], ['2', 'fire']]) },
  basic: 'bite', oa: 'bite',
});

// =====================================================================================
// The brood, retuned. E'noch, Ophelia and Trillo as a fight the party can have: one in the dining
// hall, a harder one at the blood pool. Paralysis and domination are cut back to one use each.
// =====================================================================================
const brood = { type: 'undead', tags: ['vampire'], resist: ['necrotic'] };
const grabbed = (E, c) => E.enemiesOf(c).find((t) => t.fx.some((f) => f.cond === 'grappled' && f.srcId === c.id));

def('spawnMinion', {
  ...brood, name: 'Vampire Spawn (minion)', cr: 1, minion: true, noCorpse: true,
  ac: 14, hp: 1, abil: A(16, 16, 14, 8, 10, 8), saves: { dex: 5 }, img: 'vampire.webp',
  actions: { claw: melee('Claw', 6, [['8', 'slashing']]) },
  basic: 'claw', oa: 'claw',
});

def('trilloR', {
  ...brood, name: 'Lord Lieutenant Trillo', cr: 11, smart: true, boss: true,
  ac: 19, hp: 220, speed: 40, regen: 10, abil: A(22, 18, 22, 14, 16, 18), saves: { str: 10, dex: 8, con: 10, wis: 7 }, lr: 1, leg: 2, img: 'vampire.webp',
  actions: {
    sword: melee('Sword', 11, [['2d8+6', 'slashing'], ['2d6', 'necrotic']], { critMin: 19 }),
    multi: multi(['sword', 'sword', 'sword']),
    pounce: save('Pounce', 'str', 17, null, { cost: 'bonus', onFail: [prone] }),
    order: order('Order', { n: 2, filter: (E, a) => E.hasTag(a, 'vampire'), cost: 'leg', text: "claws on Trillo's order" }),
  },
  bonusPlan: [{ use: 'pounce', chance: 0.5 }],
  legs: [{ act: 'sword', cost: 1, w: 3, if: (E, c) => engagedCount(E, c) > 0 }, { act: 'order', cost: 2, w: 2 }],
  reactions: [parry(3)],
  basic: 'sword', oa: 'sword',
});

def('opheliaR', {
  ...brood, name: 'Lady Ophelia', cr: 10, smart: true, boss: true, pos: 'mid',
  ac: 16, hp: 160, regen: 10, abil: A(16, 20, 16, 18, 16, 22), saves: { dex: 9, wis: 7, cha: 10 }, lr: 1, leg: 2, img: 'vampire.webp',
  actions: {
    claw: melee('Claw', 9, [['1d8+5', 'slashing'], ['3d6', 'necrotic']]),
    bite: melee('Bite', 9, [['1d6+5', 'piercing'], ['4d6', 'necrotic']], {
      onHit: [{ fx: 'maxHp', amount: 'dealtNecrotic', label: 'the bite' }, { fx: 'healSelf', amount: 'dealtNecrotic', label: 'feeding' }],
      aiTarget: (E, c) => E.enemiesOf(c).find((t) => E.has(t, 'charmed')) || grabbed(E, c) || null,
    }),
    charm: save('Charm', 'wis', 17, null, {
      only: (E, t) => t.tpl.type === 'humanoid' && !E.has(t, 'charmed'),
      onFail: [{ fx: 'cond', cond: 'charmed', name: 'Charm', saveOnHarm: { ability: 'wis', dc: 17 }, dur: { who: 'src', when: 'end', turns: 10 } }],
    }),
    multi: multi(['claw', 'claw'], ['claw', 'charm'], ['claw', 'bite']),
    holdPerson: hold('Hold Person', 17, { uses: 1 }),
    invisibility: { kind: 'buff', name: 'Greater Invisibility', spell: true, conc: true, uses: 1, self: true, effect: { cond: 'invisible' } },
  },
  plan: [
    { use: 'holdPerson', if: (E, c) => !c.conc && E.round >= 2, chance: 0.5 },
    { use: 'invisibility', if: (E, c) => !c.conc && c.hp < c.maxHp * 0.5 },
    { use: 'multi', opt: (E, c) => (E.enemiesOf(c).some((t) => E.has(t, 'charmed')) ? 2 : E.rng.chance(0.3) ? 1 : 0) },
  ],
  legs: [{ act: 'claw', cost: 1, w: 3 }, { act: 'charm', cost: 2, w: 1 }],
  basic: 'claw', oa: 'claw',
});

const enochSpellsR = ['fingerOfDeath', 'circleOfDeath', 'blight', 'chillTouch'];
def('enochR', {
  ...brood, name: "E'noch Qualanthri", battler: 'priest', cr: 14, smart: true, boss: true, pos: 'mid', truesight: true, magicAdv: true,
  ac: 18, hp: 300, regen: 10, abil: A(14, 18, 18, 24, 20, 20), saves: { con: 9, int: 12, wis: 10, cha: 10 },
  condImmune: ['charmed', 'frightened'], lr: 2, leg: 3, fleeAt: 0.33, fleeText: 'steps into the wall and is gone', img: 'enoch.webp',
  actions: {
    touch: melee('Withering Touch', 12, [['6d6', 'necrotic']], {
      weapon: false, onHit: [{ fx: 'maxHp', amount: 'dealt', label: 'Withering Touch' }, { fx: 'healSelf', amount: 'halfDealt', label: 'Withering Touch' }],
    }),
    chillTouch: ranged('Chill Touch', 12, [['4d8', 'necrotic']], { spell: true, weapon: false, hidden: true, onHit: [cond('noHeal', { name: 'Chill Touch', dur: { who: 'src', when: 'end', turns: 1 } })] }),
    blight: save('Blight', 'con', 19, [['8d8', 'necrotic']], { half: true, spell: true, uses: 3, hidden: true }),
    fingerOfDeath: save('Finger of Death', 'con', 19, [['7d8+30', 'necrotic']], { half: true, spell: true, uses: 1, hidden: true }),
    circleOfDeath: save('Circle of Death', 'con', 19, [['8d8', 'necrotic']], { half: true, spell: true, uses: 1, hidden: true, area: { type: 'near', max: 4, spread: 0.4 } }),
    multi: {
      kind: 'special', name: 'Multiattack (a spell and two Withering Touches)',
      aiTarget: (E, c) => E.ai.pickTarget(E, c, null),
      run(E, c) {
        const usable = enochSpellsR.filter((id) => E.usable(c, id, { free: true }));
        const w = { fingerOfDeath: 4, circleOfDeath: 4, blight: 3, chillTouch: 1 };
        for (const id of [...usable].sort((x, y) => w[y] * E.rng.next() - w[x] * E.rng.next())) {
          const ch = E.ai.tryPlan(E, c, { use: id, cost: 'free' }, null);
          if (ch) { E.perform(c, { ...ch, free: true }); break; }
        }
        for (let i = 0; i < 2; i++) {
          const t = E.active(c) ? E.ai.pickTarget(E, c, E.action(c, 'touch')) : null;
          if (t) E.attack(c, t, E.action(c, 'touch'), {});
        }
      },
    },
    children: summon('Children of the Night', () => [[M.spawnMinion, 6]], { uses: 1 }),
  },
  plan: ['children', 'multi'],
  legs: [{ act: 'touch', cost: 1, w: 3, if: (E, c) => engagedCount(E, c) > 0 }, { act: 'chillTouch', cost: 1, w: 3 }, { act: 'blight', cost: 2, w: 2 }],
  basic: 'touch', oa: 'touch',
});

// =====================================================================================
// Uriel, re-staged. Legendary actions priced by weight: 1 for a scythe attack, a cantrip or
// Command the Dead; 2 for Breath of the Grave; 3 for a levelled spell.
// =====================================================================================
const urielR = (id, name, o) => {
  const dc = o.dc || 19;
  const hit = o.hit || 10;
  const roused = (E, c) => !o.passive || c.memo.roused;
  return def(id, {
    name, battler: o.battler, cr: o.cr, type: 'humanoid', tags: ['uriel', 'sister'], smart: true, boss: true, rank: 9, pos: 'mid',
    ac: o.ac || 19, hp: o.hp, abil: A(20, 18, 18, 9, 22, 18), saves: { con: 9, wis: 11, cha: 9 },
    resist: ['necrotic'], condImmune: ['charmed', 'frightened', 'poisoned', 'exhaustion'],
    lr: 3, leg: 3, deathWard: true, flying: !!o.floats, img: 'uriel.webp',
    actions: {
      dove: melee('Mourning Dove', hit, [['2d8+7', 'slashing']], { also: 1, onHit: [{ fx: 'curse' }] }),
      tollDead: save('Toll the Dead', 'wis', dc, (E, t) => [[t.hp < t.maxHp ? '4d8+6' : '3d8+6', 'necrotic']], { spell: true }),
      sacredFlame: save('Sacred Flame', 'dex', dc, [['3d8+6', 'radiant']], { spell: true }),
      multi: multi(['dove', 'dove'], ['dove', 'tollDead'], ['tollDead', 'sacredFlame']),
      blight: save('Blight', 'con', dc, [['8d8', 'necrotic']], { spell: true, half: true, uses: 3 }),
      harm: harm(dc, { uses: 1 }),
      heal: { kind: 'heal', name: 'Heal', dice: '70', self: true, spell: true, uses: 1, when: (E, c) => c.hp <= c.maxHp - 70 },
      guardians: emanation('Spirit Guardians', { dc, dmg: [['6d6', 'necrotic']], uses: 3 }),
      breath: {
        kind: 'special', name: 'Breath of the Grave', recharge: 5, noTarget: true,
        when: (E, c) => engagedCount(E, c) >= 1 || o.floats,
        run(E, c) {
          const first = E.get([...c.engaged].find((x) => E.present(E.get(x)))) || E.ai.pickTarget(E, c, null);
          if (!first) return;
          const targets = areaTargets(E, c, first, { type: 'near', max: 4, spread: 0.25 }).filter((t) => t.tpl.type !== 'undead' && t.tpl.type !== 'construct');
          E.saveEffect(c, { name: 'Breath of the Grave', save: 'con', dc, dmg: [['8d8', 'necrotic']], half: true, isArea: true }, targets);
          for (const a of undeadAllies(E, c)) if (a.hp < a.maxHp && !a.tpl.minion) E.heal(a, 36, c, 'Breath of the Grave');
        },
      },
      commandDead: order('Command the Dead', { n: 1, filter: (E, a) => a.tpl.type === 'undead' }),
      // Nos Matre: the bell. The dead rise every round from here on, and the living are shaken.
      bell: {
        kind: 'special', name: 'Ring the Original', uses: 1, noTarget: true,
        when: () => !!o.bell,
        run(E, c) {
          E.log('act', `${c.name} rings the Original. The dead begin to climb out of the hill.`, c);
          E.flags.bell = E.round;
          E.waves.push({
            round: E.round, every: 1, spawn: [[M.guardMinion, o.risenPerRound || 4]], label: 'The risen dead reach the forecourt',
            until: (E2) => !E2.list.some((x) => E2.hasTag(x, 'uriel') && E2.alive(x)),
          });
        },
      },
      // DRAFT: "drive the living mad". Each living enemy saves or is shaken until the end of its next turn.
      madness: save('The Bell Tolls (madness)', 'wis', 15, null, {
        area: { type: 'all' }, when: (E) => !!E.flags.bell && !(E.flags.counterTone && !E.flags.toneKeepsMadness), only: (E, t) => t.tpl.type !== 'undead' && t.tpl.type !== 'construct',
        onFail: [{ fx: 'effect', effect: { id: 'bellMad', name: 'shaken by the bell', disAtk: true, announce: true }, dur: nextTurnEnd }, cond('noReactions', { name: 'the bell', dur: nextTurnEnd })],
      }),
      millions: summon('No Rest for the Wicked', () => [[M.guardMinion, o.risenPerRound || 4]], {}),
    },
    plan: [
      { use: 'bell' },
      { use: 'heal', if: roused },
      { use: 'breath', if: roused },
      { use: 'guardians', if: (E, c) => roused(E, c) && !c.conc && !hasAura(E, c, 'Spirit Guardians') && engagedCount(E, c) >= 1 },
      { use: 'harm', if: roused, chance: 0.5 },
      { use: 'blight', if: (E, c) => roused(E, c) && (engagedCount(E, c) === 0), chance: 0.7 },
      { use: 'multi', if: roused, opt: (E, c) => (engagedCount(E, c) ? (E.rng.chance(0.6) ? 0 : 1) : 2) },
    ],
    legs: [
      { act: 'dove', cost: 1, w: 3, if: (E, c) => roused(E, c) && engagedCount(E, c) > 0 },
      { act: 'tollDead', cost: 1, w: 2, if: roused },
      { act: 'sacredFlame', cost: 1, w: 1, if: roused },
      { act: 'commandDead', cost: 1, w: 2, if: roused },
      { act: 'breath', cost: 2, w: 3, if: roused },
      { act: 'blight', cost: 3, w: 1, if: roused },
      { act: 'harm', cost: 3, w: 1, if: roused },
    ],
    lair: o.lair,
    reactions: [{ ...sentinelAtDeathsDoor }],
    hooks: {
      onTurnStart(E, c) {
        if (E.flags.polygon && c.hp > 0 && c.hp < c.maxHp) E.heal(c, 20, c, 'the Polygon');
        if (c.memo.doomed && c.hp > 0) E.damage(c, [{ amt: 50, type: 'force' }], null, { rollText: 'severed from the child: 50' });
        if (E.flags.childLost && !c.memo.noSpells) { c.memo.noSpells = true; E.log('info', `${c.name} has lost the child and cannot cast spells.`, c); }
        if (o.passive && !c.memo.roused) {
          const sisters = E.alliesOf(c).filter((a) => E.hasTag(a, 'red') && E.active(a)).length;
          if (c.hp < c.maxHp || sisters <= (o.rouseAt ?? 1)) {
            c.memo.roused = E.round;
            E.log('act', `${c.name} turns from the bed. She will fight now, until she can leave.`, c);
          } else {
            E.addFx(c, { id: 'shielding', name: 'shielding the child (Dodge)', disAgainst: true, ends: { who: c.id, when: 'start', turns: 1 } }, c);
          }
        }
        // she leaves once she has fought for a few rounds, or is badly hurt
        if (o.leaves && c.memo.roused && !c.fled && (E.round - c.memo.roused >= o.leaves || c.hp <= c.maxHp * 0.5) && !E.incapacitated(c)) {
          E.log('end', `${c.name} ${o.leaveText}.`, c);
          c.fled = true;
          E.breakConc(c);
          breakAll(E, c);
          E.flags.escaped = c.name;
          E.checkEnd();
        }
      },
      skipTurn: (E, c) => (o.passive && !c.memo.roused ? 'keeps herself between the party and the child, and does not strike.' : null),
      opportunity: () => 'tollDead',
      // Nos Matre: brought to 0 she does not die; the labour takes her and she goes below.
      onZero(E, c) {
        if (!o.retreats) return null;
        E.log('end', `${c.name} ${o.leaveText}.`, c);
        c.fled = true;
        c.hp = 0;
        E.breakConc(c);
        breakAll(E, c);
        E.flags.escaped = c.name;
        return 'handled';
      },
    },
    basic: 'dove', oa: 'dove',
  });
};

urielR('urielBed', 'Uriel, Holy Empress', {
  battler: 'urielC', cr: 15, hp: 260, passive: true, rouseAt: 1, leaves: 3, leaveText: 'speaks a word of recall and is gone to Nos Matre',
});
urielR('urielReckoning', 'Uriel at Nos Matre (the Reckoning)', {
  battler: 'urielB', cr: 17, hp: 300, floats: true, bell: true, risenPerRound: 5, lair: ['madness'], retreats: true,
  leaveText: 'cries out, folds over the child, and sinks through the stone toward the Sept',
});
urielR('urielSept', 'Uriel in the Sept of Bones', {
  battler: 'urielD', cr: 18, ac: 20, hp: 300, dc: 20, hit: 11, risenPerRound: 4, lair: ['millions'],
});

// The Heir of Vol (Dave, 2026-10-11). While the cord joins it to Uriel it is part of her: it can be
// killed, and killing it costs her the child's power. If the cord is cut instead, she is cut off and
// doomed and the Heir is free. Free, it cannot be beaten: every wound makes it larger. The party's
// only win is to see that and run before Locke Pierce drops a Ruby Nova on it.
def('heir', {
  name: 'The Heir of Vol', cr: 12, type: 'undead', tags: ['heir', 'dragon'], boss: true, size: 'large', smart: true,
  ac: 18, hp: 180, speed: 40, abil: A(22, 14, 20, 14, 14, 20), saves: { dex: 7, con: 10, wis: 7, cha: 10 },
  resist: ['necrotic', 'fire'], immune: ['poison'], condImmune: ['charmed', 'frightened', 'poisoned', 'exhaustion'], lr: 1, img: 'daughters.webp',
  actions: {
    bite: melee('Bite', 11, [['2d10+6', 'piercing'], ['2d8', 'necrotic']]),
    claw: melee('Claw', 11, [['2d6+6', 'slashing']]),
    multi: multi(['bite', 'claw', 'claw']),
    breath: save('Black Fire', 'dex', 18, [['5d8', 'fire'], ['5d8', 'necrotic']], { half: true, recharge: 5, area: { type: 'near', max: 4, spread: 0.4 } }),
  },
  plan: ['breath', 'multi'],
  hooks: {
    onTurnStart(E, c) {
      // the cord is cut at the end of the round the scenario names
      if (E.flags.cutCord && E.round > E.flags.cutCord && !c.memo.free) {
        c.memo.free = E.round;
        c.name = 'The Heir of Vol, free';
        E.log('end', 'The cord is cut. Uriel is severed from the child and its power, and the Heir is free. Every wound it takes from here on feeds it.', c);
        for (const u of E.alliesOf(c).filter((x) => E.hasTag(x, 'uriel'))) {
          u.memo.noSpells = true;
          u.memo.doomed = true;
          E.log('cond', `${u.name} can no longer cast spells, and is dying.`, u);
        }
      }
      if (c.memo.free) {
        // it grows: larger, harder, hitting harder, every round
        const rounds = E.round - c.memo.free;
        c.fx = c.fx.filter((f) => f.id !== 'growth');
        c.fx.push({ id: 'growth', name: `growing (${rounds + 1})`, atk: rounds, ac: rounds, extraDmg: [[`${2 * (rounds + 1)}d8`, 'necrotic']], srcId: c.id });
        if (rounds >= (E.flags.fleeAfter || 3)) {
          E.log('end', 'The Heir fills the Sept and is still growing. The party runs for the surface. Behind them, a red light is falling out of the sky.');
          E.finish('withdrew');
        }
      }
    },
    onDamaged(E, c, ctx) {
      // free, it takes the wound and gives back more
      if (!c.memo.free || !ctx.total || c.hp <= 0) return;
      c.maxHp += ctx.total;
      c.hp = Math.min(c.maxHp, c.hp + ctx.total * 2);
      E.log('cond', `The Heir swells around the wound: ${c.hp}/${c.maxHp} hit points.`, c);
    },
    onZero(E, c) {
      if (!c.memo.free) return null;
      c.maxHp += 100;
      c.hp = c.maxHp;
      E.log('end', `The Heir cannot be put down. It rises larger: ${c.hp} hit points.`, c);
      return 'handled';
    },
    onDeath(E, c) {
      E.flags.childLost = true;
      E.log('end', 'The Heir dies still joined to its mother. Her power goes with it.');
    },
  },
  basic: 'bite', oa: 'bite',
});

// =====================================================================================
// The Emperor, unstaked: he feeds until he has regained 1,000 hit points, then he is an Ancient
// Red Dragon for a day. The simulator stops at the change and reports the round.
// =====================================================================================
def('emperorFeeding', {
  name: 'The Emperor, feeding', type: 'undead', tags: ['vampire', 'emperor'], boss: true, eyeless: true,
  ac: 21, hp: 1000, startHp: 60, abil: A(26, 10, 26, 20, 18, 24), saves: { con: 14, wis: 10 },
  resist: ['necrotic'], immune: ['fire'], condImmune: ['charmed', 'frightened', 'paralysed'], img: 'emperor.webp',
  actions: {
    bite: melee('Bite', 15, [['2d6+8', 'piercing'], ['6d6', 'necrotic']], {
      onHit: [{ fx: 'call', run: (E, src, tgt, ctx) => { src.memo.fed = (src.memo.fed || 0) + (ctx.dealt || 0); E.heal(src, ctx.dealt || 0, src, 'feeding'); } }],
    }),
    multi: multi(['bite', 'bite']),
  },
  hooks: {
    onTurnStart(E, c) {
      // he feeds on the Empress's own people first: one sister a round, drained where she stands
      const meal = E.alliesOf(c).find((a) => a.tpl.type !== 'undead' && E.active(a));
      if (meal) {
        const got = meal.hp;
        E.log('act', `${c.name} drains ${meal.name} dry (${got} hit points).`, c);
        E.kill(meal, c, 'drained');
        c.memo.fed = (c.memo.fed || 0) + got;
        E.heal(c, got, c, 'feeding');
      }
      if ((c.memo.fed || 0) >= 1000 || c.hp >= 1000) {
        E.log('end', `${c.name} has fed enough. The roof comes apart: an Ancient Red Dragon stands in the wreck of the palace.`, c);
        E.finish('dragon');
      }
    },
  },
  basic: 'bite', oa: 'bite',
});

// =====================================================================================
// Allies. DRAFTS: none of these has a block in the campaign files.
// =====================================================================================
def('zeroOneR', {
  name: 'Zero-One, hurt (draft)', cr: 5, type: 'humanoid', side: 'pc', pos: 'back',
  ac: 14, hp: 70, startHp: 40, abil: A(12, 10, 14, 12, 18, 14), saves: { wis: 7, cha: 5 }, img: 'zero-one.webp',
  actions: {
    flame: save('Sacred Flame', 'dex', 15, [['3d8', 'radiant']], {}),
    word: healing('Healing Word', '2d4+4', { cost: 'bonus', uses: 3, below: 0.35 }),
    bless: {
      kind: 'special', name: 'Bless', uses: 1, conc: true, selfManaged: true, noTarget: true,
      when: (E, c) => E.round === 1,
      run(E, c) {
        E.log('act', `${c.name} casts Bless on the party.`, c);
        E.concentrate(c, 'Bless');
        for (const a of E.alliesOf(c).filter((x) => x.tpl.pc)) E.addFx(a, { id: 'bless', name: 'Bless', atkDice: '1d4', saveDice: '1d4', conc: c.id }, c);
      },
    },
  },
  plan: ['bless', 'flame'],
  bonusPlan: ['word'],
  basic: 'flame',
});

def('defectors', {
  name: "Matheny's Defectors (crowd of six, draft)", cr: 3, type: 'humanoid', side: 'pc', pos: 'back', areaVuln: true,
  ac: 13, hp: 80, abil: A(10, 12, 12, 14, 14, 12), saves: { wis: 4 }, condImmune: ['grappled', 'restrained', 'prone'],
  outMult: (E, c) => (c.hp < 40 ? 0.5 : 1),
  actions: {
    volley: ranged('Volley of Bolts', 5, [['3d8', 'piercing']]),
    aid: healing('Field Dressing', '1d8+3', { cost: 'bonus', uses: 4, below: 0.4 }),
  },
  bonusPlan: ['aid'],
  basic: 'volley',
});

def('swashbuckler', {
  name: "Roberts' Swashbuckler (draft)", cr: 3, type: 'humanoid', side: 'pc', pos: 'front',
  ac: 17, hp: 66, abil: A(12, 18, 12, 14, 11, 15), saves: { dex: 6 },
  actions: {
    rapier: melee('Rapier', 6, [['1d8+4', 'piercing']]),
    dagger: melee('Dagger', 6, [['1d4+4', 'piercing']]),
    multi: multi(['rapier', 'rapier', 'dagger']),
  },
  basic: 'rapier', oa: 'rapier',
});


// =====================================================================================
// Added 2026-10-11 (evening), from Dave's notes after the module was rewritten. DRAFTS.
//  - E'noch in two forms: the wizard, then a Huge master vampire.
//  - Eden units as run at Zilspar (self-repair, Undead Fortitude, lightning burst), and Eden as
//    the elite of them.
//  - Aurorix (adult gold dragon, half strength) and Valtrex (restored) as companions.
//  - The Plaza Band: while it plays, the bell's madness stops and Uriel's control of undead breaks.
//    The risen dead keep coming.
// Simplified here: the lightning burst goes off at once (no delay to shove the wreck clear);
// lightning does not stop Self-Repair (the engine stops regeneration on radiant instead); Valtrex
// under the bell only loses turns, he does not turn on his friends; the counter-tone covers the
// whole field while the band stands, not a 60-foot zone.
// =====================================================================================
const lightningBurst = (dc, dice) => (E, c, ctx) => {
  const near = (ctx.wasEngaged || []).filter((t) => E.present(t));
  if (!near.length) return;
  E.log('act', `${c.name} locks up, arcs, and bursts.`, c);
  E.saveEffect(c, { name: 'Lightning Burst', save: 'dex', dc, dmg: [[dice, 'lightning']], half: true, isArea: true }, near);
};
const edenUnitZ = (id, side) => def(id, {
  name: 'Eden Unit (Zilspar)', battler: 'husk', cr: 7, type: 'undead', tags: ['eden', 'unsung'], side, pos: 'front',
  ac: 17, hp: 85, speed: 35, regen: 10, undeadFortitude: true, abil: A(18, 14, 16, 10, 12, 6), saves: { str: 7, con: 6 },
  immune: ['poison'], condImmune: ['charmed', 'exhaustion', 'poisoned'], resist: ['necrotic'], img: 'eden.webp',
  actions: {
    blade: melee('Blade Arm', 7, [['2d8+4', 'slashing']]),
    bolt: ranged('Bolt Thrower', 5, [['2d10+2', 'piercing']]),
    multi: multi(['blade', 'blade'], ['bolt', 'bolt']),
  },
  hooks: { onDeath: lightningBurst(14, '4d6') },
  basic: 'blade', oa: 'blade',
});
edenUnitZ('edenUnitZ', 'monster');
edenUnitZ('edenUnitZAlly', 'pc');

const edenZ = (id, side) => def(id, {
  name: 'Eden, EDN-00 (elite)', battler: 'eden', cr: 16, type: 'undead', tags: ['eden', 'unsung'], side, pos: 'front', boss: true, smart: true, focus: 'uriel',
  ac: 19, hp: 250, speed: 50, regen: 20, regenAlways: true, undeadFortitude: true,
  abil: A(22, 20, 26, 14, 16, 16), saves: { str: 11, dex: 10, con: 13, wis: 8 },
  immune: ['poison'], condImmune: ['charmed', 'exhaustion', 'frightened', 'poisoned'], resist: ['necrotic', 'fire', 'lightning'], lr: 2, leg: 3, img: 'eden.webp',
  actions: {
    blade: melee('Blade', 11, [['2d8+6', 'slashing'], ['2d6', 'lightning']], {
      vs: [{ when: (E, t) => E.hasTag(t, 'uriel'), dice: '2d8', type: 'slashing', label: 'One Target' }],
    }),
    multi: multi(['blade', 'blade', 'blade', 'blade']),
    order: order('Order', { n: 2, filter: (E, a) => a.tpl.id.startsWith('edenUnit'), cost: 'leg' }),
  },
  legs: [{ act: 'blade', cost: 1, w: 4 }, { act: 'order', cost: 2, w: 2 }],
  hooks: {
    attackMods: (E, c, ctx) => (E.hasTag(ctx.tgt, 'uriel') ? { adv: 'One Target' } : null),
    onDeath: lightningBurst(17, '10d6'),
  },
  basic: 'blade', oa: 'blade',
});
edenZ('edenZ', 'monster');
edenZ('edenZAlly', 'pc');

// E'noch, second form. He does not fall at 0: the elf comes off and the master vampire stands up.
def('enochMaster', {
  ...brood, name: "E'noch, the master vampire", cr: 14, smart: true, boss: true, pos: 'front', truesight: true, size: 'huge',
  ac: 17, hp: 220, speed: 40, regen: 10, abil: A(24, 16, 20, 24, 20, 20), saves: { str: 12, con: 10, wis: 10 },
  condImmune: ['charmed', 'frightened'], lr: 2, leg: 3, img: 'enoch.webp',
  actions: {
    bite: melee('Bite', 12, [['2d10+7', 'piercing'], ['4d6', 'necrotic']], {
      onHit: [{ fx: 'maxHp', amount: 'dealt', label: 'Bite' }, { fx: 'healSelf', amount: 'halfDealt', label: 'Bite' }],
    }),
    claw: melee('Wing Claw', 12, [['2d8+7', 'slashing']]),
    multi: multi(['bite', 'claw', 'claw']),
    // if he changes form in the middle of his own turn, the wizard's touch becomes a claw
    touch: melee('Wing Claw', 12, [['2d8+7', 'slashing']], { hidden: true }),
    shriek: save('Shriek', 'con', 17, [['6d8', 'thunder']], {
      half: true, recharge: 5, area: { type: 'near', max: 4, spread: 0.6 },
      onFail: [cond('noReactions', { name: 'Shriek', dur: nextTurnEnd })],
    }),
  },
  plan: ['shriek', 'multi'],
  legs: [{ act: 'claw', cost: 1, w: 3 }, { act: 'bite', cost: 2, w: 2 }],
  basic: 'claw', oa: 'claw',
});
def('enochR2', {
  ...M.enochR, id: 'enochR2', name: "E'noch Qualanthri, the wizard", cr: 13, hp: 160, fleeAt: 0, fleeText: undefined,
  hooks: {
    onZero(E, c) {
      if (c.memo.second) return null;
      c.memo.second = E.round;
      E.log('end', `${c.name} does not fall. The elf comes off him and the master vampire stands up, filling the end of the hall.`, c);
      E.breakConc(c);
      c.fx = [];
      c.tpl = M.enochMaster;
      c.name = M.enochMaster.name;
      c.maxHp = M.enochMaster.hp;
      c.hp = M.enochMaster.hp;
      c.ac = M.enochMaster.ac;
      return 'handled';
    },
  },
});

// Companions.
def('aurorix', {
  name: 'Aurorix, healed (a young gold dragon in strength, half hit points)', cr: 10, type: 'dragon', side: 'pc', pos: 'front', size: 'large', smart: true, flying: true,
  ac: 18, hp: 178, startHp: 89, speed: 40, abil: A(23, 14, 21, 16, 13, 20), saves: { dex: 6, con: 9, wis: 5, cha: 9 },
  immune: ['fire'], img: 'dragon.webp',
  actions: {
    bite: melee('Bite', 10, [['2d10+6', 'piercing']]),
    claw: melee('Claw', 10, [['2d6+6', 'slashing']]),
    multi: multi(['bite', 'claw', 'claw']),
    breath: save('Fire Breath', 'dex', 17, [['10d10', 'fire']], { half: true, recharge: 6, area: { type: 'near', max: 3, spread: 0.5 } }),
  },
  plan: ['breath', 'multi'],
  basic: 'bite', oa: 'bite',
});
def('valtrex', {
  name: 'Valtrex, restored (a young black dragon in strength)', cr: 7, type: 'dragon', side: 'pc', pos: 'front', size: 'large', smart: true,
  ac: 18, hp: 127, speed: 40, abil: A(19, 14, 17, 12, 11, 15), saves: { dex: 5, con: 6, wis: 3, cha: 5 },
  immune: ['acid'], img: 'dragon.webp',
  actions: {
    bite: melee('Bite', 7, [['2d10+4', 'piercing'], ['1d8', 'acid']]),
    claw: melee('Claw', 7, [['2d6+4', 'slashing']]),
    multi: multi(['bite', 'claw', 'claw']),
    breath: save('Scald-Breath', 'con', 14, [['11d8', 'acid']], { half: true, uses: 1, area: { type: 'near', max: 3, spread: 0.5 } }),
  },
  plan: ['breath', 'multi'],
  hooks: {
    // the bell takes his mind back unless the counter-tone is sounding
    skipTurn: (E) => (E.flags.bell && !E.flags.counterTone && E.rng.chance(0.5) ? 'hears the bell, lifts his head, and does nothing.' : null),
  },
  basic: 'bite', oa: 'bite',
});
def('plazaBand', {
  name: 'The Plaza Band (crowd of six)', cr: 0, type: 'humanoid', side: 'pc', pos: 'back', areaVuln: true,
  ac: 11, hp: 60, abil: A(10, 12, 10, 10, 12, 14), saves: {}, condImmune: ['grappled', 'restrained', 'prone'],
  actions: {
    play: { kind: 'special', name: 'The fanfare of dawn', noTarget: true, run(E, c) { if (E.flags.bell) E.log('act', `${c.name} plays the fanfare of dawn against the bell.`, c); } },
  },
  plan: ['play'],
  hooks: {
    onTurnStart(E, c) { E.flags.counterTone = c.hp > 0; },
    onDeath(E) { E.flags.counterTone = false; E.log('end', 'The music stops. The bell has the forecourt again.'); },
  },
  basic: 'play',
});
// Under the counter-tone the dead the bell raised fall where they stand.
M.guardMinion.hooks = {
  ...(M.guardMinion.hooks || {}),
  skipTurn(E, c) {
    // Dave, 10/11: the counter-tone does not fell the risen dead. Kept as an off-by-default switch.
    if (!E.flags.counterTone || !E.flags.bell || !E.flags.toneFellsDead) return null;
    E.kill(c, null, 'the fanfare of dawn');
    return 'walks into the music and falls.';
  },
};

api.register({
  creatures: R,
  library: [
    { group: 'The Lazaret, revised (proposal)', ids: ['urielBed', 'urielReckoning', 'urielSept', 'heir', 'emperorFeeding', 'dornR', 'maryR', 'marshallR', 'redSister', 'whiteSister', 'sorrowfulR', 'choirNovices', 'novice', 'redMinion', 'cursedSoldier', 'tallGuardR', 'whiteGuardR', 'guardMinion', 'muriel', 'drakiel', 'purell', 'enwe', 'fenwe', 'chanel', 'azriel', 'duracell', 'seraphiel', 'littleDaughter', 'enochR', 'enochR2', 'enochMaster', 'edenZ', 'edenUnitZ', 'opheliaR', 'trilloR', 'spawnMinion'] },
    { group: 'Allies (drafts)', ids: ['zeroOneR', 'defectors', 'swashbuckler', 'lusFayina', 'aurorix', 'valtrex', 'plazaBand', 'edenZAlly', 'edenUnitZAlly'], ally: true },
  ],
});
void ranged; void parry; void rollDice;
}
