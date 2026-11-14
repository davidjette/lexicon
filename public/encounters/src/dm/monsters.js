// DM ONLY. Stat blocks transcribed by hand from the campaign bestiary
// (the campaign bestiary, which supersedes the CRs in the modules).
// This file has no imports: it is handed its tools, so it can be shipped encrypted.

export default function (api) {
const {
  melee, ranged, save, multi, toll, cond, prone, saveOr, order, summon, raise, hold, banishment,
  emanation, hasAura, harm, healing, standAt, parry,
  isHonourDead, isSister, isVampire, rollDice, areaTargets, disengage, isEngaged,
} = api;
const M = api.M;
const def = (id, t) => {
  M[id] = { id, side: 'monster', pos: 'front', ...t };
  return M[id];
};

// Reaction: a critical hit on me or an ally becomes a normal hit.
const sentinelAtDeathsDoor = {
  id: 'sentinel',
  name: "Sentinel at Death's Door",
  trigger: 'attacked',
  who: 'allyOrSelf',
  uses: 3,
  when: (E, me, ctx) => ctx.crit,
  run(E, me, ctx) {
    ctx.noCrit = true;
    E.log('info', `${me.name} uses Sentinel at Death's Door: the critical hit becomes a normal hit.`, me);
  },
};


const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });
const nextTurnEnd = { who: 'tgt', when: 'end', turns: 1 };
const engagedCount = (E, c) => [...c.engaged].filter((id) => E.present(E.get(id))).length;
const undeadAllies = (E, c) => E.alliesOf(c).filter((a) => a.tpl.type === 'undead' && E.active(a));

// =====================================================================================
// The honour dead
// =====================================================================================
const honour = {
  type: 'undead',
  tags: ['honourDead'],
  eyeless: true,
  crossedBlades: true,
  immune: ['poison'],
  condImmune: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
};

// Hold the Line / Wall: an attack on a creature entering reach; a hit ends its movement.
const holdTheLine = (name, attackId) => ({
  id: 'holdLine',
  name,
  trigger: 'entersReach',
  who: 'enemy',
  when: (E, me, ctx) => ctx.into === me,
  run(E, me, ctx) {
    E.log('act', `${me.name} uses ${name} as ${ctx.mover.name} comes into reach.`, me);
    const r = E.attack(me, ctx.mover, E.action(me, attackId), {});
    if (r.hit && E.alive(ctx.mover)) {
      disengage(ctx.mover, me);
      ctx.mover.turn.stopped = true;
      E.log('move', `${ctx.mover.name}'s movement ends short of ${me.name}.`, me);
    }
  },
});

def('redGuard', {
  ...honour,
  name: 'Red Guard', cr: 7, ac: 18, hp: 114, abil: A(18, 12, 20, 6, 14, 5), saves: { con: 8, wis: 5 },
  resist: ['necrotic'], img: 'white-knight.webp',
  actions: {
    glaive: melee('Glaive', 8, [['1d10+4', 'slashing'], ['2d6', 'necrotic']]),
    multi: multi(['glaive', 'glaive']),
  },
  basic: 'glaive', oa: 'glaive', check: { perHit: 16, perRound: 32 },
});

def('whiteGuard', {
  ...M.redGuard, id: 'whiteGuard', name: 'White Guard',
  actions: {
    glaive: melee('Glaive', 8, [['1d10+4', 'slashing'], ['2d6', 'necrotic']], {
      onHit: [saveOr('con', 15, [cond('quiet', { name: 'The Quiet', dur: nextTurnEnd })], { oncePerTurn: 'quiet' })],
    }),
    multi: multi(['glaive', 'glaive']),
  },
});

def('tallGuard', {
  ...honour,
  name: 'Tall Guard', cr: 10, ac: 18, hp: 168, abil: A(22, 10, 20, 6, 12, 5), saves: { str: 10, con: 9 },
  resist: ['necrotic'], undeadFortitude: true, img: 'white-knight.webp',
  actions: {
    halberd: melee('Halberd', 10, [['2d10+6', 'slashing'], ['3d6', 'necrotic']]),
    shove: save('Shove', 'str', 18, null, { melee: true, onFail: [prone] }),
    multi: multi(['halberd', 'halberd'], ['halberd', 'shove']),
  },
  plan: [{ use: 'multi', opt: (E) => (E.rng.chance(0.3) ? 1 : 0) }],
  reactions: [holdTheLine('Hold the Line', 'halberd')],
  basic: 'halberd', oa: 'halberd', check: { perHit: 27, perRound: 54 },
});

def('bigOne', {
  ...honour,
  name: 'Big One', cr: 14, ac: 19, hp: 250, speed: 40, abil: A(26, 8, 22, 6, 12, 5), saves: { str: 13, con: 11, wis: 6 },
  resist: ['cold', 'necrotic'], condImmune: [...honour.condImmune, 'paralysed', 'prone'], undeadFortitude: true,
  size: 'huge', img: 'white-knight.webp',
  actions: {
    greatpole: melee('Greatpole', 13, [['3d10+8', 'bludgeoning'], ['3d8', 'necrotic']]),
    multi: multi(['greatpole', 'greatpole']),
    sweep: save('Sweep', 'dex', 20, [['10d10', 'bludgeoning']], { half: true, recharge: 5, onFail: [prone], area: { type: 'near', max: 4, spread: 0.15 } }),
  },
  plan: ['sweep', 'multi'],
  reactions: [holdTheLine('Wall', 'greatpole')],
  basic: 'greatpole', oa: 'greatpole', check: { perHit: 38, perRound: 76 },
});

def('zombie', {
  name: 'Zombie', cr: 0.25, type: 'undead', tags: ['risen'], ac: 8, hp: 15, abil: A(13, 6, 16, 3, 6, 5), saves: { wis: 0 },
  immune: ['poison'], condImmune: ['poisoned'], undeadFortitude: true, noCorpse: true,
  actions: { slam: melee('Slam', 3, [['1d8+1', 'bludgeoning']]) },
  basic: 'slam', oa: 'slam',
});

// =====================================================================================
// The Black Doves
// =====================================================================================
const directTheDead = (n) => order('Direct the Dead', { n, filter: isHonourDead, cost: 'bonus' });

// Absolution: an undead ally that would drop to 0 drops to 1 instead.
const absolution = (o = {}) => standAt('absolution', 'Absolution', 1, (E, t) => t.tpl.type === 'undead', o);

def('blackDove', {
  name: 'Black Dove Sister', battler: 'dove', cr: 3, type: 'humanoid', tags: ['sister', 'singer'], pos: 'back',
  ac: 14, hp: 58, abil: A(10, 12, 14, 10, 16, 12), saves: { wis: 5 }, resist: ['necrotic'], img: 'black-dove.webp',
  actions: {
    knife: melee('Mercy Knife', 3, [['1d4+1', 'piercing'], ['2d6', 'necrotic']]),
    toll: toll(13, '2d12'),
    multi: multi(['knife', 'knife'], ['toll', 'toll']),
    direct: directTheDead(1),
  },
  plan: [{ use: 'multi', opt: (E, c) => (engagedCount(E, c) && E.rng.chance(0.5) ? 0 : 1) }],
  bonusPlan: ['direct'],
  basic: 'toll', oa: 'knife',
});

def('sisterStanding', {
  name: 'Sister of Standing', battler: 'dove', cr: 7, type: 'humanoid', tags: ['sister', 'singer'], pos: 'back', smart: true, rank: 2,
  ac: 17, hp: 120, abil: A(14, 10, 16, 12, 18, 14), saves: { con: 6, wis: 7 }, resist: ['necrotic'], condImmune: ['frightened'],
  img: 'black-dove.webp',
  actions: {
    flail: melee('Flail', 5, [['1d8+2', 'bludgeoning'], ['3d6', 'necrotic']]),
    toll: toll(15, '3d12'),
    multi: multi(['flail', 'flail'], ['flail', 'toll']),
    holdPerson: hold('Hold Person', 15, { uses: 2 }),
    guardians: emanation('Spirit Guardians', { dc: 15, dmg: [['3d8', 'necrotic']], uses: 1 }),
    direct: directTheDead(2),
  },
  plan: [
    { use: 'holdPerson', if: (E, c) => !c.conc, chance: 0.6 },
    { use: 'guardians', if: (E, c) => !c.conc && engagedCount(E, c) >= 1 },
    { use: 'multi', if: (E, c) => engagedCount(E, c) > 0, opt: 1 },
    'toll',
  ],
  bonusPlan: ['direct'],
  reactions: [absolution()],
  basic: 'toll', oa: 'flail',
});

