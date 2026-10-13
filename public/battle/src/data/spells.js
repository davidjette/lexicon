// The spell book. One entry per spell, and cast() turns an entry into an action for whoever knows it.
// Damage and healing numbers for SRD spells come from spells-data.js (generated); the rest are below.
// A levelled spell spends a slot through the engine (act.slot), and its dice follow the slot used.
//
// What a spell does here is its combat effect only. A spell that stays up (Moonbeam, Call Lightning,
// Spiritual Weapon) is cast once and then struck with again on later turns, through again().
// Sorcerers spend sorcery points on the Metamagic named on their sheet: the choice carries a `meta`
// list, and the points are paid when the spell runs.

import { SRD_SPELLS } from './spells-data.js';
import { melee, ranged, save, emanation, rollDice, areaTargets } from './lib.js';
import { avgDice, parseDice, maxDice } from '../engine/dice.js';

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
  // spells that stay up: `sustain` is what each later strike costs, `setup` means the casting itself deals nothing
  'call lightning': { name: 'Call Lightning', level: 3, save: 'dex', half: true, type: 'lightning', dmg: up(3, 10, 3), sustain: 'action', conc: true },
  'moonbeam': { name: 'Moonbeam', level: 2, save: 'con', half: true, type: 'radiant', dmg: up(2, 10, 2), sustain: 'action', conc: true },
  'vampiric touch': { name: 'Vampiric Touch', level: 3, atk: 'melee', type: 'necrotic', dmg: up(3, 6, 3), sustain: 'action', conc: true },
  'flaming sphere': { name: 'Flaming Sphere', level: 2, save: 'dex', half: true, type: 'fire', dmg: up(2, 6, 2), sustain: 'bonus', conc: true, setup: true },
  'heat metal': { name: 'Heat Metal', level: 2, auto: true, type: 'fire', dmg: up(2, 8, 2), sustain: 'bonus', conc: true, metal: true },
  'spiritual weapon': { name: 'Spiritual Weapon', level: 2, cost: 'bonus', atk: 'melee', type: 'force', dmg: { 2: '1d8+MOD', 4: '2d8+MOD', 6: '3d8+MOD', 8: '4d8+MOD' }, sustain: 'bonus' },
  "bigby's hand": { name: "Bigby's Hand", level: 5, atk: 'melee', type: 'force', dmg: up(4, 8, 5, 2), sustain: 'bonus', conc: true },
  'arcane hand': { name: 'Arcane Hand', level: 5, atk: 'melee', type: 'force', dmg: up(4, 8, 5, 2), sustain: 'bonus', conc: true },
  'crown of stars': { name: 'Crown of Stars', level: 7, atk: 'ranged', type: 'radiant', dmg: { 7: '4d12' }, sustain: 'bonus', setup: true, charges: 7 },
  // conditions
  'hold person': { name: 'Hold Person', level: 2, save: 'wis', cond: 'paralysed', repeat: true, conc: true, only: 'humanoid' },
  'hold monster': { name: 'Hold Monster', level: 5, save: 'wis', cond: 'paralysed', repeat: true, conc: true },
  'banishment': { name: 'Banishment', level: 4, save: 'cha', cond: 'banished', conc: true },
  'blindness/deafness': { name: 'Blindness', level: 2, save: 'con', cond: 'blinded', repeat: true },
  'fear': { name: 'Fear', level: 3, save: 'wis', cond: 'frightened', repeat: true, conc: true, area: 3 },
  'slow': { name: 'Slow', level: 3, save: 'wis', cond: 'slowed', repeat: true, conc: true, area: 6, more: { ac: -2 } },
  'hypnotic pattern': { name: 'Hypnotic Pattern', level: 3, save: 'wis', cond: 'incapacitated', conc: true, area: 6, endsOnDamage: true },
  'power word stun': { name: 'Power Word Stun', level: 8, word: 'stun' },
  'power word kill': { name: 'Power Word Kill', level: 9, word: 'kill' },
  // the caster's own side
  'bless': { name: 'Bless', level: 1, buff: 'bless', conc: true },
  'haste': { name: 'Haste', level: 3, buff: 'haste', conc: true },
  // getting out of melee
  'misty step': { name: 'Misty Step', level: 2, cost: 'bonus', escape: 'self' },
  'dimension door': { name: 'Dimension Door', level: 4, escape: 'pair' },
  'greater invisibility': { name: 'Greater Invisibility', level: 4, buff: 'invisible', conc: true },
  'spirit guardians': { name: 'Spirit Guardians', level: 3, aura: true, save: 'wis', type: 'radiant', conc: true },
  // reactions, built by reaction() below
  'shield': { name: 'Shield', level: 1, reaction: true },
  'counterspell': { name: 'Counterspell', level: 3, reaction: true },
};
const HEALS = ['cure wounds', 'healing word', 'mass cure wounds', 'mass healing word', 'heal'];
const DROP = ['aid', 'false life', 'mass heal', 'arcane sword', 'faithful hound', 'guardian of faith', 'control water', 'wind wall', 'storm of vengeance', 'feeblemind'];

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
const engagedNow = (E, c) => [...c.engaged].some((x) => E.active(E.get(x)));

