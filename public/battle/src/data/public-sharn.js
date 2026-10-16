// Public stat blocks from the Sharn campaign, transcribed from the ten block images Dave supplied on
// 2026-10-10 (copies in sources/public-blocks/). Where an image is cut off or a line cannot be run
// as written, the block says so in a comment and README.md lists it.

import { melee, ranged, save, multi, cond, prone, hold, healing, parry } from './lib.js?v=mvad14p5';
import { rollDice } from '../engine/dice.js?v=mvad14p5';
import { breakAll } from '../engine/zones.js?v=mvad14p5';
import { register } from './registry.js?v=mvad14p5';

const S = {};
const def = (id, t) => {
  S[id] = { id, side: 'monster', pos: 'front', ...t };
  return S[id];
};
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });
const nextTurnEnd = { who: 'tgt', when: 'end', turns: 1 };
const engagedCount = (E, c) => [...c.engaged].filter((id) => E.present(E.get(id))).length;
const nearby = (E, c, ctx) => (ctx.wasEngaged || []).filter((t) => E.present(t) && t.side !== c.side);

// A burst when the creature is destroyed, against everyone who was in melee with it.
const deathBurst = (name, ability, dc, dmg, onFail) => (E, c, ctx) => {
  const hit = nearby(E, c, ctx);
  if (hit.length) E.saveEffect(c, { name, save: ability, dc, dmg, half: true, onFail, isArea: true }, hit);
};

// ---------------------------------------------------------------------------------------
// The Children of Ember
// ---------------------------------------------------------------------------------------
def('childOfEmber', {
  name: 'Child of Ember', cr: 4, type: 'humanoid',
  ac: 16, hp: 50, speed: 40, abil: A(12, 18, 14, 10, 14, 14), saves: { dex: 6, wis: 4 },
  resist: ['fire'], condImmune: ['charmed'],
  actions: {
    dagger: melee('Dagger', 6, [['1d4+4', 'piercing'], ['1d6', 'fire']]),
    multi: multi(['dagger', 'dagger']),
    fireBolt: ranged('Fire Bolt', 6, [['2d10', 'fire']], { spell: true, weapon: false }),
    burningHands: save('Burning Hands', 'dex', 16, [['2d6', 'fire']], { half: true, spell: true, uses: 2, area: { type: 'engaged' } }),
    holdPerson: hold("Hold Person (Faith's Hold)", 16, { uses: 2 }),
    healingWord: healing('Healing Word', '2d4+2', { cost: 'bonus', uses: 2, below: 0.5, spell: true }),
    fireball: save('Fireball (reduced)', 'dex', 16, [['6d6', 'fire']], { half: true, spell: true, uses: 1, area: { type: 'near', max: 5, spread: 0.3 } }),
    invisibility: { kind: 'buff', name: 'Invisibility (BioTec shimmer)', uses: 2, self: true, effect: { cond: 'invisible', endsOnAttack: true } },
  },
  plan: [
    { use: 'fireball', if: (E, c) => E.enemiesOf(c).filter((t) => !t.down).length >= 2, chance: 0.7 },
    { use: 'holdPerson', if: (E, c) => !c.conc, chance: 0.25 },
    { use: 'invisibility', if: (E, c) => !E.has(c, 'invisible') && E.round === 1, chance: 0.5 },
    { use: 'burningHands', if: (E, c) => engagedCount(E, c) >= 2 },
    'multi',
    'fireBolt',
  ],
  bonusPlan: ['healingWord'],
  hooks: {
    // With advantage (from invisibility or surprise) the dagger's fire damage becomes 2d6.
    onHit: (E, c, ctx) => (ctx.act.name === 'Dagger' && ctx.mode === 'adv' ? { dmg: [['1d6', 'fire', 'with advantage']] } : null),
  },
  basic: 'dagger', oa: 'dagger',
});

