// The spell book. One entry per spell, and cast() turns an entry into an action for whoever knows it.
// Damage and healing numbers for SRD spells come from spells-data.js (generated); the rest are below.
// A levelled spell spends a slot through the engine (act.slot), and its dice follow the slot used.
//
// What a spell does here is its combat effect only. A concentration damage spell (Moonbeam, Call
// Lightning) is run as one casting, not as a zone that stays.

import { SRD_SPELLS } from './spells-data.js';
import { melee, ranged, save, emanation, rollDice, areaTargets } from './lib.js';
import { avgDice } from '../engine/dice.js';

const up = (n, die, level, per = 1, flat = '') => {
  const out = {};
  for (let l = level; l <= 9; l++) out[l] = `${n + per * (l - level)}d${die}${flat}`;
  return out;
};

// Spells the generated table lacks or gets wrong, and common spells from outside the SRD (numbers only).
const EXTRA = {
  'chromatic orb': { name: 'Chromatic Orb', level: 1, atk: 'ranged', type: 'acid', dmg: up(3, 8, 1) },
  'witch bolt': { name: 'Witch Bolt', level: 1, atk: 'ranged', type: 'lightning', dmg: up(1, 12, 1) },
  'chaos bolt': { name: 'Chaos Bolt', level: 1, atk: 'ranged', type: 'force', dmg: up(2, 8, 1, 0, '+1d6') },
  'dissonant whispers': { name: 'Dissonant Whispers', level: 1, save: 'wis', half: true, type: 'psychic', dmg: up(3, 6, 1) },
  "tasha's mind whip": { name: "Tasha's Mind Whip", level: 2, save: 'int', half: true, type: 'psychic', dmg: { 2: '3d6' } },
  "aganazzar's scorcher": { name: "Aganazzar's Scorcher", level: 2, save: 'dex', half: true, type: 'fire', dmg: up(3, 8, 2), area: 3 },
  'call lightning': { name: 'Call Lightning', level: 3, save: 'dex', half: true, type: 'lightning', dmg: up(3, 10, 3) },
  'erupting earth': { name: 'Erupting Earth', level: 3, save: 'dex', half: true, type: 'bludgeoning', dmg: up(3, 12, 3), area: 3 },
  'hunger of hadar': { name: 'Hunger of Hadar', level: 3, save: 'dex', half: true, type: 'cold', dmg: { 3: '4d6' }, area: 6 },
  'thunder step': { name: 'Thunder Step', level: 3, save: 'con', half: true, type: 'thunder', dmg: up(3, 10, 3), area: 3 },
  'tidal wave': { name: 'Tidal Wave', level: 3, save: 'dex', half: true, type: 'bludgeoning', dmg: { 3: '4d8' }, area: 6 },
  'vitriolic sphere': { name: 'Vitriolic Sphere', level: 4, save: 'dex', half: true, type: 'acid', dmg: up(10, 4, 4, 2), area: 6 },
  'sickening radiance': { name: 'Sickening Radiance', level: 4, save: 'con', type: 'radiant', dmg: { 4: '4d10' }, area: 6 },
  'ice storm': { name: 'Ice Storm', level: 4, save: 'dex', half: true, type: 'cold', dmg: up(2, 8, 4, 1, '+4d6'), area: 6 },
  'flame strike': { name: 'Flame Strike', level: 5, save: 'dex', half: true, type: 'fire', dmg: up(8, 6, 5), area: 3 },
  'synaptic static': { name: 'Synaptic Static', level: 5, save: 'int', half: true, type: 'psychic', dmg: { 5: '8d6' }, area: 6 },
  'steel wind strike': { name: 'Steel Wind Strike', level: 5, save: 'dex', half: true, type: 'force', dmg: { 5: '6d10' }, area: 5 },
  'destructive wave': { name: 'Destructive Wave', level: 5, save: 'con', half: true, type: 'thunder', dmg: { 5: '10d6' }, area: 6 },
  'immolation': { name: 'Immolation', level: 5, save: 'dex', half: true, type: 'fire', dmg: { 5: '8d6' } },
  'dawn': { name: 'Dawn', level: 5, save: 'con', half: true, type: 'radiant', dmg: { 5: '4d10' }, area: 6 },
  'chain lightning': { name: 'Chain Lightning', level: 6, save: 'dex', half: true, type: 'lightning', dmg: { 6: '10d8' }, area: 4 },
  'disintegrate': { name: 'Disintegrate', level: 6, save: 'dex', type: 'force', dmg: up(10, 6, 6, 3, '+40') },
  'meteor swarm': { name: 'Meteor Swarm', level: 9, save: 'dex', half: true, type: 'fire', dmg: { 9: '40d6' }, area: 6 },
  'psychic scream': { name: 'Psychic Scream', level: 9, save: 'int', half: true, type: 'psychic', dmg: { 9: '14d6' }, area: 6 },
  // several rays or darts
  'scorching ray': { name: 'Scorching Ray', level: 2, atk: 'ranged', type: 'fire', dmg: { 2: '2d6' }, rays: (l) => l + 1 },
  'magic missile': { name: 'Magic Missile', level: 1, auto: true, type: 'force', dmg: { 1: '1d4+1' }, rays: (l) => l + 2 },
  'eldritch blast': { name: 'Eldritch Blast', level: 0, atk: 'ranged', type: 'force', byChar: true, dmg: { 1: '1d10' }, beams: true },
  // conditions
  'hold person': { name: 'Hold Person', level: 2, save: 'wis', cond: 'paralysed', repeat: true, conc: true, only: 'humanoid' },
  'hold monster': { name: 'Hold Monster', level: 5, save: 'wis', cond: 'paralysed', repeat: true, conc: true },
  'banishment': { name: 'Banishment', level: 4, save: 'cha', cond: 'banished', conc: true },
  'blindness/deafness': { name: 'Blindness', level: 2, save: 'con', cond: 'blinded', repeat: true },
  'fear': { name: 'Fear', level: 3, save: 'wis', cond: 'frightened', repeat: true, conc: true, area: 3 },
  'hypnotic pattern': { name: 'Hypnotic Pattern', level: 3, save: 'wis', cond: 'incapacitated', conc: true, area: 6, endsOnDamage: true },
  'power word stun': { name: 'Power Word Stun', level: 8, word: 'stun' },
  'power word kill': { name: 'Power Word Kill', level: 9, word: 'kill' },
  // the caster's own side
  'bless': { name: 'Bless', level: 1, buff: 'bless', conc: true },
  'greater invisibility': { name: 'Greater Invisibility', level: 4, buff: 'invisible', conc: true },
  'spirit guardians': { name: 'Spirit Guardians', level: 3, aura: true, save: 'wis', type: 'radiant', conc: true },
  // reactions, built by reaction() below
  'shield': { name: 'Shield', level: 1, reaction: true },
  'counterspell': { name: 'Counterspell', level: 3, reaction: true },
};
const HEALS = ['cure wounds', 'healing word', 'mass cure wounds', 'mass healing word', 'heal'];
const DROP = ['aid', 'false life', 'mass heal', 'arcane sword', 'faithful hound', 'spiritual weapon', 'guardian of faith', 'control water', 'wind wall', 'storm of vengeance', 'feeblemind'];

