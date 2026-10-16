// The feature book: class features, feats, chosen options and species traits, keyed by the name on the
// sheet. Each entry takes the imported character and returns a "part" (actions, plan entries, reactions,
// hooks, flags) or null when the feature does not apply. applyParts() merges the parts into the template.
//
// Templates are shared between fights, so nothing here keeps state in a closure: counters live on the
// combatant (c.used, c.memo) and per-turn flags on c.turn.

import { avgDice, rollDice } from '../engine/dice.js?v=mvacy1e5';
import { slotLevels, sorceryPoints, cast, SPELLS } from './spells.js?v=mvacy1e5';
import { melee as meleeAttack } from './lib.js?v=mvacy1e5';
import { isEngaged } from '../engine/zones.js?v=mvacy1e5';
import { steelDefender, drake, primalBeast, cannon, formFrom, shape, unshape } from './companions.js?v=mvacy1e5';

const foes = (E, c) => E.enemiesOf(c).filter((t) => !t.down);
const friends = (E, c) => E.alliesOf(c).filter((a) => E.active(a));
const engagedNow = (E, c) => [...c.engaged].some((id) => E.active(E.get(id)));
const used = (c, k) => c.used[k] || 0;
const spendUse = (c, k) => { c.used[k] = used(c, k) + 1; };
const weaponHit = (ctx) => !ctx.act.spell && ctx.act.weapon !== false;
const untilMyNextTurn = { who: 'src', when: 'start', turns: 1 };

// ---------------------------------------------------------------------------------------------
// Fighter
// ---------------------------------------------------------------------------------------------
const secondWind = (x) => ({
  actions: { secondWind: { kind: 'heal', name: 'Second Wind', dice: `1d10+${x.lvl('fighter')}`, self: true, cost: 'bonus', uses: x.uses('second wind', 1) } },
  bonusFirst: ['secondWind'],
});

const actionSurge = (x) => ({
  actions: {
    surge: {
      kind: 'special', name: 'Action Surge', cost: 'free', uses: x.uses('action surge', x.lvl('fighter') >= 17 ? 2 : 1), noTarget: true,
      when: (E, c) => !c.turn.action && !c.turn.surged && foes(E, c).length > 0,
      run(E, c) { c.turn.action = true; c.turn.surged = true; E.log('act', `${c.name} uses Action Surge.`, c); },
    },
  },
  free: ['surge'],
});

const indomitable = (x) => {
  const n = x.uses('indomitable', x.lvl('fighter') >= 17 ? 3 : x.lvl('fighter') >= 13 ? 2 : 1);
  return {
    hooks: {
      rerollSave(E, c, ctx) {
        if (ctx.o.conc || used(c, 'indomitable') >= n) return null;
        spendUse(c, 'indomitable');
        return 'Indomitable';
      },
    },
  };
};

// Battle Master manoeuvres: one pool of superiority dice, c.used.sup. One manoeuvre a turn on a hit,
// chosen in this order from those the character knows: Trip, Menacing, Goading, Pushing, Disarming.
const battleMaster = (x) => {
  const L = x.lvl('fighter');
  const n = x.uses('superiority dice', L >= 15 ? 6 : L >= 7 ? 5 : L >= 3 ? 4 : 1);
  const die = `1d${L >= 18 ? 12 : L >= 10 ? 10 : x.y2024 && L < 3 ? 6 : 8}`;
  const dc = 8 + x.prof + Math.max(x.mod('str'), x.mod('dex'));
  const knows = (m) => x.has(m) || x.has(`${m} (str.)`) || x.has(`${m} (dex.)`);
  const left = (c) => n - used(c, 'sup');
  const part = {
    hooks: {
      onHit(E, c, ctx) {
        if (c.turn.riposte && weaponHit(ctx)) return { dmg: [[die, ctx.act.dmg[0][1], 'Riposte']] };
        if (E.current !== c || c.turn.manoeuvre || !weaponHit(ctx) || left(c) <= 0) return null;
        const t = ctx.tgt;
        const type = ctx.act.dmg[0][1];
        const spend = (label, fx) => { c.turn.manoeuvre = true; spendUse(c, 'sup'); return { dmg: [[die, type, label]], fx: fx ? [fx] : [] }; };
        if (knows('trip attack') && !E.has(t, 'prone') && !E.condImmune(t, 'prone') && !['huge', 'gargantuan'].includes(t.tpl.size)) return spend('Trip Attack', { fx: 'save', ability: 'str', dc, onFail: [{ fx: 'prone' }] });
        if (knows('menacing attack') && !E.has(t, 'frightened') && !E.condImmune(t, 'frightened')) return spend('Menacing Attack', { fx: 'save', ability: 'wis', dc, onFail: [{ fx: 'cond', cond: 'frightened', name: 'Menacing Attack', dur: { who: 'src', when: 'end', turns: 1 } }] });
        if (knows('goading attack')) return spend('Goading Attack', { fx: 'save', ability: 'wis', dc, onFail: [{ fx: 'effect', effect: { id: 'goaded', name: 'Goading Attack', disAtk: true }, dur: { who: 'src', when: 'end', turns: 1 } }] });
        if (knows('pushing attack')) return spend('Pushing Attack', null);
        if (knows('disarming attack')) return spend('Disarming Attack', null);
        return null;
      },
    },
    reactions: [],
  };
  if (knows('precision attack')) {
    part.hooks.fixMiss = (E, c, ctx) => {
      if (ctx.act.spell || left(c) <= 0 || ctx.gap > 4 || ctx.nat === 1) return null;
      spendUse(c, 'sup');
      return { add: rollDice(E.rng, die).total, label: 'Precision Attack' };
    };
  }
  if (knows('riposte') && x.tpl.oa) {
    part.reactions.push({
      id: 'riposte', name: 'Riposte', trigger: 'missed',
      when: (E, me, ctx) => ctx.melee && left(me) > 0 && E.active(ctx.att),
      run(E, me, ctx) {
        spendUse(me, 'sup');
        E.log('act', `${me.name} ripostes.`, me);
        me.turn.riposte = true;
        E.attack(me, ctx.att, E.action(me, me.tpl.oa), {});
        me.turn.riposte = false;
      },
    });
  }
  if (knows('parry')) {
    const flat = x.mod('dex');
    part.reactions.push({
      id: 'parry', name: 'Parry', trigger: 'preDamage',
      when: (E, me, ctx) => ctx.o.melee && ctx.total >= 10 && left(me) > 0,
      run(E, me, ctx) {
        spendUse(me, 'sup');
        const r = rollDice(E.rng, `${die}+${flat}`);
        ctx.mult = Math.max(0, ctx.total - r.total) / ctx.total;
        ctx.note = `Parry takes off ${Math.min(r.total, ctx.total)}`;
      },
    });
  }
  return part;
};

// ---------------------------------------------------------------------------------------------
// Rogue
// ---------------------------------------------------------------------------------------------
const sneakAttack = (x) => {
  const dice = `${Math.ceil(x.lvl('rogue') / 2)}d6`;
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (E.current !== c || c.turn.sneak || !weaponHit(ctx)) return null;
        const friendNear = [...ctx.tgt.engaged].some((id) => id !== c.id && E.get(id) && E.get(id).side === c.side && E.active(E.get(id)));
        if (ctx.mode !== 'adv' && !friendNear && !(x.tpl.sneakAlone && x.tpl.sneakAlone(E, c, ctx))) return null;
        c.turn.sneak = true;
        return { dmg: [[dice, ctx.act.dmg[0][1], 'Sneak Attack']] };
      },
    },
  };
};

const cunningAction = (x) => ({
  actions: {
    cunning: {
      kind: 'special', name: 'Cunning Action (Disengage)', cost: 'bonus', noTarget: true,
      // an archer steps out before shooting; anyone badly hurt steps out when a friend can hold the line
      when: (E, c) => engagedNow(E, c) && ((x.weaponFirst && !x.frontline) || (c.hp < c.maxHp * 0.4 && friends(E, c).length > 0)),
      run(E, c) { c.turn.noOA = true; E.withdraw(c, { label: 'slips out of melee (Cunning Action)' }); },
    },
  },
  bonusFirst: ['cunning'],
});

// Steady Aim: the bonus action for advantage on the next attack this turn, when nothing else gives it
const steadyAim = (x) => ({
  actions: {
    steadyAim: {
      kind: 'special', name: 'Steady Aim', cost: 'bonus', noTarget: true,
      when: (E, c) => x.weaponFirst && c.turn.action && !c.turn.advNext && foes(E, c).length > 0 && !foes(E, c).some((t) => [...t.engaged].some((id) => id !== c.id && E.get(id) && E.get(id).side === c.side && E.active(E.get(id)))),
      run(E, c) { c.turn.advNext = 'Steady Aim'; E.log('act', `${c.name} takes a Steady Aim.`, c); },
    },
  },
  bonus: ['steadyAim'],
});

const uncannyDodge = () => ({
  reactions: [{
    id: 'uncannyDodge', name: 'Uncanny Dodge', trigger: 'preDamage',
    when: (E, me, ctx) => ctx.total >= Math.max(8, me.maxHp * 0.1),
    run(E, me, ctx) { ctx.mult = 0.5; ctx.note = 'Uncanny Dodge halves it'; },
  }],
});

const evasion = () => ({ flags: { evasion: true } });

// ---------------------------------------------------------------------------------------------
// Barbarian
// ---------------------------------------------------------------------------------------------
const rage = (x) => {
  const L = x.lvl('barbarian');
  const bonus = L >= 16 ? 4 : L >= 9 ? 3 : 2;
  return {
    actions: {
      rage: {
        kind: 'special', name: 'Rage', cost: 'bonus', noTarget: true, uses: x.uses('rage', x.uses('rage (enter)', L >= 17 ? 6 : L >= 12 ? 5 : L >= 6 ? 4 : L >= 3 ? 3 : 2)),
        when: (E, c) => !E.fxOf(c, 'rage') && foes(E, c).length > 0,
        run(E, c) {
          E.log('act', `${c.name} rages.`, c);
          E.breakConc(c);
          E.addFx(c, { id: 'rage', name: 'Rage', resist: ['bludgeoning', 'piercing', 'slashing'], advSave: ['str'], endsWhenDown: true }, c);
        },
      },
    },
    bonusFirst: ['rage'],
    hooks: {
      onHit(E, c, ctx) {
        if (!E.fxOf(c, 'rage') || !ctx.melee || !weaponHit(ctx)) return null;
        return { dmg: [[String(bonus), ctx.act.dmg[0][1], 'Rage']] };
      },
    },
  };
};

const recklessAttack = (x) => (x.frontline ? {
  hooks: {
    onTurnStart(E, c) {
      // while the rage halves what comes back, and not when already badly hurt
      if (!E.active(c) || !foes(E, c).length || !E.fxOf(c, 'rage') || c.hp < c.maxHp * 0.5) return;
      E.addFx(c, { id: 'reckless', name: 'Reckless Attack', advAgainst: true, ends: { who: c.id, when: 'start', turns: 1 } }, c);
    },
    attackMods(E, c, ctx) { return ctx.melee && E.fxOf(c, 'reckless') ? { adv: 'Reckless Attack' } : null; },
  },
} : null);

const dangerSense = () => ({ onStart(E, c) { E.addFx(c, { id: 'dangerSense', name: 'Danger Sense', advSave: ['dex'] }, c); } });
const feralInstinct = () => ({ flags: { initAdv: true } });

// ---------------------------------------------------------------------------------------------
// Monk. Ki (or Focus) is one pool, c.used.ki, shared by everything below.
// ---------------------------------------------------------------------------------------------
const kiOf = (x) => x.uses('ki points', x.uses('focus points', x.lvl('monk')));
const kiDc = (x) => 8 + x.prof + x.mod('wis');

const flurry = (x) => {
  const strike = x.tpl.actions.martialArts || x.tpl.actions.melee;
  if (!strike) return null;
  return {
    actions: { flurry: { ...strike, name: 'Flurry of Blows', cost: 'bonus', n: x.y2024 && x.lvl('monk') >= 10 ? 3 : 2, uses: kiOf(x), usesKey: 'ki' } },
    bonusFirst: ['flurry'],
  };
};

const patientDefense = (x) => ({
  actions: {
    patient: {
      kind: 'special', name: 'Patient Defense', cost: 'bonus', noTarget: true, uses: kiOf(x), usesKey: 'ki',
      when: (E, c) => c.hp < c.maxHp * 0.35 && engagedNow(E, c),
      run(E, c) {
        E.log('act', `${c.name} takes the Dodge action as a bonus action (Patient Defense).`, c);
        E.addFx(c, { id: 'dodge', name: 'Patient Defense', disAgainst: true, advSave: ['dex'], ends: { who: c.id, when: 'start', turns: 1 } }, c);
      },
    },
  },
  bonusFirst: ['patient'],
});

const stunningStrike = (x) => {
  const dc = kiDc(x);
  const ki = kiOf(x);
  return {
    hooks: {
      onHit(E, c, ctx) {
        const t = ctx.tgt;
        if (E.current !== c || c.turn.stun || !ctx.melee || !weaponHit(ctx) || used(c, 'ki') >= ki) return null;
        if (E.has(t, 'stunned') || E.condImmune(t, 'stunned') || t.hp < 20) return null;
        c.turn.stun = true;
        spendUse(c, 'ki');
        E.log('info', `${c.name} tries a Stunning Strike (DC ${dc} CON).`, c);
        return { fx: [{ fx: 'save', ability: 'con', dc, onFail: [{ fx: 'cond', cond: 'stunned', name: 'Stunning Strike', dur: { who: 'src', when: 'end', turns: 1 } }] }] };
      },
    },
  };
};

