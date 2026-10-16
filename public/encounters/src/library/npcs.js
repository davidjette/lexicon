// Villains and bosses from Dave's earlier campaigns, built from his own notes and sheets:
//   Wainwright St. Cloud   Starfall Part V (boss notes) and the "true" sheet
//   Calix                  Hope in Exile Part VII
//   Panahedradom           the Arcaneum notes
//   Archmage Valen         his sheet (legendary and lair text) and the Arcaneum notes
//   Celion the Great       his sheet
//   Gorrelach & Gunt       Spillway Depths (Homebrewery), with the Maggot Spawn
// Each runs the attacks and the main damage spells of its source. Utility magic is left out.

import { melee, ranged, save, multi, cond, prone, hold } from '../data/lib.js?v=mvaaioll';
import { register } from '../data/registry.js?v=mvaaioll';

const N = {};
const def = (id, t) => { N[id] = { id, side: 'monster', pos: 'front', ...t }; return N[id]; };
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });
const foes = (E, c) => E.enemiesOf(c).filter((t) => !t.down);
const engagedCount = (E, c) => [...c.engaged].filter((id) => E.present(E.get(id))).length;
const area = { type: 'near', max: 5, spread: 0.3 };
const many = (E, c) => foes(E, c).length >= 2;
const minute = (ability, dc) => ({ saveEnds: { ability, dc } });

// Shield as wizards use it: +5 AC against the attack that would have hit.
const shield = (uses) => ({
  id: 'shield', name: 'Shield', trigger: 'attacked', uses,
  when: (E, me, ctx) => ctx.hit && !ctx.crit && ctx.total < E.acOf(me) + 5,
  run(E, me, ctx) { ctx.acBonus += 5; E.log('act', `${me.name} casts Shield.`, me); },
});
const counterspell = (dc, uses, free = false) => ({
  id: 'counterspell', name: free ? 'Legendary Counterspell' : 'Counterspell', trigger: 'spellCast', who: 'enemy', spell: true, uses, free,
  when: (E, me, ctx) => ctx.level >= 3,
  run(E, me, ctx) {
    E.log('act', `${me.name} casts Counterspell at ${ctx.caster.name}'s ${ctx.act.name} (DC ${dc} CON).`, me);
    if (!E.save(ctx.caster, 'con', dc, { spell: true, lr: false }).success) ctx.countered = true;
  },
});