// Faith's spell slots are tracked as shared uses per level: four 1st, three 2nd, two 3rd.
const prophet = [['1d6', 'fire']]; // The Mother Prophet: +1d6 whenever she deals fire damage
def('faithZeir', {
  name: 'Faith Zeir', battler: 'faith', cr: 5, type: 'humanoid', smart: true, pos: 'back', init: 3,
  ac: 15, hp: 63, abil: A(8, 14, 12, 12, 14, 18), saves: { str: -1, dex: 2, con: 1, int: 1, wis: 5, cha: 7 },
  resist: ['fire', 'psychic'], condImmune: ['charmed'],
  actions: {
    fireBolt: ranged('Fire Bolt', 7, [['2d10', 'fire'], ...prophet], { spell: true, weapon: false }),
    burningHands: save('Burning Hands', 'dex', 15, [['3d6', 'fire'], ...prophet], { half: true, spell: true, uses: 4, usesKey: 'l1', area: { type: 'engaged' } }),
    command: save('Command (grovel)', 'wis', 15, null, { spell: true, uses: 4, usesKey: 'l1', onFail: [prone] }),
    holdPerson: hold('Hold Person', 15, { uses: 3, usesKey: 'l2' }),
    scorchingRay: ranged('Scorching Ray', 7, [['2d6', 'fire'], ...prophet], { n: 3, spell: true, weapon: false, uses: 3, usesKey: 'l2' }),
    fireball: save('Fireball', 'dex', 15, [['8d6', 'fire'], ...prophet], { half: true, spell: true, uses: 2, usesKey: 'l3', area: { type: 'near', max: 5, spread: 0.3 } }),
    invisibility: { kind: 'buff', name: 'Invisibility', spell: true, uses: 2, usesKey: 'l3', self: true, effect: { cond: 'invisible', endsOnAttack: true } },
    healingWord: healing('Healing Word', '1d4+4', { cost: 'bonus', uses: 4, usesKey: 'l1', below: 0.5, spell: true }),
  },
  plan: [
    { use: 'fireball', if: (E, c) => E.enemiesOf(c).filter((t) => !t.down).length >= 2 },
    { use: 'holdPerson', if: (E, c) => !c.conc, chance: 0.3 },
    { use: 'burningHands', if: (E, c) => engagedCount(E, c) >= 2 },
    'scorchingRay',
    'fireBolt',
  ],
  bonusPlan: ['healingWord'],
  reactions: [{
    // The image is cut off after "taking 2d10 fire damage"; run here as full on a failure, none on a success.
    id: 'emberShield', name: 'Ember Shield', trigger: 'damaged', uses: 3,
    when: (E, me, ctx) => E.active(ctx.src) && ctx.src.side !== me.side,
    run(E, me, ctx) { E.saveEffect(me, { name: 'Ember Shield', save: 'dex', dc: 15, dmg: [['2d10', 'fire'], ...prophet] }, [ctx.src]); },
  }],
  hooks: {
    onDamaged(E, c) {
      if (c.memo.nova || c.hp > c.maxHp / 2 || c.hp <= 0) return;
      c.memo.nova = true;
      const hit = [...c.engaged].map((id) => E.get(id)).filter((t) => t && E.present(t));
      E.log('act', `${c.name} is at half her hit points: Ember Nova.`, c);
      if (hit.length) E.saveEffect(c, { name: 'Ember Nova', save: 'dex', dc: 15, dmg: [['3d6', 'fire'], ...prophet], half: true, isArea: true }, hit);
    },
  },
  basic: 'fireBolt',
});

// ---------------------------------------------------------------------------------------
// The Iron Veil
// ---------------------------------------------------------------------------------------
def('ironVeilSoldier', {
  name: 'Iron Veil Soldier', cr: 5, type: 'humanoid', init: 3, concAdv: true,
  ac: 17, hp: 55, abil: A(12, 16, 13, 10, 12, 16), saves: { str: 8, dex: 9, con: 8, int: 3, wis: 3, cha: 9 },
  actions: {
    sword: melee('Longsword +1 (pact weapon)', 7, [['1d8+6', 'slashing']]),
    multi: multi(['sword', 'sword']),
    eb: ranged('Eldritch Blast', 7, [['1d10+3', 'force']], { n: 2, spell: true, weapon: false }),
    holdPerson: hold('Hold Person', 14, { uses: 2, usesKey: 'slot' }),
    command: save('Command (grovel)', 'wis', 14, null, { spell: true, uses: 2, usesKey: 'slot', onFail: [prone] }),
  },
  plan: [{ use: 'holdPerson', if: (E, c) => !c.conc, chance: 0.2 }, 'multi', 'eb'],
  reactions: [{
    id: 'rebuke', name: 'Hellish Rebuke', trigger: 'damaged', spell: true,
    when: (E, me, ctx) => (me.used.slot || 0) < 2 && E.active(ctx.src) && ctx.src.side !== me.side,
    run(E, me, ctx) {
      me.used.slot = (me.used.slot || 0) + 1;
      E.saveEffect(me, { name: 'Hellish Rebuke', save: 'dex', dc: 14, dmg: [['4d10', 'fire']], half: true, spell: true }, [ctx.src]);
    },
  }],
  hooks: {
    // Vex: advantage on the next attack against the same target
    afterHit(E, c, ctx) { if (ctx.act.name.startsWith('Longsword')) c.turn.advNext = 'Vex'; },
  },
  basic: 'sword', oa: 'sword',
});