const deflect = (x) => {
  const flat = x.mod('dex') + x.lvl('monk');
  const any = !!x.f('deflect attack');
  return {
    reactions: [{
      id: 'deflect', name: any ? 'Deflect Attack' : 'Deflect Missiles', trigger: 'preDamage',
      when: (E, me, ctx) => (any || ctx.o.melee === false) && ctx.total >= 6,
      run(E, me, ctx) {
        const r = rollDice(E.rng, `1d10+${flat}`);
        ctx.mult = Math.max(0, ctx.total - r.total) / ctx.total;
        ctx.note = `${any ? 'Deflect Attack' : 'Deflect Missiles'} takes off ${Math.min(r.total, ctx.total)}`;
      },
    }],
  };
};

// ---------------------------------------------------------------------------------------------
// Paladin
// ---------------------------------------------------------------------------------------------
const divineSmite = (x) => ({
  hooks: {
    onHit(E, c, ctx) {
      if (!ctx.melee || !weaponHit(ctx)) return null;
      if (x.y2024 && (E.current !== c || !c.turn.bonus)) return null;
      const levels = slotLevels(c, 1);
      if (!levels.length) return null;
      // the biggest slot on a critical hit; otherwise the smallest, and nothing on a target that is nearly down
      if (!ctx.crit && ctx.tgt.hp < 15) return null;
      const l = ctx.crit ? levels[levels.length - 1] : levels[0];
      if (c.slots) c.slots[l] -= 1; else c.pact.n -= 1;
      if (x.y2024) c.turn.bonus = false;
      const holy = ['undead', 'fiend'].includes(ctx.tgt.tpl.type) ? 1 : 0;
      return { dmg: [[`${Math.min(5, 1 + l) + holy}d8`, 'radiant', `Divine Smite (level ${l} slot)`]] };
    },
  },
});

const improvedSmite = () => ({
  hooks: { onHit(E, c, ctx) { return ctx.melee && weaponHit(ctx) ? { dmg: [['1d8', 'radiant', 'Improved Divine Smite']] } : null; } },
});

const layOnHands = (x) => {
  const pool = 5 * x.lvl('paladin');
  const cost = x.y2024 ? 'bonus' : 'action';
  const left = (c) => c.memo.loh ?? pool;
  const pick = (E, c) => {
    if (left(c) <= 0) return null;
    const down = E.alliesOf(c).find((a) => a.down && !E.has(a, 'noHeal'));
    if (down) return down;
    return c.hp < c.maxHp * 0.35 ? c : null;
  };
  return {
    actions: {
      layOnHands: {
        kind: 'special', name: 'Lay on Hands', cost, ally: true, aiTarget: pick, when: (E, c) => !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || c;
          const amt = Math.min(left(c), t.down ? 10 : t.maxHp - t.hp);
          c.memo.loh = left(c) - amt;
          E.log('act', `${c.name} lays on hands: ${amt} HP to ${t === c ? 'themself' : t.name} (${c.memo.loh} left in the pool).`, c);
          E.heal(t, amt, c, 'Lay on Hands');
        },
      },
    },
    [cost === 'bonus' ? 'bonusFirst' : 'plan']: ['layOnHands'],
  };
};

const auraOfProtection = (x) => ({ flags: { auraSave: Math.max(1, x.mod('cha')) } });
const auraOfCourage = () => ({ flags: { auraCourage: true } });

// ---------------------------------------------------------------------------------------------
// Cleric
// ---------------------------------------------------------------------------------------------
const turnUndead = (x) => {
  const L = x.lvl('cleric');
  const destroy = L >= 17 ? 4 : L >= 14 ? 3 : L >= 11 ? 2 : L >= 8 ? 1 : L >= 5 ? 0.5 : -1;
  const pool = (E, c) => foes(E, c).filter((t) => t.tpl.type === 'undead' && !E.fxOf(t, 'turned'));
  return {
    actions: {
      turnUndead: {
        kind: 'special', name: 'Channel Divinity: Turn Undead', uses: x.uses('channel divinity', L >= 18 ? 3 : L >= 6 ? 2 : 1), usesKey: 'channel', noTarget: true,
        when: (E, c) => pool(E, c).length >= 2,
        run(E, c) {
          E.log('act', `${c.name} presents a holy symbol: Turn Undead (DC ${x.h.dc} WIS).`, c);
          for (const t of pool(E, c)) {
            if (E.save(t, 'wis', x.h.dc, { serious: true }).success) continue;
            if ((t.tpl.cr ?? 99) <= destroy) { E.log('info', `${t.name} is destroyed (Destroy Undead).`, t); E.kill(t, c, 'Destroy Undead'); continue; }
            E.addFx(t, { id: 'turned', cond: 'incapacitated', name: 'turned', endsOnDamage: true, announce: true, ends: { who: c.id, when: 'end', turns: 10 } }, c);
            E.log('cond', `${t.name} is turned and flees.`, t);
          }
        },
      },
    },
    plan: ['turnUndead'],
  };
};

// ---------------------------------------------------------------------------------------------
// Bard
// ---------------------------------------------------------------------------------------------
const bardicInspiration = (x) => {
  const L = x.lvl('bard');
  const die = `1d${L >= 15 ? 12 : L >= 10 ? 10 : L >= 5 ? 8 : 6}`;
  const pick = (E, c) => friends(E, c).filter((a) => !E.fxOf(a, 'inspiration') && !a.summonedBy).sort((a, b) => (b.tpl.level || 0) - (a.tpl.level || 0))[0] || null;
  return {
    actions: {
      inspire: {
        kind: 'special', name: 'Bardic Inspiration', cost: 'bonus', ally: true, uses: x.uses('bardic inspiration', Math.max(1, x.mod('cha'))), aiTarget: pick, when: (E, c) => !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || pick(E, c);
          if (!t) return;
          E.log('act', `${c.name} gives ${t.name} Bardic Inspiration (${die}).`, c);
          E.addFx(t, { id: 'inspiration', name: 'Bardic Inspiration', boostDie: die }, c);
        },
      },
    },
    bonus: ['inspire'],
  };
};

// ---------------------------------------------------------------------------------------------
// Artificer
// ---------------------------------------------------------------------------------------------
const flashOfGenius = (x) => {
  const n = Math.max(1, x.mod('int'));
  return {
    reactions: [{
      id: 'flash', name: 'Flash of Genius', trigger: 'saveFailed', who: 'allyOrSelf', uses: x.uses('flash of genius', n),
      when: (E, me, ctx) => ctx.dc - ctx.total <= n && !ctx.add,
      run(E, me, ctx) { ctx.add = n; ctx.note = `${me.name}'s Flash of Genius`; },
    }],
  };
};

// ---------------------------------------------------------------------------------------------
// Sorcerer: points into slots when the big slots are gone, and a small slot into points for Metamagic
// ---------------------------------------------------------------------------------------------
const SLOT_COST = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };
const fontOfMagic = (x) => {
  const top = Math.min(5, Math.max(0, ...Object.keys(x.h.slots || {}).map(Number)));
  const want = (c) => {
    if (!c.slots || top < 3) return 0;
    let big = 0;
    for (const l of Object.keys(c.slots)) if (+l >= 3) big += c.slots[l];
    if (big > 0) return 0;
    for (let l = top; l >= 3; l--) if (sorceryPoints(c) >= SLOT_COST[l]) return l;
    return 0;
  };
  const small = (c) => (c.slots ? [1, 2].find((l) => c.slots[l] > 0) : 0) || 0;
  const needPoints = (c) => (x.h.meta || []).length > 0 && sorceryPoints(c) < 2 && small(c) > 0 && slotLevels(c, 3).length > 0;
  return {
    actions: {
      fontOfMagic: {
        kind: 'special', name: 'Font of Magic', cost: 'bonus', noTarget: true,
        when: (E, c) => foes(E, c).length > 0 && (want(c) > 0 || needPoints(c)),
        run(E, c) {
          const l = want(c);
          if (l) {
            c.memo.sp = sorceryPoints(c) - SLOT_COST[l];
            c.slots[l] += 1;
            E.log('act', `${c.name} turns ${SLOT_COST[l]} sorcery points into a level ${l} slot (${c.memo.sp} points left).`, c);
          } else {
            const s = small(c);
            c.slots[s] -= 1;
            c.memo.sp = sorceryPoints(c) + s;
            E.log('act', `${c.name} turns a level ${s} slot into ${s} sorcery point${s > 1 ? 's' : ''} (${c.memo.sp} points).`, c);
          }
        },
      },
    },
    bonusFirst: ['fontOfMagic'],
  };
};

// ---------------------------------------------------------------------------------------------
// Warlock
// ---------------------------------------------------------------------------------------------
const repellingBlast = () => ({
  hooks: {
    onHit(E, c, ctx) {
      if (!/^Eldritch Blast/.test(ctx.act.name)) return null;
      // pushed off a friend, or off the warlock, when either is hurt
      const t = ctx.tgt;
      const peel = [...t.engaged].some((id) => { const a = E.get(id); return a && a.side === c.side && (a === c || a.down || a.hp < a.maxHp * 0.4); });
      return peel ? { fx: [{ fx: 'call', run: (E2, src, tgt) => { if (E2.alive(tgt)) E2.push(src, tgt, 'Repelling Blast'); } }] } : null;
    },
  },
});

// ---------------------------------------------------------------------------------------------
// Feats
// ---------------------------------------------------------------------------------------------
const lucky = (x) => {
  const n = x.uses('lucky', x.uses('luck points', x.y2024 ? x.prof : 3));
  const left = (c) => n - used(c, 'luck');
  return {
    reactions: [{
      id: 'luckDefend', name: 'Lucky', trigger: 'attacked', free: true,
      when: (E, me, ctx) => ctx.crit && left(me) > 0,
      run(E, me, ctx) { spendUse(me, 'luck'); ctx.reroll = 'Lucky'; },
    }],
    hooks: {
      rerollSave(E, c, ctx) {
        if (ctx.o.conc || left(c) <= 0) return null;
        spendUse(c, 'luck');
        return 'Lucky';
      },
      fixMiss(E, c, ctx) {
        // one point is kept for a saving throw
        if (left(c) <= 1 || ctx.gap > 6) return null;
        spendUse(c, 'luck');
        return { reroll: 'Lucky' };
      },
    },
  };
};

const warCaster = (x) => ({
  flags: { concAdv: true },
  hooks: {
    opportunity(E, c) {
      const a = x.tpl.actions.cantrip;
      const w = x.tpl.oa && x.tpl.actions[x.tpl.oa];
      return a && a.kind === 'attack' && (!w || E.expected(c, a) > E.expected(c, w)) ? 'cantrip' : null;
    },
  },
});

// -5 to hit for +10 damage with a ranged weapon, when the sums favour it
const sharpshooter = () => ({
  hooks: {
    attackMods(E, c, ctx) {
      c.turn.sharp = false;
      if (ctx.melee || ctx.act.spell || ctx.act.weapon === false) return null;
      const avg = (ctx.act.dmg || []).reduce((s, [d]) => s + avgDice(d), 0);
      const p = Math.min(0.95, Math.max(0.05, (21 + ctx.act.toHit - E.acOf(ctx.tgt)) / 20));
      if ((p - 0.25) * (avg + 10) <= p * avg) return null;
      c.turn.sharp = true;
      return { bonus: -5 };
    },
    onHit(E, c, ctx) { return c.turn.sharp && !ctx.melee && weaponHit(ctx) ? { dmg: [['10', ctx.act.dmg[0][1], 'Sharpshooter']] } : null; },
  },
});

const crossbowExpert = (x) => {
  const a = x.tpl.actions.ranged;
  if (!a) return null;
  a.noRangePenalty = true;
  if (!/hand/i.test(a.name)) return {};
  return { actions: { crossbowBonus: { ...a, name: `${a.name} (Crossbow Expert)`, n: 1, cost: 'bonus' } }, bonus: ['crossbowBonus'] };
};

const elvenAccuracy = () => ({
  hooks: { fixMiss(E, c, ctx) { return ctx.mode === 'adv' && !c.turn.elven ? ((c.turn.elven = true), { reroll: 'Elven Accuracy, third die' }) : null; } },
});

const inspiringLeader = (x) => {
  const amt = x.h.level + Math.max(0, x.mod('cha'));
  return { onStart(E, c) { for (const a of E.alliesOf(c, true).filter((p) => !p.summonedBy).slice(0, 6)) E.tempHp(a, amt, 'Inspiring Leader'); } };
};