// ---------------------------------------------------------------------------------------
// Wainwright St. Cloud
// ---------------------------------------------------------------------------------------
const ENERGY = ['lightning', 'fire', 'cold', 'force', 'radiant', 'necrotic', 'acid', 'poison'];
const others = (open) => [...ENERGY.filter((t) => t !== open), 'psychic', 'thunder'];
def('stCloud', {
  name: 'Wainwright St. Cloud', battler: 'stcloud', cr: 20, type: 'humanoid', smart: true, boss: true, pos: 'back', init: 4,
  sub: 'Warlock 17 / Rogue 3 · Starfall',
  ac: 16, hp: 280, abil: A(10, 18, 16, 14, 14, 26), saves: { wis: 8, cha: 14 }, leg: 3,
  actions: {
    rifle: ranged('Antimatter Rifle', 11, [['6d8+5', 'necrotic']]),
    dagger: melee('Dagger of Venom', 12, [['1d4+6', 'piercing'], ['2d10', 'poison']], {
      onHit: [{ fx: 'save', ability: 'con', dc: 20, onFail: [cond('poisoned', { name: 'Dagger of Venom', ...minute('con', 20) })] }],
    }),
    multi: multi(['rifle', 'rifle'], ['dagger', 'dagger']),
    touch: melee('Vampiric Touch', 14, [['5d6', 'necrotic']], { spell: true, weapon: false, onHit: [{ fx: 'healSelf', amount: 'dealtNecrotic', label: 'Vampiric Touch' }] }),
    blast: ranged('Eldritch Blast', 14, [['1d10+8', 'force']], { n: 4, spell: true, weapon: false, cost: 'bonus' }),
    blastLeg: ranged('Eldritch Blast', 14, [['1d10+8', 'force']], { n: 4, spell: true, weapon: false, hidden: true }),
    restore: {
      kind: 'special', name: 'Restore the Field', noTarget: true, hidden: true,
      when: (E, c) => (c.tempHp || 0) < 20,
      run(E, c) { E.log('act', `${c.name} restores the field.`, c); E.tempHp(c, 18, 'ambient field (5d6)'); },
    },
    pwk: {
      kind: 'special', name: 'Power Word Kill', uses: 1, spell: true,
      when: (E, c) => foes(E, c).some((t) => t.hp <= 100),
      run(E, c) {
        const t = foes(E, c).filter((x) => x.hp <= 100).sort((a, b) => b.hp - a.hp)[0];
        if (!t) return;
        E.log('act', `${c.name} speaks Power Word Kill at ${t.name} (${t.hp} HP).`, c);
        E.damage(t, [{ amt: t.hp + (t.tempHp || 0), type: 'psychic' }], c, { rollText: 'Power Word Kill' });
      },
    },
    field: {
      kind: 'special', name: 'Ambient Field', noTarget: true, hidden: true,
      run(E, c) {
        const open = ENERGY[E.rng.int(8) - 1];
        E.removeFx(c, (f) => f.id === 'field', false);
        E.addFx(c, { id: 'field', name: `Field open to ${open}`, immune: others(open) }, c);
        E.log('act', `${c.name}'s ambient field fires a blast of ${open}. Until the next blast, only ${open} and weapons can hurt him.`, c);
        const t = foes(E, c);
        if (t.length) E.saveEffect(c, { name: 'Ambient Field', save: 'dex', dc: 22, dmg: [['4d10', open]], half: true, isArea: true }, t.slice(0, 3));
      },
    },
  },
  plan: [{ use: 'pwk', chance: 0.5 }, { use: 'touch', if: (E, c) => c.hp < c.maxHp * 0.5 && engagedCount(E, c) > 0 }, 'multi'],
  bonusPlan: ['blast'],
  legs: [{ act: 'blastLeg', cost: 1, w: 3 }, { act: 'restore', cost: 1, w: 4 }],
  lair: ['field'],
  reactions: [counterspell(22, 3)],
  hooks: {
    onFightStart(E, c) {
      E.tempHp(c, 100, 'ambient field');
      E.addFx(c, { id: 'field', name: 'Field open to lightning', immune: others('lightning') }, c);
    },
  },
  basic: 'rifle', oa: 'dagger',
});

// ---------------------------------------------------------------------------------------
// Calix, the baelnorn
// ---------------------------------------------------------------------------------------
def('calix', {
  name: 'Calix', battler: 'calix', cr: 12, type: 'undead', smart: true, pos: 'back', init: 2,
  sub: 'Baelnorn lich, 18th-level caster · Hope in Exile',
  ac: 15, hp: 99, abil: A(10, 14, 12, 20, 15, 16), saves: { int: 9, wis: 6 }, magicAdv: true,
  actions: {
    dagger: melee('Sacrificial Dagger', 6, [['1d4+2', 'piercing'], ['2d6', 'poison']]),
    fireBolt: ranged('Fire Bolt', 9, [['4d10', 'fire']], { spell: true, weapon: false }),
    lightning: save('Lightning Bolt', 'dex', 17, [['8d6', 'lightning']], { half: true, spell: true, uses: 3, area: { type: 'near', max: 3, spread: 0.5 } }),
    cone: save('Cone of Cold', 'con', 17, [['8d8', 'cold']], { half: true, spell: true, uses: 3, area }),
    banish: save('Banishment', 'cha', 17, null, { spell: true, conc: true, uses: 3, onFail: [{ fx: 'cond', cond: 'banished', name: 'Banishment', conc: true }] }),
    timeStop: {
      kind: 'special', name: 'Time Stop', uses: 1, spell: true, noTarget: true,
      when: (E, c) => E.round >= 2,
      run(E, c) {
        E.log('act', `${c.name} casts Time Stop and takes two turns alone.`, c);
        for (const id of ['cone', 'lightning']) {
          if (!E.usable(c, id, { free: true })) continue;
          const t = E.ai.pickTarget(E, c, E.action(c, id));
          if (t) E.perform(c, { act: id, targets: [t.id], free: true });
        }
      },
    },
  },
  plan: [
    'timeStop',
    { use: 'cone', if: many },
    { use: 'lightning', if: many },
    { use: 'banish', if: (E, c) => !c.conc && many(E, c), chance: 0.4 },
    'fireBolt',
  ],
  reactions: [counterspell(17, 3), shield(4)],
  basic: 'fireBolt', oa: 'dagger',
});