def('honorGuard', {
  name: 'Honor Guard', cr: 7, type: 'undead', tags: ['honourDead'],
  ac: 19, hp: 125, abil: A(18, 12, 18, 10, 12, 14), saves: { str: 14, dex: 6, con: 13, int: -1, wis: 4, cha: 2 },
  // The block reads "Bludgeoning, Piercing, and Slashing from Magical Attacks". It is run as the usual
  // resistance to nonmagical weapons, which does nothing against the party's magic weapons.
  resist: ['necrotic', 'poison'], condImmune: ['charmed', 'frightened', 'poisoned'], undeadFortitude: true,
  actions: {
    greatsword: melee('Greatsword', 8, [['2d8+4', 'slashing'], ['1d6', 'necrotic']]),
    multi: multi(['greatsword', 'greatsword']),
    beam: ranged('Necrotic Beam', 7, [['3d8', 'necrotic']], {
      recharge: 4, weapon: false,
      onHit: [{ fx: 'call', run: (E, src, tgt, ctx) => {
        const esther = E.alliesOf(src).find((a) => E.hasTag(a, 'lordCommander') && E.active(a));
        if (esther && ctx.necrotic) E.heal(esther, Math.floor(ctx.necrotic / 2), src, 'the Necrotic Beam');
      } }],
    }),
  },
  plan: [{ use: 'beam', if: (E, c) => engagedCount(E, c) === 0 }, 'multi', 'beam'],
  reactions: [{ ...parry(3), name: 'Deathless Parry' }],
  hooks: {
    // Bound to Esther: advantage on saves while she is near
    onTurnStart(E, c) {
      const near = E.alliesOf(c).some((a) => E.hasTag(a, 'lordCommander') && E.active(a));
      c.fx = c.fx.filter((f) => f.id !== 'bound');
      if (near) c.fx.push({ id: 'bound', name: 'Bound to Esther', advSave: 'all', srcId: c.id });
    },
    // Necrotic Death is run when the guard is actually destroyed.
    onDeath: deathBurst('Necrotic Death', 'dex', 15, [['3d6', 'necrotic']]),
  },
  basic: 'greatsword', oa: 'greatsword',
});

// The image is cut off at the bottom of her Spellcasting entry. Her spells here are inferred from her
// being a high-level warlock (Dave, 2026-10-11): four 5th-level pact slots, save DC 18, spent on
// Synaptic Static, Hold Monster, Banishment and Counterspell. Misty Step is already on the block.
const smite = (E, c, ctx) => {
  if (ctx.act.name !== 'Crimson Sun' || E.current !== c || c.turn.smote) return null;
  const tiers = [['smite3', 1, '4d8'], ['smite2', 2, '3d8'], ['smite1', 3, '2d8']];
  const out = { dmg: [], fx: [] };
  for (const [key, max, dice] of tiers) {
    if ((c.used[key] || 0) < max) {
      c.used[key] = (c.used[key] || 0) + 1;
      c.turn.smote = true;
      out.dmg.push([dice, 'radiant', 'Smite']);
      break;
    }
  }
  if (!c.turn.maneuver && !E.has(ctx.tgt, 'prone')) {
    c.turn.maneuver = true;
    out.fx.push({ fx: 'save', ability: 'str', dc: 17, onFail: [prone], serious: true });
  }
  return out;
};
const throwAct = (dc, o = {}) => save('Telekinetic Throw', 'str', dc, [['4d8', 'bludgeoning']], { onFail: [{ fx: 'push', label: 'thrown' }, prone], ...o });

