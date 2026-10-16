// Turns the roster the interface edits (plain data, so it can cross to the batch worker) into
// the templates and setup the engine runs.

import { DEFAULT_PARTY, switchDefaults } from './encounters.js?v=mvadgcsz';
import { ALL, PRESETS } from './registry.js?v=mvadgcsz';
import { PARTY, SPENT } from './pcs.js?v=mvadgcsz';

export { SPENT };
import { melee, ranged, multi } from './lib.js?v=mvadgcsz';

let uid = 0;
const nextId = () => `r${++uid}`;

export function customTemplate(c) {
  const actions = {};
  const seq = [];
  (c.attacks || []).forEach((a, i) => {
    const id = `atk${i}`;
    const dmg = [[a.dmg || '1d8', a.type || 'slashing']];
    actions[id] = a.ranged ? ranged(a.name || 'Attack', +a.toHit || 0, dmg) : melee(a.name || 'Attack', +a.toHit || 0, dmg);
    for (let k = 0; k < (+a.n || 1); k++) seq.push(id);
  });
  if (seq.length > 1) actions.multi = multi(seq);
  const sv = +c.save || 0;
  return {
    id: `custom:${c.name}`, name: c.name || 'Custom creature', side: 'monster', type: c.type || 'humanoid', pos: 'front',
    ac: +c.ac || 10, hp: +c.hp || 10, abil: { str: 10, dex: 10 + 2 * (+c.init || 0), con: 10, int: 10, wis: 10, cha: 10 },
    saves: { str: sv, dex: sv, con: sv, int: sv, wis: sv, cha: sv },
    lr: +c.lr || 0, boss: !!c.boss,
    actions, basic: 'atk0', oa: c.attacks && c.attacks[0] && !c.attacks[0].ranged ? 'atk0' : undefined,
  };
}

export function baseTemplate(row) {
  if (row.kind === 'pc') return PARTY[row.ref]({ dials: row.dials, level: row.level12 ? 12 : row.level || 13 });
  if (row.kind === 'custom') return customTemplate(row.custom);
  const t = ALL[row.ref];
  if (!t) throw new Error(`unknown creature ${row.ref}`);
  return t;
}

export function templateFor(row) {
  let tpl = baseTemplate(row);
  const o = row.over || {};
  if (o.ac !== undefined || o.hp !== undefined || o.init !== undefined || o.acts) {
    tpl = { ...tpl };
    if (o.ac !== undefined) tpl.ac = +o.ac;
    if (o.hp !== undefined) { tpl.hp = +o.hp; if (tpl.startHp) tpl.startHp = Math.min(tpl.startHp, tpl.hp); }
    if (o.init !== undefined) tpl.init = +o.init;
    if (o.acts) {
      tpl.actions = { ...tpl.actions };
      for (const [id, a] of Object.entries(o.acts)) {
        const base = tpl.actions[id];
        if (!base) continue;
        const next = { ...base };
        if (a.toHit !== undefined) next.toHit = +a.toHit;
        if (a.dc !== undefined) next.dc = +a.dc;
        if (a.dmg !== undefined && Array.isArray(base.dmg)) next.dmg = base.dmg.map((d, i) => [a.dmg[i] !== undefined ? a.dmg[i] : d[0], d[1]]);
        tpl.actions[id] = next;
      }
    }
  }
  const spent = row.spentData || (row.kind === 'pc' && SPENT[row.spent || 'fresh'][row.ref]);
  if (spent && Object.keys(spent).length) tpl = { ...tpl, spent };
  return tpl;
}

