// Simple versions of the player characters from the D&D Beyond exports (heroes-data.js, generated).
// "Simple" means: the sheet's own numbers, its best weapon routine, its cantrips, and every spell on
// its list that the spell book (data/spells.js) can run, cast from the character's own spell slots.
// Sorcerers spend their sorcery points on the Metamagic their sheet names. Class features, feats and
// chosen options come from the feature book (data/features.js). No hand-written tactics.

import { HEROES } from './heroes-data.js?v=mvab2y30';
import { ADDED_HEROES } from './added-heroes.js?v=mvab2y30';
import { melee, ranged, save, multi } from '../data/lib.js?v=mvab2y30';
import { cast, again, reaction, knows, castBest, castHeal, castControl, castBuff, castAgain, castEscape, castQuickened, actionFirst } from '../data/spells.js?v=mvab2y30';
import { avgDice } from '../engine/dice.js?v=mvab2y30';
import { register } from '../data/registry.js?v=mvab2y30';
import { featureParts, applyParts } from '../data/features.js?v=mvab2y30';
import { itemParts } from '../data/items.js?v=mvab2y30';
import { withUpdates } from './sheet-updates.js?v=mvab2y30';

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
    ? (a.melee ? melee : ranged)(a.name, a.toHit, [[a.dmg, a.type], ...(a.extra || [])], { n: a.count > 1 ? a.count : undefined, spell: a.spell || undefined, weapon: a.spell ? false : undefined, onHit: a.onHit, on20: a.on20, ...extra })
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
  const others = cantrip ? h.attacks.filter((a) => a.spell && a.slot === 0 && a.type !== cantrip.type) : [];
  const other = best(others.filter((a) => !a.melee)) || best(others);
  if (other) {
    actions.cantrip2 = mk(other);
    routines.push(['cantrip2', worth(other) * 0.99]);
  }
  routines.sort((x, y) => y[1] - x[1]);

  const atWill = routines[0] ? routines[0][1] : 0;
  const caster = !!(h.slots || h.pact);
  const topSlot = h.slots ? Math.max(...Object.keys(h.slots).map(Number)) : h.pact ? h.pact.level : 0;
  // weapon-shaped and zone spells the book does not run; they are not cast as one-off attacks either
  const SUSTAINED = ['shadow blade', 'flame blade', 'storm sphere'];
  const plan = [];
  // every spell on the sheet that the book knows
  const ids = [];
  const notRun = [];
  const reactions = [];
  for (const [name, lvl] of Object.entries(h.spells)) {
    if (!lvl) continue;
    const onSheet = h.attacks.some((x) => x.spell && x.slot > 0 && x.name.toLowerCase() === name) && !SUSTAINED.includes(name);
    const wl = (h.classes || {}).warlock || 0;
    const arcanum = lvl > topSlot && lvl >= 6 && lvl <= (wl >= 17 ? 9 : wl >= 15 ? 8 : wl >= 13 ? 7 : wl >= 11 ? 6 : 0);
    if (lvl > topSlot && !arcanum) { notRun.push(name); continue; }
    if (!knows(name)) { if (!onSheet) notRun.push(name); continue; }
    const r = reaction(name, { dc: h.dc });
    if (r) { reactions.push(r); continue; }
    const id = `sp_${name.replace(/[^a-z0-9]+/g, '_')}`;
    const o = { dc: h.dc, toHit: h.spellHit, mod: h.spellMod, charLevel: h.level, ...(arcanum ? { uses: 1, at: lvl } : {}) };
    actions[id] = cast(name, o);
    ids.push(id);
    // a spell that stays up strikes again through a second action
    const more = again(name, o);
    if (more) { actions[`${id}_again`] = more; ids.push(`${id}_again`); }
  }
  plan.push(castHeal(ids), castEscape(ids), castControl(ids), castBuff(ids), castAgain(ids, atWill), castBest(ids, atWill));
  // attack spells written on the sheet that the book does not know (house spells), at the sheet's numbers
  if (caster) {
    // a concentration spell is a wall, a zone or a lasting effect, never a one-off attack: those wait for a book entry
    h.attacks.filter((a) => a.spell && a.slot > 0 && a.slot <= topSlot && !a.conc && !knows(a.name) && !SUSTAINED.includes(a.name.toLowerCase())).forEach((a, i) => {
      const id = `spell${i}`;
      actions[id] = mk(a, { slot: a.slot });
      ids.push(id);
      if (worth(a) > atWill) plan.push({ use: id });
    });
  }
  // powers from items or boons on the sheet (Mortymer's Heart of Winter): an area save at the sheet's numbers, a few uses a fight
  (h.powers || []).forEach((p, i) => {
    const id = `power${i}`;
    actions[id] = save(p.name, p.save, p.dc, p.dmg, { half: p.half, area: p.area, uses: p.uses, onFail: p.onFail });
    plan.splice(2, 0, { use: id });
  });
  // in melee, a character with a real weapon uses it, and does not shoot at disadvantage
  const meleeWorth = (routines.find((r) => r[0] === 'meleeRoutine') || [0, 0])[1];
  // (an archer, such as Rinn Silverhawk, keeps shooting: `archer: true` on the record)
  if (meleeWorth && !h.archer && routines[0][0] !== 'meleeRoutine' && meleeWorth >= 0.6 * routines[0][1]) {
    plan.push({ use: 'meleeRoutine', if: (E, c) => [...c.engaged].some((x) => E.active(E.get(x))) });
  }
  for (const [id] of routines) plan.push(id);
  // the other weapons on the sheet: not what the script reaches for, but there for a player
  armed.filter((a) => a !== bestMelee && a !== bestRanged).forEach((a, i) => {
    actions[`other${i}`] = mk(a);
    actions[`other${i}Routine`] = multi(Array(h.perAction).fill(`other${i}`));
    actions[`other${i}Routine`].name = `${a.name}${h.perAction > 1 ? ` x${h.perAction}` : ''}`;
    actions[`other${i}`].hidden = h.perAction > 1;
  });

  const bonusPlan = [castHeal(ids), castEscape(ids), actionFirst(castHeal(ids), castEscape(ids), castControl(ids), castBuff(ids)), castAgain(ids), castQuickened(ids, atWill), castBest(ids, 0)];
  if (h.monk && actions.melee) {
    actions.martialArts = { ...actions.melee, name: 'Martial Arts (bonus strike)', cost: 'bonus', n: 1 };
    bonusPlan.push('martialArts');
  }
  // bonus-action attacks from class features on the sheet, such as an Artillerist's cannons
  (h.bonus || []).forEach((a, i) => {
    actions[`feature${i}`] = { ...mk({ ...a, spell: true }), name: `${a.name}${a.count > 1 ? ` x${a.count}` : ''}`, cost: 'bonus', noRangePenalty: true };
    bonusPlan.push(`feature${i}`);
  });
  const frontline = routines[0] && routines[0][0] === 'meleeRoutine';
  const tpl = {
    id: h.id, name: h.campaign === 'The Unforeseen' ? `${h.name} (Original, level ${h.level})` : h.name, side: 'pc', pc: true, hero: true, type: 'humanoid', smart: true, pos: frontline ? 'front' : 'back',
    level: h.level, sheet: h.sheet,
    slots: h.slots || undefined, pact: h.pact || undefined, spellsNotRun: notRun, sorcery: h.sorcery, meta: h.meta,
    hasteWith: routines[0] && routines[0][0] === 'rangedRoutine' ? 'ranged' : bestMelee ? 'melee' : undefined,
    ac: h.ac, hp: h.hp, init: h.init, abil: h.abil, saves: h.saves, resist: h.resist, immune: h.immune, condImmune: h.condImmune, lr: h.lr,
    actions, plan, bonusPlan, reactions: reactions.length ? reactions : undefined, hooks: {},
    basic: bestMelee ? 'melee' : bestRanged ? 'ranged' : 'cantrip', basicN: h.perAction, oa: bestMelee ? 'melee' : undefined,
  };
  const book = featureParts(h, tpl, { frontline, atWill, weaponFirst: !!routines[0] && /Routine$/.test(routines[0][0]) });
  const kit = itemParts(book.x);
  applyParts(tpl, [...book.parts, ...kit.parts]);
  if (!tpl.reactions || !tpl.reactions.length) tpl.reactions = undefined;
  tpl.items = { run: kit.run, numbers: kit.numbers, outside: kit.outside, skipped: kit.skipped };
  tpl.features = { run: book.run, numbers: book.numbers, outside: book.outside, unknown: book.unknown, skipped: book.skipped.map((n) => `${n} (${book.why[n]})`) };
  const spellCount = ids.length + (reactions.length || 0);
  tpl.sub = `${h.classLine} \u00b7 ${h.campaign}${spellCount ? ` \u00b7 ${spellCount} spells run${notRun.length ? `, ${notRun.length} not` : ''}` : ''}${book.run.length ? ` \u00b7 ${book.run.length} features run${book.unknown.length + book.skipped.length ? `, ${book.unknown.length + book.skipped.length} not` : ''}` : ''}${kit.run.length + kit.skipped.length ? ` \u00b7 ${kit.run.length} items run${kit.skipped.length ? `, ${kit.skipped.length} not` : ''}` : ''}`;
  return tpl;
}

const creatures = {};
const groups = {};
for (const raw of [...HEROES, ...ADDED_HEROES]) {
  const h = withUpdates(raw);
  const t = buildHero(h);
  creatures[t.id] = t;
  (groups[h.campaign] = groups[h.campaign] || []).push(t.id);
}
register({
  creatures,
  library: Object.entries(groups).map(([campaign, ids]) => ({ group: `Characters: ${campaign}`, ids, ally: true })),
});