def('lordCommanderEsther', {
  name: 'Lord Commander Esther Crona', battler: 'esther', cr: 16, type: 'humanoid', tags: ['lordCommander'], smart: true, boss: true, init: 4,
  ac: 22, hp: 320, abil: A(18, 16, 16, 12, 14, 20), saves: { str: 17, dex: 15, con: 17, int: 1, wis: 15, cha: 20 },
  resist: ['fire', 'psychic'], condImmune: ['charmed', 'frightened'], lr: 3, leg: 3, auraSave: 4,
  actions: {
    sun: melee('Crimson Sun', 11, [['2d6+6', 'slashing'], ['1d8', 'force']]),
    beam: ranged('Eldritch Blast (one beam)', 10, [['1d10+5', 'force']], { spell: true, weapon: false }),
    multi: multi(['sun', 'sun', 'sun'], ['beam', 'beam', 'beam']),
    throw: throwAct(17, { recharge: 5 }),
    throwLeg: throwAct(18, { hidden: true }),
    thunderStep: {
      kind: 'special', name: 'Thunder Step', recharge: 5, noTarget: true,
      when: (E, c) => engagedCount(E, c) >= 2,
      run(E, c) {
        const left = [...c.engaged].map((id) => E.get(id)).filter((t) => t && E.present(t));
        breakAll(E, c);
        E.log('move', `${c.name} thunder steps away.`, c);
        E.saveEffect(c, { name: 'Thunder Step', save: 'con', dc: 18, dmg: [['4d10', 'thunder']], half: true, isArea: true }, left);
      },
    },
    layOnHands: {
      kind: 'special', name: 'Lay on Hands', cost: 'bonus', noTarget: true,
      when: (E, c) => (c.memo.loh ?? 40) > 0 && c.hp < c.maxHp * 0.5,
      run(E, c) { const amt = c.memo.loh ?? 40; c.memo.loh = 0; E.log('act', `${c.name} lays on hands.`, c); E.heal(c, amt, c, 'Lay on Hands'); },
    },
    synapticStatic: save('Synaptic Static', 'int', 18, [['8d6', 'psychic']], { half: true, spell: true, uses: 4, usesKey: 'pact', area: { type: 'near', max: 4, spread: 0.3 } }),
    holdMonster: hold('Hold Monster', 18, { uses: 4, usesKey: 'pact' }),
    banishment: save('Banishment', 'cha', 18, null, { spell: true, conc: true, uses: 4, usesKey: 'pact', onFail: [{ fx: 'cond', cond: 'banished', name: 'Banishment', conc: true }] }),
    shockwave: save('Shockwave Burst', 'str', 18, [['2d8', 'force']], { half: true, onFail: [{ fx: 'push', label: 'Shockwave Burst' }], area: { type: 'engaged' } }),
  },
  plan: [
    { use: 'synapticStatic', if: (E, c) => E.round <= 2 && E.enemiesOf(c).filter((t) => !t.down).length >= 2, chance: 0.7 },
    { use: 'holdMonster', if: (E, c) => !c.conc, chance: 0.25 },
    { use: 'banishment', if: (E, c) => !c.conc && E.enemiesOf(c).filter((t) => !t.down).length >= 2, chance: 0.2 },
    'thunderStep', { use: 'throw', chance: 0.35 }, 'multi',
  ],
  bonusPlan: ['layOnHands'],
  legs: [
    { act: 'beam', cost: 1, w: 3 },
    { act: 'sun', cost: 2, w: 3, if: (E, c) => engagedCount(E, c) > 0 },
    { act: 'throwLeg', cost: 2, w: 2 },
    { act: 'shockwave', cost: 3, w: 2, if: (E, c) => engagedCount(E, c) >= 2 },
  ],
  reactions: [
    {
      // Aura of Vengeance: enemies near her have disadvantage on their first attack roll each round
      id: 'vengeance', name: 'Aura of Vengeance', trigger: 'turnStart', who: 'enemy', free: true,
      when: (E, me, ctx) => !ctx.subject.down && ctx.subject.engaged.has(me.id),
      run(E, me, ctx) { ctx.subject.turn.disFirst = 'Aura of Vengeance'; },
    },
    {
      id: 'counterspell', name: 'Counterspell', trigger: 'spellCast', who: 'enemy', spell: true,
      when: (E, me, ctx) => (me.used.pact || 0) < 4 && ctx.level >= 3,
      run(E, me, ctx) {
        me.used.pact = (me.used.pact || 0) + 1;
        E.log('act', `${me.name} casts Counterspell at ${ctx.caster.name}'s ${ctx.act.name} (DC 18 CON).`, me);
        const r = E.save(ctx.caster, 'con', 18, { spell: true, lr: false });
        if (!r.success) ctx.countered = true;
      },
    },
    { ...parry(4) },
    {
      id: 'mistyEscape', name: 'Misty Escape', trigger: 'preDamage', uses: 2,
      when: (E, me, ctx) => ctx.total >= 25 || me.hp < me.maxHp * 0.4,
      run(E, me, ctx) {
        ctx.mult = 0.5;
        ctx.note = 'Misty Escape halves it';
        E.log('act', `${me.name} uses Misty Escape.`, me);
        breakAll(E, me);
        E.addFx(me, { cond: 'invisible', name: 'Misty Escape', endsOnAttack: true, ends: { who: me.id, when: 'start', turns: 1 } }, me);
      },
    },
    {
      id: 'forceChoke', name: 'Force Choke', trigger: 'hitBy',
      run(E, me, ctx) {
        E.saveEffect(me, { name: 'Force Choke', save: 'con', dc: 17, dmg: [['3d10', 'force']], half: true, onFail: [cond('restrained', { name: 'Force Choke', dur: nextTurnEnd })] }, [ctx.att]);
      },
    },
  ],
  hooks: { onHit: smite },
  basic: 'sun', oa: 'sun',
});