// ---------------------------------------------------------------------------------------
// Panahedradom, Ancient Drake of the Entropic Doom
// ---------------------------------------------------------------------------------------
def('panahedradom', {
  name: 'Panahedradom', battler: 'drakeDoom', cr: 21, type: 'dragon', size: 'gargantuan', boss: true,
  sub: 'Ancient Drake of the Entropic Doom · the Arcaneum',
  ac: 22, hp: 560, abil: A(27, 14, 25, 16, 15, 19), saves: { dex: 9, con: 14, wis: 9, cha: 11 },
  immune: ['acid'], lr: 3, leg: 3,
  actions: {
    bite: melee('Bite', 14, [['2d10+8', 'piercing'], ['2d8', 'cold']]),
    claw: melee('Claw', 14, [['2d6+8', 'slashing']]),
    tail: melee('Tail', 14, [['2d8+8', 'bludgeoning']]),
    presence: save('Frightful Presence', 'wis', 16, null, {
      area: { type: 'all' }, only: (E, t) => !E.has(t, 'frightened'),
      onFail: [cond('frightened', { name: 'Frightful Presence', ...minute('wis', 16) })],
    }),
    multi: multi(['bite', 'claw', 'claw']),
    breath: save('Acid Breath', 'dex', 22, [['15d8', 'acid']], { half: true, recharge: 5, area: { type: 'near', max: 4, spread: 0.5 } }),
    wing: save('Wing Attack', 'dex', 23, [['2d6+8', 'bludgeoning']], { onFail: [prone], area: { type: 'engaged' }, hidden: true }),
  },
  plan: ['breath', { use: 'presence', if: (E, c) => E.round === 1 }, 'multi'],
  legs: [{ act: 'tail', cost: 1, w: 3 }, { act: 'wing', cost: 2, w: 2, if: (E, c) => engagedCount(E, c) >= 2 }],
  basic: 'bite', oa: 'bite',
});

