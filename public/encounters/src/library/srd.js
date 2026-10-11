// A selection of SRD 5.1 monsters (srd-data.js, generated), turned into library entries.
// Run as written where the engine can: attacks, multiattack, save abilities, recharge, legendary
// actions and resistance, regeneration, magic resistance, pack tactics. Spell lists are not run.
//
// This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of
// the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The
// SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at
// https://creativecommons.org/licenses/by/4.0/legalcode.

import { SRD } from './srd-data.js';
import { melee, ranged, save, multi } from '../data/lib.js';
import { register } from '../data/registry.js';

export const SRD_ATTRIBUTION = 'Monster statistics marked SRD are from the System Reference Document 5.1 by Wizards of the Coast LLC, used under the Creative Commons Attribution 4.0 International License.';

const key = (s) => String(s).replace(/ \(.*\)$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const nextTurnEnd = { who: 'tgt', when: 'end', turns: 1 };

function onHit(riders) {
  const out = [];
  for (const r of riders || []) {
    if (r.grapple) out.push({ fx: 'grapple', dc: r.grapple });
    else if (r.cond === 'prone') out.push({ fx: 'save', ability: r.save, dc: r.dc, onFail: [{ fx: 'prone' }] });
    else out.push({ fx: 'save', ability: r.save, dc: r.dc, serious: true, onFail: [{ fx: 'cond', cond: r.cond, saveEnds: r.repeat ? { ability: r.save, dc: r.dc } : undefined, dur: r.repeat ? undefined : nextTurnEnd }] });
  }
  return out.length ? out : undefined;
}

export function buildSrd(m) {
  const actions = {};
  const ids = {};
  for (const a of m.actions) {
    const id = key(a.name) + (a.legOnly ? 'Leg' : '');
    ids[key(a.name)] = ids[key(a.name)] || id;
    const lim = { recharge: a.recharge, uses: a.uses, hidden: a.legOnly || undefined };
    if (a.kind === 'attack') actions[id] = (a.melee ? melee : ranged)(a.name, a.toHit, a.dmg, { ...lim, onHit: onHit(a.riders) });
    else {
      actions[id] = save(a.name, a.save, a.dc, a.dmg.length ? a.dmg : null, {
        ...lim, half: a.half,
        area: a.area ? { type: 'near', max: 5, spread: 0.4 } : undefined,
        only: a.cond ? (E, t) => !E.has(t, a.cond) : undefined,
        onFail: a.cond ? [{ fx: 'cond', cond: a.cond, saveEnds: a.repeat ? { ability: a.save, dc: a.dc } : undefined, dur: a.repeat ? undefined : nextTurnEnd }] : undefined,
      });
    }
  }
  const seq = [];
  for (const x of m.multi || []) {
    const id = ids[key(x.name)];
    if (id && actions[id] && !actions[id].hidden) for (let i = 0; i < x.count; i++) seq.push(id);
  }
  if (seq.length > 1) actions.multi = multi(seq);
  const own = Object.keys(actions).filter((id) => id !== 'multi' && !actions[id].hidden);
  const firstMelee = own.find((id) => actions[id].kind === 'attack' && actions[id].melee);
  const first = firstMelee || own.find((id) => actions[id].kind === 'attack') || own[0];
  // limited and recharge abilities first, then the multiattack, then anything else
  const plan = [
    ...own.filter((id) => actions[id].recharge || actions[id].uses).map((id) => ({ use: id })),
    ...(actions.multi ? ['multi'] : []),
    ...own.filter((id) => !actions[id].recharge && !actions[id].uses),
  ];
  const legs = (m.legs || []).map((l) => ({ act: ids[key(l.name)], cost: l.cost, w: l.cost === 1 ? 3 : 2 })).filter((l) => l.act && actions[l.act]);
  return {
    id: m.id, name: m.name, side: 'monster', pos: firstMelee ? 'front' : 'back', srd: true,
    cr: m.cr, type: m.type, size: m.size, tags: [m.id],
    sub: `CR ${m.cr} · ${m.type} · SRD${m.spellcaster ? ' · spells not run' : ''}`,
    ac: m.ac, hp: m.hp, abil: m.abil, saves: m.saves,
    resist: m.resist, immune: m.immune, vuln: m.vuln, condImmune: m.condImmune,
    flying: m.flying || undefined, lr: m.lr || 0, leg: legs.length ? 3 : 0, legs,
    regen: m.regen || undefined, magicAdv: m.magicAdv || undefined, undeadFortitude: m.undeadFortitude || undefined,
    packTactics: m.packTactics ? m.id : undefined, boss: m.cr >= 10 && legs.length > 0,
    actions, plan, basic: first, oa: firstMelee,
  };
}

const creatures = {};
const groups = {};
for (const m of SRD) {
  const t = buildSrd(m);
  if (!t.basic) continue;
  creatures[t.id] = t;
  (groups[m.group] = groups[m.group] || []).push(t.id);
}
register({ creatures, library: Object.entries(groups).map(([g, ids]) => ({ group: `SRD: ${g}`, ids })) });
