// The battle tracker's rules: dice, stat cards read from the library's templates, initiative
// order, turn flow with its stop points, damage and conditions. No page code here, so the
// same file runs under node for tests.

import { ALL } from '../data/registry.js?v=mwfr2swb';
import { PARTY } from '../data/pcs.js?v=mwfr2swb';

export const ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const mod = (score) => Math.floor(((score ?? 10) - 10) / 2);
export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const d = (sides) => 1 + Math.floor(Math.random() * sides);

// "2d8+7", "9", "1d4+3 + 3d6". A critical hit doubles the dice, not the bonus.
export function rollExpr(expr, { crit = false } = {}) {
  let total = 0;
  const bits = [];
  const re = /([+-]?)\s*(\d+)(?:d(\d+))?/g;
  let m;
  while ((m = re.exec(String(expr))) !== null) {
    if (m[0] === '') { re.lastIndex++; continue; }
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3]) {
      const n = +m[2] * (crit ? 2 : 1);
      const rolls = Array.from({ length: n }, () => d(+m[3]));
      total += sign * rolls.reduce((a, b) => a + b, 0);
      bits.push(`${sign < 0 ? '-' : bits.length ? '+' : ''}[${rolls.join(',')}]`);
    } else {
      total += sign * +m[2];
      bits.push(`${sign < 0 ? '-' : bits.length ? '+' : ''}${m[2]}`);
    }
  }
  return { total, text: bits.join(' ') };
}

// mode: 'adv' | 'dis' | undefined
export function rollD20(mode) {
  const a = d(20);
  if (!mode) return { nat: a, rolls: [a] };
  const b = d(20);
  return { nat: mode === 'adv' ? Math.max(a, b) : Math.min(a, b), rolls: [a, b], mode };
}

// ---------------------------------------------------------------- stat cards
// A card is what the tracker shows and rolls from. Library templates are written for the
// simulator; this reads out the parts a person at the table needs.
export function cardFromTpl(tpl) {
  const abil = tpl.abil || {};
  const saves = {};
  for (const a of ABILS) saves[a] = tpl.saves && tpl.saves[a] !== undefined ? tpl.saves[a] : mod(abil[a]);
  const actions = [];
  const acts = tpl.actions || {};
  for (const [key, a] of Object.entries(acts)) {
    if (!a || a.hidden || !a.name) continue;
    const row = { key, name: a.name, cost: a.cost === 'bonus' ? 'bonus' : a.cost === 'free' ? 'free' : a.cost === 'leg' ? 'legendary' : 'action' };
    if (a.kind === 'attack') {
      row.hit = a.toHit;
      row.ranged = !a.melee;
      if (Array.isArray(a.dmg)) row.dmg = a.dmg;
      if (a.n > 1) row.text = `${a.n} attacks`;
    } else if (a.kind === 'save') {
      row.save = a.save;
      row.dc = a.dc;
      row.half = !!a.half;
      if (Array.isArray(a.dmg)) row.dmg = a.dmg;
    } else if (a.kind === 'heal') {
      row.heal = String(a.dice);
    } else if (a.kind === 'multi') {
      row.text = a.options.map((o) => o.map((id) => (acts[id] && acts[id].name) || id).join(' + ')).join(', or ');
    } else {
      if (typeof a.dc === 'number') row.dc = a.dc;
      if (typeof a.save === 'string') row.save = a.save;
      if (Array.isArray(a.dmg)) row.dmg = a.dmg;
    }
    if (typeof a.uses === 'number') row.uses = a.uses;
    if (typeof a.recharge === 'number') row.recharge = a.recharge;
    if (a.conc) row.conc = true;
    actions.push(row);
  }
  for (const r of tpl.reactions || []) {
    if (r && r.name) actions.push({ key: `rx_${r.id || r.name}`, name: r.name, cost: 'reaction', uses: typeof r.uses === 'number' ? r.uses : undefined });
  }
  const legendary = (tpl.legs || []).map((l) => ({ key: l.act, cost: l.cost || 1, name: (acts[l.act] && acts[l.act].name) || l.act }));
  return {
    id: tpl.id, name: tpl.name, sub: tpl.sub || '', pc: !!tpl.pc, side: tpl.side === 'pc' ? 'pc' : 'foe', type: tpl.type || '',
    ac: tpl.ac, hp: tpl.hp, startHp: tpl.startHp, init: tpl.init !== undefined ? tpl.init : mod(abil.dex), dex: mod(abil.dex),
    saves, resist: tpl.resist || [], immune: tpl.immune || [], vuln: tpl.vuln || [], condImmune: tpl.condImmune || [],
    minion: !!tpl.minion, lr: tpl.lr || 0, leg: tpl.leg || 0, regen: tpl.regen || 0, deathWard: !!tpl.deathWard, cr: tpl.cr,
    actions, legendary, traits: [], turnStart: [], thresholds: [],
  };
}

