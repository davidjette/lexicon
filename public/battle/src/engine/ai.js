// Tactics. A creature with a `brain` function (the three PCs) decides for itself; everything else
// walks its `plan` list in order and falls back to its multiattack.

import { isEngaged } from './zones.js?v=mv9oo28y';

const POS_WEIGHT = { front: 3, mid: 2, back: 1 };

function subActions(E, c, act) {
  if (act.kind !== 'multi') return [act];
  return act.options[0].map((id) => E.action(c, id)).filter(Boolean);
}

function isMeleeAction(E, c, act, opt = 0) {
  if (act.kind === 'multi') {
    const first = E.action(c, (act.options[opt] || act.options[0])[0]);
    return !!(first && first.melee);
  }
  return !!act.melee;
}

export function pickTarget(E, c, act, o = {}) {
  let foes = E.enemiesOf(c).filter((t) => !t.down || E.rules.attackDowned || o.includeDowned);
  if (act && act.notUndead) foes = foes.filter((t) => t.tpl.type !== 'undead' && t.tpl.type !== 'construct');
  if (act && act.only) foes = foes.filter((t) => act.only(E, t));
  // never the creature that has charmed you; not a creature marked as out of the fight for now
  const charmedBy = c.fx.filter((f) => f.cond === 'charmed').map((f) => f.srcId);
  foes = foes.filter((t) => !charmedBy.includes(t.id) && !t.memo.working && !t.tpl.untouchable);
  // a creature the party has agreed not to strike
  if (c.side === 'pc' && E.flags.spare) foes = foes.filter((t) => !E.hasTag(t, E.flags.spare));
  if (!foes.length) return null;
  let pool = foes;
  const melee = act && isMeleeAction(E, c, act, o.opt);
  if (melee) {
    const reach = foes.filter((t) => E.canReach(c, t));
    if (!reach.length) return null;
    const now = reach.filter((t) => isEngaged(c, t));
    pool = now.length && !(c.tpl.smart && E.rng.chance(0.3)) ? now : reach;
  }
  if (o.filter) {
    const f = pool.filter(o.filter);
    if (f.length) pool = f;
  }
  const focus = c.tpl.focus;
  return E.rng.weighted(pool, (t) => {
    let w = 1;
    // in a small room there is no back line
    if (c.side === 'monster' && !(melee && isEngaged(c, t))) w *= E.flags.closeQuarters ? 2 : POS_WEIGHT[t.pos] || 2;
    if (c.tpl.smart && t.conc) w *= 3;
    if (focus && (t.tpl.id === focus || E.hasTag(t, focus))) w *= 60;
    if (c.side === 'pc' || c.tpl.smart) w *= 1 + (1 - t.hp / Math.max(1, t.maxHp));
    if (c.side === 'pc' && t.tpl.boss && E.flags.focusBoss) w *= 8;
    if (!melee && E.has(t, 'invisible') && !c.tpl.eyeless && !c.tpl.truesight) w *= 0.2;
    if (o.weight) w *= o.weight(t);
    return w;
  });
}

function targetsFor(E, c, id, entry) {
  const act = E.action(c, id);
  if (entry && entry.target) {
    const t = entry.target(E, c);
    if (!t) return null;
    return Array.isArray(t) ? t.map((x) => x.id) : [t.id];
  }
  if (act.aiTarget) {
    const t = act.aiTarget(E, c);
    if (!t) return null;
    return Array.isArray(t) ? t.map((x) => x.id) : [t.id];
  }
  switch (act.kind) {
    case 'attack':
    case 'multi': {
      const t = pickTarget(E, c, act, { opt: entry && entry.opt });
      return t ? [t.id] : null;
    }
    case 'save': {
      if (act.area && act.area.type === 'engaged') {
        const n = [...c.engaged].filter((x) => E.present(E.get(x))).length;
        return n >= ((entry && entry.min) || 1) ? [] : null;
      }
      if (act.area && act.area.type === 'all') return E.enemiesOf(c).some((t) => !t.down) ? [] : null;
      const t = pickTarget(E, c, act);
      return t ? [t.id] : null;
    }
    case 'heal': {
      if (act.self) return c.hp < c.maxHp * 0.6 ? [c.id] : null;
      const pool = E.alliesOf(c, true).filter((a) => !E.has(a, 'noHeal') && a.hp < a.maxHp * (act.below || 0.5) && !(act.living && a.tpl.type === 'undead'));
      if (!pool.length) return null;
      pool.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return [pool[0].id];
    }
    default:
      return [];
  }
}