export const SPELLS = { ...SRD_SPELLS, ...EXTRA };
for (const k of DROP) delete SPELLS[k];

export const knows = (name) => !!SPELLS[String(name).toLowerCase()];
export const spellLevel = (name) => (SPELLS[String(name).toLowerCase()] || {}).level;

// dice for a table keyed by slot (or character) level: the highest row not above `level`
function diceAt(table, level, mod = 0) {
  let best = null;
  for (const k of Object.keys(table)) if (+k <= level && (best === null || +k > best)) best = +k;
  if (best === null) best = Math.min(...Object.keys(table).map(Number));
  return String(table[best]).replace('+MOD', mod ? `+${mod}` : '');
}

// ---------- slots ----------
// the slot levels a caster could spend on a spell of level `min`, lowest first
export function slotLevels(c, min) {
  if (c.slots) return Object.keys(c.slots).map(Number).filter((l) => l >= min && c.slots[l] > 0).sort((a, b) => a - b);
  if (c.pact && c.pact.n > 0 && c.pact.level >= min) return [c.pact.level];
  return [];
}
function spend(c, min) {
  const l = slotLevels(c, min)[0];
  if (!l) return 0;
  if (c.slots) c.slots[l] -= 1;
  else c.pact.n -= 1;
  return l;
}

const liveFoes = (E, c) => E.enemiesOf(c).filter((t) => !t.down && E.present(t));
const hurts = (E, t, type) => E.resistMult(t, type) > 0;