// ref: 'pc:gemma' (the party, built at the fight's level), a scenario card id, or a library id.
export function resolveCard(ref, scenario, level) {
  const own = scenario && scenario.cards && scenario.cards[ref];
  if (own) {
    const base = own.from && ALL[own.from] ? cardFromTpl(ALL[own.from]) : cardFromTpl({ id: ref, name: own.name, abil: own.abil, saves: own.saves });
    return { ...base, ...own, id: ref };
  }
  if (ref.startsWith('pc:')) {
    const make = PARTY[ref.slice(3)];
    if (make) return { ...cardFromTpl(make({ level: level || 14 })), pc: true, side: 'pc' };
  }
  if (ALL[ref]) return cardFromTpl(ALL[ref]);
  return null;
}

export function customCard(o) {
  const sv = +o.save || 0;
  return {
    id: `custom:${o.name}`, name: o.name || 'Creature', sub: '', pc: false, side: o.side || 'foe', type: '',
    ac: +o.ac || 10, hp: Math.max(1, +o.hp || 1), init: +o.init || 0, dex: +o.init || 0,
    saves: Object.fromEntries(ABILS.map((a) => [a, sv])), resist: [], immune: [], vuln: [], condImmune: [],
    minion: false, lr: 0, leg: 0, regen: 0, actions: o.hit !== '' && o.hit !== undefined ? [{ key: 'atk', name: o.aname || 'Attack', cost: 'action', hit: +o.hit || 0, dmg: [[o.dmg || '1d8', o.dtype || 'damage']] }] : [],
    legendary: [], traits: [], turnStart: [], thresholds: [],
  };
}

// ---------------------------------------------------------------- state
export function newState(scenario) {
  const s = {
    v: 1, scenario: scenario ? scenario.id : null, level: (scenario && scenario.level) || 14, flags: {}, done: {},
    round: 0, phase: 'setup', cur: null, sel: null, list: [], log: [], seq: 0, pick: null,
  };
  if (!scenario) return s;
  for (const t of scenario.toggles || []) s.flags[t.key] = !!t.on;
  for (const [ref, n, side] of scenario.start || []) addCombatants(s, scenario, ref, n || 1, side);
  if (scenario.lair) {
    s.list.push({ id: `c${++s.seq}`, lair: true, name: scenario.lair.name, side: 'foe', init: scenario.lair.init ?? 20, dex: -99, conds: [] });
  }
  s.log = [];
  return s;
}

export const cardOf = (s, scenario, c) => c.card || resolveCard(c.ref, scenario, s.level);