// ---------------------------------------------------------------------------------------
// Archmage Valen
// ---------------------------------------------------------------------------------------
def('valen', {
  name: 'Archmage Valen', battler: 'valen', cr: 18, type: 'humanoid', smart: true, boss: true, pos: 'back', init: 6,
  sub: 'Wizard 18 · the Arcaneum',
  ac: 15, hp: 245, abil: A(8, 15, 18, 20, 12, 10), saves: { int: 11, wis: 7 },
  resist: ['lightning', 'slashing', 'bludgeoning', 'piercing'], lr: 3, leg: 3,
  actions: {
    fireBolt: ranged('Fire Bolt', 14, [['4d10', 'fire']], { spell: true, weapon: false }),
    chill: ranged('Chill Touch', 14, [['4d8', 'necrotic']], { spell: true, weapon: false }),
    grasp: melee('Shocking Grasp', 14, [['4d8', 'lightning']], { spell: true, weapon: false }),
    ray: ranged('Scorching Ray', 14, [['2d6', 'fire']], { n: 3, spell: true, weapon: false }), // Spell Mastery: at will
    fireball: save('Fireball', 'dex', 19, [['8d6', 'fire']], { half: true, spell: true, uses: 3, area }),
    cone: save('Cone of Cold', 'con', 19, [['8d8', 'cold']], { half: true, spell: true, uses: 3, area }),
    disintegrate: save('Disintegrate', 'dex', 19, [['10d6+40', 'force']], { spell: true, uses: 1 }),
    finger: save('Finger of Death', 'con', 19, [['7d8+30', 'necrotic']], { half: true, spell: true, uses: 1 }),
    sunburst: save('Sunburst', 'con', 19, [['12d6', 'radiant']], {
      half: true, spell: true, uses: 1, area, onFail: [cond('blinded', { name: 'Sunburst', ...minute('con', 19) })],
    }),
    holdMonster: hold('Hold Monster', 19, { uses: 2 }),
    pwk: {
      kind: 'special', name: 'Power Word Kill', uses: 1, spell: true,
      when: (E, c) => foes(E, c).some((t) => t.hp <= 100),
      run(E, c) {
        const t = foes(E, c).filter((x) => x.hp <= 100).sort((a, b) => b.hp - a.hp)[0];
        if (!t) return;
        E.log('act', `${c.name} speaks Power Word Kill at ${t.name} (${t.hp} HP).`, c);
        E.damage(t, [{ amt: t.hp + (t.tempHp || 0), type: 'psychic' }], c, { rollText: 'Power Word Kill' });
      },
    },
    rayLeg: ranged('Scorching Ray', 14, [['2d6', 'fire']], { n: 3, spell: true, weapon: false, hidden: true }),
    fireballLeg: save('Fireball', 'dex', 19, [['8d6', 'fire']], { half: true, spell: true, uses: 3, usesKey: 'fireball', area, hidden: true }),
    slot: {
      kind: 'special', name: 'Lair: a spell slot returns', noTarget: true, hidden: true,
      run(E, c) {
        const spent = ['fireball', 'cone', 'disintegrate', 'finger', 'sunburst', 'pwk'].filter((id) => (c.used[id] || 0) > 0);
        if (!spent.length) { E.log('act', `${c.name}'s sanctum hums. Nothing is spent.`, c); return; }
        const id = spent[E.rng.int(spent.length) - 1];
        c.used[id] -= 1;
        E.log('act', `${c.name}'s sanctum returns a spell slot: ${c.tpl.actions[id].name}.`, c);
      },
    },
  },
  plan: [
    { use: 'pwk', chance: 0.6 },
    { use: 'sunburst', if: many },
    { use: 'cone', if: many },
    { use: 'fireball', if: many },
    { use: 'disintegrate', chance: 0.6 },
    { use: 'finger', chance: 0.6 },
    { use: 'holdMonster', if: (E, c) => !c.conc, chance: 0.3 },
    { use: 'grasp', if: (E, c) => engagedCount(E, c) > 0, chance: 0.3 },
    'ray', 'fireBolt',
  ],
  // Cantrip 1, a 1st or 2nd-level spell 2, a 3rd or 4th-level spell 3
  legs: [{ act: 'fireBolt', cost: 1, w: 3 }, { act: 'rayLeg', cost: 2, w: 2 }, { act: 'fireballLeg', cost: 3, w: 2, if: many }],
  lair: ['slot'],
  reactions: [counterspell(19, 3, true), shield(4)],
  basic: 'fireBolt', oa: 'grasp',
});

// ---------------------------------------------------------------------------------------
// Celion the Great
// ---------------------------------------------------------------------------------------
def('celion', {
  name: 'Celion the Great', battler: 'celion', cr: 13, type: 'humanoid', smart: true, pos: 'back', init: 6,
  sub: 'Wizard 16 / Paladin 1 · Ages of the Infanta',
  ac: 16, hp: 140, abil: A(14, 14, 16, 20, 12, 13), saves: { int: 11, wis: 7 }, resist: ['fire'],
  actions: {
    sword: melee('Longsword, +1', 9, [['1d8+3', 'slashing']]),
    fireBolt: ranged('Fire Bolt', 13, [['4d10', 'fire']], { spell: true, weapon: false }),
    frost: ranged('Ray of Frost', 13, [['4d8', 'cold']], { spell: true, weapon: false }),
    grasp: melee('Shocking Grasp', 13, [['4d8', 'lightning']], { spell: true, weapon: false }),
    fireball: save('Fireball', 'dex', 19, [['8d6', 'fire']], { half: true, spell: true, uses: 3, area }),
    lightning: save('Lightning Bolt', 'dex', 19, [['8d6', 'lightning']], { half: true, spell: true, uses: 2, area: { type: 'near', max: 3, spread: 0.5 } }),
    cone: save('Cone of Cold', 'con', 19, [['8d8', 'cold']], { half: true, spell: true, uses: 2, area }),
    chain: save('Chain Lightning', 'dex', 19, [['10d8', 'lightning']], { half: true, spell: true, uses: 1, area: { type: 'near', max: 4, spread: 1 } }),
    disintegrate: save('Disintegrate', 'dex', 19, [['10d6+40', 'force']], { spell: true, uses: 1 }),
    delayed: save('Delayed Blast Fireball', 'dex', 19, [['12d6', 'fire']], { half: true, spell: true, uses: 1, area }),
    banish: save('Banishment', 'cha', 19, null, { spell: true, conc: true, uses: 2, onFail: [{ fx: 'cond', cond: 'banished', name: 'Banishment', conc: true }] }),
  },
  plan: [
    { use: 'delayed', if: many },
    { use: 'chain', if: many },
    { use: 'cone', if: many },
    { use: 'fireball', if: many },
    { use: 'lightning', if: many },
    { use: 'disintegrate', chance: 0.6 },
    { use: 'banish', if: (E, c) => !c.conc && many(E, c), chance: 0.3 },
    'fireBolt', 'frost',
  ],
  reactions: [counterspell(19, 3), shield(4)],
  basic: 'fireBolt', oa: 'sword',
});