// Try one plan entry: a string id, { use, if, chance, opt, target, min, cost }, or a function.
export function tryPlan(E, c, entry, slot) {
  // an entry may be a function that makes its own choice (the spell book's castBest and friends)
  if (typeof entry === 'function') {
    const ch = entry(E, c, slot || 'action');
    return ch && E.usable(c, ch.act, ch) ? ch : null;
  }
  const e = typeof entry === 'string' ? { use: entry } : entry;
  const act = E.action(c, e.use);
  if (!act) return null;
  const cost = e.cost || act.cost || 'action';
  if (slot && cost !== slot) return null;
  if (!E.usable(c, e.use, { cost })) return null;
  if (e.if && !e.if(E, c)) return null;
  if (e.chance !== undefined && !E.rng.chance(e.chance)) return null;
  // do not keep throwing fire at something that cannot burn
  if ((act.kind === 'attack' || act.kind === 'save') && Array.isArray(act.dmg) && act.dmg.length) {
    const live = E.enemiesOf(c).filter((t) => !t.down);
    if (live.length && live.every((t) => act.dmg.every(([, type]) => E.resistMult(t, type) === 0))) return null;
  }
  let opt = typeof e.opt === 'function' ? e.opt(E, c) : e.opt;
  if (act.kind === 'multi' && opt === undefined) {
    // if nothing is in reach, use the first option that opens with a ranged attack
    if (isMeleeAction(E, c, act, 0) && !pickTarget(E, c, act, { opt: 0 })) {
      opt = act.options.findIndex((_, i) => !isMeleeAction(E, c, act, i));
      if (opt < 0) return null;
    }
  }
  const targets = targetsFor(E, c, e.use, { ...e, opt });
  if (!targets) return null;
  return { act: e.use, targets, opt, level: e.level, cost: e.cost };
}

function genericNext(E, c) {
  const t = c.tpl;
  // things that cost neither the action nor the bonus action (Action Surge)
  for (const p of t.freePlan || []) {
    const ch = tryPlan(E, c, p, 'free');
    if (ch) return ch;
  }
  if (c.turn.bonus) {
    for (const p of t.bonusPlan || []) {
      const ch = tryPlan(E, c, p, 'bonus');
      if (ch) return ch;
    }
  }
  if (c.turn.action) {
    for (const p of t.plan || []) {
      const ch = tryPlan(E, c, p, 'action');
      if (ch) return ch;
    }
    // fallback: the first multiattack, then anything that deals damage
    const acts = Object.entries(E.actions(c)).filter(([, a]) => (a.cost || 'action') === 'action');
    const order = [...acts.filter(([, a]) => a.kind === 'multi'), ...acts.filter(([, a]) => a.kind === 'attack' || a.kind === 'save')];
    for (const [id] of order) {
      const ch = tryPlan(E, c, id, 'action');
      if (ch) return ch;
    }
    c.turn.action = false;
  }
  return null;
}

// Haste: one more weapon attack, after everything else the turn holds
function hasteAttack(E, c) {
  if (c.turn.hasted || !E.any(c, 'hasteAttack')) return null;
  c.turn.hasted = true;
  const id = c.tpl.hasteWith || c.tpl.basic;
  const act = id && E.action(c, id);
  if (!act || act.kind !== 'attack' || act.spell) return null;
  const targets = targetsFor(E, c, id, {});
  if (!targets) return null;
  E.log('info', `${c.name} attacks once more (Haste).`, c);
  return { act: id, targets, free: true, one: true };
}