export function addCombatants(s, scenario, ref, n, side, card) {
  const k = card || resolveCard(ref, scenario, s.level);
  if (!k) return [];
  const made = [];
  const sd = side || k.side;
  const mk = (name, count) => {
    const c = {
      id: `c${++s.seq}`, ref, name, side: sd, pc: !!k.pc, init: null, dex: k.dex || 0,
      hp: k.startHp || k.hp, maxHp: k.hp, temp: 0, conds: [], conc: false,
      lrLeft: k.lr || 0, legLeft: k.leg || 0, uses: {}, spent: {}, fired: {}, notes: '', dead: false,
    };
    if (card) c.card = card;
    if (count) { c.count = count; c.hp = count; c.maxHp = count; }
    if (k.deathWard) c.ward = true;
    for (const a of k.actions) if (a.uses) c.uses[a.key] = a.uses;
    s.list.push(c);
    made.push(c);
    return c;
  };
  if (k.minion && n > 1) {
    const waves = s.list.filter((c) => c.ref === ref && c.count).length;
    mk(`${k.name.replace(/\s*\(minion\)/i, '')}s${waves ? ` (wave ${waves + 1})` : ''}`, n);
  } else {
    const have = s.list.filter((c) => c.ref === ref && !c.count).length;
    for (let i = 0; i < n; i++) {
      const idx = have + i + 1;
      mk(n > 1 || have ? `${k.name} ${idx}` : k.name);
    }
    // the first of a kind keeps its plain name until a second one joins it
    if (have === 1 && n >= 1) {
      const first = s.list.find((c) => c.ref === ref && !c.count && c.name === k.name);
      if (first) first.name = `${k.name} 1`;
    }
  }
  // Once the fight is running, newcomers roll at once, one roll for the batch.
  if (s.phase !== 'setup' && made.length) {
    const r = rollD20();
    for (const c of made) c.init = r.nat + (k.init || 0);
    say(s, 'info', `${made.map((c) => c.name).join(', ')} ${made.length > 1 || made[0].count ? 'join' : 'joins'} the fight. Initiative ${r.nat}${signed(k.init || 0)} = ${made[0].init}.`);
  }
  return made;
}

export function say(s, t, text, extra) {
  s.log.unshift({ id: ++s.seq, t, text, ...(extra || {}) });
  if (s.log.length > 400) s.log.length = 400;
  return s.log[0];
}

// Highest first; ties to the higher Dexterity, then to whoever was added first. The lair
// loses every tie.
export function order(s) {
  return s.list
    .filter((c) => c.init !== null && c.init !== undefined && c.init !== '')
    .sort((a, b) => b.init - a.init || (a.lair ? 1 : 0) - (b.lair ? 1 : 0) || b.dex - a.dex || +a.id.slice(1) - +b.id.slice(1));
}

const takesTurns = (c) => c.lair || !c.dead;
export const get = (s, id) => s.list.find((c) => c.id === id);

export function rollInitiative(s, scenario, { all = false } = {}) {
  const byRef = {};
  for (const c of s.list) {
    if (c.lair || (c.init !== null && c.init !== '' && !all)) continue;
    if (c.pc && !all && s.phase === 'setup' && c.init === null && c.holdForPlayer) continue;
    const k = cardOf(s, scenario, c);
    const key = c.pc ? c.id : `${c.ref}|${c.side}`;
    if (!byRef[key]) byRef[key] = rollD20();
    c.init = byRef[key].nat + (k.init || 0);
    say(s, 'info', `${c.name} initiative: ${byRef[key].nat}${signed(k.init || 0)} = ${c.init}.`);
  }
}

export function begin(s, scenario) {
  rollInitiative(s, scenario);
  s.round = 1;
  say(s, 'round', 'Round 1');
  const first = order(s).find(takesTurns);
  if (first) startTurn(s, scenario, first);
  else s.phase = 'turn';
}

function tick(c, when) {
  const gone = [];
  c.conds = (c.conds || []).filter((x) => {
    if (!x.ends || x.ends.when !== when) return true;
    x.ends.turns -= 1;
    if (x.ends.turns > 0) return true;
    gone.push(x.name);
    return false;
  });
  return gone;
}