def('prioress', {
  ...M.sisterStanding, id: 'prioress', name: 'Prioress', cr: 9, rank: 3,
  ac: 18, hp: 150, abil: A(14, 10, 16, 12, 20, 14), saves: { con: 7, wis: 9 },
  actions: {
    ...M.sisterStanding.actions,
    toll: toll(17, '4d12'),
    holdPerson: hold('Hold Person', 17, { uses: 2 }),
    guardians: emanation('Spirit Guardians', { dc: 17, dmg: [['3d8', 'necrotic']], uses: 1 }),
    harm: harm(17, { uses: 1 }),
    holdMonster: hold('Hold Monster', 17, { uses: 1 }),
  },
  plan: [
    { use: 'holdMonster', if: (E, c) => !c.conc },
    { use: 'harm', chance: 0.7 },
    ...M.sisterStanding.plan,
  ],
  reactions: [absolution({ free: true })],
});

def('greenSister', {
  name: 'Green Sister', battler: 'dove', cr: 4, type: 'humanoid', tags: ['sister'], pos: 'back',
  ac: 13, hp: 66, abil: A(10, 14, 12, 14, 17, 13), img: 'black-dove.webp',
  actions: {
    scalpel: melee('Scalpel', 4, [['1d4+2', 'slashing']], {
      vs: [{ when: (E, t) => ['prone', 'restrained', 'unconscious'].some((k) => E.has(t, k)), dice: '2d6', type: 'slashing', label: 'helpless' }],
    }),
    draught: save('Sleeping Draught', 'con', 14, null, {
      onFail: [
        cond('poisoned', { name: 'Sleeping Draught', saveEnds: { ability: 'con', dc: 14 } }),
        { fx: 'call', run: (E, src, tgt, ctx) => { if (ctx.failBy >= 5) E.addFx(tgt, { cond: 'unconscious', name: 'asleep', endsOnDamage: true, saveEnds: { ability: 'con', dc: 14 } }, src); } },
      ],
    }),
    triage: healing('Triage', '2d8+4', { cost: 'bonus', living: true, below: 0.7 }),
    massCure: {
      kind: 'special', name: 'Mass Cure Wounds', uses: 1, spell: true, noTarget: true,
      when: (E, c) => E.alliesOf(c, true).filter((a) => a.tpl.type !== 'undead' && a.hp < a.maxHp * 0.6).length >= 2,
      run(E, c) {
        const r = rollDice(E.rng, '5d8+3');
        E.log('act', `${c.name} casts Mass Cure Wounds: ${r.text} = ${r.total}.`, c);
        for (const a of E.alliesOf(c, true).filter((x) => x.tpl.type !== 'undead' && x.hp < x.maxHp).slice(0, 6)) E.heal(a, r.total, c, 'Mass Cure Wounds');
      },
    },
  },
  plan: ['massCure', { use: 'draught', chance: 0.7 }, 'scalpel'],
  bonusPlan: ['triage'],
  basic: 'draught', oa: 'scalpel',
});

// Wings of the Light: a minute of flight and an extra 1d8 radiant on Light of Aerenal.
const wings = {
  kind: 'buff', name: 'Wings of the Light', cost: 'bonus', uses: 1, self: true,
  effect: { id: 'wings', extraDmg: [['1d8', 'radiant']] },
};

// Womb of Ash: on death, every enemy close by saves or is frightened of the order.
const wombOfAsh = (E, c, ctx) => {
  const near = (ctx.wasEngaged || []).filter((t) => E.present(t) && t.side !== c.side);
  if (!near.length) return;
  E.log('act', `${c.name} falls and the Womb of Ash cries out (DC 16 WIS).`, c);
  for (const t of near) {
    const r = E.save(t, 'wis', 16, { serious: true });
    if (!r.success) E.addFx(t, { cond: 'frightened', name: 'Womb of Ash', ends: { who: t.id, when: 'end', turns: 10 } }, null);
  }
};

def('sisterLight', {
  name: 'Sister of the Light', battler: 'doveWhite', cr: 10, type: 'humanoid', tags: ['sister', 'white'], pos: 'back', smart: true, rank: 3,
  ac: 17, hp: 156, abil: A(10, 16, 14, 14, 20, 18), saves: { dex: 7, wis: 9, cha: 8 },
  resist: ['necrotic', 'psychic', 'radiant'], condImmune: ['charmed', 'frightened'], img: 'black-dove-white.webp',
  actions: {
    light: ranged('Light of Aerenal', 9, [['4d8+5', 'radiant']]),
    cradle: save('Cradle of Pain', 'con', 17, [['8d8', 'necrotic']], {
      half: true, recharge: 5, conc: true,
      onFail: [
        { fx: 'cond', cond: 'speed0', name: 'Cradle of Pain', saveEnds: { ability: 'con', dc: 17 }, conc: true },
        { fx: 'cond', cond: 'noReactions', name: 'Cradle of Pain', saveEnds: { ability: 'con', dc: 17 }, conc: true },
      ],
    }),
    multi: multi(['light', 'light'], ['light', 'cradle']),
    guardians: emanation('Spirit Guardians', { dc: 17, dmg: [['4d8', 'radiant']], uses: 1 }),
    command: order('Command', { n: 1, filter: isSister, cost: 'bonus', text: 'acts on the white sister\'s command' }),
    wings,
  },
  plan: [
    { use: 'guardians', if: (E, c) => !c.conc && engagedCount(E, c) >= 2 },
    { use: 'multi', opt: (E, c) => (c.ready.cradle !== false && !c.conc ? 1 : 0) },
  ],
  bonusPlan: ['wings', 'command'],
  reactions: [sentinelAtDeathsDoor],
  hooks: { onDeath: wombOfAsh },
  basic: 'light',
});

const lancet = (toHit) =>
  melee('Lancet', toHit, [['1d4+3', 'piercing'], ['4d6', 'necrotic']], { onHit: [{ fx: 'healSelf', amount: 'dealtNecrotic', label: 'the lancet' }] });

const bloodActions = (dc) => ({
  lancet: lancet(7),
  bloodletting: save('Bloodletting', 'con', dc, [['6d8', 'necrotic']], {
    half: true, notUndead: true,
    onFail: [cond('noHeal', { name: 'Bloodletting', dur: { who: 'src', when: 'start', turns: 1 } })],
  }),
  torpor: save('Torpor', 'con', dc, null, {
    recharge: 5,
    onFail: [cond('paralysed', { name: 'Torpor', saveEnds: { ability: 'con', dc } })],
    disFor: (E, t) => t.tpl.type === 'undead' || t.tpl.type === 'dragon',
  }),
  multi: multi(['lancet', 'lancet'], ['lancet', 'bloodletting']),
  transfusion: healing('Transfusion', '4d8', { cost: 'bonus', below: 0.6 }),
});

def('sisterBlood', {
  name: 'Sister of the Blood', battler: 'doveRed', cr: 11, type: 'humanoid', tags: ['sister', 'red'], smart: true, rank: 3,
  ac: 16, hp: 170, abil: A(12, 16, 18, 18, 16, 14), saves: { con: 8, int: 8, wis: 7 },
  resist: ['necrotic'], immune: ['poison'], condImmune: ['poisoned'], img: 'sister-of-the-blood.webp',
  actions: bloodActions(17),
  plan: ['torpor', { use: 'multi', opt: (E) => (E.rng.chance(0.5) ? 1 : 0) }],
  bonusPlan: ['transfusion'],
  basic: 'lancet', oa: 'lancet',
});

def('surgeonMarshall', {
  ...M.sisterBlood, id: 'surgeonMarshall', name: 'Surgeon Marshall', cr: 13, rank: 4, ac: 17, hp: 210, lr: 1,
  actions: {
    ...bloodActions(18),
    holdHim: save('Hold Him', 'con', 18, null, {
      uses: 1, area: { type: 'all', max: 4 },
      onFail: [cond('paralysed', { name: 'Hold Him', dur: nextTurnEnd })],
    }),
  },
  plan: ['holdHim', 'torpor', { use: 'multi', opt: (E) => (E.rng.chance(0.5) ? 1 : 0) }],
  reactions: [standAt('triage', 'Triage', 30, (E, t) => t.tpl.id === 'sisterBlood', { uses: 3 })],
});

// ---- more sisters (added 2026-10-06) ----
def('sisterBone', {
  name: 'Sister of the Bone', battler: 'dove', cr: 5, type: 'humanoid', tags: ['sister', 'singer'],
  ac: 15, hp: 84, abil: A(12, 12, 14, 12, 17, 12), saves: { wis: 6 }, resist: ['necrotic'], img: 'black-dove.webp',
  actions: {
    saw: melee('Bone Saw', 4, [['1d6+1', 'slashing'], ['3d6', 'necrotic']]),
    welcome: raise('Welcome', () => M.whiteGuard, 1, { recharge: 5, halfHp: true }),
    multi: multi(['saw', 'saw'], ['saw', 'welcome']),
  },
  plan: [{ use: 'multi', opt: (E, c) => (E.corpses > 0 && c.ready.welcome !== false ? 1 : 0) }],
  reactions: [{
    id: 'lastRites', name: 'Last Rites', trigger: 'dropped', who: 'enemy',
    when: (E, me, ctx) => ctx.tgt.tpl.type !== 'undead',
    run(E, me, ctx) {
      E.log('info', `${me.name} speaks the Last Rites over ${ctx.tgt.name}.`, me);
      E.deathFail(ctx.tgt, 1, false);
    },
  }],
  basic: 'saw', oa: 'saw',
});