// ---------------------------------------------------------------------------------------
// Umbra and the Zeirs
// ---------------------------------------------------------------------------------------
def('recruiter', {
  name: 'Recruiter', cr: 2, type: 'humanoid',
  ac: 13, hp: 27, abil: A(10, 14, 12, 12, 10, 16), saves: { wis: 2, cha: 5 }, condImmune: ['charmed'],
  actions: {
    syringe: melee('Umbra Syringe', 5, [], {
      uses: 2, weapon: false,
      onHit: [{ fx: 'call', run: (E, src, tgt) => {
        const r = E.save(tgt, 'wis', 13, { serious: true });
        const d = rollDice(E.rng, r.success ? '1d6' : '2d6');
        E.damage(tgt, [{ amt: d.total, type: 'poison' }], src, { rollText: `${d.text} poison` });
        if (r.success || !E.alive(tgt)) return;
        E.addFx(tgt, { id: 'umbra', name: 'Umbra (weak-willed)', disSave: ['wis', 'cha'], announce: true, ends: { who: tgt.id, when: 'end', turns: 1 } }, src);
        tgt.memo.umbraFails = (tgt.memo.umbraFails || 0) + 1;
        if (tgt.memo.umbraFails >= 2) {
          E.log('cond', `${tgt.name} has failed two syringe saves and is Umbra Drugged.`, tgt);
          E.breakConc(tgt);
          E.addFx(tgt, { id: 'umbraDrugged', name: 'Umbra Drugged', cond: 'noReactions', disSave: 'all', disAtk: true, saveEnds: { ability: 'con', dc: 13 }, ends: { who: tgt.id, when: 'end', turns: 10 } }, src);
        }
      } }],
    }),
    triggered: ranged('Triggered', 5, [['1d8+3', 'psychic']], { spell: true, weapon: false }),
    magicMissile: {
      kind: 'special', name: 'Magic Missile', spell: true, uses: 4,
      aiTarget: (E, c) => E.ai.pickTarget(E, c, null),
      run(E, c, act, choice) {
        const t = E.get(choice.targets[0]);
        if (!t) return;
        const d = rollDice(E.rng, '3d4+3');
        E.log('act', `${c.name} casts Magic Missile at ${t.name}.`, c);
        E.damage(t, [{ amt: d.total, type: 'force' }], c, { rollText: `${d.text} force` });
      },
    },
  },
  plan: [{ use: 'syringe', if: (E, c) => engagedCount(E, c) > 0 }, { use: 'magicMissile', chance: 0.6 }, 'triggered'],
  reactions: [{
    id: 'powder', name: 'Umbra Powder Burst', trigger: 'damaged', uses: 1,
    when: (E, me, ctx) => ctx.src && me.engaged.has(ctx.src.id) && E.active(ctx.src),
    run(E, me, ctx) {
      E.saveEffect(me, { name: 'Umbra Powder Burst', save: 'wis', dc: 13, dmg: [['1d4+2', 'poison']], onFail: [{ fx: 'effect', effect: { id: 'powder', name: 'Umbra powder', disAtk: true, oneAttack: true }, dur: nextTurnEnd }] }, [ctx.src]);
    },
  }],
  basic: 'triggered', oa: 'syringe',
});

