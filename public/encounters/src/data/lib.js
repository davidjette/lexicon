// Builders for creature data. They keep the stat-block transcriptions short and readable.

import { rollDice } from '../engine/dice.js?v=mv9nlcei';
import { enemiesInAura, areaTargets } from '../engine/zones.js?v=mv9nlcei';

// Melee attack. dmg is [[dice, type], ...]
export const melee = (name, toHit, dmg, o = {}) => ({ kind: 'attack', name, toHit, melee: true, dmg, ...o });
export const ranged = (name, toHit, dmg, o = {}) => ({ kind: 'attack', name, toHit, melee: false, dmg, ...o });
export const save = (name, ability, dc, dmg, o = {}) => ({ kind: 'save', name, save: ability, dc, dmg, ...o });
export const multi = (...options) => ({ kind: 'multi', name: 'Multiattack', options });

// "DC n Wisdom save or (dice) necrotic", the order's Toll.
export const toll = (dc, dice) => save('Toll', 'wis', dc, [[dice, 'necrotic']], { half: false });

export const cond = (c, o = {}) => ({ fx: 'cond', cond: c, ...o });
export const prone = { fx: 'prone' };
export const saveOr = (ability, dc, onFail, o = {}) => ({ fx: 'save', ability, dc, onFail, ...o });

// An order: up to `n` allies matching `filter` each make one attack with their basic action.
export function order(name, { n = 1, filter, cost = 'action', legCost, text } = {}) {
  const pick = (E, c) =>
    E.alliesOf(c).filter((a) => E.active(a) && !E.incapacitated(a) && a.reaction && a.tpl.basic && (!filter || filter(E, a, c)));
  return {
    kind: 'special',
    name,
    cost,
    legCost,
    noTarget: true,
    when: (E, c) => pick(E, c).length > 0,
    run(E, c) {
      const pool = pick(E, c);
      E.log('act', `${c.name}: ${name}.`, c);
      for (let i = 0; i < n && pool.length; i++) {
        const a = pool.splice(Math.floor(E.rng.next() * pool.length), 1)[0];
        const act = E.action(a, a.tpl.basic);
        const t = E.ai.pickTarget(E, a, act);
        if (!t) continue;
        a.reaction = false;
        E.log('info', `${a.name} ${text || 'moves and attacks on the order'}.`, a);
        if (act.kind === 'save') E.saveEffect(a, act, [t]);
        else E.attack(a, t, act, {});
      }
    },
  };
}

export const isHonourDead = (E, a) => E.hasTag(a, 'honourDead');
export const isSister = (E, a) => E.hasTag(a, 'sister');
export const isVampire = (E, a) => E.hasTag(a, 'vampire');

// Bring creatures onto the field. list: [[tpl, n], ...] or a function returning that.
export function summon(name, list, o = {}) {
  return {
    kind: 'special',
    name,
    noTarget: true,
    ...o,
    run(E, c) {
      const spawn = typeof list === 'function' ? list(E, c) : list;
      const names = [];
      for (const [tpl, n] of spawn) {
        for (let i = 0; i < n; i++) {
          const s = E.spawn(tpl, { side: c.side, name: E.nameFor(tpl, c.side), after: c });
          s.summonedBy = c.id;
          if (o.halfHp) s.hp = Math.floor(s.maxHp / 2);
          names.push(s.name);
        }
      }
      E.log('act', `${c.name}: ${name}. ${names.join(', ')} ${names.length > 1 ? 'join' : 'joins'} the fight.`, c);
    },
  };
}

// Raise corpses already on the field (limited by how many have died).
export function raise(name, tpl, max, o = {}) {
  return {
    kind: 'special',
    name,
    noTarget: true,
    ...o,
    when: (E) => E.corpses > 0,
    run(E, c) {
      const n = Math.min(max, E.corpses);
      E.corpses -= n;
      const names = [];
      for (let i = 0; i < n; i++) {
        const s = E.spawn(tpl(), { side: c.side, name: E.nameFor(tpl(), c.side), after: c });
        if (o.halfHp) s.hp = Math.floor(s.maxHp / 2);
        names.push(s.name);
      }
      E.log('act', `${c.name}: ${name}. ${n} of the dead stand up: ${names.join(', ')}.`, c);
    },
  };
}

// hold person / hold monster: Wisdom save or paralysed, repeat at the end of each turn, concentration.
export function hold(name, dc, o = {}) {
  return save(name, 'wis', dc, null, {
    spell: true,
    conc: true,
    onFail: [{ fx: 'cond', cond: 'paralysed', name, saveEnds: { ability: 'wis', dc, spell: true }, conc: true }],
    ...o,
  });
}

export function banishment(dc, o = {}) {
  return save('Banishment', 'cha', dc, null, {
    spell: true,
    conc: true,
    onFail: [{ fx: 'cond', cond: 'banished', name: 'Banishment', conc: true }],
    ...o,
  });
}

// Emanation centred on the caster. `on` says when it bites: 'enemyStart', 'enemyEnd', 'casterTurn'.
export function emanation(name, { save: ability = 'wis', dc, dmg, on = ['enemyStart'], onFail, conc = true, ...o }) {
  return {
    kind: 'special',
    name,
    spell: true,
    conc,
    selfManaged: true,
    noTarget: true,
    ...o,
    run(E, c, act, choice) {
      const dice = typeof dmg === 'function' ? dmg(choice.level) : dmg;
      E.log('act', `${c.name} casts ${name}${choice.level ? ` with a level ${choice.level} slot` : ''}.`, c);
      if (conc) E.concentrate(c, name);
      c.memo.concLevel = choice.level || 3;
      E.addFx(c, { id: name, name, conc: conc ? c.id : undefined, aura: { save: ability, dc, dmg: dice, on, onFail } }, c);
      if (on.includes('casterTurn')) E.auraSweep(c);
    },
  };
}

export const hasAura = (E, c, name) => c.fx.some((f) => f.id === name);

// harm: 14d6 necrotic, Constitution save for half, and the maximum drops by the damage taken on a failure.
export function harm(dc, o = {}) {
  return save('Harm', 'con', dc, [['14d6', 'necrotic']], {
    spell: true,
    half: true,
    onFail: [{ fx: 'maxHp', amount: 'dealt', label: 'Harm' }],
    ...o,
  });
}

// A flat heal on self or an ally, as an action.
export function healing(name, dice, o = {}) {
  return { kind: 'heal', name, dice, ...o };
}

// Reaction: an undead ally that would drop stays at `hp`.
export function standAt(id, name, hp, filter, o = {}) {
  return {
    id,
    name,
    trigger: 'dropping',
    who: 'ally',
    ...o,
    when: (E, me, ctx) => filter(E, ctx.tgt),
    run(E, me, ctx) {
      ctx.saved = true;
      ctx.tgt.hp = hp;
      E.log('info', `${me.name} uses ${name}: ${ctx.tgt.name} stays up at ${hp} HP.`, me);
    },
  };
}

export const parry = (bonus = 5) => ({
  id: 'parry',
  name: 'Parry',
  trigger: 'attacked',
  when: (E, me, ctx) => ctx.melee && !ctx.crit && ctx.total < E.acOf(me) + bonus,
  run(E, me, ctx) {
    ctx.acBonus += bonus;
    E.log('info', `${me.name} parries: +${bonus} AC against this attack.`, me);
  },
});

export { rollDice, enemiesInAura, areaTargets };