// ---------------------------------------------------------------------------------------------
// Weapon Mastery (the 2024 rules): the option reads "longsword (sap)"
// ---------------------------------------------------------------------------------------------
function mastery(x) {
  const props = {};
  for (const o of x.h.options || []) {
    const m = o.match(/^(.+) \((sap|vex|topple|nick|graze|slow|push|cleave)\)$/);
    if (m) props[m[1]] = m[2];
  }
  for (const o of Object.keys(x.h.features || {})) {
    const m = o.match(/^(sap|vex|topple|nick|graze|slow|push|cleave) \((.+)\)$/);
    if (m) props[m[2]] = m[1];
  }
  const of = (act) => { const n = String(act.name).toLowerCase(); const k = Object.keys(props).find((w) => n.includes(w)); return k ? props[k] : null; };
  if (!Object.keys(props).length) return null;
  const dc = 8 + x.prof + Math.max(x.mod('str'), x.mod('dex'));
  // Nick: one more swing with the light weapon as part of the Attack action
  const m = x.tpl.actions.melee;
  const r = x.tpl.actions.meleeRoutine;
  if (m && r && of(m) === 'nick') { r.options[0].push('melee'); r.name = `${r.name} + Nick`; }
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (!weaponHit(ctx)) return null;
        const p = of(ctx.act);
        if (p === 'sap') return { fx: [{ fx: 'effect', effect: { id: 'sap', name: 'Sap', disAtk: true, oneAttack: true }, dur: untilMyNextTurn }] };
        if (p === 'vex') { c.turn.advNext = 'Vex'; return null; }
        if (p === 'topple' && !E.has(ctx.tgt, 'prone') && !E.condImmune(ctx.tgt, 'prone')) return { fx: [{ fx: 'save', ability: 'con', dc, onFail: [{ fx: 'prone' }], serious: false }] };
        return null;
      },
      onMiss(E, c, ctx) {
        if (ctx.act.spell || of(ctx.act) !== 'graze' || !E.alive(ctx.tgt)) return;
        const amt = Math.max(1, x.mod('str'));
        E.damage(ctx.tgt, [{ amt, type: ctx.act.dmg[0][1] }], c, { rollText: `Graze ${amt}` });
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Subclass and one-off features
// ---------------------------------------------------------------------------------------------
const channelUses = (x) => x.uses('channel divinity', 1);
const channelLeft = (x, c) => channelUses(x) - used(c, 'channel');

// Cleric: Divine Strike or Blessed Strikes, once on each of the cleric's turns
const DOMAIN_TYPE = { 'nature domain': 'cold', 'life domain': 'radiant', 'tempest domain': 'thunder', 'war domain': 'slashing', 'trickery domain': 'poison', 'forge domain': 'fire', 'grave domain': 'necrotic' };
const divineStrike = (x) => {
  const dice = x.lvl('cleric') >= 14 ? '2d8' : '1d8';
  const type = DOMAIN_TYPE[(x.h.subclasses || {}).cleric] || 'radiant';
  const blessed = x.has('blessed strikes');
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (E.current !== c || c.turn.strike || !(weaponHit(ctx) || (blessed && ctx.act.spell && !ctx.act.slot))) return null;
        c.turn.strike = true;
        return { dmg: [[dice, blessed ? 'radiant' : type, blessed ? 'Blessed Strikes' : 'Divine Strike']] };
      },
    },
  };
};

// Harness Divine Power: a Channel Divinity for a spent slot, when there is nothing to turn
const harness = (x) => {
  const cap = Math.ceil(x.prof / 2);
  const lost = (c) => { if (!c.slots) return 0; for (let l = cap; l >= 1; l--) if ((c.slots[l] ?? 0) < ((c.tpl.slots || {})[l] || 0)) return l; return 0; };
  return {
    actions: {
      harness: {
        kind: 'special', name: 'Harness Divine Power', cost: 'bonus', noTarget: true, uses: x.uses('harness divine power', 1),
        when: (E, c) => channelLeft(x, c) > 0 && lost(c) > 0 && !foes(E, c).some((t) => t.tpl.type === 'undead'),
        run(E, c) { const l = lost(c); spendUse(c, 'channel'); c.slots[l] += 1; E.log('act', `${c.name} harnesses divine power and regains a level ${l} slot.`, c); },
      },
    },
    bonus: ['harness'],
  };
};

// Nature Domain: halve acid, cold, fire, lightning or thunder for the cleric or a friend
const dampenElements = () => {
  const ok = (E, me, ctx) => ctx.total >= 10 && ctx.parts.some((p) => ['acid', 'cold', 'fire', 'lightning', 'thunder'].includes(p.type));
  const run = (E, me, ctx) => { ctx.mult = 0.5; ctx.note = `${me.name}'s Dampen Elements halves it`; };
  return { reactions: ['preDamage', 'preHarm'].map((trigger) => ({ id: 'dampen', name: 'Dampen Elements', trigger, who: 'allyOrSelf', when: ok, run })) };
};

// a short teleport out of melee for someone who does not belong there (Fey Step, Starlight Step)
const stepAway = (id, name) => (x) => ({
  actions: {
    [id]: {
      kind: 'special', name, cost: 'bonus', noTarget: true, uses: x.uses(name.toLowerCase(), 1),
      when: (E, c) => !x.frontline && engagedNow(E, c) && c.hp < c.maxHp * 0.6 && friends(E, c).length > 0,
      run(E, c) { E.log('act', `${c.name} uses ${name}.`, c); E.withdraw(c, { teleport: true, label: 'is out of melee' }); },
    },
  },
  bonusFirst: [id],
});

// Life Domain
const discipleOfLife = () => ({ flags: { healAdd: (lvl) => 2 + lvl } });
const blessedHealer = () => ({ flags: { healerSelf: (lvl) => 2 + lvl } });
const supremeHealing = () => ({ flags: { healMax: true } });
const preserveLife = (x) => {
  const pool = 5 * x.lvl('cleric');
  const hurt = (E, c) => E.alliesOf(c, true).filter((a) => E.active(a) && a.hp < a.maxHp / 2 && a.tpl.type !== 'undead' && a.tpl.type !== 'construct');
  const need = (E, c) => hurt(E, c).reduce((n, a) => n + Math.floor(a.maxHp / 2) - a.hp, 0);
  return {
    actions: {
      preserveLife: {
        kind: 'special', name: 'Channel Divinity: Preserve Life', noTarget: true,
        when: (E, c) => channelLeft(x, c) > 0 && need(E, c) >= Math.min(pool, 40),
        run(E, c) {
          spendUse(c, 'channel');
          let left = pool;
          E.log('act', `${c.name} channels divinity: Preserve Life, ${pool} hit points to share.`, c);
          for (const a of hurt(E, c).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)) {
            const amt = Math.min(left, Math.floor(a.maxHp / 2) - a.hp);
            if (amt <= 0) continue;
            left -= amt;
            E.heal(a, amt, c, 'Preserve Life');
          }
        },
      },
    },
    plan: ['preserveLife'],
  };
};

// Swashbuckler: Sneak Attack in a duel, with nobody else beside the rogue
const rakishAudacity = () => ({ flags: { sneakAlone: (E, c, ctx) => ctx.melee && [...c.engaged].every((id) => id === ctx.tgt.id || !E.active(E.get(id))) } });

// Archfey
const feyPresence = (x) => ({
  actions: {
    feyPresence: {
      kind: 'save', name: 'Fey Presence', save: 'wis', dc: x.h.dc, dmg: null, uses: x.uses('fey presence', 1), area: { type: 'engaged' },
      onFail: [{ fx: 'cond', cond: 'frightened', name: 'Fey Presence', dur: { who: 'src', when: 'end', turns: 1 } }],
    },
  },
  plan: [{ use: 'feyPresence', min: 2 }],
});
const mistyEscape = (x) => ({
  reactions: [{
    id: 'mistyEscape', name: 'Misty Escape', trigger: 'damaged', uses: x.uses('misty escape', 1),
    when: (E, me) => me.hp < me.maxHp * 0.4 && engagedNow(E, me),
    run(E, me) {
      E.log('act', `${me.name} uses Misty Escape.`, me);
      E.withdraw(me, { teleport: true, label: 'vanishes out of melee' });
      E.addFx(me, { cond: 'invisible', name: 'Misty Escape', endsOnAttack: true, ends: { who: me.id, when: 'start', turns: 1 } }, me);
    },
  }],
});
const charmProof = () => ({ onStart(E, c) { E.addFx(c, { id: 'beguiling', name: 'Beguiling Defenses', immuneCond: ['charmed'] }, c); } });
const darkDelirium = (x) => {
  const fits = (E, t) => !E.condImmune(t, 'charmed') && !E.incapacitated(t) && t.hp >= 60;
  const pick = (E, c) => (c.conc || E.round > 2 || foes(E, c).length < 2 ? null : foes(E, c).filter((t) => fits(E, t)).sort((a, b) => b.hp - a.hp)[0] || null);
  return {
    actions: {
      darkDelirium: {
        kind: 'special', name: 'Dark Delirium', uses: x.uses('dark delirium', 1), conc: true, selfManaged: true, aiTarget: pick, when: (E, c) => !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || pick(E, c);
          if (!t) return;
          E.concentrate(c, 'Dark Delirium');
          E.saveEffect(c, { name: 'Dark Delirium', save: 'wis', dc: x.h.dc, dmg: null, onFail: [{ fx: 'cond', cond: 'incapacitated', name: 'Dark Delirium', conc: true, endsOnDamage: true }] }, [t]);
        },
      },
    },
    plan: ['darkDelirium'],
  };
};
// Eldritch Smite: a pact slot on a weapon hit, kept for a critical hit or a target with plenty of life left
const eldritchSmite = () => ({
  hooks: {
    onHit(E, c, ctx) {
      if (E.current !== c || c.turn.esmite || !ctx.melee || !weaponHit(ctx)) return null;
      const pact = c.pact && c.pact.n > 0 ? c.pact.level : 0;
      const slot = pact || (slotLevels(c, 1).slice(-1)[0] || 0);
      if (!slot || (!ctx.crit && ctx.tgt.hp < 40)) return null;
      c.turn.esmite = true;
      if (pact) c.pact.n -= 1; else c.slots[slot] -= 1;
      const big = ['huge', 'gargantuan'].includes(ctx.tgt.tpl.size);
      return { dmg: [[`${1 + slot}d8`, 'force', `Eldritch Smite (level ${slot} slot)`]], fx: big ? [] : [{ fx: 'prone' }] };
    },
  },
});
const lifedrinker = (x) => ({
  hooks: { onHit(E, c, ctx) { return ctx.melee && weaponHit(ctx) ? { dmg: [[String(Math.max(1, x.mod('cha'))), 'necrotic', 'Lifedrinker']] } : null; } },
});

// Chrono Walker (Eloise's patron): step back in time out of the way of one blow
const evasionStep = (x) => ({
  reactions: [{
    id: 'evasionStep', name: 'Evasion Step', trigger: 'preDamage', uses: x.uses('evasion step', 1),
    when: (E, me, ctx) => ctx.o.melee && (ctx.total >= me.maxHp * 0.15 || ctx.total >= me.hp),
    run(E, me, ctx) {
      ctx.mult = 0;
      ctx.note = 'Evasion Step: gone before the blow lands';
      E.withdraw(me, { teleport: true, label: 'steps back in time and out of reach' });
    },
  }],
});

// Oath of Vengeance
const vowOfEnmity = (x) => {
  const pick = (E, c) => foes(E, c).sort((a, b) => b.hp - a.hp)[0] || null;
  const live = (E, c) => { const t = E.get(c.memo.vow); return t && E.active(t) ? t : null; };
  const part = {
    actions: {
      vow: {
        kind: 'special', name: 'Channel Divinity: Vow of Enmity', cost: 'bonus', noTarget: true,
        when: (E, c) => channelLeft(x, c) > 0 && !live(E, c) && !!pick(E, c),
        run(E, c) { const t = pick(E, c); spendUse(c, 'channel'); c.memo.vow = t.id; E.log('act', `${c.name} swears a Vow of Enmity against ${t.name}.`, c); },
      },
    },
    bonusFirst: ['vow'],
    hooks: { attackMods(E, c, ctx) { return ctx.tgt.id === c.memo.vow ? { adv: 'Vow of Enmity' } : null; } },
    reactions: [],
  };
  if (x.has('soul of vengeance') && x.tpl.oa) {
    for (const trigger of ['hitBy', 'missed']) {
      part.reactions.push({
        id: 'soulOfVengeance', name: 'Soul of Vengeance', trigger, who: 'allyOrSelf',
        when: (E, me, ctx) => ctx.att.id === me.memo.vow && E.active(ctx.att) && (isEngaged(me, ctx.att) || E.canReach(me, ctx.att)),
        run(E, me, ctx) { E.log('act', `${me.name} strikes back at the sworn enemy (Soul of Vengeance).`, me); E.attack(me, ctx.att, E.action(me, me.tpl.oa), {}); },
      });
    }
  }
  return part;
};
const avengingAngel = (x) => ({
  actions: {
    avengingAngel: {
      kind: 'special', name: 'Avenging Angel', uses: 1, noTarget: true,
      when: (E, c) => E.round <= 2 && foes(E, c).length >= 3,
      run(E, c) {
        E.log('act', `${c.name} takes the form of an Avenging Angel: wings, and an aura of menace.`, c);
        for (const t of foes(E, c)) {
          if (E.condImmune(t, 'frightened') || E.save(t, 'wis', x.h.dc, { serious: true }).success) continue;
          E.addFx(t, { cond: 'frightened', id: 'menace', name: 'Avenging Angel', advAgainst: true, endsOnDamage: true, ends: { who: c.id, when: 'end', turns: 10 } }, c);
        }
      },
    },
  },
  plan: ['avengingAngel'],
});