// ---------- sorcery points and Metamagic ----------
const META = {
  quickened: { key: 'quickened', name: 'Quickened Spell', cost: 2 },
  heightened: { key: 'heightened', name: 'Heightened Spell', cost: 3 },
  empowered: { key: 'empowered', name: 'Empowered Spell', cost: 1 },
  subtle: { key: 'subtle', name: 'Subtle Spell', cost: 1 },
  twinned: (level) => ({ key: 'twinned', name: 'Twinned Spell', cost: Math.max(1, level) }),
};
export const sorceryPoints = (c) => (c.memo.sp === undefined ? (c.memo.sp = c.tpl.sorcery || 0) : c.memo.sp);
const hasMeta = (c, key) => (c.tpl.meta || []).includes(key) && sorceryPoints(c) > 0;
const metaCost = (list) => (list || []).reduce((n, m) => n + m.cost, 0);
const used = (choice, key) => (choice.meta || []).some((m) => m.key === key);
function payMeta(E, c, choice) {
  for (const m of choice.meta || []) {
    c.memo.sp = sorceryPoints(c) - m.cost;
    E.log('info', `${c.name} uses ${m.name} (${m.cost} sorcery point${m.cost > 1 ? 's' : ''}, ${c.memo.sp} left).`, c);
  }
}
// Subtle Spell, when an enemy is ready to counter the casting
function subtle(E, c, choice) {
  const spent = metaCost(choice.meta);
  if (!hasMeta(c, 'subtle') || sorceryPoints(c) - spent < 1) return choice;
  const watched = liveFoes(E, c).some((t) => t.reaction && (t.tpl.reactions || []).some((r) => r.id === 'counterspell') && slotLevels(t, 3).length);
  return watched ? { ...choice, quietCast: true, meta: [...(choice.meta || []), META.subtle] } : choice;
}
// Empowered Spell: roll the dice here, and roll again the lowest of them, as many as the caster's Charisma modifier
function empoweredRoll(E, c, dice) {
  const { terms, mod } = parseDice(dice);
  const rolls = [];
  for (const t of terms) for (let i = 0; i < t.n; i++) rolls.push({ sides: t.sides, v: E.rng.int(t.sides) });
  const again = rolls.filter((r) => r.v < (r.sides + 1) / 2).sort((a, b) => ((b.sides + 1) / 2 - b.v) - ((a.sides + 1) / 2 - a.v))
    .slice(0, Math.max(1, Math.floor((((c.tpl.abil || {}).cha || 10) - 10) / 2)));
  const before = again.map((r) => r.v);
  for (const r of again) r.v = E.rng.int(r.sides);
  if (again.length) E.log('info', `Empowered Spell: ${c.name} rolls ${before.join(', ')} again and gets ${again.map((r) => r.v).join(', ')}.`, c);
  return String(Math.max(0, rolls.reduce((n, r) => n + r.v, 0) + mod));
}

