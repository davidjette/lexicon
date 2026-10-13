// Building a fight from a preset. The presets themselves are registered by the packs.

import './public.js?v=mv6bd7z3';
import './public-sharn.js?v=mv6bd7z3';
import { ALL, PRESETS } from './registry.js?v=mv6bd7z3';
import { PARTY, SPENT } from './pcs.js?v=mv6bd7z3';

export { ALL, PRESETS };

export const DEFAULT_PARTY = [
  { id: 'gemma', near: null, pos: 'back' },
  { id: 'eric', near: 'dario', pos: 'mid' },
  { id: 'dario', near: null, pos: 'front' },
];

export function makePc(id, o = {}) {
  return PARTY[id](o);
}

export function switchDefaults(preset) {
  const sw = {};
  for (const s of preset.switches || []) sw[s.key] = s.on;
  return sw;
}

// Roster rows are { ref, side, name, tpl, near, pos }. The interface edits those rows; this builds them from a preset.
export function presetRoster(preset, sw = switchDefaults(preset), partyOpts = {}) {
  const extra = preset.extra ? preset.extra(sw) : {};
  const rows = [];
  const partyIds = preset.party || ['gemma', 'eric', 'dario'];
  for (const p of DEFAULT_PARTY.filter((x) => partyIds.includes(x.id))) {
    const tpl = makePc(p.id, { level: preset.level12 ? 12 : preset.level || 13, dials: { ...((preset.dials || {})[p.id] || {}), ...((partyOpts[p.id] || {}).dials || {}) } });
    const spent = (preset.spent && preset.spent[p.id]) || (partyOpts.worn ? SPENT.half[p.id] : null);
    rows.push({ side: 'pc', tpl: spent ? { ...tpl, spent } : tpl, name: tpl.name, near: partyIds.includes(p.near) ? p.near : null, pos: p.pos });
  }
  const count = {};
  const add = (list, side) => {
    for (const [id, n] of list || []) {
      const tpl = ALL[id];
      if (!tpl) throw new Error(`unknown creature ${id}`);
      for (let i = 0; i < n; i++) {
        const k = `${side}:${id}`;
        count[k] = (count[k] || 0) + 1;
        const total = (list.find((x) => x[0] === id) || [])[1] || 1;
        rows.push({ side, tpl, name: total > 1 ? `${tpl.name} ${count[k]}` : tpl.name, near: null, pos: tpl.pos });
      }
    }
  };
  add([...(preset.allies || []), ...(extra.allies || [])], 'pc');
  add([...(preset.monsters || []), ...(extra.monsters || [])], 'monster');
  return rows;
}

export function buildSetup({ rows, scenario = {}, rules = {}, seed = 1, quiet = false }) {
  return {
    pcs: rows.filter((r) => r.side === 'pc').map((r) => ({ tpl: r.tpl, name: r.name, near: r.near, pos: r.pos })),
    monsters: rows.filter((r) => r.side === 'monster').map((r) => ({ tpl: r.tpl, name: r.name, near: r.near, pos: r.pos })),
    scenario,
    rules,
    seed,
    quiet,
  };
}

export function presetSetup(id, { sw, seed = 1, rules = {}, quiet = false, partyOpts } = {}) {
  const preset = PRESETS.find((p) => p.id === id);
  const s = { ...switchDefaults(preset), ...(sw || {}) };
  return buildSetup({ rows: presetRoster(preset, s, partyOpts), scenario: preset.scenario(s), rules: { ...(preset.rules || {}), ...rules }, seed, quiet });
}