// Not run: Human Shield and Cattle Blood Feast (both need a captive or a performer beside him), and
// Shatter the Glass (he leaves). His beast form has legendary actions on the block but no changed
// statistics, so only the legendary options change when he unmasks.
def('malrikZeir', {
  name: 'Malrik Zeir', battler: 'malrik', cr: 13, type: 'undead', tags: ['vampire'], smart: true, boss: true, init: 14, eyeless: true,
  ac: 18, hp: 168, speed: 40, abil: A(20, 18, 18, 19, 16, 21), saves: { str: 10, dex: 9, con: 4, int: 4, wis: 8, cha: 10 },
  immune: ['cold', 'necrotic'], condImmune: ['charmed', 'exhaustion'], lr: 3, leg: 3,
  actions: {
    chain: melee('Zeir Binding Chain', 10, [['2d8+5', 'bludgeoning'], ['3d8', 'necrotic']], {
      onHit: [{ fx: 'save', ability: 'str', dc: 18, serious: true, onFail: [{ fx: 'grapple', dc: 18 }, cond('restrained', { name: 'the chain', dur: { who: 'src', when: 'end', turns: 2 } })] }],
    }),
    drain: ranged('Umbra Drain', 10, [['4d8+5', 'necrotic']], {
      weapon: false, noRangePenalty: true,
      onHit: [{ fx: 'healSelf', amount: 'dealtNecrotic', label: 'Umbra Drain' }, { fx: 'save', ability: 'con', dc: 17, serious: true, onFail: [{ fx: 'maxHp', amount: 'dealtNecrotic', label: 'Umbra Drain' }] }],
    }),
    multi: multi(['chain', 'drain']),
    hunger: save('Hunger of Umbra', 'con', 18, [['6d8', 'psychic']], {
      half: true, recharge: 5, area: { type: 'near', max: 5, spread: 0.4 },
      onFail: [cond('blinded', { name: 'Hunger of Umbra', dur: { who: 'src', when: 'end', turns: 1 } })],
    }),
    unmask: {
      kind: 'special', name: 'Unmask the Monster', noTarget: true,
      when: (E, c) => !c.memo.beast && c.hp < c.maxHp * 0.6,
      run(E, c) { c.memo.beast = true; E.log('act', `${c.name} unmasks: the beast form.`, c); },
    },
    buffet: save('Wing Buffet', 'dex', 18, [['2d6', 'bludgeoning']], { onFail: [prone], area: { type: 'engaged' } }),
  },
  plan: ['hunger', 'multi', 'drain'],
  legs: [
    { act: 'chain', cost: 1, w: 3, if: (E, c) => !c.memo.beast },
    { act: 'unmask', cost: 3, w: 9 },
    { act: 'buffet', cost: 1, w: 3, if: (E, c) => c.memo.beast && engagedCount(E, c) >= 1 },
    { act: 'drain', cost: 2, w: 3, if: (E, c) => c.memo.beast },
  ],
  reactions: [
    {
      // Elegant Deflection: once per turn, 15 less damage from an attack that hits him
      id: 'deflection', name: 'Elegant Deflection', trigger: 'preDamage', free: true,
      when: (E, me, ctx) => me.memo.deflected !== E.turnCount && ctx.total > 0,
      run(E, me, ctx) {
        me.memo.deflected = E.turnCount;
        ctx.mult = Math.max(0, ctx.total - 15) / ctx.total;
        ctx.note = 'Elegant Deflection -15';
      },
    },
    {
      id: 'recoil', name: 'Umbra Recoil', trigger: 'preDamage',
      when: (E, me, ctx) => ctx.total * ctx.mult >= 18,
      run(E, me, ctx) {
        ctx.mult *= 0.5;
        ctx.note = `${ctx.note ? ctx.note + ', ' : ''}Umbra Recoil halves it`;
        E.log('act', `${me.name} recoils 20 feet in a blur of Umbra.`, me);
        breakAll(E, me);
      },
    },
  ],
  basic: 'chain', oa: 'chain',
});