// a spell that is up and can strike again
const standing = (c, s) => {
  const st = c.memo.sus && c.memo.sus[s.name];
  return st && st.left > 0 && (!s.conc || (c.conc && c.conc.name === s.name)) ? st : null;
};

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
      kind: 'special', name: s.name, spell: true, ...slotted, ...cost, ally: !mass, noTarget: mass, book: { role: 'heal', mass, base: avgDice(diceAt(s.heal, s.level, mod)) },
      run(E, c, act, choice) {
        const lvl = levelOf(choice);
        const t0 = c.tpl;
        const atZero = !mass && t0.healMaxDown && (E.get((choice.targets || [])[0]) || c).hp <= 0;
        let r = t0.healMax || atZero ? { total: maxDice(diceAt(s.heal, lvl, mod)), text: 'the most the dice can show' } : rollDice(E.rng, diceAt(s.heal, lvl, mod));
        if (t0.healAdd) r = { total: r.total + t0.healAdd(lvl), text: `${r.text} +${t0.healAdd(lvl)}` };
        const pool = mass
          ? E.alliesOf(c, true).filter((a) => a.hp < a.maxHp && !E.has(a, 'noHeal')).sort((a, b) => a.hp - b.hp).slice(0, 6)
          : [E.get((choice.targets || [])[0]) || c];
        E.log('act', `${c.name} casts ${s.name} (level ${lvl}): ${r.text} = ${r.total}${mass ? ' each' : ` on ${pool[0].name}`}.`, c);
        for (const a of pool) E.heal(a, r.total, c, s.name);
        if (t0.healerSelf && pool.some((a) => a !== c) && c.hp < c.maxHp) E.heal(c, t0.healerSelf(lvl), c, 'Blessed Healer');
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
        if (s.word === 'kill') E.damage(t, [{ amt: t.hp + (t.tempHp || 0), type: 'psychic' }], c, { rollText: s.name });
        else E.addFx(t, { cond: 'stunned', name: s.name, saveEnds: { ability: 'con', dc, spell: true } }, c);
      },
    };
  }

  if (s.cond) {
    const fits = (E, t) => !E.has(t, s.cond) && !E.condImmune(t, s.cond) && (!s.only || t.tpl.type === s.only);
    const base = save(s.name, s.save, dc, null, {
      spell: true, conc: s.conc,
      area: s.area ? { type: 'near', max: s.area, spread: 0.3 } : undefined,
      only: fits,
      onFail: [{ fx: 'cond', cond: s.cond, name: s.name, conc: s.conc, endsOnDamage: s.endsOnDamage, more: s.more, saveEnds: s.repeat ? { ability: s.save, dc, spell: true } : undefined }],
    });
    return {
      ...base, kind: 'special', ...slotted, selfManaged: true, book: { role: 'control', area: s.area || 0 },
      aiTarget: (E, c) => liveFoes(E, c).sort((x, y) => y.hp - x.hp).find((t) => fits(E, t)) || null,
      run(E, c, act, choice) {
        payMeta(E, c, choice);
        let ts = (choice.targets || []).map((id) => E.get(id)).filter((t) => t && E.present(t) && !t.down);
        if (s.area && ts.length) ts = areaTargets(E, c, ts[0], base.area);
        ts = ts.filter((t) => fits(E, t));
        if (!ts.length) { E.log('info', `${c.name}: ${s.name} has no target.`, c); return; }
        if (s.conc) E.concentrate(c, s.name);
        E.saveEffect(c, used(choice, 'heightened') ? { ...base, disFor: (E2, t) => t === ts[0] } : base, ts);
      },
    };
  }

  if (s.buff === 'haste') {
    return {
      kind: 'special', name: 'Haste', spell: true, ...slotted, conc: true, selfManaged: true, noTarget: true, book: { role: 'haste' },
      run(E, c, act, choice) {
        payMeta(E, c, choice);
        const ts = (choice.targets || []).map((id) => E.get(id)).filter((t) => t && E.active(t));
        if (!ts.length) return;
        E.log('act', `${c.name} casts Haste on ${ts.map((t) => (t === c ? 'themself' : t.name)).join(' and ')}.`, c);
        E.concentrate(c, 'Haste');
        for (const t of ts) {
          E.addFx(t, {
            id: 'haste', name: 'Haste', ac: 2, hasteAttack: true, conc: c.id,
            // when the spell ends the target loses a turn
            onEnd(E2, o) { if (E2.active(o)) E2.addFx(o, { cond: 'incapacitated', name: 'Haste wearing off', ends: { who: o.id, when: 'end', turns: 1 } }, null); },
          }, c);
        }
      },
    };
  }
  if (s.escape) {
    const pair = s.escape === 'pair';
    return {
      kind: 'special', name: s.name, spell: true, ...slotted, ...cost, noTarget: true, book: { role: 'escape', pair },
      run(E, c, act, choice) {
        const friend = pair ? E.get((choice.targets || [])[0]) : null;
        E.log('act', `${c.name} casts ${s.name}${friend ? `, taking ${friend.name} along` : ''}.`, c);
        for (const w of [c, friend]) {
          if (!w || !E.active(w)) continue;
          E.withdraw(w, { teleport: true, label: 'is out of melee' });
          w.pos = pair || w.pos !== 'front' ? 'back' : 'mid';
        }
      },
    };
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
  const hit = s.auto ? 1 : s.atk ? 0.65 : s.half ? 0.75 : 0.55;
  const book = {
    role: 'damage', at: o.uses ? o.at || s.level : 0, type: s.type, save: s.atk || s.auto ? null : s.save, area: s.area || 0, atk: !!s.atk || !!s.auto, half: !!s.half,
    dice: (lvl) => diceAt(s.dmg, lvl, mod), rays: s.rays, sustain: s.sustain, setup: !!s.setup,
    single: !s.area && !s.rays && !s.sustain, rolled: !s.atk && !s.auto,
  };
  book.avg = (lvl, n = 1) => avgDice(book.dice(lvl)) * (s.rays ? s.rays(lvl) : 1) * (1 + 0.7 * (Math.min(n, s.area || 1) - 1));
  book.value = (lvl, n = 1) => book.avg(lvl, n) * hit;
  const ok = (E, t) => hurts(E, t, s.type) && (!s.metal || ['humanoid', 'construct'].includes(t.tpl.type));
  book.ok = ok;
  const pick = (E, c) => E.ai.pickTarget(E, c, { melee: s.atk === 'melee' }, { filter: (t) => ok(E, t) });
  const strike = (E, c, first, lvl, choice = {}) => {
    let t = first;
    const name = lvl > s.level ? `${s.name} (level ${lvl})` : s.name;
    // one damage roll of the casting may carry a bonus (Elemental Affinity, Arcane Firearm)
    const plus = (c.tpl.spellPlus || []).filter((p) => !p.type || p.type === s.type).map((p) => `+${p.dice}`).join('');
    const dice = book.dice(lvl) + plus;
    const n = s.rays ? s.rays(lvl) : 1;
    if (s.auto) {
      const r = rollDice(E.rng, Array(n).fill(dice).join('+'));
      E.log('act', `${c.name}: ${name} at ${t.name}${s.rays ? `, ${n} darts` : ''}.`, c);
      E.damage(t, [{ amt: r.total, type: s.type }], c, { rollText: `${r.text} ${s.type}` });
    } else if (s.atk) {
      const a = { name, toHit, melee: s.atk === 'melee', dmg: [[dice, s.type]], plain: [[book.dice(lvl), s.type]], spell: true, weapon: false, noRangePenalty: !!s.sustain };
      for (let i = 0; i < n && E.active(c); i++) {
        if (t.down || !E.present(t)) t = pick(E, c);
        if (!t) break;
        E.attack(c, t, i === 0 ? a : { ...a, dmg: a.plain }, {});
      }
    } else {
      const targets = s.area ? areaTargets(E, c, t, { max: s.area, spread: s.area >= 6 ? 0.3 : 0.15 }) : [t];
      const rolled = used(choice, 'empowered') ? empoweredRoll(E, c, dice) : dice;
      const eff = { name, save: s.save, dc, dmg: [[rolled, s.type]], half: s.half, spell: true, isArea: !!s.area };
      if (used(choice, 'heightened')) eff.disFor = (E2, x) => x === t;
      E.saveEffect(c, eff, targets);
    }
  };
  const act = {
    kind: 'special', name: s.name, spell: true, ...slotted, ...cost, book,
    aiTarget: (E, c) => (liveFoes(E, c).some((t) => ok(E, t)) ? pick(E, c) : null),
    run(E, c, self, choice) {
      payMeta(E, c, choice);
      const lvl = levelOf(choice);
      let ts = (choice.targets || []).map((id) => E.get(id)).filter((t) => t && !t.down && E.present(t));
      if (!ts.length) ts = [pick(E, c)].filter(Boolean);
      if (!ts.length) { E.log('info', `${c.name}: ${s.name} has no target.`, c); return; }
      if (s.sustain) {
        E.log('act', `${c.name} casts ${lvl > s.level ? `${s.name} (level ${lvl})` : s.name}.`, c);
        if (s.conc) E.concentrate(c, s.name);
        (c.memo.sus = c.memo.sus || {})[s.name] = { lvl, left: s.charges || 99 };
        if (s.setup) return;
      }
      for (const t of used(choice, 'twinned') ? ts.slice(0, 2) : ts.slice(0, 1)) if (E.active(c)) strike(E, c, t, lvl, choice);
    },
  };
  if (!s.sustain) return act;
  // cast once; later strikes come through again()
  return {
    ...act, conc: s.conc, selfManaged: true, when: (E, c) => !standing(c, s),
    again: {
      kind: 'special', name: `${s.name} (strikes again)`, spell: true, cost: s.sustain, book: { role: 'again', value: (c) => book.value(standing(c, s).lvl) },
      when: (E, c) => !!standing(c, s) && liveFoes(E, c).some((t) => ok(E, t)),
      aiTarget: pick,
      run(E, c, self, choice) {
        const st = standing(c, s);
        let t = E.get((choice.targets || [])[0]);
        if (!t || t.down || !E.present(t)) t = pick(E, c);
        if (!st || !t) return;
        st.left -= 1;
        strike(E, c, t, st.lvl);
      },
    },
  };
}