export const AI = {
  pickTarget,
  tryPlan,

  next(E, c) {
    return (c.tpl.brain ? c.tpl.brain(E, c) : genericNext(E, c)) || hasteAttack(E, c);
  },

  legendary(E, L, after) {
    if (E.rules.legendaryUse < 1 && !E.rng.chance(E.rules.legendaryUse)) return null;
    const legs = (L.tpl.legs || []).filter((l) => {
      if (l.heavy && !E.rules.legendaryHeavy) return false;
      const cost = l.cost || 1;
      if (L.legLeft < cost) return false;
      if (!E.usable(L, l.act, { cost: 'leg', legCost: cost })) return false;
      if (l.if && !l.if(E, L, after)) return false;
      return true;
    });
    const options = [];
    for (const l of legs) {
      const targets = targetsFor(E, L, l.act, l);
      if (targets) options.push({ l, targets });
    }
    if (!options.length) return null;
    const pick = E.rng.weighted(options, (o) => o.l.w || 1);
    return { act: pick.l.act, targets: pick.targets, cost: 'leg', legCost: pick.l.cost || 1 };
  },

  lair(E, c) {
    const ids = (c.tpl.lair || []).filter((id) => E.usable(c, id, { free: true }));
    const fresh = ids.filter((id) => id !== c.memo.lastLair);
    const pool = [];
    for (const id of fresh.length ? fresh : ids) {
      const targets = targetsFor(E, c, id, null);
      if (targets) pool.push({ act: id, targets, free: true });
    }
    return pool.length ? E.rng.pick(pool) : null;
  },

  // Everything the actor could legally do right now, for the override menu. `full` is for a player
  // running the turn: it adds free actions, the slot levels a spell can be cast at, and pulling back.
  options(E, c, kind, { full = false } = {}) {
    const out = [];
    const foes = E.enemiesOf(c).map((t) => ({ id: t.id, name: t.name }));
    // with ranks in play, an enemy a melee attack cannot get to is listed but marked out of reach
    const inReach = (act, opt) => (full && E.rules.movement && isMeleeAction(E, c, act, opt) ? foes.map((t) => ({ ...t, far: !E.canReach(c, E.get(t.id)) })) : foes);
    const friends = E.alliesOf(c, true).map((t) => ({ id: t.id, name: t.name }));
    const push = (id, act, extra = {}) => {
      const pool = act.ally || act.kind === 'heal' || act.kind === 'buff' ? friends : inReach(act, 0);
      const none = act.self || (act.area && (act.area.type === 'engaged' || act.area.type === 'all')) || act.noTarget;
      const base = { act: id, name: act.name, cost: extra.cost || act.cost || 'action', targets: none ? [] : pool, ...extra };
      if (full && act.slot && c.slots && !act.pact) {
        const levels = Object.keys(c.slots).map(Number).filter((l) => l >= act.slot && c.slots[l] > 0);
        if (levels.length > 1) base.levels = levels;
      }
      if (act.kind === 'multi' && act.options.length > 1) {
        act.options.forEach((o, i) => out.push({ ...base, opt: i, name: `${act.name}: ${o.map((s) => (E.action(c, s) || {}).name).join(' + ')}` }));
      } else out.push(base);
    };
    if (kind === 'legendary') {
      for (const l of c.tpl.legs || []) {
        const act = E.action(c, l.act);
        if (act && E.usable(c, l.act, { cost: 'leg', legCost: l.cost || 1 })) push(l.act, act, { cost: 'leg', legCost: l.cost || 1 });
      }
    } else if (kind === 'lair') {
      for (const id of c.tpl.lair || []) push(id, E.action(c, id), { free: true });
    } else {
      for (const [id, act] of Object.entries(E.actions(c))) {
        const cost = act.cost || 'action';
        if (cost !== 'action' && cost !== 'bonus' && !(full && cost === 'free')) continue;
        // a hidden action is one the script reaches for itself; a player sees it only while the
        // turn holds the thing it spends (Haste's extra attack)
        if (act.hidden && !(full && act.takes && c.turn[act.takes])) continue;
        // an action a player arms or toggles says itself when it is on offer; scripts never list it
        if (act.offer && !(full && act.offer(E, c))) continue;
        // a player is not offered a buff on themself that is already running
        if (full && act.noTarget && c.fx.some((f) => f.name === act.name && f.srcId === c.id)) continue;
        if (E.usable(c, id)) push(id, act);
      }
    }
    // Haste from the spell book: one more weapon attack this turn
    if (full && kind === 'turn' && !c.turn.hasted && E.any(c, 'hasteAttack')) {
      const id = c.tpl.hasteWith || c.tpl.basic;
      const act = id && E.action(c, id);
      if (act && act.kind === 'attack' && !act.spell) out.push({ act: id, name: `${act.name} (Haste: one attack)`, cost: 'free', targets: inReach(act, 0), choice: { free: true, one: true, hasted: true } });
    }
    if (full && kind === 'turn' && c.engaged.size) out.push({ withdraw: true, name: 'Pull back', cost: 'move', targets: [] });
    if (full && kind === 'turn' && E.rules.movement) {
      for (const [dir, word] of [[-1, 'Move forward'], [1, 'Move back']]) {
        const cost = E.shiftCost(c, dir);
        if (cost) out.push({ shift: dir, name: cost === 'dash' ? `${word} (Dash, uses the action)` : word, cost: 'move', targets: [] });
      }
    }
    out.push({ pass: true, name: kind === 'turn' ? 'End turn' : 'Pass', targets: [] });
    return out;
  },
};