// Draconic Bloodline
const elementalAffinity = (x) => {
  const name = Object.keys(x.h.features || {}).find((n) => /^elemental affinity \(/.test(n)) || '';
  const type = (name.match(/\((\w+)\)/) || [])[1];
  return type ? { flags: { spellPlus: [...(x.tpl.spellPlus || []), { type, dice: String(Math.max(1, x.mod('cha'))) }] } } : null;
};
const draconicPresence = (x) => ({
  actions: {
    draconicPresence: {
      kind: 'special', name: 'Draconic Presence', noTarget: true, conc: true, selfManaged: true,
      when: (E, c) => !c.conc && E.round <= 2 && sorceryPoints(c) >= 9 && foes(E, c).filter((t) => !E.condImmune(t, 'frightened')).length >= 3,
      run(E, c) {
        c.memo.sp = sorceryPoints(c) - 5;
        E.log('act', `${c.name} spends 5 sorcery points on Draconic Presence (${c.memo.sp} left).`, c);
        E.concentrate(c, 'Draconic Presence');
        E.addFx(c, { id: 'Draconic Presence', name: 'Draconic Presence', conc: c.id, aura: { save: 'wis', dc: x.h.dc, dmg: null, on: ['enemyStart'], onFail: [{ fx: 'cond', cond: 'frightened', name: 'Draconic Presence', conc: true }] } }, c);
      },
    },
  },
  plan: ['draconicPresence'],
});

// Divination: two dice rolled before the fight. A low one makes an enemy fail a save that matters; a high
// one turns the wizard's own failed save.
const portent = (x) => {
  const n = x.lvl('wizard') >= 14 ? 3 : 2;
  return {
    onStart(E, c) { c.memo.portent = Array.from({ length: n }, () => E.rng.int(20)); E.log('info', `${c.name}'s Portent dice: ${c.memo.portent.join(', ')}.`, c); },
    hooks: {
      foretell(E, c, ctx) {
        const dice = c.memo.portent || [];
        if (!ctx.first || !dice.length || !(ctx.serious || ctx.expected >= 35) || ctx.tgt.lr > 0) return null;
        const low = Math.min(...dice);
        if (low + E.saveBonus(ctx.tgt, ctx.act.save) >= ctx.dc) return null;
        dice.splice(dice.indexOf(low), 1);
        return { die: low, label: 'Portent' };
      },
      forceSave(E, c, ctx) {
        const dice = c.memo.portent || [];
        if (ctx.o.conc || !(ctx.o.serious || ctx.o.expected >= 30)) return null;
        const high = dice.filter((d) => d + E.saveBonus(c, ctx.ability) >= ctx.dc).sort((a, b) => a - b)[0];
        if (high === undefined) return null;
        dice.splice(dice.indexOf(high), 1);
        return `Portent: the die was ${high}, and the save holds`;
      },
    },
  };
};

// Eldritch Knight
const warMagic = (x) => {
  const w = x.tpl.actions.melee || x.tpl.actions.ranged;
  if (!w) return null;
  return {
    actions: { warMagic: { ...w, name: `${w.name} (War Magic)`, n: 1, cost: 'bonus', when: (E, c) => !c.turn.action && !!c.turn.slotSpell } },
    bonus: ['warMagic'],
  };
};
const eldritchStrike = () => ({
  hooks: { onHit(E, c, ctx) { return weaponHit(ctx) ? { fx: [{ fx: 'effect', effect: { id: 'eldritchStrike', name: 'Eldritch Strike', disSave: 'all' }, dur: { who: 'src', when: 'end', turns: 1 } }] } : null; } },
});
const shieldMaster = (x) => {
  const dc = 8 + x.prof + x.mod('str');
  const pick = (E, c) => [...c.engaged].map((id) => E.get(id)).find((t) => E.active(t) && !E.has(t, 'prone') && !E.condImmune(t, 'prone') && !['huge', 'gargantuan'].includes(t.tpl.size)) || null;
  return {
    flags: { evasion: true },
    actions: {
      shieldShove: {
        kind: 'special', name: 'Shield Master (shove)', cost: 'bonus', aiTarget: pick,
        when: (E, c) => !c.turn.action && friends(E, c).length > 0 && !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || pick(E, c);
          if (!t) return;
          E.log('act', `${c.name} shoves ${t.name} with the shield (DC ${dc} STR).`, c);
          if (!E.save(t, 'str', dc, {}).success) E.applyFx(c, t, [{ fx: 'prone' }]);
        },
      },
    },
    bonus: ['shieldShove'],
  };
};
const mageSlayer = (x) => ({
  flags: { concBreaker: true },
  reactions: x.tpl.oa ? [{
    id: 'mageSlayer', name: 'Mage Slayer', trigger: 'spellCast', who: 'enemy',
    when: (E, me, ctx) => isEngaged(me, ctx.caster) && E.active(ctx.caster),
    run(E, me, ctx) { E.log('act', `${me.name} strikes as ${ctx.caster.name} casts (Mage Slayer).`, me); E.attack(me, ctx.caster, E.action(me, me.tpl.oa), {}); },
  }] : [],
});
const defensiveDuelist = (x) => {
  const w = x.h.attacks.find((a) => a.name === (x.tpl.actions.melee || {}).name);
  if (!w || !(w.props || []).includes('finesse')) return null;
  return {
    reactions: [{
      id: 'defensiveDuelist', name: 'Defensive Duelist', trigger: 'attacked',
      when: (E, me, ctx) => ctx.melee && !ctx.crit && ctx.total < E.acOf(me) + ctx.acBonus + x.prof,
      run(E, me, ctx) { ctx.acBonus += x.prof; E.log('info', `${me.name} turns the blow aside (Defensive Duelist, +${x.prof} AC).`, me); },
    }],
  };
};

// College of Lore: a Bardic Inspiration die taken off an attack roll that would just hit
const cuttingWords = (x) => {
  const L = x.lvl('bard');
  const sides = L >= 15 ? 12 : L >= 10 ? 10 : L >= 5 ? 8 : 6;
  const n = x.uses('bardic inspiration', Math.max(1, x.mod('cha')));
  return {
    reactions: [{
      id: 'cuttingWords', name: 'Cutting Words', trigger: 'attacked', who: 'allyOrSelf',
      when: (E, me, ctx) => !ctx.crit && used(me, 'inspire') < n && ctx.total - sides < E.acOf(ctx.tgt) + ctx.acBonus && !E.condImmune(ctx.att, 'charmed'),
      run(E, me, ctx) {
        spendUse(me, 'inspire');
        const r = rollDice(E.rng, `1d${sides}`);
        ctx.acBonus += r.total;
        E.log('info', `${me.name}'s Cutting Words take ${r.total} off ${ctx.att.name}'s attack roll.`, me);
      },
    }],
  };
};

// Artillerist: one damage roll of a spell cast through the firearm
const firearm = (x) => ({ flags: { spellPlus: [...(x.tpl.spellPlus || []), { dice: '1d8' }] } });

const wardingFlare = (x) => ({
  reactions: [{
    id: 'flare', name: 'Warding Flare', trigger: 'attacked', uses: x.uses('warding flare', Math.max(1, x.mod('wis'))),
    when: (E, me, ctx) => ctx.crit || me.hp < me.maxHp * 0.6,
    run(E, me, ctx) { ctx.reroll = 'Warding Flare'; },
  }],
});

// Champion
const improvedCritical = (x) => ({ flags: { critMin: x.lvl('fighter') >= 15 ? 18 : 19 } });

// Dragonborn breath: only when it would catch a crowd
const breathWeapon = (x) => {
  const name = Object.keys(x.h.features || {}).find((n) => /^breath weapon \(/.test(n)) || '';
  const kind = (name.match(/\((\w+)/) || [])[1] || 'gold';
  const type = { gold: 'fire', red: 'fire', brass: 'fire', blue: 'lightning', bronze: 'lightning', black: 'acid', copper: 'acid', green: 'poison', silver: 'cold', white: 'cold' }[kind] || 'fire';
  const L = x.h.level;
  const dice = `${L >= 16 ? 5 : L >= 11 ? 4 : L >= 6 ? 3 : 2}d6`;
  return {
    actions: { breath: { kind: 'save', name: 'Breath Weapon', save: ['fire', 'cold', 'poison'].includes(type) && kind !== 'gold' && kind !== 'red' && kind !== 'brass' ? 'con' : 'dex', dc: 8 + x.prof + x.mod('con'), dmg: [[dice, type]], half: true, uses: x.uses('breath weapon', 1), area: { type: 'engaged' } } },
    plan: [{ use: 'breath', min: 3 }],
  };
};

// Fighting styles the sheet's numbers do not hold
const greatWeapon = (x) => {
  const w = x.h.attacks.find((a) => a.name === (x.tpl.actions.melee || {}).name);
  if (!w || !(w.props || []).some((p) => p === 'two-handed' || p === 'versatile')) return null;
  // rolling again every 1 and 2 on the weapon's dice is worth about one point a hit
  return { hooks: { onHit(E, c, ctx) { return ctx.melee && weaponHit(ctx) && ctx.act.name === w.name ? { dmg: [['1', ctx.act.dmg[0][1], 'Great Weapon Fighting']] } : null; } } };
};
// a second light weapon in the other hand: one more swing as a bonus action
const offHand = (x) => {
  const main = (x.tpl.actions.melee || {}).name;
  const light = x.h.attacks.filter((a) => !a.spell && a.melee && a.toHit !== null && (a.props || []).includes('light'));
  const dual = x.has('dual wielder');
  const mainLine = x.h.attacks.find((a) => a.name === main);
  if (!mainLine || !(dual || (mainLine.props || []).includes('light'))) return null;
  const pool = (dual ? x.h.attacks.filter((a) => !a.spell && a.melee && a.toHit !== null && !/unarmed/i.test(a.name) && !(a.props || []).includes('two-handed')) : light);
  const same = pool.filter((a) => a.name === main).length >= 2;
  const other = pool.filter((a) => a.name !== main).sort((p, q) => avgDice(q.dmg) - avgDice(p.dmg))[0] || (same ? mainLine : null);
  if (!other) return null;
  return {
    actions: { offHand: meleeAttack(`${other.name} (off hand)`, other.toHit, [[other.dmg, other.type]], { cost: 'bonus' }) },
    bonus: ['offHand'],
  };
};

// Healing potions carried: drunk when badly hurt. A bonus action under the 2024 rules and for a Thief.
const POTION = { 'potion of healing': '2d4+2', 'potion of healing (greater)': '4d4+4', 'potion of healing (superior)': '8d4+8', 'potion of healing (supreme)': '10d4+20' };
function potions(x) {
  const part = { actions: {}, bonusFirst: [], plan: [] };
  const quick = x.y2024 || x.has('fast hands');
  for (const [name, n] of Object.entries(x.h.potions || {}).sort((a, b) => avgDice(POTION[b[0]] || '0') - avgDice(POTION[a[0]] || '0'))) {
    const dice = POTION[name];
    if (!dice) continue;
    const id = `potion${Object.keys(part.actions).length}`;
    const label = name.replace(/^p/, 'P').replace('healing', 'Healing').replace(/\((\w)/, (m, ch) => `(${ch.toUpperCase()}`);
    part.actions[id] = {
      kind: 'special', name: label, cost: quick ? 'bonus' : 'action', noTarget: true, uses: n,
      // an action spent drinking is only worth it when a friend keeps the fight going
      when: (E, c) => (quick ? c.hp < c.maxHp * 0.5 : c.hp < c.maxHp * 0.3 && friends(E, c).length > 0),
      run(E, c) { const r = rollDice(E.rng, dice); E.log('act', `${c.name} drinks a ${label}: ${r.text} = ${r.total}.`, c); E.heal(c, r.total, c, label); },
    };
    (quick ? part.bonusFirst : part.plan).push(id);
  }
  return Object.keys(part.actions).length ? part : null;
}

// ---------------------------------------------------------------------------------------------
// More subclass, species and feat features
// ---------------------------------------------------------------------------------------------
const oncePerTurn = (flag, test, dmg) => ({
  hooks: {
    onHit(E, c, ctx) {
      if (E.current !== c || c.turn[flag] || !test(E, c, ctx)) return null;
      c.turn[flag] = true;
      return { dmg: [dmg(E, c, ctx)] };
    },
  },
});
const anyAttack = () => true;
const weaponOnly = (E, c, ctx) => weaponHit(ctx);

// Ranger
const favoredFoe = (x) => {
  const L = x.lvl('ranger');
  const die = L >= 14 ? '1d8' : L >= 6 ? '1d6' : '1d4';
  const n = x.uses('favored foe', x.prof);
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (E.current !== c || c.turn.foe || !weaponHit(ctx)) return null;
        if (c.memo.foe !== ctx.tgt.id || !c.conc || c.conc.name !== 'Favored Foe') {
          if (c.conc || used(c, 'favoredFoe') >= n) return null;
          spendUse(c, 'favoredFoe');
          E.concentrate(c, 'Favored Foe');
          c.memo.foe = ctx.tgt.id;
        }
        c.turn.foe = true;
        return { dmg: [[die, ctx.act.dmg[0][1], 'Favored Foe']] };
      },
    },
  };
};
const planarWarrior = (x) => ({
  actions: {
    planar: {
      kind: 'special', name: 'Planar Warrior', cost: 'bonus', noTarget: true,
      when: (E, c) => c.turn.action && foes(E, c).length > 0,
      run(E, c) { c.turn.planar = true; },
    },
  },
  bonus: ['planar'],
  hooks: {
    onHit(E, c, ctx) {
      if (!c.turn.planar || !weaponHit(ctx)) return null;
      c.turn.planar = false;
      return { dmg: [[x.lvl('ranger') >= 11 ? '2d8' : '1d8', 'force', 'Planar Warrior']] };
    },
  },
});
const gatheredSwarm = () => oncePerTurn('swarm', weaponOnly, () => ['1d6', 'piercing', 'Gathered Swarm']);

// Artificer 11: a 1st or 2nd level spell kept in an item, cast without slots
const spellStoring = (x) => {
  const o = { dc: x.h.dc, toHit: x.h.spellHit, mod: x.h.spellMod, charLevel: x.h.level };
  let best = null;
  for (const [name, lvl] of Object.entries(x.h.spells || {})) {
    if (lvl < 1 || lvl > 2 || !SPELLS[name]) continue;
    const a = cast(name, { ...o, uses: Math.max(2, 2 * x.mod('int')), at: lvl });
    if (!a || !a.book || a.book.role !== 'damage' || a.book.sustain) continue;
    const v = a.book.value(lvl, 2);
    if (!best || v > best.v) best = { a, v };
  }
  if (!best || best.v <= x.atWill) return null;
  // kept for when the slots of 3rd level and up are gone
  const own = best.a.when;
  return { actions: { stored: { ...best.a, name: `${best.a.name} (Spell-Storing Item)`, when: (E, c) => slotLevels(c, 3).length === 0 && (!own || own(E, c)) } }, plan: ['stored'] };
};

// Bladesinging
const bladesong = (x) => {
  const n = Math.max(1, x.mod('int'));
  return {
    actions: {
      bladesong: {
        kind: 'special', name: 'Bladesong', cost: 'bonus', noTarget: true, uses: x.uses('bladesong', x.prof),
        when: (E, c) => !E.fxOf(c, 'bladesong') && foes(E, c).length > 0,
        run(E, c) { E.log('act', `${c.name} begins the Bladesong (+${n} AC).`, c); E.addFx(c, { id: 'bladesong', name: 'Bladesong', ac: n, endsWhenDown: true }, c); },
      },
    },
    bonusFirst: ['bladesong'],
  };
};