// The Lament: one save a turn for each enemy that starts its turn in earshot; two singers raise the DC.
const lament = {
  id: 'lament', name: 'The Lament', trigger: 'turnStart', who: 'enemy', free: true,
  when: (E, me, ctx) => !ctx.subject.turn.lamented && !ctx.subject.down,
  run(E, me, ctx) {
    const t = ctx.subject;
    t.turn.lamented = true;
    const singers = E.alliesOf(me, true).filter((a) => (a.tpl.id === 'sorrowful' || a.tpl.id === 'sorrowfulR') && E.active(a)).length;
    const r = E.save(t, 'wis', singers >= 2 ? 17 : 15, { serious: false, lr: false });
    if (!r.success) {
      t.turn.disFirst = 'The Lament';
      E.log('cond', `${t.name} has disadvantage on the first attack this turn (The Lament).`, t);
    }
  },
};

def('sorrowful', {
  name: 'Sorrowful Sister', cr: 6, type: 'humanoid', tags: ['sister'], pos: 'back',
  ac: 14, hp: 97, abil: A(10, 14, 14, 12, 18, 16), saves: { wis: 7, cha: 6 }, resist: ['necrotic', 'psychic'], img: 'black-dove.webp',
  actions: { toll: toll(15, '3d12') },
  reactions: [
    lament,
    {
      id: 'veil', name: 'Mourning Veil', trigger: 'hitBy',
      run(E, me, ctx) {
        E.log('info', `${me.name}'s Mourning Veil turns on ${ctx.att.name} (DC 15 WIS).`, me);
        const r = E.save(ctx.att, 'wis', 15, { serious: true });
        if (!r.success) E.addFx(ctx.att, { cond: 'frightened', name: 'Mourning Veil', ends: { who: ctx.att.id, when: 'end', turns: ctx.att === E.current ? 2 : 1 } }, me);
      },
    },
  ],
  basic: 'toll',
});

def('battleSister', {
  name: 'Battle Sister', battler: 'doveKnight', cr: 8, type: 'humanoid', tags: ['sister', 'singer'], rank: 1,
  ac: 19, hp: 136, abil: A(18, 10, 18, 10, 16, 12), saves: { str: 7, con: 7, wis: 6 }, resist: ['necrotic'], condImmune: ['frightened'],
  img: 'battle-sister.webp',
  actions: {
    mace: melee('Flanged Mace', 7, [['1d8+4', 'bludgeoning'], ['2d6', 'necrotic']]),
    multi: multi(['mace', 'mace', 'mace']),
    direct: directTheDead(1),
  },
  bonusPlan: ['direct'],
  reactions: [{
    id: 'shieldMother', name: 'Shield the Mother', trigger: 'targeted', who: 'ally',
    when: (E, me, ctx) => (ctx.tgt.tpl.rank || 0) > 1 && E.hasTag(ctx.tgt, 'sister') && ctx.melee && (isEngaged(me, ctx.att) || me.near === ctx.tgt.id),
    run(E, me, ctx) {
      ctx.newTarget = me;
      E.log('info', `${me.name} steps in front of ${ctx.tgt.name} (Shield the Mother).`, me);
    },
  }],
  basic: 'mace', oa: 'mace', check: { perHit: 15, perRound: 45 },
});

def('maryChristmas', {
  name: 'Sister Mary Christmas', cr: 11, type: 'humanoid', tags: ['sister', 'singer'], smart: true, rank: 2,
  ac: 18, hp: 178, speed: 40, abil: A(20, 16, 18, 12, 18, 14), saves: { str: 9, con: 8, wis: 8 },
  resist: ['necrotic'], condImmune: ['frightened'], img: 'tall-sister.webp',
  actions: {
    scythe: melee('Scythe', 9, [['1d10+5', 'slashing'], ['2d6', 'necrotic']]),
    multi: multi(['scythe', 'scythe', 'scythe', 'scythe']),
    reap: save('Reap', 'dex', 17, [['6d10', 'slashing']], { half: true, recharge: 5, onFail: [prone], area: { type: 'engaged' } }),
    callRank: summon('Call the Rank', () => [[M.whiteGuard, 6]], { uses: 1 }),
  },
  plan: [{ use: 'callRank', if: (E, c) => c.hp < c.maxHp * 0.75 || E.round >= 2 }, { use: 'reap', min: 2 }, 'multi', 'reap'],
  basic: 'scythe', oa: 'scythe', check: { perHit: 17, perRound: 68 },
});

// ---- the named sisters ----
// Dispel Magic on a concentrating enemy: automatic against 3rd level and below, a check above that.
const dispel = (bonus, uses) => ({
  kind: 'special', name: 'Dispel Magic', spell: true, uses,
  aiTarget: (E, c) => E.enemiesOf(c).find((t) => t.conc && !t.down) || null,
  run(E, c, act, choice) {
    const t = E.get(choice.targets[0]);
    if (!t || !t.conc) return;
    const lvl = t.memo.concLevel || 3;
    E.log('act', `${c.name} casts Dispel Magic at ${t.name}'s ${t.conc.name} (cast at level ${lvl}).`, c);
    if (lvl <= 3 || E.check(c, bonus, 10 + lvl, 'dispel check')) E.breakConc(t);
  },
});

def('maelisDorn', {
  name: 'Sister-Inquisitor Maelis Dorn', battler: 'doveElder', cr: 14, type: 'humanoid', tags: ['sister', 'singer'], pos: 'back', smart: true, boss: true, rank: 5,
  ac: 18, hp: 190, abil: A(14, 12, 20, 18, 22, 16), saves: { con: 10, int: 9, wis: 11 },
  resist: ['necrotic'], condImmune: ['charmed', 'frightened'], lr: 2, leg: 3, img: 'maelis-dorn.webp',
  actions: {
    staff: melee('Staff', 7, [['1d8+2', 'bludgeoning'], ['4d6', 'necrotic']]),
    toll: toll(19, '5d12'),
    multi: multi(['staff', 'staff', 'toll']),
    holdMonster: hold('Hold Monster', 19, { uses: 2 }),
    banishment: banishment(19, { uses: 2 }),
    dispel: dispel(6, 2),
    harm: harm(19, { uses: 1 }),
    order: order('Order', { n: 1, filter: (E, a) => isSister(E, a) || isHonourDead(E, a), cost: 'leg' }),
    ring: {
      kind: 'special', name: 'Ring the house bell', noTarget: true, uses: 1,
      when: (E) => !!E.flags.houseBell,
      run(E, c) {
        E.log('act', `${c.name} rings the house bell. The nearest post of tall guards is coming.`, c);
        E.waves.push({ round: E.round, spawn: [[M.tallGuard, 4]], label: 'The tall guard post answers the bell' });
        E.waves.push({ round: E.round + 1, spawn: [[M.sisterLight, 2], [M.sisterStanding, 1], [M.blackDove, 4]], label: 'The sisters of the Westhouse arrive' });
      },
    },
  },
  plan: [
    { use: 'ring', cost: 'action' },
    { use: 'dispel', chance: 0.8 },
    { use: 'banishment', if: (E, c) => !c.conc, chance: 0.5 },
    { use: 'holdMonster', if: (E, c) => !c.conc, chance: 0.7 },
    { use: 'harm', chance: 0.6 },
    { use: 'multi', if: (E, c) => engagedCount(E, c) > 0 },
    'toll',
  ],
  legs: [{ act: 'order', cost: 1, w: 3 }, { act: 'ring', cost: 3, w: 6 }],
  reactions: [absolution({ free: true })],
  basic: 'toll', oa: 'staff',
});