// The later strikes of a spell that stays up (Call Lightning, Spiritual Weapon): a second action for the caster.
export const again = (key, o = {}) => (cast(key, o) || {}).again || null;

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

// the highest slot a caster has is kept for a killing blow, or for when the fight is being lost
const topSlot = (c) => {
  const top = Math.max(0, ...Object.keys(c.tpl.slots || {}).map(Number));
  return top >= 6 ? top : 0;
};
const losing = (E, c) => {
  const side = E.side(c.side).filter((x) => !x.summonedBy);
  return c.hp < c.maxHp * 0.35 || side.filter((x) => x.down || x.dead).length * 2 >= side.length;
};

function bestDamage(E, c, ids, slot, atWill, allowTop = false) {
  const foes = liveFoes(E, c);
  if (!foes.length) return null;
  const inMelee = engagedNow(E, c);
  const top = topSlot(c);
  const desperate = top && losing(E, c);
  let best = null;
  for (const [id, a] of spellsOf(E, c, ids, 'damage', slot)) {
    const live = foes.filter((t) => a.book.ok(E, t));
    const n = live.length;
    if (!n) continue;
    if (a.book.sustain && a.conc && c.conc) continue;
    const levels = a.slot ? slotLevels(c, a.slot) : [0];
    for (const l of levels) {
      const lvl = l || a.book.at || 1;
      let v = a.book.value(lvl, n);
      let kill = null;
      if (l && l === top && !allowTop && !desperate) {
        // a killing blow: the strongest enemy this casting would finish on an average roll
        if (a.book.sustain) continue;
        kill = a.book.area ? null : live.filter((t) => t.hp <= a.book.avg(lvl) && t.hp > atWill * 1.5).sort((x, y) => y.hp - x.hp)[0];
        const pool = a.book.area && n > 1 && live.reduce((sum, t) => sum + t.hp, 0) <= a.book.avg(lvl, n) * 0.8;
        if (!kill && !pool) continue;
      }
      if (a.book.atk && !a.book.area && inMelee && !a.book.sustain) v *= 0.6;
      // a spell that stays up is worth its later strikes too
      if (a.book.sustain === 'action') v += 2 * Math.max(0, v - atWill);
      else if (a.book.sustain) v *= 3;
      let twin = null;
      if (a.book.single && n >= 2 && !kill && hasMeta(c, 'twinned') && sorceryPoints(c) >= Math.max(1, lvl)) { twin = META.twinned(lvl); v *= 1.9; }
      const big = live.slice().sort((x, y) => y.hp - x.hp)[0];
      const edge = a.book.save ? -E.saveBonus(big, a.book.save) : 0;
      if (!best || v > best.v + 0.01 || (Math.abs(v - best.v) <= 0.01 && edge > best.edge)) best = { id, l, v, a, twin, kill, live, edge };
    }
  }
  return best;
}