// Monk
const focusedAim = (x) => ({
  hooks: {
    fixMiss(E, c, ctx) {
      const cost = Math.ceil(ctx.gap / 2);
      if (ctx.act.spell || ctx.nat === 1 || cost > 3 || kiOf(x) - used(c, 'ki') < cost) return null;
      c.used.ki = used(c, 'ki') + cost;
      return { add: cost * 2, label: `Focused Aim (${cost} ki)` };
    },
  },
});
const martialDie = (x) => { const L = x.lvl('monk'); return x.y2024 ? (L >= 17 ? 12 : L >= 11 ? 10 : L >= 5 ? 8 : 6) : (L >= 17 ? 10 : L >= 11 ? 8 : L >= 5 ? 6 : 4); };
const deftStrike = (x) => ({
  hooks: {
    onHit(E, c, ctx) {
      if (E.current !== c || c.turn.deft || !weaponHit(ctx) || kiOf(x) - used(c, 'ki') < 2) return null;
      c.turn.deft = true;
      spendUse(c, 'ki');
      return { dmg: [[`1d${martialDie(x)}`, ctx.act.dmg[0][1], 'Deft Strike']] };
    },
  },
});
const handOfHarm = (x) => ({
  hooks: {
    onHit(E, c, ctx) {
      if (E.current !== c || c.turn.harm || !ctx.melee || !weaponHit(ctx) || kiOf(x) - used(c, 'ki') < 1) return null;
      c.turn.harm = true;
      spendUse(c, 'ki');
      const out = { dmg: [[`1d${martialDie(x)}+${Math.max(0, x.mod('wis'))}`, 'necrotic', 'Hand of Harm']], fx: [] };
      if (x.lvl('monk') >= 6 && !E.condImmune(ctx.tgt, 'poisoned')) out.fx.push({ fx: 'cond', cond: 'poisoned', name: "Physician's Touch", dur: { who: 'src', when: 'end', turns: 1 } });
      return out;
    },
  },
});
const handOfHealing = (x) => ({
  actions: {
    handOfHealing: {
      kind: 'heal', name: 'Hand of Healing (in place of a Flurry blow)', dice: `1d${martialDie(x)}+${Math.max(0, x.mod('wis'))}`, self: true, cost: 'bonus', uses: kiOf(x), usesKey: 'ki',
      when: (E, c) => c.hp < c.maxHp * 0.4,
    },
  },
  bonusFirst: ['handOfHealing'],
});
const openHand = (x) => {
  const dc = kiDc(x);
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (ctx.act.name !== 'Flurry of Blows' || c.turn.openHand || E.has(ctx.tgt, 'prone') || E.condImmune(ctx.tgt, 'prone')) return null;
        c.turn.openHand = true;
        return { fx: [{ fx: 'save', ability: 'dex', dc, onFail: [{ fx: 'prone' }], serious: false }] };
      },
    },
  };
};
const wholeness = (x) => ({
  actions: { wholeness: { kind: 'heal', name: 'Wholeness of Body', dice: `1d${martialDie(x)}+${Math.max(0, x.mod('wis'))}`, self: true, cost: 'bonus', uses: x.uses('wholeness of body', Math.max(1, x.mod('wis'))) } },
  bonusFirst: ['wholeness'],
});

// Kobold
const grovel = (x) => ({
  actions: {
    grovel: {
      kind: 'special', name: 'Grovel, Cower, and Beg', uses: x.uses('grovel, cower, and beg', 1), noTarget: true,
      when: (E, c) => E.round <= 2 && friends(E, c).length >= 2 && foes(E, c).length > 0,
      run(E, c) {
        E.log('act', `${c.name} grovels, cowers and begs. Friends have advantage against enemies close by.`, c);
        const near = foes(E, c).filter((t) => t.engaged.size > 0 || isEngaged(c, t));
        for (const t of near.length ? near : foes(E, c).slice(0, 2)) E.addFx(t, { id: 'grovel', name: 'Grovel, Cower, and Beg', advAgainst: true, ends: { who: c.id, when: 'end', turns: 1 } }, c);
      },
    },
  },
  plan: ['grovel'],
});
const packTactics = () => ({
  hooks: { attackMods(E, c, ctx) { return [...ctx.tgt.engaged].some((id) => id !== c.id && E.get(id) && E.get(id).side === c.side && E.active(E.get(id))) ? { adv: 'Pack Tactics' } : null; } },
});

// Aasimar
const healingHands = (x) => {
  const pick = (E, c) => E.alliesOf(c).find((a) => a.down && !E.has(a, 'noHeal')) || null;
  return {
    actions: {
      healingHands: {
        kind: 'special', name: 'Healing Hands', ally: true, uses: 1, aiTarget: pick, when: (E, c) => !!pick(E, c),
        run(E, c, act, choice) { const t = E.get((choice.targets || [])[0]) || pick(E, c); if (t) { E.log('act', `${c.name} lays Healing Hands on ${t.name}.`, c); E.heal(t, x.h.level, c, 'Healing Hands'); } },
      },
    },
    plan: ['healingHands'],
  };
};
// Radiant Soul and Necrotic Shroud: an action for a minute of extra damage once a turn. Taken in the
// first round, and only once the extra damage is worth the action.
const revelation = (id, name, type, fear) => (x) => {
  if (id === 'radiantSoul' && (x.f('radiant soul') || {}).act !== 'action') {
    // the Celestial warlock's feature of the same name: Charisma on one radiant or fire damage roll
    const n = String(Math.max(1, x.mod('cha')));
    return { flags: { spellPlus: [...(x.tpl.spellPlus || []), { type: 'radiant', dice: n }, { type: 'fire', dice: n }] } };
  }
  // the extra damage rides on attack rolls, so it is for those who fight with weapons
  if (!x.weaponFirst) return null;
  const L = x.h.level;
  return {
    actions: {
      [id]: {
        kind: 'special', name, uses: 1, noTarget: true,
        when: (E, c) => L >= 5 && E.round <= 1 && !E.fxOf(c, id) && foes(E, c).reduce((n, t) => n + t.hp, 0) >= 12 * L,
        run(E, c) {
          E.log('act', `${c.name} reveals a celestial nature: ${name}.`, c);
          E.addFx(c, { id, name, endsWhenDown: true }, c);
          if (fear) E.saveEffect(c, { name, save: 'cha', dc: 8 + x.prof + x.mod('cha'), dmg: null, onFail: [{ fx: 'cond', cond: 'frightened', name, dur: { who: 'src', when: 'end', turns: 1 } }] }, [...c.engaged].map((i) => E.get(i)).filter((t) => E.active(t)));
        },
      },
    },
    plan: [id],
    hooks: {
      onHit(E, c, ctx) {
        if (E.current !== c || c.turn.revealed || !E.fxOf(c, id)) return null;
        c.turn.revealed = true;
        return { dmg: [[String(L), type, name]] };
      },
    },
  };
};

// Celestial warlock: a pool of d6 to heal with as a bonus action
const healingLight = (x) => {
  const pool = 1 + x.lvl('warlock');
  const most = Math.max(1, x.mod('cha'));
  const left = (c) => pool - used(c, 'healingLight');
  const pick = (E, c) => {
    if (left(c) <= 0) return null;
    const all = E.alliesOf(c, true).filter((a) => !E.has(a, 'noHeal'));
    return all.find((a) => a.down) || all.filter((a) => a.hp < a.maxHp * 0.4).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null;
  };
  return {
    actions: {
      healingLight: {
        kind: 'special', name: 'Healing Light', cost: 'bonus', ally: true, aiTarget: pick, when: (E, c) => !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || c;
          const n = Math.min(left(c), t.down ? 1 : most);
          c.used.healingLight = used(c, 'healingLight') + n;
          const r = rollDice(E.rng, `${n}d6`);
          E.log('act', `${c.name}: Healing Light on ${t === c ? 'themself' : t.name}, ${r.text} = ${r.total} (${left(c)} dice left).`, c);
          E.heal(t, r.total, c, 'Healing Light');
        },
      },
    },
    bonusFirst: ['healingLight'],
  };
};

// College of Eloquence: a Bardic Inspiration die taken off the strongest enemy's saves until the bard's next turn
const unsettlingWords = (x) => {
  const L = x.lvl('bard');
  const avg = Math.round(((L >= 15 ? 12 : L >= 10 ? 10 : L >= 5 ? 8 : 6) + 1) / 2);
  const n = x.uses('bardic inspiration', Math.max(1, x.mod('cha')));
  const pick = (E, c) => foes(E, c).filter((t) => !E.fxOf(t, 'unsettled')).sort((a, b) => b.hp - a.hp)[0] || null;
  return {
    actions: {
      unsettle: {
        kind: 'special', name: 'Unsettling Words', cost: 'bonus', aiTarget: pick,
        when: (E, c) => c.turn.action && used(c, 'inspire') < n - 1 && E.round <= 3 && !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || pick(E, c);
          if (!t) return;
          spendUse(c, 'inspire');
          E.log('act', `${c.name} unsettles ${t.name}: ${avg} off its next saving throw.`, c);
          E.addFx(t, { id: 'unsettled', name: 'Unsettling Words', saveBonus: -avg, ends: { who: c.id, when: 'start', turns: 1 } }, c);
        },
      },
    },
    bonus: ['unsettle'],
  };
};