// ---------------------------------------------------------------------------------------
// Gorrelach & Gunt, the Cyst Twin of Pestilence
// One head acts while the other charges a lair action, turn about, each round. Below a quarter of
// its hit points the third phase takes over for the rest of the fight.
// ---------------------------------------------------------------------------------------
const maggot = {
  id: 'maggotSpawn', name: 'Maggot Spawn', side: 'monster', pos: 'front', cr: 0.125, type: 'fiend', size: 'tiny',
  sub: 'CR 1/8 · fiend · Spillway Depths',
  ac: 12, hp: 1, abil: A(6, 14, 8, 1, 6, 2), condImmune: ['poisoned'],
  actions: { bite: melee('Scurry Bite', 4, [['1', 'piercing']]) },
  plan: ['bite'], basic: 'bite',
  hooks: {
    onDeath(E, c, ctx) {
      const hit = (ctx.wasEngaged || []).filter((t) => E.present(t) && t.side !== c.side);
      if (hit.length) E.saveEffect(c, { name: 'Explode', save: 'dex', dc: 12, dmg: [['2d6', 'acid']], isArea: true }, hit);
    },
  },
};
N.maggotSpawn = maggot;
const maw = (E, c) => !c.memo.rear && E.round % 2 === 1;
const nose = (E, c) => !c.memo.rear && E.round % 2 === 0;
const rear = (E, c) => !!c.memo.rear;
const plus2 = (E, c) => (c.memo.rear ? [['2', 'bludgeoning', 'Rectal Vigor']] : []);
def('gorrelachGunt', {
  name: 'Gorrelach & Gunt', cr: 7, type: 'fiend', size: 'large', boss: true,
  sub: 'The Cyst Twin of Pestilence · CR 7 · Spillway Depths',
  ac: 16, hp: 162, abil: A(20, 10, 25, 12, 12, 15),
  immune: ['poison'], resist: ['cold', 'fire', 'lightning'], condImmune: ['poisoned', 'charmed', 'frightened', 'stunned'], lr: 1,
  actions: {
    gnash: melee('Gnash', 6, [['2d10+5', 'piercing']], { onHit: [{ fx: 'save', ability: 'str', dc: 14, onFail: [{ fx: 'grapple', dc: 14 }] }], when: (E, c) => maw(E, c) || rear(E, c) }),
    snot: ranged('Snot Rocket', 6, [['2d10+5', 'slashing'], ['1d10', 'poison']], {
      onHit: [{ fx: 'save', ability: 'con', dc: 14, onFail: [cond('poisoned', { name: 'Snot Rocket', ...minute('con', 14) })] }], when: (E, c) => nose(E, c) || rear(E, c),
    }),
    slam: melee('Slam', 6, [['3d10+3', 'bludgeoning']], { onHit: [{ fx: 'save', ability: 'str', dc: 14, onFail: [prone] }], hidden: true }),
    grind: {
      kind: 'special', name: 'Grinding Jaw', cost: 'bonus',
      when: (E, c) => foes(E, c).some((t) => E.has(t, 'grappled') && t.engaged.has(c.id)),
      run(E, c) {
        const t = foes(E, c).find((x) => E.has(x, 'grappled') && x.engaged.has(c.id));
        if (!t) return;
        E.log('act', `${c.name} grinds ${t.name} in its jaw.`, c);
        E.rollAndDamage(c, t, [{ dice: '2d10+5', type: 'piercing' }, ...(c.memo.rear ? [{ dice: '2', type: 'piercing' }] : [])], { label: 'Grinding Jaw' });
      },
    },
    larva: {
      kind: 'special', name: 'Incubate Larva', cost: 'bonus', noTarget: true,
      when: (E, c) => (nose(E, c) || rear(E, c)) && E.alliesOf(c).filter((a) => a.tpl.id === 'maggotSpawn' && !a.down).length < 6,
      run(E, c) {
        const near = [...c.engaged].map((id) => E.get(id)).filter((t) => t && E.present(t));
        E.log('act', `${c.name} points at a boil, which bursts.`, c);
        for (const t of near) E.rollAndDamage(c, t, [{ dice: '1d10', type: 'acid' }], { label: 'the boil' });
        const s = E.spawn(maggot, { side: c.side, name: E.nameFor(maggot, c.side), after: c });
        s.summonedBy = c.id;
        E.log('act', `${s.name} crawls out and joins the fight.`, c);
      },
    },
    vomit: save('Cone of Vomit', 'dex', 14, [['2d10', 'acid'], ['2d10', 'poison']], { half: true, area: { type: 'near', max: 2, spread: 0.5 }, hidden: true }),
    cough: save('Pestilent Cough', 'con', 14, null, { area: { type: 'near', max: 4, spread: 0.6 }, onFail: [cond('poisoned', { name: 'Pestilent Cough', ...minute('con', 14) })], hidden: true }),
    flood: save('Diarrhea Flood', 'con', 15, [['8d6', 'poison']], { half: true, area: { type: 'near', max: 3, spread: 0.6 }, hidden: true }),
    charge: {
      kind: 'special', name: 'Charged lair action', noTarget: true, hidden: true,
      run(E, c) {
        if (E.round === 1) { E.log('act', `${c.name}: the Nose coughs and chokes, charging. The Maw is active.`, c); return; }
        const id = rear(E, c) ? 'flood' : E.round % 2 === 0 ? 'cough' : 'vomit';
        const t = E.ai.pickTarget(E, c, E.action(c, id));
        if (t) E.perform(c, { act: id, targets: [t.id], free: true });
        if (!rear(E, c)) E.log('act', `${c.name}: ${E.round % 2 === 0 ? 'the Nose is active and the Maw retches, charging' : 'the Maw is active and the Nose chokes, charging'}.`, c);
      },
    },
  },
  plan: ['gnash', 'snot'],
  bonusPlan: ['grind', 'larva'],
  lair: ['charge'],
  reactions: [
    {
      id: 'slam', name: 'Slam', trigger: 'hitBy',
      when: (E, me, ctx) => ctx.att && E.present(ctx.att) && (ctx.melee || me.engaged.has(ctx.att.id)),
      run(E, me, ctx) { E.attack(me, ctx.att, E.action(me, 'slam'), {}); },
    },
  ],
  hooks: {
    onHit: (E, c) => (c.memo.rear ? { dmg: plus2(E, c) } : null),
    onDamaged(E, c) {
      if (c.memo.rear || c.down || c.hp <= 0 || c.hp >= c.maxHp / 4) return;
      c.memo.rear = true;
      E.log('act', `${c.name} rotates. The Anointed Rear takes over: its final form.`, c);
      E.heal(c, 40, c, 'Rectal Vigor');
      E.addFx(c, { id: 'vigor', name: 'Rectal Vigor (+2 AC, +2 damage)', ac: 2 }, c);
      const t = foes(E, c);
      if (t.length) E.saveEffect(c, { name: 'Anal Horror', save: 'wis', dc: 15, onFail: [cond('frightened', { name: 'Anal Horror', ...minute('wis', 15) })], isArea: true }, t);
    },
  },
  basic: 'gnash', oa: 'slam',
});

register({
  creatures: N,
  library: [
    { group: 'Villains of the Infantaverse', ids: ['stCloud', 'valen', 'celion', 'calix', 'panahedradom'] },
    { group: "Dead Man's Hand", ids: ['gorrelachGunt', 'maggotSpawn'] },
  ],
});
