// A selection of SRD 5.1 monsters (srd-data.js, generated), turned into library entries.
// Run as written where the engine can: attacks, multiattack, save abilities, recharge, legendary
// actions and resistance, regeneration, magic resistance, pack tactics. A monster with a spell list
// and slots casts from it through the spell book (data/spells.js).
//
// This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of
// the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The
// SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at
// https://creativecommons.org/licenses/by/4.0/legalcode.

import { SRD } from './srd-data.js?v=mv6bd7z3';
import { melee, ranged, save, multi } from '../data/lib.js?v=mv6bd7z3';
import { cast, again, reaction, knows, castBest, castHeal, castControl, castBuff, castAgain } from '../data/spells.js?v=mv6bd7z3';
import { avgDice } from '../engine/dice.js?v=mv6bd7z3';
import { register } from '../data/registry.js?v=mv6bd7z3';

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
  // the spell list, cast from the monster's own slots
  const reactions = [];
  const bonusPlan = [];
  let spellNote = m.spellcaster ? ' · spells not run' : '';
  if (m.casting) {
    const k = m.casting;
    const o = { dc: k.dc, toHit: k.toHit, mod: k.mod, charLevel: k.level };
    const sids = [];
    let cantrip = null;
    for (const sp of k.spells) {
      if (!knows(sp.name)) continue;
      const r = reaction(sp.name, o);
      if (r) { reactions.push(r); continue; }
      const id = `sp_${sp.name.replace(/[^a-z0-9]+/g, '_')}`;
      const act = cast(sp.name, o);
      if (!sp.level) {
        const v = avgDice(act.dmg[0][0]) * (act.n || 1);
        if (!cantrip || v > cantrip.v) cantrip = { id, act, v };
      } else {
        actions[id] = act;
        sids.push(id);
        const more = again(sp.name, o);
        if (more) { actions[`${id}_again`] = more; sids.push(`${id}_again`); }
      }
    }
    if (cantrip) actions[cantrip.id] = cantrip.act;
    const weapon = first && actions[first].dmg ? avgDice(actions[first].dmg[0][0]) * (seq.length > 1 ? seq.length : 1) : 0;
    const atWill = 0.65 * Math.max(weapon, cantrip ? cantrip.v : 0);
    // spells first, then the cantrip if it beats the weapon, then the block's own actions
    bonusPlan.push(castAgain(sids), castBest(sids, 0));
    plan.unshift(castHeal(sids), castControl(sids), castBuff(sids), castAgain(sids, atWill), castBest(sids, atWill), ...(cantrip && cantrip.v > weapon ? [cantrip.id] : []));
    spellNote = ` · ${sids.length + reactions.length + (cantrip ? 1 : 0)} of ${k.spells.length} spells run`;
  }
  const legs = (m.legs || []).map((l) => ({ act: ids[key(l.name)], cost: l.cost, w: l.cost === 1 ? 3 : 2 })).filter((l) => l.act && actions[l.act]);
  return {
    id: m.id, name: m.name, side: 'monster', pos: firstMelee && !m.casting ? 'front' : 'back', srd: true,
    cr: m.cr, type: m.type, size: m.size, tags: [m.id],
    sub: `CR ${m.cr} · ${m.type} · SRD${spellNote}`,
    slots: m.casting ? { ...m.casting.slots } : undefined, smart: m.casting ? true : undefined,
    ac: m.ac, hp: m.hp, abil: m.abil, saves: m.saves,
    resist: m.resist, immune: m.immune, vuln: m.vuln, condImmune: m.condImmune,
    flying: m.flying || undefined, lr: m.lr || 0, leg: legs.length ? 3 : 0, legs,
    regen: m.regen || undefined, magicAdv: m.magicAdv || undefined, undeadFortitude: m.undeadFortitude || undefined,
    packTactics: m.packTactics ? m.id : undefined, boss: m.cr >= 10 && legs.length > 0,
    actions, plan, bonusPlan: bonusPlan.length ? bonusPlan : undefined, basic: first, oa: firstMelee, reactions: reactions.length ? reactions : undefined,
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