// ---------------------------------------------------------------------------------------
// BioTec
// ---------------------------------------------------------------------------------------
def('cogbornInfected', {
  name: 'Cogborn Infected', cr: 3, type: 'aberration', init: 1,
  ac: 14, hp: 52, speed: 20, abil: A(14, 12, 14, 7, 10, 6),
  actions: {
    tentacle: melee('Tentacle', 6, [['2d6+4', 'bludgeoning']]),
    blast: ranged('Psychic Blast', 6, [['4d4', 'psychic']], { weapon: false }),
    multi: multi(['tentacle', 'tentacle'], ['blast', 'blast'], ['tentacle', 'blast']),
    // "Recharge 2" on the block is run as recharging on a 2 or better.
    pulse: save('Mind-Rot Pulse', 'wis', 12, [['3d6', 'psychic']], { half: true, recharge: 2, area: { type: 'engaged' } }),
    hold: save('Tentacle Hold', 'dex', 12, null, { cost: 'bonus', recharge: 6, onFail: [{ fx: 'grapple', dc: 14 }] }),
  },
  plan: [{ use: 'pulse', if: (E, c) => engagedCount(E, c) >= 2 }, 'multi'],
  bonusPlan: ['hold'],
  basic: 'tentacle', oa: 'tentacle',
});

def('edenHybridUnit', {
  name: 'E.D.E.N. Hybrid Unit', battler: 'husk', cr: 6, type: 'undead', tags: ['edenUnit'],
  ac: 18, hp: 45, speed: 40, abil: A(20, 14, 16, 3, 10, 5), saves: { str: 15, dex: 7, con: 12, int: -5, wis: 3, cha: -3 },
  resist: ['necrotic', 'lightning'], condImmune: ['charmed', 'exhaustion', 'frightened', 'paralysed', 'poisoned'],
  actions: {
    armblade: melee('Armblade', 8, [['1d10+8', 'force']], { onHit: [{ fx: 'save', ability: 'str', dc: 15, onFail: [prone] }] }),
    cannon: ranged('Arm Cannon', 8, [['2d8+8', 'force']], { onHit: [{ fx: 'push', label: 'Arm Cannon' }] }),
    surge: {
      kind: 'special', name: 'Action Surge', cost: 'free', uses: 1, noTarget: true,
      run(E, c) { c.turn.action = true; c.turn.surged = true; E.log('act', `${c.name} uses Action Surge.`, c); },
    },
    secondWind: healing('Second Wind', '1d10+8', { cost: 'bonus', uses: 2, self: true }),
  },
  // one attack a turn as written; it surges on its first turn in melee
  brain(E, c) {
    if (c.turn.bonus && c.hp < c.maxHp * 0.5 && E.usable(c, 'secondWind')) return { act: 'secondWind' };
    const pick = () => {
      const m = E.ai.pickTarget(E, c, E.action(c, 'armblade'));
      if (m) return { act: 'armblade', targets: [m.id] };
      const r = E.ai.pickTarget(E, c, E.action(c, 'cannon'));
      return r ? { act: 'cannon', targets: [r.id] } : null;
    };
    if (c.turn.action) return pick() || ((c.turn.action = false), null);
    if (!c.turn.surged && E.usable(c, 'surge')) return { act: 'surge' };
    return null;
  },
  hooks: {
    // Its own Undead Fortitude: a d6, even stands back up at 1 HP; a critical hit always destroys it.
    onZero(E, c, ctx) {
      if (ctx.crit) return null;
      const r = E.rng.int(6);
      E.log('info', `${c.name} Undead Fortitude: d6 ${r}, ${r % 2 === 0 ? 'even, back at 1 HP' : 'odd, destroyed'}.`, c);
      if (r % 2 === 0) { c.hp = 1; return 'handled'; }
      return null;
    },
    onDeath: deathBurst('Force Pulse', 'dex', 15, [['6d6', 'lightning']], [{ fx: 'push', label: 'Force Pulse' }]),
  },
  basic: 'armblade', oa: 'armblade',
});