// ---------- building actions ----------
// o: { dc, toHit, mod, charLevel, uses, at } — `uses` with `at` makes a spell without slots (innate casting).
export function cast(key, o = {}) {
  const s = SPELLS[String(key).toLowerCase()];
  if (!s || s.reaction) return null;
  const { dc, toHit, mod = 0, charLevel = 1 } = o;
  const slotted = o.uses ? { uses: o.uses } : { slot: s.level };
  const levelOf = (choice) => (o.uses ? o.at || s.level : choice.level || s.level);
  const cost = s.cost === 'bonus' ? { cost: 'bonus' } : {};

  if (HEALS.includes(String(key).toLowerCase())) {
    const mass = /^mass /.test(key);
    return {
      kind: 'special', name: s.name, spell: true, ...slotted, ...cost, ally: !mass, noTarget: mass, book: { role: 'heal', mass },
      run(E, c, act, choice) {
        const lvl = levelOf(choice);
        const r = rollDice(E.rng, diceAt(s.heal, lvl, mod));
        const pool = mass
          ? E.alliesOf(c, true).filter((a) => a.hp < a.maxHp && !E.has(a, 'noHeal')).sort((a, b) => a.hp - b.hp).slice(0, 6)
          : [E.get((choice.targets || [])[0]) || c];
        E.log('act', `${c.name} casts ${s.name} (level ${lvl}): ${r.text} = ${r.total}${mass ? ' each' : ` on ${pool[0].name}`}.`, c);
        for (const a of pool) E.heal(a, r.total, c, s.name);
      },
    };
  }

  if (s.level === 0) {
    const dice = diceAt(s.dmg, charLevel);
    const n = s.beams ? (charLevel >= 17 ? 4 : charLevel >= 11 ? 3 : charLevel >= 5 ? 2 : 1) : undefined;
    if (s.atk) return (s.atk === 'melee' ? melee : ranged)(s.name, toHit, [[dice, s.type]], { spell: true, weapon: false, n: n > 1 ? n : undefined });
    return save(s.name, s.save, dc, [[dice, s.type]], { spell: true, half: s.half });
  }

  if (s.word) {
    const cap = s.word === 'kill' ? 100 : 150;
    const pick = (E, c) => liveFoes(E, c).filter((t) => t.hp <= cap && !E.has(t, 'stunned')).sort((a, b) => b.hp - a.hp)[0] || null;
    return {
      kind: 'special', name: s.name, spell: true, ...slotted, book: { role: 'word' }, aiTarget: pick, when: (E, c) => !!pick(E, c),
      run(E, c, act, choice) {
        const t = E.get((choice.targets || [])[0]) || pick(E, c);
        if (!t || t.hp > cap) { E.log('info', `${c.name}: ${s.name} has no target weak enough.`, c); return; }
        E.log('act', `${c.name} speaks ${s.name} at ${t.name} (${t.hp} HP).`, c);
        if (s.word === 'kill') E.damage(t, [{ amt: t.hp + (t.temp || 0), type: 'psychic' }], c, { rollText: s.name });
        else E.addFx(t, { cond: 'stunned', name: s.name, saveEnds: { ability: 'con', dc, spell: true } }, c);
      },
    };
  }

  if (s.cond) {
    const fits = (E, t) => !E.has(t, s.cond) && !E.condImmune(t, s.cond) && (!s.only || t.tpl.type === s.only);
    return save(s.name, s.save, dc, null, {
      spell: true, ...slotted, conc: s.conc, book: { role: 'control' },
      area: s.area ? { type: 'near', max: s.area, spread: 0.3 } : undefined,
      only: fits,
      onFail: [{ fx: 'cond', cond: s.cond, name: s.name, conc: s.conc, endsOnDamage: s.endsOnDamage, saveEnds: s.repeat ? { ability: s.save, dc, spell: true } : undefined }],
    });
  }

  if (s.buff === 'bless') {
    return {
      kind: 'special', name: 'Bless', spell: true, ...slotted, conc: true, selfManaged: true, noTarget: true, book: { role: 'buff' },
      run(E, c) {
        const pool = E.alliesOf(c, true).filter((a) => E.active(a)).sort((a, b) => (b.tpl.level || 0) - (a.tpl.level || 0)).slice(0, 3);
        E.log('act', `${c.name} casts Bless on ${pool.map((a) => a.name).join(', ')}.`, c);
        E.concentrate(c, 'Bless');
        for (const a of pool) E.addFx(a, { id: 'bless', name: 'Bless', atkDice: '1d4', saveDice: '1d4', conc: c.id }, c);
      },
    };
  }
  if (s.buff === 'invisible') {
    return { kind: 'buff', name: s.name, spell: true, ...slotted, conc: true, self: true, effect: { cond: 'invisible' }, book: { role: 'buff' } };
  }
  if (s.aura) {
    return { ...emanation(s.name, { save: s.save, dc, dmg: (lvl) => [[`${lvl || 3}d8`, s.type]], on: ['enemyEnd', 'casterTurn'], ...slotted }), book: { role: 'aura' } };
  }

  // damage, by attack roll or saving throw, scaled by the slot
  const book = { role: 'damage', at: o.uses ? o.at || s.level : 0, type: s.type, area: s.area || 0, atk: !!s.atk || !!s.auto, half: !!s.half, dice: (lvl) => diceAt(s.dmg, lvl, mod), rays: s.rays };
  book.value = (lvl, n = 1) => {
    const one = avgDice(book.dice(lvl)) * (s.rays ? s.rays(lvl) : 1);
    const hit = s.auto ? 1 : s.atk ? 0.65 : s.half ? 0.75 : 0.55;
    return one * hit * (1 + 0.7 * (Math.min(n, s.area || 1) - 1));
  };
  const pick = (E, c) => E.ai.pickTarget(E, c, { melee: s.atk === 'melee' }, { filter: (t) => hurts(E, t, s.type) });
  return {
    kind: 'special', name: s.name, spell: true, ...slotted, ...cost, book,
    aiTarget: (E, c) => (liveFoes(E, c).some((t) => hurts(E, t, s.type)) ? pick(E, c) : null),
    run(E, c, act, choice) {
      const lvl = levelOf(choice);
      let t = E.get((choice.targets || [])[0]);
      if (!t || t.down || !E.present(t)) t = pick(E, c);
      if (!t) { E.log('info', `${c.name}: ${s.name} has no target.`, c); return; }
      const name = lvl > s.level ? `${s.name} (level ${lvl})` : s.name;
      const dice = book.dice(lvl);
      const n = s.rays ? s.rays(lvl) : 1;
      if (s.auto) {
        const r = rollDice(E.rng, Array(n).fill(dice).join('+'));
        E.log('act', `${c.name} casts ${name} at ${t.name}: ${n} darts.`, c);
        E.damage(t, [{ amt: r.total, type: s.type }], c, { rollText: `${r.text} ${s.type}` });
      } else if (s.atk) {
        const a = { name, toHit, melee: s.atk === 'melee', dmg: [[dice, s.type]], spell: true, weapon: false };
        for (let i = 0; i < n && E.active(c); i++) {
          if (t.down || !E.present(t)) t = pick(E, c);
          if (!t) break;
          E.attack(c, t, a, {});
        }
      } else {
        const targets = s.area ? areaTargets(E, c, t, { max: s.area, spread: s.area >= 6 ? 0.3 : 0.15 }) : [t];
        E.saveEffect(c, { name, save: s.save, dc, dmg: [[dice, s.type]], half: s.half, spell: true, isArea: !!s.area }, targets);
      }
    },
  };
}