// the damage spell and slot worth the most right now, if it beats what the caster does at will
export const castBest = (ids, atWill = 0) => (E, c, slot = 'action') => {
  let best = bestDamage(E, c, ids, slot, atWill);
  if (!best || best.v < atWill * 1.2) best = bestDamage(E, c, ids, slot, atWill, true);
  if (!best || best.v < atWill * 1.2) return null;
  if (slot === 'bonus') {
    // a bonus-action casting uses up the turn's one levelled spell: leave room for an aura, and for a bigger spell
    if (!c.conc && spellsOf(E, c, ids, 'aura', 'action').length) return null;
    const alt = c.turn.action && !c.turn.slotSpell ? bestDamage(E, c, ids, 'action', atWill) : null;
    if (alt && alt.v > best.v + atWill) return null;
  }
  const { a } = best;
  const t = best.kill || a.aiTarget(E, c);
  if (!t) return null;
  const targets = [t.id];
  const meta = [];
  if (best.twin) {
    const second = best.live.filter((x) => x !== t).sort((x, y) => y.hp - x.hp)[0];
    if (second) { targets.push(second.id); meta.push(best.twin); }
  }
  const left = () => sorceryPoints(c) - metaCost(meta);
  const lvl = best.l || a.book.at || 1;
  if (hasMeta(c, 'heightened') && a.book.rolled && !a.book.half && lvl >= 5 && left() >= 3) meta.push(META.heightened);
  if (hasMeta(c, 'empowered') && a.book.rolled && !a.book.setup && lvl >= 3 && left() >= 1) meta.push(META.empowered);
  return subtle(E, c, { act: best.id, level: best.l || undefined, targets, meta });
};