// ---------------------------------------------------------------------------------------
// House Lyrandar
// ---------------------------------------------------------------------------------------
// Not run: Gust of Wind, Cunning Action, Storm Step, Disarming Attack and Precision Attack.
def('hallorn', {
  name: "Hallorn d'Lyrandar", battler: 'hallorn', cr: 5, type: 'humanoid', smart: true, init: 8,
  ac: 16, hp: 72, speed: 35, abil: A(12, 18, 14, 12, 12, 18), saves: { dex: 7, cha: 7 }, resist: ['lightning'],
  actions: {
    rapier: melee("Rapier (Tempest's Kiss)", 7, [['1d8+5', 'piercing']]),
    crossbow: ranged('Hand Crossbow (Skybreaker)', 7, [['1d6+5', 'piercing']]),
    multi: multi(['rapier', 'rapier'], ['crossbow', 'crossbow']),
    thunderclap: save('Thunderclap', 'con', 15, [['2d6', 'thunder']], { area: { type: 'engaged' } }),
  },
  plan: [{ use: 'thunderclap', if: (E, c) => engagedCount(E, c) >= 3 }, 'multi'],
  reactions: [
    { ...parry(3), when: (E, me, ctx) => ctx.melee && !ctx.crit && ctx.total < E.acOf(me) + 3 },
    {
      id: 'riposte', name: 'Riposte', trigger: 'missed',
      when: (E, me, ctx) => ctx.melee && (me.used.sup || 0) < 4 && E.active(ctx.att),
      run(E, me, ctx) {
        me.used.sup = (me.used.sup || 0) + 1;
        me.turn.riposte = true;
        E.log('act', `${me.name} ripostes.`, me);
        E.attack(me, ctx.att, E.action(me, 'rapier'), {});
        me.turn.riposte = false;
      },
    },
  ],
  hooks: {
    onHit(E, c, ctx) {
      const out = { dmg: [], fx: [] };
      if (c.turn.riposte) out.dmg.push(['1d8', 'piercing', 'Riposte']);
      // Sneak Attack once a turn: with advantage, or Rakish Audacity (he and his target alone together)
      const alone = ctx.melee && engagedCount(E, c) === 1;
      if (E.current === c && !c.turn.sneak && (ctx.mode === 'adv' || alone)) {
        c.turn.sneak = true;
        out.dmg.push(['3d6', 'piercing', 'Sneak Attack']);
      }
      if (E.current === c && !c.turn.trip && (c.used.sup || 0) < 3 && !E.has(ctx.tgt, 'prone')) {
        c.turn.trip = true;
        c.used.sup = (c.used.sup || 0) + 1;
        out.dmg.push(['1d8', 'piercing', 'Trip Attack']);
        out.fx.push({ fx: 'save', ability: 'str', dc: 15, onFail: [prone], serious: true });
      }
      return out;
    },
  },
  basic: 'rapier', oa: 'rapier',
});

register({
  creatures: S,
  library: [
    { group: 'Sharn: the Iron Veil', ids: ['lordCommanderEsther', 'honorGuard', 'ironVeilSoldier'] },
    { group: 'Sharn: the Children of Ember', ids: ['faithZeir', 'childOfEmber'] },
    { group: 'Sharn: Umbra', ids: ['malrikZeir', 'recruiter'] },
    { group: 'Sharn: BioTec', ids: ['edenHybridUnit', 'cogbornInfected'] },
    { group: 'Sharn: House Lyrandar', ids: ['hallorn'] },
  ],
});

export const SHARN_IDS = Object.keys(S);