// Shield and Counterspell, paid for from the caster's slots.
export function reaction(key, { dc } = {}) {
  const k = String(key).toLowerCase();
  if (k === 'shield') {
    return {
      id: 'shield', name: 'Shield', trigger: 'attacked', spell: true,
      when: (E, me, ctx) => !ctx.crit && ctx.total < E.acOf(me) + 5 && slotLevels(me, 1).length > 0,
      run(E, me) {
        spend(me, 1);
        E.addFx(me, { id: 'shield', name: 'Shield', ac: 5, ends: { who: me.id, when: 'start', turns: 1 } }, me);
        E.log('info', `${me.name} casts Shield: +5 AC until the start of their next turn.`, me);
      },
    };
  }
  if (k === 'counterspell') {
    return {
      id: 'counterspell', name: 'Counterspell', trigger: 'spellCast', who: 'enemy', spell: true,
      when: (E, me, ctx) => ctx.level >= 3 && slotLevels(me, 3).length > 0,
      run(E, me, ctx) {
        spend(me, 3);
        E.log('act', `${me.name} casts Counterspell at ${ctx.caster.name}'s ${ctx.act.name} (DC ${dc} CON).`, me);
        if (!E.save(ctx.caster, 'con', dc, { spell: true, lr: false }).success) ctx.countered = true;
      },
    };
  }
  return null;
}