export function startTurn(s, scenario, c) {
  s.phase = 'turn';
  s.cur = c.id;
  s.sel = c.id;
  c.prompts = [];
  if (c.lair) { say(s, 'turn', `Lair action (initiative ${c.init}): ${c.name}`); return; }
  say(s, 'turn', `${c.name}'s turn`);
  const k = cardOf(s, scenario, c);
  const gone = tick(c, 'start');
  if (gone.length) say(s, 'info', `${c.name}: ${gone.join(', ')} ${gone.length > 1 ? 'end' : 'ends'}.`);
  c.legLeft = k.leg || 0;
  c.reacted = false;
  for (const a of k.actions) {
    if (a.recharge && c.spent[a.key]) {
      const r = d(6);
      if (r >= a.recharge) { delete c.spent[a.key]; say(s, 'info', `${c.name}: ${a.name} recharges (rolled ${r}).`); } else say(s, 'info', `${c.name}: ${a.name} does not recharge (rolled ${r}, needs ${a.recharge}+).`);
    }
  }
  if (k.regen && c.hp > 0 && c.hp < c.maxHp) heal(s, c, k.regen, 'regeneration');
  for (const p of k.turnStart || []) {
    if (p.flag && !s.flags[p.flag]) continue;
    if (p.notFlag && s.flags[p.notFlag]) continue;
    if (p.heal) { if (c.hp > 0 && c.hp < c.maxHp) heal(s, c, p.heal, p.text); continue; }
    c.prompts.push(p);
  }
}

export function endTurn(s, scenario, c) {
  if (!c || c.lair) return;
  const gone = tick(c, 'end');
  if (gone.length) say(s, 'info', `${c.name}: ${gone.join(', ')} ${gone.length > 1 ? 'end' : 'ends'}.`);
  c.prompts = [];
}

// Who may take a legendary action now that `after` has finished a turn.
export function legendaryReady(s, scenario, after) {
  return s.list.filter((c) => {
    if (c.lair || c.dead || c.id === (after && after.id) || !(c.legLeft > 0)) return false;
    if ((c.conds || []).some((x) => x.noLeg)) return false;
    return (cardOf(s, scenario, c).legendary || []).length > 0;
  });
}

// What the end of this round brings (scenario timeline), for the stop between rounds.
export function roundEndItems(s, scenario) {
  if (!scenario) return [];
  return (scenario.roundEnd || []).filter((it) => {
    if (it.flag && !s.flags[it.flag]) return false;
    if (it.key && s.done[it.key]) return false;
    if (it.rounds && !it.rounds.includes(s.round)) return false;
    if (it.from && s.round < it.from) return false;
    return true;
  });
}

// The Next button. One press ends the turn; if anyone has a legendary action to take, or the
// round is over, it stops there and the following press moves on.
export function next(s, scenario) {
  if (s.phase === 'setup') { begin(s, scenario); return; }
  if (s.phase === 'roundEnd') {
    s.round += 1;
    say(s, 'round', `Round ${s.round}`);
    const first = order(s).find(takesTurns);
    if (first) startTurn(s, scenario, first); else s.phase = 'turn';
    return;
  }
  const cur = get(s, s.cur);
  if (s.phase === 'turn') {
    endTurn(s, scenario, cur);
    if (cur && !cur.lair && legendaryReady(s, scenario, cur).length) { s.phase = 'leg'; return; }
  }
  // phase 'leg', or a turn with nothing to stop for
  const ord = order(s);
  const at = ord.findIndex((c) => c.id === s.cur);
  const nxt = ord.slice(at + 1).find(takesTurns);
  if (nxt) { startTurn(s, scenario, nxt); return; }
  s.phase = 'roundEnd';
  s.cur = null;
  say(s, 'info', `End of round ${s.round}.`);
}