// Quickened Spell: the turn's big spell as a bonus action, which leaves the action for a cantrip, a weapon,
// or another strike from a spell that is already up
export const castQuickened = (ids, atWill = 0) => (E, c, slot = 'action') => {
  if (slot !== 'bonus' || !hasMeta(c, 'quickened') || !c.turn.action || c.turn.slotSpell) return null;
  const ch = castBest(ids, atWill)(E, c, 'action');
  if (!ch || sorceryPoints(c) - metaCost(ch.meta) < 2) return null;
  return { ...ch, cost: 'bonus', meta: [...ch.meta, META.quickened] };
};

// The bonus action is chosen before the action. This entry, in a bonus plan, lets the action's healing,
// control and buff spells go first, so a Quickened spell does not use up the turn's one levelled casting.
export const actionFirst = (...entries) => (E, c, slot = 'action') => {
  if (slot !== 'bonus' || !c.turn.action) return null;
  for (const f of entries) {
    const ch = f(E, c, 'action');
    if (ch) return ch;
  }
  return null;
};

// strike again with a spell that is already up
export const castAgain = (ids, atWill = 0) => (E, c, slot = 'action') => {
  const mine = spellsOf(E, c, ids, 'again', slot).map(([id, a]) => ({ id, a, v: a.book.value(c) })).sort((x, y) => y.v - x.v)[0];
  if (!mine) return null;
  if (slot === 'action') {
    if (mine.v < atWill) return null;
    const alt = bestDamage(E, c, ids, 'action', atWill);
    if (alt && alt.v > 2 * mine.v) return null;
  }
  const t = mine.a.aiTarget(E, c);
  return t ? { act: mine.id, targets: [t.id] } : null;
};