def('tallSister', {
  name: 'The Tall Sister', battler: 'doveWhite', cr: 15, type: 'humanoid', tags: ['sister', 'white'], smart: true, boss: true, rank: 5,
  ac: 17, hp: 204, abil: A(18, 12, 18, 16, 20, 18), saves: { con: 9, wis: 10, cha: 9 },
  resist: ['necrotic'], condImmune: ['charmed', 'frightened'], lr: 3, leg: 3, img: 'tall-sister.webp',
  actions: {
    graveHand: melee('Grave Hand', 9, [['2d6+4', 'bludgeoning'], ['4d8', 'necrotic']]),
    toll: toll(18, '5d12'),
    multi: multi(['graveHand', 'graveHand', 'toll']),
    raise: raise('Raise the Ranks', () => M.whiteGuard, 4, { recharge: 5 }),
    direct: order('Direct', { n: 1, filter: isHonourDead, cost: 'leg' }),
    knit: {
      kind: 'special', name: 'Knit', noTarget: true,
      when: (E, c) => E.alliesOf(c).filter((a) => a.tpl.id === 'whiteGuard' && E.active(a)).length >= 2,
      run(E, c) {
        const two = E.alliesOf(c).filter((a) => a.tpl.id === 'whiteGuard' && E.active(a)).sort((a, b) => a.hp - b.hp).slice(0, 2);
        const targets = [...two[0].engaged, ...two[1].engaged];
        for (const g of two) { g.tpl = { ...g.tpl, noCorpse: true }; E.kill(g, null, 'knit into a tall guard'); }
        const t = E.spawn(M.tallGuard, { side: c.side, name: E.nameFor(M.tallGuard, c.side), after: c });
        for (const id of targets) { const o = E.get(id); if (o && E.present(o)) { t.engaged.add(o.id); o.engaged.add(t.id); } }
        E.log('act', `${c.name}: Knit. Two white guards fold into ${t.name} at full hit points.`, c);
      },
    },
    wings,
  },
  plan: ['raise', { use: 'multi', if: (E, c) => engagedCount(E, c) > 0 || E.rng.chance(0.6) }, 'toll'],
  bonusPlan: ['wings'],
  legs: [{ act: 'direct', cost: 1, w: 3 }, { act: 'toll', cost: 1, w: 3 }, { act: 'knit', cost: 3, w: 4 }],
  basic: 'toll', oa: 'graveHand',
});

// =====================================================================================
// Daughters and wights
// =====================================================================================
const wail = (E, c, ctx) => {
  const near = (ctx.wasEngaged || []).filter((t) => E.present(t) && t.tpl.type !== 'undead');
  if (!near.length) return;
  E.saveEffect(c, { name: 'Wail of Rejection', save: 'wis', dc: 15, dmg: [['6d6', 'psychic']], half: true }, near);
};

const daughter = (id, name, breathType, o = {}) => {
  const dc = o.dc || 15;
  return def(id, {
    name, cr: o.cr || 7, type: 'dragon', tags: ['daughter'], packTactics: 'daughter',
    ac: 16, hp: o.hp || 110, abil: A(14, 16, o.con || 14, 16, 12, 16), saves: { dex: 6, con: 5, cha: 6 },
    resist: ['necrotic'], immune: [breathType], img: 'daughters.webp',
    actions: {
      bite: melee('Bite', 6, [['2d6+3', 'piercing'], ['2d6', breathType]]),
      claw: melee('Claw', 6, [['1d10+3', 'slashing']]),
      multi: multi(['bite', 'claw']),
      breath: save(`${breathType[0].toUpperCase()}${breathType.slice(1)} Breath`, breathType === 'cold' ? 'con' : 'dex', dc, [[o.breath || '10d6', breathType]], {
        half: true, recharge: 5, area: { type: 'near', max: 3, spread: 0.3 },
      }),
      ...(o.actions || {}),
    },
    plan: [...(o.plan || []), 'breath', 'multi'],
    bonusPlan: o.bonusPlan,
    hooks: { onDeath: wail },
    basic: 'bite', oa: 'bite',
  });
};
daughter('daughterFire', 'Daughter of Vol (fire)', 'fire');
daughter('daughterCold', 'Daughter of Vol (cold)', 'cold');
daughter('daughterAcid', 'Daughter of Vol (acid)', 'acid');
daughter('daughterLightning', 'Daughter of Vol (lightning)', 'lightning');
daughter('eldest', 'Muriel, the Eldest', 'lightning', {
  cr: 10, hp: 150, con: 18, dc: 17, breath: '12d6',
  actions: {
    speak: order('Speak for Us', { n: 1, filter: (E, a) => E.hasTag(a, 'daughter'), cost: 'bonus', text: 'bites on her sister\'s word' }),
    mothersToll: save("Mother's Daughter: Toll the Dead", 'wis', 15, [['4d12', 'necrotic']], { uses: 1, spell: true }),
  },
  plan: [{ use: 'mothersToll', chance: 0.5 }],
  bonusPlan: ['speak'],
});

const drainLife = (dc) => saveOr('con', dc, [{ fx: 'maxHp', amount: 'dealtNecrotic', label: 'Drain Life' }], { oncePerTurn: 'drain' });

def('revenantWight', {
  name: 'Revenant Wight', cr: 10, type: 'undead', tags: ['wight'],
  ac: 17, hp: 170, abil: A(18, 14, 18, 12, 14, 18), saves: { con: 8, wis: 6, cha: 8 },
  resist: ['necrotic'], condImmune: ['charmed', 'exhaustion', 'frightened', 'poisoned'], img: 'black-dove.webp',
  actions: {
    graveblade: melee('Graveblade', 8, [['2d8+4', 'slashing'], ['3d8', 'necrotic']], { onHit: [drainLife(16)] }),
    multi: multi(['graveblade', 'graveblade']),
  },
  basic: 'graveblade', oa: 'graveblade', check: { perHit: 26, perRound: 52 },
});

def('doveWight', {
  name: 'Black Dove Wight', cr: 9, type: 'undead', tags: ['wight', 'singer', 'sister'],
  ac: 16, hp: 136, abil: A(16, 14, 18, 10, 16, 14), saves: { con: 8, wis: 7 },
  resist: ['necrotic'], condImmune: ['charmed', 'exhaustion', 'frightened', 'poisoned'], img: 'black-dove.webp',
  actions: {
    sickle: melee('Dove Sickle', 7, [['2d6+3', 'slashing'], ['3d8', 'necrotic']], { onHit: [drainLife(16)] }),
    toll: toll(15, '3d12'),
    multi: multi(['sickle', 'sickle'], ['sickle', 'toll']),
    direct: directTheDead(1),
  },
  bonusPlan: ['direct'],
  basic: 'sickle', oa: 'sickle', check: { perHit: 23, perRound: 46 },
});

// =====================================================================================
// Esther Crona
// =====================================================================================
const estherActions = {
  blade: melee('Bound Blade', 11, [['2d8+5', 'slashing'], ['3d8', 'necrotic']]),
  hurl: save('Hurl', 'str', 19, [['6d10', 'bludgeoning']], { onFail: [{ fx: 'push', label: 'hurled' }, prone] }),
  mark: save("Inquisitor's Mark", 'wis', 19, null, {
    onFail: [{ fx: 'effect', effect: { id: 'inquisitorsMark', name: "Inquisitor's Mark", announce: true }, dur: nextTurnEnd, say: 'marked: disadvantage on attacks against anyone but Esther.' }],
  }),
  multi: multi(['blade', 'blade', 'hurl'], ['blade', 'blade', 'mark']),
};

def('estherHalf', {
  name: 'Esther Crona, Half-Raised', battler: 'risen', cr: 11, type: 'humanoid', tags: ['esther'], smart: true, boss: true,
  ac: 18, hp: 120, abil: A(20, 16, 24, 16, 14, 22), saves: { dex: 8, con: 12, wis: 7, cha: 11 },
  resist: ['fire', 'necrotic'], condImmune: ['charmed', 'frightened'], img: 'esther-risen.webp',
  actions: { ...estherActions, order: order('Order', { n: 1, filter: isHonourDead, cost: 'bonus' }) },
  basic: 'blade', oa: 'blade',
});

def('estherRaised', {
  ...M.estherHalf, id: 'estherRaised', name: 'Esther Crona, Raised', cr: 16, hp: 230, lr: 3, leg: 3,
  actions: {
    ...estherActions,
    breath: save("Dragon's Breath", 'dex', 20, [['14d6', 'fire']], { half: true, recharge: 5, area: { type: 'near', max: 4, spread: 0.5 } }),
    void: {
      kind: 'special', name: 'Your Pact Is Void', uses: 1, noTarget: true,
      run(E, c) {
        E.log('act', `${c.name}: "Your pact is void."`, c);
        for (const t of E.enemiesOf(c)) {
          if (t.conc) E.breakConc(t);
          if (t.summonedBy) { E.log('info', `${t.name} is dismissed.`, t); t.tpl = { ...t.tpl, noCorpse: true }; E.kill(t, c, 'dismissed'); continue; }
          if (t.tpl.warlock) {
            const r = E.save(t, 'cha', 19, { serious: true });
            if (!r.success) E.addFx(t, { cond: 'pactVoid', name: 'Your Pact Is Void', ends: { who: c.id, when: 'end', turns: 2 } }, c);
          }
        }
      },
    },
    order: order('Order', { n: 1, filter: isHonourDead, cost: 'leg' }),
    buffet: save('Wing Buffet', 'dex', 19, [['2d6+5', 'bludgeoning']], { onFail: [prone], area: { type: 'engaged' } }),
  },
  plan: [
    { use: 'void', if: (E, c) => E.enemiesOf(c).some((t) => t.conc || t.tpl.warlock) },
    'breath',
    'multi',
  ],
  legs: [{ act: 'blade', cost: 1, w: 4 }, { act: 'order', cost: 1, w: 2 }, { act: 'hurl', cost: 2, w: 2 }, { act: 'buffet', cost: 2, w: 2, if: (E, c) => engagedCount(E, c) >= 2 }],
  check: { perRound: 60 },
});