// ---------------------------------------------------------------- hit points
const typeMult = (k, type) => (k.immune.includes(type) ? 0 : k.resist.includes(type) ? 0.5 : k.vuln.includes(type) ? 2 : 1);

// parts: [{ amt, type }]. mult: 1, 0.5 or 2 on top of the target's own resistances.
export function damage(s, scenario, c, parts, mult = 1, why = '') {
  const k = cardOf(s, scenario, c);
  const notes = [];
  let sum = 0;
  for (const p of parts) {
    const m = typeMult(k, p.type);
    if (m === 0) notes.push(`immune to ${p.type}`);
    else if (m === 0.5) notes.push(`resists ${p.type}`);
    else if (m === 2) notes.push(`vulnerable to ${p.type}`);
    sum += Math.floor(p.amt * m);
  }
  let amt = Math.floor(sum * mult);
  if (mult === 0.5) notes.push('halved');
  if (mult === 2) notes.push('doubled');
  const tail = `${why ? ` from ${why}` : ''}${notes.length ? ` (${notes.join(', ')})` : ''}`;
  if (amt <= 0) { say(s, 'hp', `${c.name} takes no damage${tail}.`); return 0; }
  if (c.count) {
    c.count -= 1; c.hp = c.count;
    if (c.count <= 0) { c.dead = true; say(s, 'hp', `${c.name}: the last one falls${tail}.`); } else say(s, 'hp', `${c.name}: one falls${tail}. ${c.count} left.`);
    return amt;
  }
  const before = c.hp;
  let rest = amt;
  if (c.temp > 0) { const t = Math.min(c.temp, rest); c.temp -= t; rest -= t; }
  c.hp = Math.max(0, c.hp - rest);
  if (c.hp === 0 && c.ward && before > 0) {
    c.ward = false; c.hp = 1;
    say(s, 'alert', `${c.name}: Death Ward. She drops to 1 instead of 0 and takes a legendary action at once.`);
  }
  say(s, 'hp', `${c.name} takes ${amt}${tail}: ${before} to ${c.hp} of ${c.maxHp}.`);
  (k.thresholds || []).forEach((th, i) => {
    if (!c.fired[i] && before > th.at && c.hp <= th.at) { c.fired[i] = true; say(s, 'alert', `${c.name}: ${th.text}`); }
  });
  if (c.conc && rest > 0 && c.hp > 0) {
    const dc = Math.max(10, Math.floor(amt / 2));
    if (c.pc) say(s, 'alert', `${c.name} is concentrating: DC ${dc} Constitution save.`);
    else {
      const r = rollD20();
      const tot = r.nat + (k.saves.con || 0);
      if (tot < dc) c.conc = false;
      say(s, 'alert', `${c.name} concentration, DC ${dc}: ${r.nat}${signed(k.saves.con || 0)} = ${tot}. ${tot >= dc ? 'Holds.' : 'Lost.'}`);
    }
  }
  if (c.hp === 0) {
    c.conc = false;
    if (c.pc) say(s, 'alert', `${c.name} is down.`);
    else { c.dead = true; say(s, 'alert', `${c.name} is down.`); }
  }
  return amt;
}

export function heal(s, c, amt, why = '') {
  if (c.count) { c.count += amt; c.hp = c.count; c.maxHp = Math.max(c.maxHp, c.count); c.dead = false; say(s, 'hp', `${c.name}: ${c.count} standing.`); return; }
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + amt);
  if (c.hp > 0) c.dead = false;
  say(s, 'hp', `${c.name} regains ${c.hp - before}${why ? ` (${why})` : ''}: ${before} to ${c.hp} of ${c.maxHp}.`);
}

export function addCond(c, cond) {
  c.conds = (c.conds || []).filter((x) => x.name !== cond.name);
  c.conds.push(JSON.parse(JSON.stringify(cond)));
}

export const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Exhaustion', 'Blessed', 'Hasted', 'Slowed', 'Dodging', 'Hidden', 'Flying'];