// Ancestral Guardian
const markedBy = (name) => ({ fx: 'effect', effect: { id: 'inquisitorsMark', name }, dur: untilMyNextTurn });
const ancestralProtectors = () => ({
  hooks: {
    onHit(E, c, ctx) {
      if (E.current !== c || c.turn.ancestors || !E.fxOf(c, 'rage') || !weaponHit(ctx)) return null;
      c.turn.ancestors = true;
      return { fx: [markedBy('Ancestral Protectors')] };
    },
  },
});
const spiritShield = (x) => {
  const dice = `${x.lvl('barbarian') >= 14 ? 4 : x.lvl('barbarian') >= 10 ? 3 : 2}d6`;
  return {
    reactions: [{
      id: 'spiritShield', name: 'Spirit Shield', trigger: 'preDamage', who: 'ally',
      when: (E, me, ctx) => !!E.fxOf(me, 'rage') && ctx.total >= 8,
      run(E, me, ctx) { const r = rollDice(E.rng, dice); ctx.mult = Math.max(0, ctx.total - r.total) / ctx.total; ctx.note = `${me.name}'s Spirit Shield takes off ${Math.min(r.total, ctx.total)}`; },
    }],
  };
};
const surpriseAttack = () => ({
  hooks: {
    onHit(E, c, ctx) {
      if (E.round !== 1 || c.memo.surprised || ctx.tgt.memo.acted) return null;
      c.memo.surprised = true;
      return { dmg: [['2d6', ctx.act.dmg[0][1], 'Surprise Attack']] };
    },
  },
});
// Wild Heart (2024), the bear: while raging, resistance to everything but force, necrotic, psychic and radiant
const rageOfTheWilds = () => ({
  hooks: {
    onTurnStart(E, c) {
      if (E.fxOf(c, 'rage') && !E.fxOf(c, 'bear')) E.addFx(c, { id: 'bear', name: 'Rage of the Wilds (bear)', resist: ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder'], endsWhenDown: true }, c);
    },
  },
});

// Gunslinger (Matthew Mercer's Martial Archetype, v1.2). Grit points pay for one "shot" on a firearm
// attack, named before the roll; grit comes back on a natural 20 and on a killing blow. Table
// rulings: misfire and reload are not tracked, and the Arms trick shot is left out.
// A player readies the shot; the script spends grit by a simple order: Deadeye when the shot would
// be at disadvantage, Violent Shot when one more die would finish the target, a leg shot at a
// standing enemy that fights hand to hand.
const gunslinger = (x) => {
  const L = x.lvl('fighter');
  const n = Math.max(1, x.mod('wis'));
  const dc = 8 + x.prof + x.mod('dex');
  const left = (c) => n - used(c, 'grit');
  const firearm = (act) => !!act && !act.melee && !act.spell && act.weapon !== false && act.kind === 'attack';
  const die = (act) => `1d${(/d(\d+)/.exec(act.dmg[0][0]) || [0, 6])[1]}`;
  const SHOTS = { deadeye: 'Deadeye Shot', violent: 'Violent Shot', head: 'Trick Shot (head)', legs: 'Trick Shot (legs)', torso: 'Trick Shot (torso)' };
  const regain = (E, c, why) => {
    if (used(c, 'grit') <= 0) return;
    c.used.grit -= 1;
    E.log('info', `${c.name} regains a grit point (${why}).`, c);
  };
  const hampered = (E, c) => ['prone', 'restrained', 'blinded', 'poisoned', 'frightened'].some((k) => E.has(c, k)) || engagedNow(E, c);
  const pick = (E, c, t, act) => {
    if (hampered(E, c)) return 'deadeye';
    const avg = act.dmg.reduce((s, [d]) => s + avgDice(d), 0);
    if (L >= 7 && t.hp > avg && t.hp <= avg + avgDice(die(act))) return 'violent';
    const basic = E.action(t, t.tpl.basic);
    if (L >= 10 && !c.turn.tricked && basic && basic.melee && !E.has(t, 'prone') && !E.condImmune(t, 'prone') && !['huge', 'gargantuan'].includes(t.tpl.size)) return 'legs';
    return null;
  };
  const actions = {};
  for (const [key, name] of Object.entries(SHOTS)) {
    if ((key === 'violent' && L < 7) || (['head', 'legs', 'torso'].includes(key) && L < 10)) continue;
    actions[`shot_${key}`] = {
      kind: 'special', cost: 'free', noTarget: true, name: `${name} on the next shot (1 grit)`,
      offer: (E, c) => left(c) > 0 && !c.turn.shot,
      run(E, c) {
        c.turn.shot = key;
        E.log('info', `${c.name} lines up a ${name} (grit ${left(c)} of ${n}).`, c);
      },
    };
  }
  return {
    actions,
    flags: L >= 7 ? { init: (x.tpl.init || 0) + x.prof } : {},
    hooks: {
      // the shot is named, and the grit spent, before the roll
      attackMods(E, c, ctx) {
        c.turn.shotLive = null;
        if (!firearm(ctx.act) || left(c) <= 0) return null;
        const mine = !!(E.playerRuns && E.playerRuns(c));
        const shot = mine ? c.turn.shot : E.current === c ? pick(E, c, ctx.tgt, ctx.act) : null;
        if (!shot) return null;
        c.turn.shot = null;
        spendUse(c, 'grit');
        c.turn.shotLive = shot;
        if (!mine) E.log('info', `${c.name} spends grit on a ${SHOTS[shot]} (${left(c)} of ${n} left).`, c);
        if (['head', 'legs', 'torso'].includes(shot)) c.turn.tricked = true;
        return shot === 'deadeye' ? { adv: 'Deadeye Shot' } : null;
      },
      onMiss(E, c) { c.turn.shotLive = null; },
      onHit(E, c, ctx) {
        const shot = c.turn.shotLive;
        c.turn.shotLive = null;
        if (firearm(ctx.act) && ctx.crit && ctx.nat === 20) regain(E, c, 'a critical hit');
        if (!shot || shot === 'deadeye') return null;
        if (shot === 'violent') return { dmg: [[die(ctx.act), ctx.act.dmg[0][1], 'Violent Shot']] };
        if (shot === 'legs') return { fx: [{ fx: 'save', ability: 'str', dc, onFail: [{ fx: 'prone' }] }] };
        if (shot === 'head') return { fx: [{ fx: 'save', ability: 'con', dc, onFail: [{ fx: 'effect', effect: { id: 'trickHead', name: 'Trick Shot (head)', disAtk: true, announce: true }, dur: { who: 'tgt', when: 'end', turns: 1 } }] }] };
        return { fx: [{ fx: 'push', label: 'Trick Shot (torso)' }] };
      },
      afterHit(E, c, ctx) {
        if (firearm(ctx.act) && ctx.tgt.hp <= 0 && !ctx.tgt.tpl.pc) regain(E, c, 'a killing blow');
      },
    },
  };
};

// Arcane Archer: two special arrows between rests
const arcaneShot = (x) => {
  const n = x.uses('arcane shot', 2);
  const dice = x.lvl('fighter') >= 18 ? '4d6' : '2d6';
  return {
    hooks: {
      onHit(E, c, ctx) {
        if (E.current !== c || c.turn.shot || ctx.melee || !weaponHit(ctx) || used(c, 'arcaneShot') >= n) return null;
        c.turn.shot = true;
        spendUse(c, 'arcaneShot');
        return { dmg: [[dice, 'force', 'Bursting Arrow']] };
      },
    },
  };
};

// Peace Domain: a d4 once a turn for the bonded, on a roll that would otherwise fail
const emboldeningBond = (x) => ({
  onStart(E, c) {
    const bonded = E.alliesOf(c, true).filter((a) => !a.summonedBy).sort((a, b) => (b.tpl.level || 0) - (a.tpl.level || 0)).slice(0, x.prof);
    if (bonded.length < 2) return;
    E.log('info', `${c.name}'s Emboldening Bond joins ${bonded.map((a) => a.name).join(', ')}.`, c);
    for (const a of bonded) E.addFx(a, { id: 'bond', name: 'Emboldening Bond', boostDie: '1d4', perTurn: true }, c);
  },
});

// Grave Domain
const circleOfMortality = () => ({ flags: { healMaxDown: true } });
const pathToTheGrave = (x) => {
  const pick = (E, c) => foes(E, c).filter((t) => t.hp >= 80 && !E.fxOf(t, 'curse')).sort((a, b) => b.hp - a.hp)[0] || null;
  return {
    actions: {
      pathToTheGrave: {
        kind: 'special', name: 'Channel Divinity: Path to the Grave', aiTarget: pick,
        when: (E, c) => E.round <= 3 && channelLeft(x, c) > 0 && friends(E, c).length > 0 && !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || pick(E, c);
          if (!t) return;
          spendUse(c, 'channel');
          E.log('act', `${c.name} marks ${t.name} for the grave.`, c);
          E.applyFx(c, t, [{ fx: 'curse' }]);
        },
      },
    },
    plan: ['pathToTheGrave'],
  };
};
const sentinelAtDeathsDoor = (x) => ({
  reactions: [{
    id: 'sentinel', name: "Sentinel at Death's Door", trigger: 'attacked', who: 'allyOrSelf', uses: x.uses("sentinel at death's door", Math.max(1, x.mod('wis'))),
    when: (E, me, ctx) => ctx.crit,
    run(E, me, ctx) { ctx.noCrit = true; E.log('info', `${me.name} turns the critical hit into a normal hit (Sentinel at Death's Door).`, me); },
  }],
});

// Soulknife
const psychicBlades = (x) => {
  const line = x.h.attacks.find((a) => /^Psychic Blades: Attack \(DEX\)/.test(a.name)) || x.h.attacks.find((a) => /^Psychic Blades/.test(a.name));
  if (!line) return null;
  const flat = (line.dmg.match(/[+-]\d+$/) || [''])[0];
  return {
    actions: { psychicBonus: { kind: 'attack', name: 'Psychic Blades (bonus attack)', toHit: line.toHit, melee: false, noRangePenalty: true, dmg: [[`1d4${flat}`, 'psychic']], cost: 'bonus' } },
    bonus: ['psychicBonus'],
  };
};
const geniesWrath = (x) => oncePerTurn('genie', anyAttack, () => [String(x.prof), 'fire', "Genie's Wrath"]);

// Gift of the Chromatic Dragon
const chromatic = (x) => ({
  actions: {
    chromatic: {
      kind: 'special', name: 'Chromatic Infusion', cost: 'bonus', noTarget: true, uses: 1,
      when: (E, c) => foes(E, c).length > 0,
      run(E, c) { E.log('act', `${c.name} infuses a weapon with dragon fire.`, c); E.addFx(c, { id: 'chromatic', name: 'Chromatic Infusion', extraDmg: [['1d4', 'fire']] }, c); },
    },
  },
  bonusFirst: ['chromatic'],
  reactions: ['preDamage', 'preHarm'].map((trigger) => ({
    id: 'reactiveResistance', name: 'Reactive Resistance', trigger, uses: x.prof,
    when: (E, me, ctx) => ctx.total >= 10 && ctx.parts.some((p) => ['acid', 'cold', 'fire', 'lightning', 'poison'].includes(p.type)),
    run(E, me, ctx) { ctx.mult = 0.5; ctx.note = 'Reactive Resistance halves it'; },
  })),
});

// Hexblade
const hexbladesCurse = (x) => {
  const pick = (E, c) => foes(E, c).sort((a, b) => b.hp - a.hp)[0] || null;
  return {
    actions: {
      hexCurse: {
        kind: 'special', name: "Hexblade's Curse", cost: 'bonus', noTarget: true, uses: x.uses("hexblade's curse", 1),
        when: (E, c) => !!pick(E, c),
        run(E, c) { const t = pick(E, c); c.memo.hexed = t.id; E.log('act', `${c.name} lays the Hexblade's Curse on ${t.name}.`, c); },
      },
    },
    [x.weaponFirst ? 'bonusFirst' : 'bonus']: ['hexCurse'],
    hooks: {
      attackMods(E, c, ctx) { return ctx.tgt.id === c.memo.hexed ? { critMin: 19 } : null; },
      onHit(E, c, ctx) { return ctx.tgt.id === c.memo.hexed ? { dmg: [[String(x.prof), ctx.act.dmg[0][1], "Hexblade's Curse"]] } : null; },
    },
  };
};
// Divine Soul: 2d4 on a failed save or a missed attack, once between rests
const favoredByTheGods = () => ({
  hooks: {
    fixMiss(E, c, ctx) {
      if (c.used.favored || ctx.gap > 6 || ctx.nat === 1) return null;
      c.used.favored = 1;
      return { add: rollDice(E.rng, '2d4').total, label: 'Favored by the Gods' };
    },
    forceSave(E, c, ctx) {
      if (c.used.favored || ctx.o.conc || ctx.total === undefined || ctx.dc - ctx.total > 6) return null;
      c.used.favored = 1;
      const r = rollDice(E.rng, '2d4');
      return ctx.total + r.total >= ctx.dc ? `Favored by the Gods +${r.total}: the save holds` : null;
    },
  },
});
const wrathOfTheStorm = (x) => ({
  reactions: [{
    id: 'wrath', name: 'Wrath of the Storm', trigger: 'hitBy', uses: x.uses('wrath of the storm', Math.max(1, x.mod('wis'))),
    when: (E, me, ctx) => ctx.melee && E.active(ctx.att),
    run(E, me, ctx) { E.saveEffect(me, { name: 'Wrath of the Storm', save: 'dex', dc: x.h.dc, dmg: [['2d8', 'lightning']], half: true }, [ctx.att]); },
  }],
});

// Mastermind: the Help action as a bonus action, for the friend who hits hardest
const masterOfTactics = () => {
  const pick = (E, c) => friends(E, c).filter((a) => !E.fxOf(a, 'helped') && !a.summonedBy && a.tpl.basic).sort((a, b) => E.expected(b, E.action(b, b.tpl.basic)) - E.expected(a, E.action(a, a.tpl.basic)))[0] || null;
  return {
    actions: {
      help: {
        kind: 'special', name: 'Master of Tactics (Help)', cost: 'bonus', ally: true, aiTarget: pick, when: (E, c) => !!pick(E, c),
        run(E, c, act, choice) {
          const t = E.get((choice.targets || [])[0]) || pick(E, c);
          if (!t) return;
          E.log('act', `${c.name} helps ${t.name}: advantage on the next attack.`, c);
          E.addFx(t, { id: 'helped', name: 'Help', advAtk: true, endsOnAttack: true, ends: { who: c.id, when: 'start', turns: 1 } }, c);
        },
      },
    },
    bonus: ['help'],
  };
};

// Clockwork Soul: cancel an enemy's advantage on an attack
const restoreBalance = (x) => ({
  reactions: [{
    id: 'restoreBalance', name: 'Restore Balance', trigger: 'attacked', who: 'allyOrSelf', uses: x.uses('restore balance', x.prof),
    when: (E, me, ctx) => ctx.mode === 'adv',
    run(E, me, ctx) { ctx.reroll = 'Restore Balance'; },
  }],
});

// Circle of Stars: the omen is weal or woe for the day, by the roll of a die
const cosmicOmen = (x) => {
  const n = x.uses('cosmic omen', x.prof);
  const left = (c) => n - used(c, 'omen');
  return {
    onStart(E, c) { c.memo.omen = E.rng.int(2) === 1 ? 'weal' : 'woe'; },
    reactions: [
      { id: 'omenWeal', name: 'Cosmic Omen (weal)', trigger: 'saveFailed', who: 'allyOrSelf',
        when: (E, me, ctx) => me.memo.omen === 'weal' && left(me) > 0 && ctx.dc - ctx.total <= 6 && !ctx.add,
        run(E, me, ctx) { spendUse(me, 'omen'); ctx.add = rollDice(E.rng, '1d6').total; ctx.note = `${me.name}'s Cosmic Omen`; } },
      { id: 'omenWoe', name: 'Cosmic Omen (woe)', trigger: 'attacked', who: 'allyOrSelf',
        when: (E, me, ctx) => me.memo.omen === 'woe' && left(me) > 0 && !ctx.crit && ctx.total - 6 < E.acOf(ctx.tgt) + ctx.acBonus,
        run(E, me, ctx) { spendUse(me, 'omen'); const r = rollDice(E.rng, '1d6'); ctx.acBonus += r.total; E.log('info', `${me.name}'s Cosmic Omen takes ${r.total} off the attack roll.`, me); } },
    ],
  };
};

// Armorer, Guardian model
const armorer = (x) => {
  const L = x.lvl('artificer');
  return {
    actions: {
      defensiveField: {
        kind: 'special', name: 'Defensive Field', cost: 'bonus', noTarget: true, uses: x.uses('defensive field', x.uses('guardian armor: defensive field', x.prof)),
        when: (E, c) => c.tempHp <= 0 && foes(E, c).length > 0,
        run(E, c) { E.tempHp(c, L, 'Defensive Field'); },
      },
    },
    bonusFirst: ['defensiveField'],
    hooks: { onHit(E, c, ctx) { return /Thunder Gauntlets/i.test(ctx.act.name) ? { fx: [markedBy('Thunder Gauntlets')] } : null; } },
  };
};

// Archfey (2024): Misty Step with the Refreshing Step rider, when a little cover helps
const stepsOfTheFey = (x) => ({
  actions: {
    feySteps: {
      kind: 'special', name: 'Steps of the Fey (Refreshing Step)', cost: 'bonus', noTarget: true, uses: x.uses('steps of the fey', Math.max(1, x.mod('cha'))),
      when: (E, c) => c.tempHp <= 0 && c.hp < c.maxHp * 0.7 && foes(E, c).length > 0,
      run(E, c) { const r = rollDice(E.rng, '1d10'); E.log('act', `${c.name} steps through the mist (Refreshing Step).`, c); E.tempHp(c, r.total, 'Refreshing Step'); },
    },
  },
  bonus: ['feySteps'],
});
const hiddenStep = (x) => ({
  actions: {
    hiddenStep: {
      kind: 'special', name: 'Hidden Step', cost: 'bonus', noTarget: true, uses: x.uses('hidden step', x.prof),
      when: (E, c) => c.turn.action && foes(E, c).length > 0,
      run(E, c) { E.log('act', `${c.name} vanishes (Hidden Step).`, c); E.addFx(c, { cond: 'invisible', name: 'Hidden Step', endsOnAttack: true, ends: { who: c.id, when: 'start', turns: 1 } }, c); },
    },
  },
  bonus: ['hiddenStep'],
});
const gunner = (x) => { if (x.tpl.actions.ranged) x.tpl.actions.ranged.noRangePenalty = true; return {}; };

// ---------------------------------------------------------------------------------------------
// Companions and Wild Shape (the creatures themselves are in companions.js)
// ---------------------------------------------------------------------------------------------
const bringAlong = (make) => (x) => ({
  onStart(E, c) {
    for (const tpl of [].concat(make(x.h, x))) {
      const pet = E.spawn(tpl, { side: c.side, name: tpl.name, after: c });
      pet.summonedBy = c.id;
      E.log('info', `${tpl.name} is at ${c.name}'s side.`, c);
    }
  },
});

// Artillerist: the cannons are already standing. Firing them takes the maker's bonus action each round.
const eldritchCannons = (x) => {
  const two = x.lvl('artificer') >= 15;
  const part = bringAlong((h, y) => (two ? [cannon(h, y, 'ballista', 1), cannon(h, y, 'second', 2)] : [cannon(h, y, 'ballista', 1)]))(x);
  const start = part.onStart;
  return {
    onStart(E, c) {
      start(E, c);
      // with friends to shield, the second cannon is a Protector
      if (two && friends(E, c).filter((a) => !a.tpl.companion).length >= 2) {
        const second = E.side(c.side).find((p) => p.summonedBy === c.id && /Cannon 2/.test(p.name));
        if (second) { second.memo.protector = true; second.name = second.name.replace('Force Ballista', 'Protector'); }
      }
    },
    actions: {
      fireCannons: {
        kind: 'special', name: two ? 'Eldritch Cannons (fire)' : 'Eldritch Cannon (fire)', cost: 'bonus', noTarget: true,
        when: (E, c) => foes(E, c).length > 0 && E.side(c.side).some((p) => p.summonedBy === c.id && p.tpl.companion && E.active(p)),
        run(E, c) { c.memo.cannons = E.round; },
      },
    },
    bonusFirst: ['fireCannons'],
  };
};

// Fathomless: the tentacle strikes as a bonus action
const tentacle = (x) => ({
  actions: { tentacle: meleeAttack('Tentacle of the Deeps', x.h.spellHit || 2 + x.prof + x.mod('cha'), [[x.lvl('warlock') >= 10 ? '2d8' : '1d8', 'cold']], { cost: 'bonus', spell: true, weapon: false, melee: false, noRangePenalty: true }) },
  bonus: ['tentacle'],
});

// Circle of the Moon: an elemental's body as a bonus action. From 18th level the druid casts as usual in it.
const wildShape = (x) => {
  const L = x.lvl('druid');
  if (!(x.h.subclasses || {}).druid || !/moon/.test(x.h.subclasses.druid)) return null;
  const ref = L >= 10 ? 'srd-earth-elemental' : L >= 6 ? 'srd-giant-spider' : 'srd-dire-wolf';
  const casts = L >= 18;
  const uses = L >= 20 ? undefined : x.uses('wild shape', 2);
  const ready = (E, c) => {
    if (!c.tpl.forms) { const f = formFrom(c.tpl, ref, x.h.abil); if (!f) return false; c.tpl.forms = { beast: f }; }
    return true;
  };
  return {
    actions: {
      wildShape: {
        kind: 'special', name: 'Wild Shape', cost: 'bonus', noTarget: true, uses,
        when: (E, c) => !c.form && foes(E, c).length > 0 && ready(E, c) && (casts || !c.conc || c.hp < c.maxHp * 0.5),
        run(E, c) { shape(E, c, 'beast'); },
      },
    },
    bonusFirst: ['wildShape'],
    late: [{ use: 'formStrike', if: (E, c) => !!c.form }],
    hooks: { onZero: (E, c, ctx) => unshape(E, c, ctx) },
  };
};

// Circle of Stars: the Archer's bolt, a bonus action every turn while the form is up
const starryForm = (x) => ({
  actions: {
    starryArcher: {
      kind: 'attack', name: 'Starry Form (Archer)', toHit: x.h.spellHit, melee: false, noRangePenalty: true, spell: true, weapon: false, cost: 'bonus',
      dmg: [[`${x.lvl('druid') >= 10 ? 2 : 1}d8+${Math.max(0, x.mod('wis'))}`, 'radiant']],
    },
  },
  bonus: ['starryArcher'],
});

// ---------------------------------------------------------------------------------------------
// The book. Several sheet names may lead to one entry; an entry is applied once.
// ---------------------------------------------------------------------------------------------
const BOOK = {
  'second wind': secondWind,
  'action surge': actionSurge,
  indomitable,
  'sneak attack': sneakAttack,
  'cunning action': cunningAction,
  'steady aim': steadyAim,
  'superiority dice': battleMaster, 'combat superiority': battleMaster, maneuvers: battleMaster, 'maneuver options': battleMaster, 'martial adept': battleMaster,
  riposte: battleMaster, parry: battleMaster, 'precision attack': battleMaster, 'trip attack': battleMaster, 'trip attack (str.)': battleMaster,
  'trip attack (dex.)': battleMaster, 'menacing attack': battleMaster, 'goading attack': battleMaster, 'pushing attack': battleMaster,
  'disarming attack': battleMaster, 'disarming attack (str.)': battleMaster, 'disarming attack (dex.)': battleMaster,
  'uncanny dodge': uncannyDodge,
  evasion,
  rage, 'rage (enter)': rage,
  'reckless attack': recklessAttack,
  'danger sense': dangerSense,
  'feral instinct': feralInstinct,
  'flurry of blows': flurry,
  'patient defense': patientDefense,
  'stunning strike': stunningStrike,
  'deflect missiles': deflect, 'deflect attack': deflect, 'deflect attacks': deflect,
  'divine smite': divineSmite, "paladin's smite": divineSmite,
  'improved divine smite': improvedSmite, 'radiant strikes': improvedSmite,
  'lay on hands': layOnHands,
  'aura of protection': auraOfProtection,
  'aura of courage': auraOfCourage,
  'channel divinity: turn undead': turnUndead,
  'bardic inspiration': bardicInspiration,
  'flash of genius': flashOfGenius,
  'convert sorcery points': fontOfMagic,
  'repelling blast': repellingBlast,
  lucky, 'luck points': lucky,
  'war caster': warCaster,
  sharpshooter,
  'crossbow expert': crossbowExpert,
  'elven accuracy': elvenAccuracy,
  'inspiring leader': inspiringLeader,
  'weapon mastery': mastery,
  // subclass and one-off features
  'divine strike': divineStrike, 'blessed strikes': divineStrike,
  'harness divine power': harness,
  'dampen elements': dampenElements,
  'fey step': stepAway('feyStep', 'Fey Step'), 'starlight step': stepAway('starlightStep', 'Starlight Step'),
  'disciple of life': discipleOfLife, 'blessed healer': blessedHealer, 'supreme healing': supremeHealing,
  'channel divinity: preserve life': preserveLife,
  'rakish audacity': rakishAudacity,
  'fey presence': feyPresence, 'misty escape': mistyEscape, 'beguiling defenses': charmProof, 'dark delirium': darkDelirium,
  'eldritch smite': eldritchSmite, lifedrinker,
  'channel divinity: vow of enmity': vowOfEnmity, 'vow of enmity': vowOfEnmity, 'soul of vengeance': vowOfEnmity,
  'avenging angel': avengingAngel,
  'elemental affinity': elementalAffinity, 'elemental affinity (acid)': elementalAffinity, 'elemental affinity (fire)': elementalAffinity,
  'draconic presence': draconicPresence,
  portent,
  'war magic': warMagic, 'improved war magic': warMagic, 'eldritch strike': eldritchStrike,
  'shield master': shieldMaster, 'shield master shove': shieldMaster, 'shield master evasion': shieldMaster,
  'mage slayer': mageSlayer, 'mage slayer attack': mageSlayer,
  'defensive duelist': defensiveDuelist,
  'cutting words': cuttingWords,
  'evasion step': evasionStep,
  'fast hands': () => ({}),
  'arcane firearm': firearm,
  'warding flare': wardingFlare,
  'improved critical': improvedCritical, 'superior critical': improvedCritical,
  'breath weapon': breathWeapon, 'breath weapon (gold)': breathWeapon,
  'great weapon fighting': greatWeapon,
  'two-weapon fighting': offHand, 'dual wielder': offHand,
  'favored foe': favoredFoe, 'planar warrior': planarWarrior, 'gathered swarm': gatheredSwarm,
  'spell-storing item': spellStoring, 'sonic beam (spell-storing item)': spellStoring,
  bladesong,
  'focused aim': focusedAim, 'deft strike': deftStrike, 'hand of harm': handOfHarm, "physician's touch": handOfHarm, 'hand of healing': handOfHealing,
  'open hand technique': openHand, 'flurry of blows: topple': openHand, 'flurry of blows: addle': openHand, 'flurry of blows: push': openHand,
  'wholeness of body': wholeness,
  'grovel, cower, and beg': grovel, 'pack tactics': packTactics,
  'healing hands': healingHands,
  'radiant soul': revelation('radiantSoul', 'Radiant Soul', 'radiant', false), 'necrotic shroud': revelation('necroticShroud', 'Necrotic Shroud', 'necrotic', true),
  'healing light': healingLight, 'healing light: expend healing': healingLight,
  'unsettling words': unsettlingWords,
  'ancestral protectors': ancestralProtectors, 'spirit shield': spiritShield, 'surprise attack': surpriseAttack, 'rage of the wilds': rageOfTheWilds,
  'arcane shot': arcaneShot, 'bursting arrow': arcaneShot, 'grasping arrow': arcaneShot,
  grit: gunslinger, 'deadeye shot': gunslinger, quickdraw: gunslinger, 'violent shot': gunslinger, 'trick shot': gunslinger,
  'emboldening bond': emboldeningBond,
  'circle of mortality': circleOfMortality, 'channel divinity: path to the grave': pathToTheGrave, "sentinel at death's door": sentinelAtDeathsDoor,
  'psychic blades': psychicBlades, 'psychic blades: attack (dex)': psychicBlades, 'psychic blades: attack (str)': psychicBlades,
  'psychic blades: bonus attack (dex)': psychicBlades, 'psychic blades: bonus attack (str)': psychicBlades,
  "genie's wrath (efreeti)": geniesWrath, "genie's wrath": geniesWrath,
  'gift of the chromatic dragon': chromatic, 'gift of the chromatic dragon: chromatic infusion': chromatic, 'gift of the chromatic dragon: reactive resistance': chromatic,
  "hexblade's curse": hexbladesCurse, 'favored by the gods': favoredByTheGods, 'wrath of the storm': wrathOfTheStorm,
  'master of tactics': masterOfTactics,
  'restore balance': restoreBalance,
  'cosmic omen': cosmicOmen,
  guardian: armorer, 'thunder gauntlets': armorer, 'defensive field': armorer, 'guardian armor: defensive field': armorer,
  'guardian armor: thunder gauntlets': armorer, 'guardian armor: thunder gauntlets (str)': armorer,
  'steps of the fey': stepsOfTheFey, 'misty step: refreshing step': stepsOfTheFey, 'misty step: taunting step': stepsOfTheFey,
  'hidden step': hiddenStep,
  gunner,
  'crossbow expert attack': crossbowExpert,
  // companions and forms
  'steel defender': bringAlong(steelDefender),
  'drake companion': bringAlong(drake), 'drake companion (fire)': bringAlong(drake), 'drake companion: command': bringAlong(drake), 'drake companion: summon': bringAlong(drake),
  "ranger's companion": bringAlong(primalBeast), 'beast of the land': bringAlong(primalBeast), 'primal companion: take action': bringAlong(primalBeast),
  'eldritch cannon': eldritchCannons, 'create eldritch cannon': eldritchCannons, 'eldritch cannon: force ballista': eldritchCannons,
  'eldritch cannon: protector': eldritchCannons, 'eldritch cannon: flamethrower': eldritchCannons, 'explosive cannon': eldritchCannons,
  'tentacle of the deeps': tentacle, 'tentacle of the deeps: attack': tentacle, 'tentacle of the deeps: move': tentacle, 'tentacle of the deeps: summon': tentacle,
  'wild shape': wildShape, 'combat wild shape': wildShape, 'circle forms': wildShape, 'elemental wild shape': wildShape, archdruid: wildShape,
  'starry form': starryForm, 'starry form: archer': starryForm, 'starry form: chalice': starryForm, 'starry form: dragon': starryForm, 'twinkling constellations': starryForm,
  'deflect missiles attack': deflect, 'deflect attack: redirect attack': deflect,
};

// Has an effect in a fight, and is left out on purpose. The reason is shown with the name.
const SKIPPED = {
  'dragon wings': 'flight is not run: a flying character could not be reached by anything on the ground',
  'split time, shared mind': 'the engine holds one concentration spell for each caster',
  'time shift': 'changes places with a friend, which the three ranks do not show',
  'channel divinity: abjure enemy': 'the Channel Divinity always goes to Vow of Enmity',
  'channel divinity: balm of peace': 'the Channel Divinity is kept for other uses',
  'careful spell': 'spells do not catch friends in this simulator',
  'distant spell': 'range is not measured',
  'agile parry': 'gives up weapon damage for armour class, which the character would rarely choose',
  "kensei's shot": 'the bonus action goes to Flurry of Blows',
  'quickened healing': 'a weak use of ki in a fight',
  'empowered healing': 'a small gain on healing dice',
  'psionic sorcery': 'casting psionic spells from sorcery points is not run',
  'psychic defenses': 'advantage against charm and fright is not run',
  'wild surge': 'the Wild Magic table is not run',
  'elemental adept (lightning)': 'ignoring resistance is not run',
  'reactive spell': 'a spell in place of an opportunity attack is not run',
  'perfected armor': 'the pull of the Guardian armour is not run', 'perfected armor - guardian': 'the pull of the Guardian armour is not run', 'perfected armor: guardian': 'the pull of the Guardian armour is not run',
  'telekinetic - shove': 'a five-foot shove does not change a rank', 'telekinetic (charisma)': 'a five-foot shove does not change a rank',
  'sunlight sensitivity': 'the light is not tracked',
  'instinctive pounce': 'movement is not measured',
  'psionic power: psionic energy': 'the dice are spent outside a fight', 'psionic power: recovery': 'the dice are spent outside a fight',
  'pact of the chain features: bombyx mori': 'the moth does not fight; it holds a second concentration spell, which is not run',
  'detonate eldritch cannon': 'the cannons are kept firing',
  'fortified position': 'cover from the cannons is not run',
  'second wind: tactical shift': 'movement is not measured', 'tactical shift': 'movement is not measured',
};

// Already inside the sheet's own numbers (armour class, attack bonus, damage, hit points, initiative,
// attacks per action), or run elsewhere (spells, Metamagic), so there is nothing to add.
const IN_NUMBERS = [
  'extra attack', 'fighting style', 'archery', 'dueling', 'defense', 'unarmored defense', 'martial arts', 'tough', 'alert',
  'spellcasting', 'pact magic', 'font of magic', 'metamagic', 'sorcery points', 'quickened spell', 'twinned spell', 'empowered spell',
  'heightened spell', 'subtle spell', 'metamagic adept', 'sorcery points (metamagic adept)', 'ki', 'ki points', 'focus points', "monk's focus",
  'ki-empowered strikes', 'ki-fueled attack', 'psychic resilience', 'fighting style: thrown weapon fighting', 'arms of the astral self', 'arms of the astral self (wis.)', 'arms of the astral self: summon', 'empowered strikes', 'unarmed strike', 'unarmed strike (dex.)', 'draconic resilience', 'agonizing blast',
  'agonizing blast (eldritch blast)', 'eldritch invocations', 'channel divinity', 'destroy undead', 'lay on hands pool', 'lay on hands: heal',
  'lay on hands: healing pool', 'potent spellcasting', 'expertise', 'jack of all trades',
  'dexterous attacks', 'thrown weapon fighting', 'fighting style feat', 
  'divine health', 'purity of body', 'battle ready', 'hex warrior',
  'thirsting blade', 'bladesong training', 'training in war and song', 'bonus proficiencies', 'bonus proficiency', 'bonus cantrip', 'bonus cantrips',
  'heavy armor master', 'medium armor master', 'fighting initiate', 'magic initiate (cleric)',
  'magic initiate (wizard)', 'eldritch adept', 'extra cantrip', 'oath spells', 'domain spells', 'circle spells', 'expanded spell list',
  'artificer specialist', 'tools of the trade', 'arcane armor', 'power armor', 'armor model', 'pact boon', 'pact of the blade', 'pact of the tome',
  'pact of the chain', 'mystic arcanum', 'mystic arcanum (6th level)', 'mystic arcanum (7th level)', 'mystic arcanum (8th level)',
  'mystic arcanum (9th level)', 'gold dragon', 'copper dragon', 'red dragon', 'dragon ancestor', 'draconic ancestry', 'damage resistance',
  'celestial resistance', 'infernal legacy', 'hellish resistance', 'constructed resilience', 'integrated protection', 'natural armor',
  'armored casing', 'dwarven resilience', 'dwarven toughness', 'fey ancestry', 'trance', 'brave', 'gnome cunning', 'gnomish cunning',
  'mental discipline', 'necrotic resistance', 'light bearer', 'aura improvements', 'weapon mastery', '4: weapon mastery',
  'psionic spells', 'clockwork magic', 'divine magic', 'additional magical secrets', 'magical secrets', 
  'ritual casting', 'cantrip formulas', 'infusions known', 'infused items', 'the right tool for the job',
];

// Nothing to do inside a fight, or nothing the simulator's positions can show.
const OUTSIDE = [
  /ability score|proficienc|language|darkvision|tool expertise|magical tinkering|infuse item|tinker'?s magic|divine intervention|divine sense/,
  /arcane recovery|ritual|slow fall|unarmored movement|step of the wind|fast movement|primeval awareness|primal knowledge|natural explorer/,
  /favored enemy|deft explorer|canny|roving|land's stride|hide in plain sight|vanish|timeless body|tongue of the sun|druidic|wild companion/,
  /song of rest|countercharm|peerless skill|reliable talent|thieves' cant|second-story work|supreme sneak|use magic device/,
  /cleansing touch|mask of many faces|devil'?s sight|eldritch sight|eyes of the rune keeper|beast speech|book of ancient secrets|gift of the depths/,
  /aspect of the moon|whispers of the grave|shroud of shadow|one with shadows|undying servitude|eldritch spear|eldritch mind|lessons of the first ones/,
  /hold breath|amorphous|shape self|natural resilience|built for success|healing machine|mechanical nature|sentry's rest|specialized design/,
  /student of war|know your enemy|master of intrigue|insightful manipulator|magical guidance|divination savant|wizardly quill|awakened spellbook/,
  /speech of the woods|powerful build|firbolg magic|control air and water|emissary of the sea|guardians? of the depths|amphibious/,
  /astral fire|astral trance|feline agility|cat'?s (claws|talent)|kenku|mimicry|expert (duplication|forgery)/,
  /keen mind|linguist|actor|observant|skill expert|prodigy|mobile|speedy|squat nimbleness|durable|arcanist|telepathic speech|mind link/,
  /universal speech|silver tongue|create pact weapon|pact of the blade: |weapon bond|arcane charge|magic awareness|detect portal|planar wanderer/,
  /portal jump|create magical maps|awareness|scribe'?s pen|shiftweave|goggles of night|mark of|dragonmark|deductive intuition|intuition/,
  /lvl 22|lvl22|level 22|farmer|wayfarer|house medani|scion of the outer planes|dark bargain|fate card|solar powered|increase (two|three) scores/,
  /^(wisdom|charisma|intelligence|strength|dexterity|constitution|good|fire|coast|desert|forest|beasts|dragons|humanoids|cantrip|winged|efreeti)$/,
  /speedy recovery|genie's vessel|bottled respite|chameleon carapace|secondary arms|sleepless|relentless avenger|magical cunning/,
  /land's stride|nature's ward|stillness of mind|unarmored movement improvement/,
  /sacred oath|arcane tradition|sorcerous origin|otherworldly patron|divine domain|monastic tradition|martial archetype|roguish archetype|primal path/,
  /bard college|druid circle|ranger archetype|ranger conclave|artificer specialist|warrior of|roguish|subclass|implements of mercy|hit point/,
  /^skills$|^alignment$|keen senses|^core \w+ traits$|eldritch invocation options|artificer infusions|magic item (adept|savant|master|plans)|replicate magic item/,
  /weapon training|combat training|stonecunning|initiate a circle spell|^circle spell: |arcane shot options|font of inspiration|wild shape improvement/,
  /armor modifications|additional fighting style|spells of the mark|fiendish legacy|animal speaker|acolyte of nature|adventurer's atlas|arcane archer lore/,
  /blindsense|cthonic legacy|construct resilience|draconic gift|dual mind|fairy magic|fleet of foot|genie kind|gift of the sea|gifted scribe|githzerai psionics/,
  /guided precision|halfling nimbleness|high elf descent|implement of peace|kensei weapon|path of the kensei|long-limbed|mage hand legerdemain|mapping magic/,
  /mask of the wild|naturally stealthy|psychic whispers|psi-bolstered knack|scribe's insight|severed from dreams|skill versatility|sneaky|speech of beast/,
  /star map|thri-kreen telepathy|tireless|variant tiefling|wards and seals|warped being|unfailing inspiration|tactical mind|metamorphosis|mortal coil/,
  /lay on hands: purify poison|remarkable athlete|eldritch master|^flight$|slow \(javelin\)|shotgun, \+1|thousand forms|beast spells|^psionic power$|^brace$/,
  /channel divinity: charm animals|fancy footwork|magical inspiration|chronostride|primal strike|slippery mind|otherworldly presence|seeker of souls/,
  /invasive thoughts|eyes of the grave|one with the blade|^claws$|power armor - create armor|arcane armor - create armor/,
  /^\d+: ability|draconic flight \(passive\)|blessed strikes?: |evocation savant/,
];

export function featureParts(h, tpl, base = {}) {
  const lvl = (k) => (h.classes || {})[k] || 0;
  const names = [...new Set([...Object.keys(h.features || {}), ...(h.feats || []), ...(h.options || [])])];
  const y2024 = names.some((n) => /weapon mastery|focus points|\((sap|vex|topple|nick|graze|slow|push|cleave)\)$/.test(n));
  const x = {
    h, tpl, lvl, y2024, prof: h.prof || 2, frontline: !!base.frontline, weaponFirst: !!base.weaponFirst, atWill: base.atWill || 0,
    mod: (a) => Math.floor(((h.abil || {})[a] ?? 10) / 2 - 5),
    f: (n) => (h.features || {})[n],
    uses: (n, d) => ((h.features || {})[n] || {}).uses || d,
    has: (n) => names.includes(n),
  };
  const parts = []; const run = []; const numbers = []; const outside = []; const unknown = []; const skipped = [];
  const done = new Set();
  const nulled = new Set();
  for (const n of names) {
    const entry = BOOK[n];
    if (entry) {
      if (done.has(entry)) { (nulled.has(entry) ? outside : run).push(n); continue; }
      done.add(entry);
      const part = entry(x);
      if (part) { parts.push(part); run.push(n); } else { outside.push(n); nulled.add(entry); }
    } else if (SKIPPED[n]) skipped.push(n);
    else if (/^(sap|vex|topple|nick|graze) \(.+\)$/.test(n)) run.push(n);
    else if (IN_NUMBERS.includes(n)) numbers.push(n);
    else if (/ spells$| magic$/.test(n) && !/^(spell|wild|fairy)|war magic/.test(n)) numbers.push(n);
    else if (OUTSIDE.some((re) => re.test(n)) || /\((sap|vex|topple|nick|graze|slow|push|cleave)\)$/.test(n)) outside.push(n);
    else unknown.push(n);
  }
  // options written "longsword (sap)" belong to Weapon Mastery even when the feature line is missing
  if (!done.has(mastery) && names.some((o) => /\((sap|vex|topple|nick|graze)\)$|^(sap|vex|topple|nick|graze) \(/.test(o))) {
    const part = mastery(x);
    if (part) parts.push(part);
  }
  const drink = potions(x);
  if (drink) parts.push(drink);
  return { parts, run, numbers, outside, unknown, skipped, why: SKIPPED, x };
}

// ---------------------------------------------------------------------------------------------
// Merging parts into a template
// ---------------------------------------------------------------------------------------------
const FIRST = ['rerollSave', 'forceSave', 'skipTurn', 'opportunity', 'onZero', 'fixMiss'];
function compose(name, fns) {
  if (fns.length === 1) return fns[0];
  if (name === 'onHit') {
    return (E, c, ctx) => {
      const out = { dmg: [], fx: [] };
      for (const f of fns) { const r = f(E, c, ctx); if (r) { out.dmg.push(...(r.dmg || [])); out.fx.push(...(r.fx || [])); } }
      return out.dmg.length || out.fx.length ? out : null;
    };
  }
  if (name === 'attackMods' || name === 'defendMods') {
    return (E, c, ctx) => {
      const out = {};
      for (const f of fns) {
        const r = f(E, c, ctx);
        if (!r) continue;
        out.adv = out.adv || r.adv;
        out.dis = out.dis || r.dis;
        if (r.bonus) out.bonus = (out.bonus || 0) + r.bonus;
        if (r.critMin) out.critMin = Math.min(out.critMin || 20, r.critMin);
      }
      return out;
    };
  }
  if (FIRST.includes(name)) return (E, c, ctx) => { for (const f of fns) { const r = f(E, c, ctx); if (r) return r; } return null; };
  return (E, c, ctx) => { for (const f of fns) f(E, c, ctx); };
}

export function applyParts(tpl, parts) {
  const hooks = {};
  const note = (name, fn) => { if (fn) (hooks[name] = hooks[name] || []).push(fn); };
  for (const [k, fn] of Object.entries(tpl.hooks || {})) note(k, fn);
  const front = []; const bonusFirst = []; const bonus = []; const free = []; const late = [];
  for (const p of parts) {
    Object.assign(tpl.actions, p.actions || {});
    Object.assign(tpl, p.flags || {});
    front.push(...(p.plan || []));
    bonusFirst.push(...(p.bonusFirst || []));
    bonus.push(...(p.bonus || []));
    free.push(...(p.free || []));
    late.push(...(p.late || []));
    if (p.reactions) tpl.reactions = [...(tpl.reactions || []), ...p.reactions];
    for (const [k, fn] of Object.entries(p.hooks || {})) note(k, fn);
    note('onFightStart', p.onStart);
  }
  tpl.plan = [...front, ...(tpl.plan || [])];
  if (late.length) {
    const routine = (e) => ['meleeRoutine', 'rangedRoutine', 'cantrip', 'cantrip2'].includes(typeof e === 'string' ? e : e && e.use);
    const at = tpl.plan.findIndex(routine);
    tpl.plan.splice(at < 0 ? tpl.plan.length : at, 0, ...late);
  }
  tpl.bonusPlan = [...bonusFirst, ...(tpl.bonusPlan || []), ...bonus];
  if (free.length) tpl.freePlan = [...(tpl.freePlan || []), ...free];
  tpl.hooks = Object.fromEntries(Object.entries(hooks).map(([k, fns]) => [k, compose(k, fns)]));
  return tpl;
}