// out of melee: a caster who does not belong in the front line, hurt and with friends still standing
export const castEscape = (ids) => (E, c, slot = 'action') => {
  if (!engagedNow(E, c) || (c.tpl.pos || 'front') === 'front') return null;
  const friends = E.alliesOf(c).filter((x) => E.active(x));
  if (!friends.length) return null;
  const mine = spellsOf(E, c, ids, 'escape', slot)[0];
  if (!mine) return null;
  const [id, a] = mine;
  if (c.hp >= c.maxHp * (a.book.pair ? 0.4 : 0.6)) return null;
  if (!a.book.pair) return { act: id, targets: [] };
  const friend = friends.filter((x) => engagedNow(E, x) && (x.tpl.pos || 'front') !== 'front' && x.hp < x.maxHp * 0.5).sort((x, y) => x.hp - y.hp)[0];
  return { act: id, targets: friend ? [friend.id] : [] };
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
  const singles = mine.filter(([, a]) => !a.book.mass).sort((x, y) => x[1].book.base - y[1].book.base);
  if (mass && (down.length >= 2 || (!singles.length && down.length))) return { act: mass[0], targets: [] };
  if (!singles.length) return null;
  if (down.length) return { act: singles[0][0], targets: [down[0].id] };
  // an action spent topping up someone still standing has to be a big heal
  const big = singles[singles.length - 1];
  if (big[1].book.base < 25) return null;
  return { act: big[0], targets: [hurt.sort((a, b) => a.hp - b.hp)[0].id] };
};

// one try at the strongest enemy with a condition spell, early in the fight
export const castControl = (ids) => (E, c, slot = 'action') => {
  if (c.conc || c.memo.controlTried || E.round > 2) return null;
  const foes = liveFoes(E, c).sort((a, b) => b.hp - a.hp);
  for (const [id, a] of spellsOf(E, c, ids, 'control', slot)
    // against a crowd the spell that takes several of them comes first, then the highest level
    .sort((x, y) => (foes.length >= 3 ? (y[1].book.area ? 1 : 0) - (x[1].book.area ? 1 : 0) : 0) || (y[1].slot || 0) - (x[1].slot || 0))) {
    // sending away or freezing the only enemy helps nobody when the caster stands alone
    if (foes.length === 1 && (/Banishment/.test(a.name) || E.alliesOf(c).filter((x) => E.active(x)).length === 0)) continue;
    const t = foes.find((x) => x.hp >= 60 && a.only(E, x));
    if (!t) continue;
    c.memo.controlTried = true;
    const targets = [t.id];
    const meta = [];
    const second = !a.book.area && hasMeta(c, 'twinned') && sorceryPoints(c) >= a.slot && foes.find((x) => x !== t && x.hp >= 40 && a.only(E, x));
    if (second) { targets.push(second.id); meta.push(META.twinned(a.slot)); }
    if (hasMeta(c, 'heightened') && sorceryPoints(c) - metaCost(meta) >= 3) meta.push(META.heightened);
    return subtle(E, c, { act: id, targets, meta });
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
  if (E.round > 2) return null;
  const haste = spellsOf(E, c, ids, 'haste', slot)[0];
  if (haste && c.hp >= c.maxHp * 0.5) {
    // the best weapon users on the caster's side; the caster only if weapons are what they fight with
    const worth = (x) => { const w = E.action(x, x.tpl.hasteWith || x.tpl.basic); return w && w.kind === 'attack' && !w.spell ? E.expected(x, w) / (w.n || 1) : 0; };
    const pool = E.alliesOf(c, true).filter((x) => E.active(x) && !E.fxOf(x, 'haste') && (x !== c || (c.tpl.pos || 'front') === 'front'))
      .map((x) => [x, worth(x)]).filter(([, w]) => w >= 6).sort((x, y) => y[1] - x[1]);
    if (pool.length) {
      const targets = [pool[0][0].id];
      const meta = [];
      if (pool[1] && hasMeta(c, 'twinned') && sorceryPoints(c) >= 3) { targets.push(pool[1][0].id); meta.push(META.twinned(3)); }
      return subtle(E, c, { act: haste[0], targets, meta });
    }
  }
  if (E.round > 1) return null;
  const friends = E.alliesOf(c).filter((x) => E.active(x)).length;
  const buff = spellsOf(E, c, ids, 'buff', slot).find(([, a]) => a.name !== 'Bless' || friends >= 2);
  return buff ? { act: buff[0], targets: [] } : null;
};