// =====================================================================================
// The brood
// =====================================================================================
const vampire = { type: 'undead', tags: ['vampire'], resist: ['necrotic'] };
const grappledByMe = (E, c) => E.enemiesOf(c).find((t) => t.fx.some((f) => f.cond === 'grappled' && f.srcId === c.id));
const biteOnly = (c) => (E, t) => t.fx.some((f) => (f.cond === 'grappled' && f.srcId === c) || f.cond === 'charmed' || f.cond === 'restrained');

const spawnActions = (toHit, necro, drain) => ({
  claw: melee('Claw', toHit, [['2d4+3', 'slashing']], { onHit: [{ fx: 'grapple', dc: 13 }] }),
  bite: melee('Bite', toHit, [['1d6+3', 'piercing'], [necro, 'necrotic']], {
    onHit: [...(drain ? [{ fx: 'maxHp', amount: 'dealtNecrotic', label: 'the bite' }] : []), { fx: 'healSelf', amount: 'dealtNecrotic', label: 'feeding' }],
    aiTarget: (E, c) => grappledByMe(E, c) || null,
  }),
  multi: multi(['claw', 'claw'], ['claw', 'bite']),
});
const spawnPlan = [{ use: 'multi', opt: (E, c) => (grappledByMe(E, c) ? 1 : 0), target: (E, c) => grappledByMe(E, c) || E.ai.pickTarget(E, c, E.action(c, 'claw')) }];

def('lesserSpawn', {
  ...vampire, name: 'Vampire Lesser Spawn', cr: 3, ac: 13, hp: 52, regen: 5, abil: A(16, 14, 14, 6, 10, 6),
  actions: spawnActions(5, '2d6', false), plan: spawnPlan, basic: 'claw', oa: 'claw', img: 'vampire.webp',
});
def('vampireSpawn', {
  ...vampire, name: 'Vampire Spawn', cr: 5, ac: 15, hp: 82, regen: 10, abil: A(16, 16, 16, 11, 10, 12), saves: { dex: 6, wis: 3 },
  actions: spawnActions(6, '3d6', true), plan: spawnPlan, basic: 'claw', oa: 'claw', img: 'vampire.webp',
});

def('trillo', {
  ...vampire, name: 'Lord Lieutenant Trillo', cr: 15, smart: true, boss: true,
  ac: 20, hp: 230, speed: 40, regen: 20, abil: A(24, 18, 24, 14, 16, 18), saves: { str: 12, dex: 9, con: 12, wis: 8 }, lr: 2, leg: 3,
  img: 'vampire.webp',
  actions: {
    sword: melee('Sword', 12, [['2d8+7', 'slashing'], ['3d6', 'necrotic']], { critMin: 19 }),
    multi: multi(['sword', 'sword', 'sword']),
    pounce: save('Pounce', 'str', 19, null, { cost: 'bonus', onFail: [prone] }),
    order: order('Order', { n: 2, filter: isVampire, cost: 'leg', text: 'claws on Trillo\'s order' }),
  },
  bonusPlan: ['pounce'],
  legs: [{ act: 'sword', cost: 1, w: 4 }, { act: 'order', cost: 2, w: 2 }],
  reactions: [parry(5)],
  hooks: {
    afterHit(E, c, ctx) {
      if (ctx.crit && ctx.act.name === 'Sword' && E.alive(ctx.tgt)) E.reduceMax(ctx.tgt, ctx.dealt, "Trillo's critical");
    },
  },
  basic: 'sword', oa: 'sword', check: { perHit: 26, perRound: 78 },
});

// Charm and domination. A charmed creature will not attack the charmer; a dominated one turns on its friends.
const charm = (dc) => save('Charm', 'wis', dc, null, {
  only: (E, t) => t.tpl.type === 'humanoid' && !E.has(t, 'charmed'),
  onFail: [{ fx: 'cond', cond: 'charmed', name: 'Charm', saveOnHarm: { ability: 'wis', dc }, dur: { who: 'src', when: 'end', turns: 20 } }],
});
const dominate = (name, dc, o = {}) => save(name, 'wis', dc, null, {
  spell: true, conc: true,
  only: (E, t) => !E.has(t, 'dominated'),
  onFail: [{ fx: 'cond', cond: 'dominated', name, conc: true, saveOnHarm: { ability: 'wis', dc } }],
  ...o,
});

def('ophelia', {
  ...vampire, name: 'Lady Ophelia', cr: 13, smart: true, boss: true, pos: 'mid',
  ac: 17, hp: 170, regen: 20, abil: A(16, 20, 18, 18, 16, 22), saves: { dex: 10, wis: 8, cha: 11 }, lr: 2, leg: 2, img: 'vampire.webp',
  actions: {
    claw: melee('Claw', 10, [['1d8+5', 'slashing'], ['3d6', 'necrotic']]),
    bite: melee('Bite', 10, [['1d6+5', 'piercing'], ['5d6', 'necrotic']], {
      onHit: [{ fx: 'maxHp', amount: 'dealtNecrotic', label: 'the bite' }, { fx: 'healSelf', amount: 'dealtNecrotic', label: 'feeding' }],
      aiTarget: (E, c) => E.enemiesOf(c).find((t) => E.has(t, 'charmed') || t.fx.some((f) => f.cond === 'grappled' && f.srcId === c.id)) || null,
    }),
    charm: charm(19),
    multi: multi(['claw', 'claw'], ['claw', 'charm'], ['claw', 'bite']),
    holdPerson: save('Hold Person', 'wis', 19, null, {
      spell: true, conc: true, uses: 2, area: { type: 'near', max: 3, spread: 0.6 },
      onFail: [{ fx: 'cond', cond: 'paralysed', name: 'Hold Person', saveEnds: { ability: 'wis', dc: 19, spell: true }, conc: true }],
    }),
    invisibility: { kind: 'buff', name: 'Greater Invisibility', spell: true, conc: true, uses: 2, self: true, effect: { cond: 'invisible' } },
    dominate: dominate('Dominate Person', 19, { uses: 1 }),
  },
  plan: [
    { use: 'holdPerson', if: (E, c) => !c.conc && E.round <= 2 },
    { use: 'dominate', if: (E, c) => !c.conc, chance: 0.5 },
    { use: 'invisibility', if: (E, c) => !c.conc && c.hp < c.maxHp * 0.6 },
    { use: 'multi', opt: (E, c) => (E.enemiesOf(c).some((t) => E.has(t, 'charmed')) ? 2 : E.rng.chance(0.35) ? 1 : 0) },
  ],
  legs: [{ act: 'claw', cost: 1, w: 3 }, { act: 'charm', cost: 2, w: 2 }],
  reactions: [],
  basic: 'claw', oa: 'claw',
});

// ---- E'noch ----
const enochSpells = ['powerWord', 'fingerOfDeath', 'circleOfDeath', 'dominateMonster', 'blight', 'chillTouch'];

