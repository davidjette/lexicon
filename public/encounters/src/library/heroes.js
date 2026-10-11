// Simple versions of the player characters from the D&D Beyond exports (heroes-data.js, generated).
// "Simple" means: the sheet's own numbers, its best weapon routine, its best cantrip, its attack
// spells and a few well-known damage and healing spells, run by the plain plan-following tactics.
// No hand-written tactics, no subclass features beyond the handful named below.

import { HEROES } from './heroes-data.js';
import { melee, ranged, save, multi, healing, emanation } from '../data/lib.js';
import { avgDice } from '../engine/dice.js';
import { register } from '../data/registry.js';

const foes = (E, c) => E.enemiesOf(c).filter((t) => !t.down);
const worth = (a) => (a.toHit !== null && a.toHit !== undefined ? 0.65 : 0.6) * avgDice(a.dmg) * (a.count || 1);

export function buildHero(h) {
  const actions = {};
  const weapons = h.attacks.filter((a) => !a.spell && a.toHit !== null && a.toHit !== undefined);
  const best = (list) => list.slice().sort((x, y) => worth(y) - worth(x))[0];
  const armed = weapons.filter((a) => !/unarmed/i.test(a.name) || a.martialArts);
  const bestMelee = best(armed.filter((a) => a.melee)) || best(weapons.filter((a) => a.melee));
  const bestRanged = best(armed.filter((a) => !a.melee));
  const cantrip = best(h.attacks.filter((a) => a.spell && a.slot === 0));
  const routines = [];
  const mk = (a, extra = {}) => (a.toHit !== null && a.toHit !== undefined
    ? (a.melee ? melee : ranged)(a.name, a.toHit, [[a.dmg, a.type]], { n: a.count > 1 ? a.count : undefined, spell: a.spell || undefined, weapon: a.spell ? false : undefined, ...extra })
    : save(a.name, a.save, a.dc, [[a.dmg, a.type]], { spell: true, ...extra }));

  if (bestMelee) {
    actions.melee = mk(bestMelee);
    actions.meleeRoutine = multi(Array(h.perAction).fill('melee'));
    actions.meleeRoutine.name = `${bestMelee.name}${h.perAction > 1 ? ` x${h.perAction}` : ''}`;
    routines.push(['meleeRoutine', worth(bestMelee) * h.perAction]);
  }
  if (bestRanged) {
    actions.ranged = mk(bestRanged);
    actions.rangedRoutine = multi(Array(h.perAction).fill('ranged'));
    actions.rangedRoutine.name = `${bestRanged.name}${h.perAction > 1 ? ` x${h.perAction}` : ''}`;
    routines.push(['rangedRoutine', worth(bestRanged) * h.perAction]);
  }
  if (cantrip) {
    actions.cantrip = mk(cantrip);
    routines.push(['cantrip', worth(cantrip)]);
  }
  // a second cantrip of another damage type, for targets the first cannot hurt
  const other = cantrip && best(h.attacks.filter((a) => a.spell && a.slot === 0 && a.type !== cantrip.type));
  if (other) {
    actions.cantrip2 = mk(other);
    routines.push(['cantrip2', worth(other) * 0.99]);
  }
  routines.sort((x, y) => y[1] - x[1]);

  const plan = [];
  // well-known spells from the sheet's list
  h.big.forEach((b, i) => {
    const id = `big${i}`;
    const title = b.name.replace(/\b\w/g, (ch) => ch.toUpperCase());
    if (b.area === 'aura') {
      actions[id] = emanation(title, { save: b.save, dc: h.dc, dmg: [[b.dmg, b.type]], on: ['enemyEnd', 'casterTurn'], uses: b.uses });
      plan.push({ use: id, if: (E, c) => !c.conc && [...c.engaged].some((x) => E.present(E.get(x))) });
    } else {
      actions[id] = save(title, b.save, h.dc, [[b.dmg, b.type]], { half: true, spell: true, uses: b.uses, area: b.area ? { type: 'near', max: 5, spread: 0.3 } : undefined });
      plan.push(b.area ? { use: id, if: (E, c) => foes(E, c).length >= 2 } : { use: id, chance: 0.6 });
    }
  });
  // attack spells with a level: two castings each
  h.attacks.filter((a) => a.spell && a.slot > 0).forEach((a, i) => {
    const id = `spell${i}`;
    actions[id] = mk(a, { uses: 2 });
    if (worth(a) > (routines[0] ? routines[0][1] : 0)) plan.push({ use: id });
  });
  // in melee, a character with a real weapon uses it, and does not shoot at disadvantage
  const meleeWorth = (routines.find((r) => r[0] === 'meleeRoutine') || [0, 0])[1];
  if (meleeWorth && routines[0][0] !== 'meleeRoutine' && meleeWorth >= 0.6 * routines[0][1]) {
    plan.push({ use: 'meleeRoutine', if: (E, c) => [...c.engaged].some((x) => E.active(E.get(x))) });
  }
  for (const [id] of routines) plan.push(id);

  const bonusPlan = [];
  h.heals.forEach((x, i) => {
    const id = `heal${i}`;
    actions[id] = healing(x.name.replace(/\b\w/g, (ch) => ch.toUpperCase()), x.dice, { cost: x.cost === 'bonus' ? 'bonus' : 'action', uses: x.uses, below: 0.4, spell: true });
    if (x.cost === 'bonus') bonusPlan.push(id);
    else plan.unshift({ use: id, if: (E, c) => E.alliesOf(c, true).some((a) => a.down || a.hp < a.maxHp * 0.3) });
  });
  if (h.monk && actions.melee) {
    actions.martialArts = { ...actions.melee, name: 'Martial Arts (bonus strike)', cost: 'bonus', n: 1 };
    bonusPlan.push('martialArts');
  }
  if (h.fighter >= 2) {
    actions.surge = {
      kind: 'special', name: 'Action Surge', cost: 'bonus', uses: 1, noTarget: true,
      when: (E, c) => !c.turn.action && foes(E, c).length > 0,
      run(E, c) { c.turn.action = true; E.log('act', `${c.name} uses Action Surge.`, c); },
    };
    bonusPlan.push('surge');
  }

  const sneak = h.rogue ? `${Math.ceil(h.rogue / 2)}d6` : null;
  const smites = h.paladin >= 2 ? Math.min(5, 1 + Math.ceil(h.paladin / 4)) : 0;
  const frontline = routines[0] && routines[0][0] === 'meleeRoutine';
  return {
    id: h.id, name: h.campaign === 'The Unforeseen' ? `${h.name} (Original, level ${h.level})` : h.name, side: 'pc', pc: true, hero: true, type: 'humanoid', smart: true, pos: frontline ? 'front' : 'back',
    sub: `${h.classLine} · ${h.campaign}`, level: h.level,
    ac: h.ac, hp: h.hp, init: h.init, abil: h.abil, saves: h.saves, resist: h.resist,
    actions, plan, bonusPlan,
    hooks: {
      onFightStart(E, c) {
        if (h.barbarian) E.addFx(c, { id: 'rage', name: 'Rage', resist: ['bludgeoning', 'piercing', 'slashing'], extraDmg: [[h.barbarian >= 9 ? '3' : '2', 'slashing']], extraMeleeOnly: true }, c);
      },
      onHit(E, c, ctx) {
        if (E.current !== c || ctx.act.spell) return null;
        const out = { dmg: [] };
        if (sneak && !c.turn.sneak && (ctx.mode === 'adv' || [...ctx.tgt.engaged].some((id) => id !== c.id && E.get(id) && E.get(id).side === c.side))) {
          c.turn.sneak = true;
          out.dmg.push([sneak, ctx.act.dmg[0][1], 'Sneak Attack']);
        }
        if (smites && ctx.melee && !c.turn.smote && (c.used.smite || 0) < smites) {
          c.turn.smote = true;
          c.used.smite = (c.used.smite || 0) + 1;
          out.dmg.push(['2d8', 'radiant', 'Divine Smite']);
        }
        return out.dmg.length ? out : null;
      },
    },
    basic: bestMelee ? 'melee' : bestRanged ? 'ranged' : 'cantrip', basicN: h.perAction, oa: bestMelee ? 'melee' : undefined,
  };
}

const creatures = {};
const groups = {};
for (const h of HEROES) {
  const t = buildHero(h);
  creatures[t.id] = t;
  (groups[h.campaign] = groups[h.campaign] || []).push(t.id);
}
register({
  creatures,
  library: Object.entries(groups).map(([campaign, ids]) => ({ group: `Characters: ${campaign}`, ids, ally: true })),
});