// ---------- choosing what to cast ----------
// Plan entries for a caster whose spells came from cast(). Each returns a choice or null, and the
// plan carries on down its list when one declines. `ids` are the caster's spell action ids.

const spellsOf = (E, c, ids, role, slot) => ids
  .map((id) => [id, E.action(c, id)])
  .filter(([id, a]) => a && a.book && a.book.role === role && (a.cost || 'action') === slot && E.usable(c, id));

// the damage spell and slot worth the most right now, if it beats what the caster does at will
export const castBest = (ids, atWill = 0) => (E, c, slot = 'action') => {
  const foes = liveFoes(E, c);
  if (!foes.length) return null;
  const inMelee = [...c.engaged].some((x) => E.active(E.get(x)));
  let best = null;
  for (const [id, a] of spellsOf(E, c, ids, 'damage', slot)) {
    const n = foes.filter((t) => hurts(E, t, a.book.type)).length;
    if (!n) continue;
    const levels = a.slot ? slotLevels(c, a.slot) : [0];
    for (const l of levels) {
      let v = a.book.value(l || a.book.at || 1, n);
      if (a.book.atk && !a.book.area && inMelee) v *= 0.6;
      if (!best || v > best.v + 0.01) best = { id, l, v };
    }
  }
  if (!best || best.v < atWill * 1.2) return null;
  const t = E.action(c, best.id).aiTarget(E, c);
  return t ? { act: best.id, level: best.l || undefined, targets: [t.id] } : null;
};

// bring back a fallen friend, or top up a badly hurt one
export const castHeal = (ids) => (E, c, slot = 'action') => {
  const friends = E.alliesOf(c, true).filter((a) => E.alive(a) && !E.has(a, 'noHeal'));
  const down = friends.filter((a) => a.down);
  const hurt = friends.filter((a) => !a.down && a.hp < a.maxHp * 0.3);
  if (!down.length && !(slot === 'action' && hurt.length)) return null;
  const mine = spellsOf(E, c, ids, 'heal', slot);
  if (!mine.length) return null;
  const mass = mine.find(([, a]) => a.book.mass);
  const single = mine.find(([, a]) => !a.book.mass);
  if (mass && (down.length >= 2 || !single)) return { act: mass[0], targets: [] };
  if (!single) return null;
  const t = down[0] || hurt.sort((a, b) => a.hp - b.hp)[0];
  return { act: single[0], targets: [t.id] };
};

// one try at the strongest enemy with a condition spell, early in the fight
export const castControl = (ids) => (E, c, slot = 'action') => {
  if (c.conc || c.memo.controlTried || E.round > 2) return null;
  const foes = liveFoes(E, c).sort((a, b) => b.hp - a.hp);
  for (const [id, a] of spellsOf(E, c, ids, 'control', slot).sort((x, y) => (y[1].slot || 0) - (x[1].slot || 0))) {
    // sending away or freezing the only enemy helps nobody when the caster stands alone
    if (foes.length === 1 && (/Banishment/.test(a.name) || E.alliesOf(c).filter((x) => E.active(x)).length === 0)) continue;
    const t = foes.find((x) => x.hp >= 60 && a.only(E, x));
    if (!t) continue;
    c.memo.controlTried = true;
    return { act: id, targets: [t.id] };
  }
  for (const [id] of spellsOf(E, c, ids, 'word', slot)) {
    const t = E.action(c, id).aiTarget(E, c);
    if (t) return { act: id, targets: [t.id] };
  }
  return null;
};

// a concentration spell for the caster's own side, when nothing else is being held
export const castBuff = (ids) => (E, c, slot = 'action') => {
  if (c.conc) return null;
  const engaged = [...c.engaged].some((x) => E.present(E.get(x)));
  const aura = spellsOf(E, c, ids, 'aura', slot)[0];
  if (aura && engaged) return { act: aura[0], level: slotLevels(c, 3).filter((l) => l <= 5).slice(-1)[0], targets: [] };
  if (E.round > 1) return null;
  const friends = E.alliesOf(c).filter((x) => E.active(x)).length;
  const buff = spellsOf(E, c, ids, 'buff', slot).find(([, a]) => a.name !== 'Bless' || friends >= 2);
  return buff ? { act: buff[0], targets: [] } : null;
};