def('enoch', {
  ...vampire, name: "E'noch Qualanthri", battler: 'priest', cr: 18, smart: true, boss: true, pos: 'mid', truesight: true, magicAdv: true,
  ac: 18, hp: 255, regen: 20, abil: A(14, 18, 18, 24, 20, 20), saves: { con: 10, int: 13, wis: 11, cha: 11 },
  condImmune: ['charmed', 'frightened'], lr: 3, leg: 3, fleeAt: 0.33, fleeText: 'steps into the wall and is gone', img: 'enoch.webp',
  actions: {
    touch: melee('Withering Touch', 13, [['6d6', 'necrotic']], {
      formless: true, weapon: false,
      onHit: [{ fx: 'maxHp', amount: 'dealt', label: 'Withering Touch' }, { fx: 'healSelf', amount: 'halfDealt', label: 'Withering Touch' }],
    }),
    chillTouch: ranged('Chill Touch', 13, [['4d8', 'necrotic']], {
      formless: true, spell: true, weapon: false, hidden: true,
      onHit: [cond('noHeal', { name: 'Chill Touch', dur: { who: 'src', when: 'end', turns: 1 } })],
    }),
    blight: save('Blight', 'con', 21, [['9d8', 'necrotic']], { half: true, spell: true, uses: 3, formless: true, hidden: true }),
    fingerOfDeath: save('Finger of Death', 'con', 21, [['7d8+30', 'necrotic']], { half: true, spell: true, uses: 2, formless: true, hidden: true }),
    circleOfDeath: save('Circle of Death', 'con', 21, [['8d8', 'necrotic']], { half: true, spell: true, uses: 2, formless: true, hidden: true, area: { type: 'near', max: 4, spread: 0.5 } }),
    dominateMonster: dominate('Dominate Monster', 21, { uses: 2, formless: true, hidden: true }),
    powerWord: {
      kind: 'special', name: 'Power Word Stun', spell: true, uses: 1, formless: true, hidden: true,
      aiTarget: (E, c) => E.enemiesOf(c).filter((t) => !t.down && t.hp <= 150 && !E.has(t, 'stunned')).sort((a, b) => b.hp - a.hp)[0] || null,
      run(E, c, act, choice) {
        const t = E.get(choice.targets[0]);
        if (!t) return;
        E.log('act', `${c.name} speaks Power Word Stun at ${t.name}.`, c);
        E.addFx(t, { cond: 'stunned', name: 'Power Word Stun', saveEnds: { ability: 'con', dc: 21, spell: true } }, c);
      },
    },
    multi: {
      kind: 'special', name: 'Multiattack (a spell and two Withering Touches)', formless: true,
      aiTarget: (E, c) => E.ai.pickTarget(E, c, null),
      run(E, c, act, choice) {
        // one spell, chosen by what is still available and useful
        const usable = enochSpells.filter((id) => E.usable(c, id, { free: true }) && !(E.action(c, id).conc && c.conc));
        const weights = { powerWord: 5, fingerOfDeath: 4, circleOfDeath: 4, dominateMonster: 3, blight: 3, chillTouch: 1 };
        const tries = [...usable].sort((a, b) => weights[b] * E.rng.next() - weights[a] * E.rng.next());
        for (const id of tries) {
          const ch = E.ai.tryPlan(E, c, { use: id, cost: 'free' }, null);
          if (ch) { E.perform(c, { ...ch, free: true, quietCast: false }); break; }
        }
        for (let i = 0; i < 2; i++) {
          if (!E.active(c)) break;
          const t = E.ai.pickTarget(E, c, E.action(c, 'touch'));
          if (!t) break;
          E.attack(c, t, E.action(c, 'touch'), {});
        }
      },
    },
    children: summon('Children of the Night', () => [[M.vampireSpawn, 3]], { uses: 1, formless: true }),
    bat: {
      kind: 'special', name: 'Take the shape of the Great Bat', cost: 'bonus', noTarget: true, formless: true,
      run(E, c) {
        c.form = 'bat';
        if (c.conc) E.breakConc(c);
        E.log('act', `${c.name} becomes the Great Bat (AC 16, no spells).`, c);
      },
    },
    command: {
      kind: 'special', name: 'Command', noTarget: true,
      when: (E, c) => E.alliesOf(c).some((a) => isVampire(E, a) && E.active(a) && !E.incapacitated(a)),
      run(E, c) {
        const v = E.rng.pick(E.alliesOf(c).filter((a) => isVampire(E, a) && E.active(a) && !E.incapacitated(a)));
        E.log('act', `${c.name} commands ${v.name} to attack.`, c);
        const ch = E.ai.tryPlan(E, v, { use: 'multi', cost: 'free' }, null);
        if (ch) E.run(v, E.action(v, 'multi'), ch);
      },
    },
    legSpell: {
      kind: 'special', name: 'Spell (5th level or lower)', formless: true,
      when: (E, c) => E.usable(c, 'blight', { free: true }),
      aiTarget: (E, c) => E.ai.pickTarget(E, c, null),
      run(E, c, act, choice) { E.perform(c, { act: 'blight', targets: choice.targets, free: true }); },
    },
  },
  forms: {
    bat: {
      ac: 16, abil: A(24, 16, 20, 8, 14, 12),
      actions: {
        bite: melee('Bite', 11, [['2d10+7', 'piercing'], ['4d6', 'necrotic']], { onHit: [{ fx: 'grapple', dc: 19 }, { fx: 'healSelf', amount: 'dealtNecrotic', label: 'feeding' }] }),
        wingClaw: melee('Wing Claw', 11, [['2d8+7', 'slashing']]),
        multi: multi(['bite', 'wingClaw', 'wingClaw']),
        shriek: save('Shriek', 'con', 17, [['6d8', 'thunder']], {
          half: true, recharge: 5, area: { type: 'all', max: 6 },
          onFail: [cond('stunned', { name: 'Shriek', dur: nextTurnEnd })],
        }),
      },
    },
  },
  plan: [
    { use: 'children', if: (E) => E.round >= 1 },
    'shriek',
    'multi',
  ],
  bonusPlan: [{ use: 'bat', if: (E, c) => !c.form && (engagedCount(E, c) >= 2 || c.hp < c.maxHp * 0.6 || E.round >= 4) }],
  legs: [
    { act: 'touch', cost: 1, w: 3 },
    { act: 'chillTouch', cost: 1, w: 2 },
    { act: 'command', cost: 2, w: 2 },
    { act: 'legSpell', cost: 3, w: 3, heavy: true },
    { act: 'wingClaw', cost: 1, w: 3 },
  ],
  reactions: [{
    id: 'counterspell', name: 'Counterspell', trigger: 'spellCast', who: 'enemy', uses: 3, spell: true,
    when: (E, me, ctx) => !me.form && ctx.level >= 3,
    run(E, me, ctx) {
      E.log('act', `${me.name} casts Counterspell at ${ctx.caster.name}'s ${ctx.act.name} (DC 21 CON).`, me);
      const r = E.save(ctx.caster, 'con', 21, { spell: true, lr: false });
      if (!r.success) ctx.countered = true;
    },
  }],
  basic: 'touch', oa: 'touch',
});

// =====================================================================================
// The palace and the sept
// =====================================================================================
def('cursedKnight', {
  name: 'Cursed Knight', cr: 9, type: 'construct', eyeless: true,
  ac: 19, hp: 152, abil: A(22, 10, 18, 6, 12, 5), immune: ['poison', 'psychic'],
  condImmune: ['charmed', 'exhaustion', 'frightened', 'paralysed', 'petrified', 'poisoned'],
  actions: {
    greatsword: melee('Greatsword', 10, [['3d6+6', 'slashing']]),
    multi: multi(['greatsword', 'greatsword']),
  },
  hooks: {
    afterHit(E, c, ctx) {
      const k = `hits:${ctx.tgt.id}`;
      c.turn[k] = (c.turn[k] || 0) + 1;
      if (c.turn[k] === 2 && E.alive(ctx.tgt)) E.applyFx(c, ctx.tgt, [saveOr('str', 17, [prone])]);
    },
  },
  basic: 'greatsword', oa: 'greatsword', check: { perHit: 16, perRound: 32 },
});

def('statue', {
  name: 'Statue of the Mother', cr: 15, type: 'construct', eyeless: true, size: 'gargantuan',
  ac: 18, hp: 310, abil: A(28, 6, 20, 3, 11, 1), immune: ['poison', 'psychic'],
  condImmune: ['charmed', 'exhaustion', 'frightened', 'paralysed', 'petrified', 'poisoned', 'prone'],
  actions: {
    fist: melee('Fist', 14, [['4d10+9', 'bludgeoning']], { onHit: [saveOr('str', 20, [prone])] }),
    multi: multi(['fist', 'fist']),
    crush: save('Shield Crush', 'dex', 20, [['10d10', 'bludgeoning']], {
      half: true, recharge: 5, area: { type: 'near', max: 3, spread: 0.1 },
      onFail: [cond('restrained', { name: 'under the shield', saveEnds: { ability: 'str', dc: 20 } })],
    }),
  },
  plan: ['crush', 'multi'],
  basic: 'fist', oa: 'fist', check: { perHit: 31, perRound: 62 },
});

def('varyn', {
  name: 'Varyn Crona, the Eternal Guardian', battler: 'guardian', cr: 13, type: 'undead', tags: ['ghost'], truesight: true, smart: true,
  ac: 17, hp: 180, abil: A(10, 18, 16, 16, 18, 22), saves: { wis: 9, cha: 11 }, resist: ['all-but-force-radiant'],
  condImmune: ['charmed', 'exhaustion', 'frightened', 'grappled', 'paralysed', 'poisoned', 'prone', 'restrained'], img: 'varyn.webp',
  actions: {
    blade: melee('Spectral Blade', 11, [['2d8+4', 'force'], ['3d8', 'necrotic']]),
    multi: multi(['blade', 'blade']),
    dreadOath: save('Dread Oath', 'wis', 18, null, {
      recharge: 5, area: { type: 'all', max: 4 },
      onFail: [cond('frightened', { name: 'Dread Oath', dur: nextTurnEnd }), { fx: 'push', label: 'driven from the bed' }],
    }),
  },
  plan: ['dreadOath', 'multi'],
  reactions: [{
    id: 'guardian', name: 'Guardian', trigger: 'targeted', who: 'ally', free: true,
    when: (E, me, ctx) => E.hasTag(ctx.tgt, 'emperor'),
    run(E, me, ctx) { ctx.newTarget = me; E.log('info', `${me.name} is between the Emperor and the blow (Guardian).`, me); },
  }],
  basic: 'blade', oa: 'blade', check: { perHit: 26, perRound: 52 },
});