export function rowsFromPreset(presetId, sw) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const s = { ...switchDefaults(preset), ...(sw || {}) };
  const extra = preset.extra ? preset.extra(s) : {};
  const rows = [];
  const partyIds = preset.party || ['gemma', 'eric', 'dario'];
  for (const p of DEFAULT_PARTY.filter((x) => partyIds.includes(x.id))) {
    rows.push({
      uid: nextId(), side: 'pc', kind: 'pc', ref: p.id, name: PARTY[p.id]().name, pos: p.pos,
      near: p.near && partyIds.includes(p.near) ? p.near : null, dials: { ...((preset.dials || {})[p.id] || {}) }, over: {}, spent: 'fresh',
      level12: !!preset.level12, level: preset.level12 ? 12 : preset.level || 13, spentData: preset.spent ? preset.spent[p.id] : undefined,
    });
  }
  const add = (list, side) => {
    for (const [id, n] of list || []) {
      for (let i = 0; i < n; i++) rows.push({ uid: nextId(), side, kind: 'lib', ref: id, name: n > 1 ? `${ALL[id].name} ${i + 1}` : ALL[id].name, pos: ALL[id].pos || 'front', over: {} });
    }
  };
  add([...(preset.allies || []), ...(extra.allies || [])], 'pc');
  add([...(preset.monsters || []), ...(extra.monsters || [])], 'monster');
  return rows;
}

export function newRow(side, ref, name) {
  if (PARTY[ref]) return { uid: nextId(), side, kind: 'pc', ref, name: side === 'pc' ? PARTY[ref]().name : `${PARTY[ref]().name} (opposition)`, pos: DEFAULT_PARTY.find((p) => p.id === ref).pos, near: ref === 'eric' ? 'dario' : null, dials: {}, over: {}, spent: 'fresh' };
  return { uid: nextId(), side, kind: 'lib', ref, name: name || ALL[ref].name, pos: ALL[ref].pos || 'front', over: {} };
}

export function customRow(side, custom) {
  return { uid: nextId(), side, kind: 'custom', custom, name: custom.name, pos: 'front', over: {} };
}

// Party-wide preparations before the fight.
function applyPrebuffs(setup, pre) {
  if (!pre || !pre.herosFeast) return setup;
  const feast = {
    onFightStart(E, c) {
      if (c.memo.feast) return;
      c.memo.feast = true;
      c.maxHp += 11;
      c.hp += 11;
      c.baseMaxHp += 11;
      E.addFx(c, { id: 'herosFeast', name: "Hero's Feast", advSave: ['wis'], immuneCond: ['frightened', 'poisoned'], resist: ['poison'] }, null);
    },
  };
  setup.pcs = setup.pcs.map((p) => {
    if (!p.tpl.pc) return p;
    const old = p.tpl.hooks || {};
    const hooks = { ...old, onFightStart(E, c) { if (old.onFightStart) old.onFightStart(E, c); feast.onFightStart(E, c); } };
    let tpl = { ...p.tpl, hooks };
    // the casting costs the cleric his 6th-level slot
    if (tpl.id === 'eric') {
      const spent = { ...(tpl.spent || {}) };
      spent.slots = { ...(spent.slots || {}), 6: Math.max(1, (spent.slots || {})[6] || 0) };
      tpl = { ...tpl, spent };
    }
    return { ...p, tpl };
  });
  return setup;
}

// state: { presetId, sw, rows, rules, prebuffs }
export function setupFromState(state, seed, quiet = false) {
  const preset = PRESETS.find((p) => p.id === state.presetId);
  const sw = { ...(preset ? switchDefaults(preset) : {}), ...(state.sw || {}) };
  const scenario = preset ? preset.scenario(sw) : { flags: {} };
  scenario.flags = { ...(scenario.flags || {}), ...(state.flags || {}) };
  const toEntry = (r) => ({ tpl: templateFor(r), name: r.name, near: r.near || null, pos: r.pos });
  const setup = {
    pcs: state.rows.filter((r) => r.side === 'pc').map(toEntry),
    monsters: state.rows.filter((r) => r.side === 'monster').map(toEntry),
    scenario,
    rules: state.rules || {},
    seed,
    quiet,
  };
  return applyPrebuffs(setup, state.prebuffs);
}