def('emperorWaking', {
  name: 'The Emperor Waking', type: 'undead', tags: ['vampire', 'emperor'], boss: true,
  ac: 21, hp: 420, startHp: 210, regen: 30, regenAlways: true, abil: A(26, 10, 26, 20, 18, 24), saves: { con: 14, wis: 10 },
  resist: ['necrotic'], immune: ['fire'], condImmune: ['charmed', 'frightened'], img: 'emperor.webp',
  actions: { bite: melee('Bite', 15, [['2d6+8', 'piercing'], ['6d6', 'necrotic']], { onHit: [{ fx: 'healSelf', amount: 'dealtNecrotic', label: 'feeding' }] }) },
  plan: ['bite'],
  hooks: {
    onTurnStart(E, c) {
      if (E.round < 4 || c.memo.changed) return;
      c.memo.changed = true;
      E.log('act', 'The change is finished. The roof comes apart and Kaius, the Crimson Sun, stands in the wreck (DC 18 DEX, 4d10 bludgeoning).', c);
      E.saveEffect(c, { name: 'The Roof', save: 'dex', dc: 18, dmg: [['4d10', 'bludgeoning']], half: true }, E.enemiesOf(c));
      const k = E.spawn(M.kaius, { side: c.side, name: M.kaius.name, after: c });
      for (const id of c.engaged) { const o = E.get(id); if (o && E.present(o)) { k.engaged.add(o.id); o.engaged.add(k.id); } }
      for (const v of E.alliesOf(c).filter((a) => a.tpl.id === 'varyn')) { E.log('info', `${v.name} fades.`, v); v.fled = true; v.engaged.clear(); }
      c.tpl = { ...c.tpl, noCorpse: true };
      c.fled = true;
      for (const o of E.list) o.engaged.delete(c.id);
      c.engaged.clear();
    },
  },
  basic: 'bite', oa: 'bite',
});

def('kaius', {
  name: 'Kaius, the Crimson Sun', cr: 24, type: 'dragon', tags: ['emperor', 'undead'], boss: true, eyeless: true, truesight: true, smart: true, size: 'gargantuan',
  ac: 22, hp: 546, regen: 30, regenAlways: true, abil: A(30, 10, 29, 20, 18, 26), saves: { dex: 7, con: 16, wis: 11, cha: 15 },
  immune: ['fire', 'necrotic'], condImmune: ['charmed', 'frightened'], lr: 3, leg: 3, img: 'emperor.webp',
  actions: {
    presence: save('Frightful Presence', 'wis', 21, null, {
      area: { type: 'all' }, only: (E, t) => !E.has(t, 'frightened'),
      onFail: [cond('frightened', { name: 'Frightful Presence', saveEnds: { ability: 'wis', dc: 21 } })],
    }),
    bite: melee('Bite', 17, [['2d10+10', 'piercing'], ['4d6', 'fire']]),
    claw: melee('Claw', 17, [['2d6+10', 'slashing']]),
    tail: melee('Tail', 17, [['2d8+10', 'bludgeoning']]),
    multi: multi(['presence', 'bite', 'claw', 'claw']),
    breath: save('Fire Breath', 'dex', 24, [['26d6', 'fire']], { half: true, recharge: 5, area: { type: 'near', max: 6, spread: 0.7 } }),
    wing: save('Wing Attack', 'dex', 25, [['2d6+10', 'bludgeoning']], { onFail: [prone], area: { type: 'engaged' } }),
  },
  plan: ['breath', 'multi'],
  legs: [{ act: 'tail', cost: 1, w: 3 }, { act: 'wing', cost: 2, w: 2, if: (E, c) => engagedCount(E, c) >= 2 }],
  basic: 'bite', oa: 'bite',
});

// =====================================================================================
// Eden
// =====================================================================================
def('edenUnit', {
  name: 'Eden Unit', battler: 'husk', cr: 6, type: 'undead', tags: ['eden', 'unsung'],
  ac: 17, hp: 105, speed: 35, abil: A(18, 14, 16, 10, 12, 6), saves: { str: 7, con: 6 },
  immune: ['poison'], condImmune: ['charmed', 'exhaustion', 'poisoned'], resist: ['necrotic'], img: 'eden.webp',
  actions: {
    blade: melee('Blade Arm', 7, [['2d8+4', 'slashing']]),
    bolt: ranged('Bolt Thrower', 5, [['2d10+2', 'piercing']]),
    multi: multi(['blade', 'blade'], ['bolt', 'bolt']),
    overdrive: {
      kind: 'special', name: 'Overdrive', cost: 'bonus', uses: 1,
      aiTarget: (E, c) => E.ai.pickTarget(E, c, E.action(c, 'blade')),
      run(E, c, act, choice) {
        E.log('act', `${c.name} goes into Overdrive: one extra attack, and takes 10 damage.`, c);
        const t = E.get(choice.targets[0]);
        if (t) E.attack(c, t, E.action(c, 'blade'), {});
        E.damage(c, [{ amt: 10, type: 'force' }], null, {});
      },
    },
  },
  bonusPlan: [{ use: 'overdrive', if: (E, c) => c.hp > 30 }],
  basic: 'blade', oa: 'blade', check: { perHit: 13, perRound: 26 },
});

def('eden', {
  name: 'Eden, EDN-00', battler: 'eden', cr: 15, type: 'undead', tags: ['eden', 'unsung'], boss: true, smart: true, focus: 'uriel',
  ac: 19, hp: 250, speed: 50, abil: A(22, 20, 26, 14, 16, 16), saves: { str: 11, dex: 10, con: 13, wis: 8 },
  immune: ['poison'], condImmune: ['charmed', 'exhaustion', 'frightened', 'poisoned'], resist: ['necrotic', 'fire'], lr: 2, leg: 3, img: 'eden.webp',
  actions: {
    blade: melee('Blade', 11, [['2d8+6', 'slashing'], ['2d6', 'necrotic']], {
      vs: [{ when: (E, t) => E.hasTag(t, 'uriel'), dice: '2d8', type: 'slashing', label: 'One Target' }],
    }),
    multi: multi(['blade', 'blade', 'blade', 'blade']),
    order: order('Order', { n: 2, filter: (E, a) => a.tpl.id === 'edenUnit', cost: 'leg' }),
  },
  legs: [{ act: 'blade', cost: 1, w: 4 }, { act: 'order', cost: 2, w: 2 }],
  hooks: { attackMods: (E, c, ctx) => (E.hasTag(ctx.tgt, 'uriel') ? { adv: 'One Target' } : null) },
  basic: 'blade', oa: 'blade', check: { perHit: 22, perRound: 88 },
});

// =====================================================================================
// Uriel
// =====================================================================================
const urielSpells = (dc, toHit) => ({
  tollDead: save('Toll the Dead', 'wis', dc, (E, t) => [[t.hp < t.maxHp ? '4d8+6' : '3d8+6', 'necrotic']], { spell: true }),
  sacredFlame: save('Sacred Flame', 'dex', dc, [['3d8+6', 'radiant']], { spell: true }),
  inflict: save('Inflict Wounds (2nd level)', 'con', dc, [['3d10', 'necrotic']], { spell: true, half: true }),
  blight: save('Blight', 'con', dc, [['8d8', 'necrotic']], { spell: true, half: true, uses: 3 }),
  harm: harm(dc, { uses: 1 }),
  heal: { kind: 'heal', name: 'Heal', dice: '70', self: true, spell: true, uses: 1, when: (E, c) => c.hp <= c.maxHp - 70 },
  massCure: {
    kind: 'special', name: 'Mass Cure Wounds', spell: true, uses: 3, noTarget: true,
    when: (E, c) => E.alliesOf(c, true).filter((a) => a.tpl.type !== 'undead' && a.hp <= a.maxHp - 25).length >= 2,
    run(E, c) {
      const r = rollDice(E.rng, '5d8+6');
      E.log('act', `${c.name} casts Mass Cure Wounds: ${r.text} = ${r.total}.`, c);
      for (const a of E.alliesOf(c, true).filter((x) => x.tpl.type !== 'undead' && x.hp < x.maxHp).slice(0, 6)) E.heal(a, r.total, c, 'Mass Cure Wounds');
    },
  },
  guardians: emanation('Spirit Guardians', {
    dc, dmg: [['6d6', 'necrotic']], uses: 3,
    onFail: [{ fx: 'cond', cond: 'frightened', name: 'Spirit Guardians', conc: true }],
  }),
});

const urielBreath = (dc, fire) => ({
  kind: 'special', name: 'Breath of the Grave', recharge: 5, noTarget: true,
  when: (E, c) => engagedCount(E, c) >= 1,
  run(E, c) {
    const first = E.get([...c.engaged].find((id) => E.present(E.get(id))));
    const targets = areaTargets(E, c, first, { type: 'near', max: 5, spread: fire ? 0.6 : 0.25 }).filter((t) => t.tpl.type !== 'undead' && t.tpl.type !== 'construct');
    const dmg = fire ? [['4d8', 'necrotic'], ['4d8', 'fire']] : [['8d8', 'necrotic']];
    E.saveEffect(c, { name: 'Breath of the Grave', save: 'con', dc, dmg, half: true }, targets);
    for (const a of undeadAllies(E, c)) if (a.hp < a.maxHp) E.heal(a, 36, c, 'Breath of the Grave');
  },
});

const uriel = (id, name, o) => {
  const dc = o.dc;
  const dove = melee('Mourning Dove', o.toHit - 1, [['2d8+7', 'slashing'], ...(o.fire ? [['4d6', 'fire']] : [])], { also: 1, onHit: [{ fx: 'curse' }] });
  const spells = urielSpells(dc, o.toHit);
  const spellIds = Object.keys(spells);
  for (const k of spellIds) spells[k].needsChild = true;
  return def(id, {
    name, battler: o.battler, cr: o.cr, type: 'humanoid', tags: ['uriel', 'sister'], smart: true, boss: true, rank: 9, pos: 'mid',
    ac: o.ac, hp: o.hp, abil: A(20, 18, 18, 9, 22, 18), saves: { con: 9, wis: 11, cha: 9 },
    resist: ['necrotic'], condImmune: ['charmed', 'frightened', 'poisoned', 'exhaustion'],
    lr: 3, leg: 3, deathWard: true, twoTurns: o.twoTurns, fleeAt: o.fleeAt, fleeText: o.fleeText, img: 'uriel.webp',
    actions: {
      dove,
      ...spells,
      multi: multi(['dove', 'dove'], ['dove', 'tollDead'], ['dove', 'inflict']),
      breath: urielBreath(dc, o.fire),
      commandDead: order('Command the Dead', { n: 1, filter: (E, a) => a.tpl.type === 'undead' && !E.hasTag(a, 'eden') }),
      summonUndead: summon('Summon Undead', () => [[M.doveWight, 1]], { uses: 2 }),
      noRest: o.millions
        ? summon('No Rest for the Wicked: the Millions', () => [[M.whiteGuard, 8]], {})
        : raise('No Rest for the Wicked', () => M.zombie, 12, {}),
      radiance: save('Sickening Radiance', 'con', dc, [['4d10', 'radiant']], {
        area: { type: 'near', max: 5, spread: 0.5 },
        onFail: [{ fx: 'call', run: (E, src, tgt) => {
          E.addFx(tgt, { id: `exhaust${E.turnCount}`, name: 'exhaustion (Sickening Radiance)', atk: -2, saveBonus: -2, announce: true, ends: { who: src.id, when: 'start', turns: 1 } }, src);
          E.log('cond', `${tgt.name} gains a level of exhaustion until the radiance fades (-2 to d20 tests).`, tgt);
        } }],
      }),
      original: {
        kind: 'special', name: 'Ring the Original', uses: 1, noTarget: true,
        when: () => !!o.bell,
        run(E, c) {
          E.log('act', `${c.name} rings the Original. Every corpse within a mile rises; eight white guards reach the forecourt each round from now on.`, c);
          E.flags.bell = E.round;
          E.waves.push({
            round: E.round, every: 1, spawn: [[M.whiteGuard, 8]], label: 'The risen dead reach the forecourt',
            until: (E2) => !E2.list.some((x) => E2.hasTag(x, 'uriel') && E2.alive(x)),
          });
        },
      },
    },
    plan: [
      { use: 'original' },
      { use: 'heal' },
      { use: 'breath' },
      { use: 'guardians', if: (E, c) => !c.conc && !hasAura(E, c, 'Spirit Guardians') && engagedCount(E, c) >= 1 },
      { use: 'harm', chance: 0.6 },
      { use: 'summonUndead', if: (E, c) => E.round >= 2, chance: 0.6 },
      { use: 'massCure' },
      { use: 'blight', if: (E, c) => engagedCount(E, c) === 0 || c.turn.second, chance: 0.8 },
      { use: 'multi', if: (E, c) => !c.turn.second, opt: (E, c) => (engagedCount(E, c) && E.rng.chance(0.5) ? 0 : E.rng.chance(0.5) ? 1 : 2) },
      { use: 'tollDead' },
    ],
    legs: [
      { act: 'dove', cost: 1, w: 3, if: (E, c) => engagedCount(E, c) > 0 },
      { act: 'tollDead', cost: 1, w: 2 },
      { act: 'sacredFlame', cost: 1, w: 1 },
      { act: 'commandDead', cost: 1, w: 3 },
      { act: 'breath', cost: 1, w: 6, heavy: true },
      { act: 'blight', cost: 1, w: 2, heavy: true },
      { act: 'harm', cost: 1, w: 2, heavy: true },
    ],
    lair: o.lair ? ['noRest', 'radiance'] : null,
    reactions: [
      sentinelAtDeathsDoor,
      {
        id: 'dragonmark', name: 'Dragonmark of Death', trigger: 'turnStart', who: 'ally', free: true,
        when: (E, me, ctx) => ctx.subject.tpl.type === 'undead' && !E.hasTag(ctx.subject, 'eden') && E.active(ctx.subject),
        run(E, me, ctx) {
          E.tempHp(ctx.subject, 10, 'Dragonmark of Death');
          ctx.subject.turn.advNext = 'Dragonmark of Death';
        },
      },
    ],
    hooks: {
      onTurnStart(E, c, ctx) {
        if (E.flags.polygon && !ctx.second && c.hp > 0 && c.hp < c.maxHp) E.heal(c, 20, c, 'the Polygon');
        if (E.flags.childLost && !c.memo.noSpells) { c.memo.noSpells = true; E.log('info', `${c.name} has lost the child and cannot cast spells.`, c); }
        if (c.memo.working === 1) c.memo.working = 2;
      },
      onDeathWard(E, c) {
        const ch = E.ai.legendary(E, c, null);
        if (ch) { E.log('act', `${c.name} takes a legendary action at once (Death Ward).`, c); const s = c.legLeft; c.legLeft = Math.max(1, s); E.perform(c, { ...ch, cost: 'leg', legCost: 0, free: true }); c.legLeft = s; }
      },
      opportunity: () => 'tollDead',
      // Stage three: Mother Lich.
      onZero(E, c) {
        if (!o.lich || c.memo.risen) return null;
        if (!c.memo.working) {
          c.memo.working = 1;
          c.hp = 0;
          E.breakConc(c);
          E.addFx(c, { cond: 'incapacitated', id: 'working', name: 'the working' }, null);
          E.log('end', `${c.name} drops to 0 hit points and does not die. She begins the working that makes her undead; it completes at the end of her next turn unless the bond is cut (an action within 5 feet, DC 19 Medicine or Religion).`, c);
        }
        return 'handled';
      },
      onTurnEnd(E, c) {
        if (c.memo.working !== 2 || c.memo.risen) return;
        c.memo.risen = true;
        c.memo.working = 0;
        c.memo.noSpells = false;
        E.flags.childLost = false;
        c.fx = c.fx.filter((f) => f.id !== 'working');
        c.hp = 150;
        c.tpl = { ...c.tpl, type: 'undead', immune: ['necrotic', 'poison'], deathWard: false };
        E.log('end', `The working completes. ${c.name} rises as an undead at 150 hit points, immune to necrotic and poison.`, c);
      },
    },
    basic: 'dove', oa: 'dove',
  });
};

uriel('uriel1', 'Uriel, the White Death', {
  battler: 'urielB', cr: 16, ac: 19, hp: 260, dc: 19, toHit: 11, fleeAt: 0.5, fleeText: 'speaks a word of recall and is gone to Nos Matre',
});
uriel('uriel2', 'Uriel, the Holy Empress', {
  battler: 'urielC', cr: 17, ac: 19, hp: 260, dc: 19, toHit: 11, fleeAt: 0.5, fleeText: 'goes below, into the Sept of Bones', bell: true, lair: true,
});
uriel('uriel3', 'Uriel, Mother of the Heir', {
  battler: 'urielD', cr: 20, ac: 20, hp: 330, dc: 21, toHit: 13, twoTurns: true, fire: true, lich: true, lair: true, millions: true,
});

api.kit = { holdTheLine, lament, dispel, sentinelAtDeathsDoor, honour, directTheDead, absolution, wombOfAsh, wings, drainLife };
api.register({
  creatures: { ...M },
  library: [{ group: 'The Lazaret, as written (bestiary of 10/8)', ids: [
  'uriel1', 'uriel2', 'uriel3', 'estherRaised', 'estherHalf', 'maelisDorn', 'tallSister', 'surgeonMarshall',
  'enoch', 'trillo', 'ophelia', 'eden', 'kaius', 'emperorWaking', 'varyn', 'statue',
  'sisterBlood', 'sisterLight', 'maryChristmas', 'prioress', 'sisterStanding', 'battleSister', 'sorrowful', 'sisterBone', 'greenSister', 'blackDove',
  'bigOne', 'tallGuard', 'whiteGuard', 'redGuard', 'revenantWight', 'doveWight', 'eldest', 'daughterFire', 'daughterCold', 'daughterAcid', 'daughterLightning',
  'vampireSpawn', 'lesserSpawn', 'cursedKnight', 'edenUnit', 'zombie',
] }],
});
}
