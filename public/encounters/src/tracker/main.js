// The battle tracker page: a table-side initiative tracker for the DM. The page itself is an
// empty shell; every fight and stat block it shows comes out of the DM pack once unlocked.

import '../data/encounters.js?v=mwfs3ebf';
import { ALL, TRACKERS } from '../data/registry.js?v=mwfs3ebf';
import { PARTY } from '../data/pcs.js?v=mwfs3ebf';
import { findPack, unlock, installTexts } from '../dm-loader.js?v=mwfs3ebf';
import {
  ABILS, CONDITIONS, DAMAGE_TYPES, signed, rollExpr, rollD20, newState, cardOf, addCombatants, customCard, say, order, get,
  rollInitiative, next, legendaryReady, roundEndItems, damage, heal, addCond, resolveCard,
} from './core.js?v=mwfs3ebf';

const KEY = 'tracker-state-v1';
const app = document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

let S = null; // the fight
let undo = [];
let resetArmed = false;
const scenario = () => TRACKERS.find((t) => t.id === (S && S.scenario)) || null;
const card = (c) => cardOf(S, scenario(), c);

function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked: the fight still runs */ } }
function load() {
  try {
    const got = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (got && got.v === 1 && (!got.scenario || TRACKERS.some((t) => t.id === got.scenario))) {
      // a fight not yet begun is set up again when its starting numbers have been changed
      const sc = TRACKERS.find((t) => t.id === got.scenario);
      if (sc && got.phase === 'setup' && (got.rev || 0) !== (sc.rev || 0)) return null;
      return got;
    }
  } catch { /* start fresh */ }
  return null;
}
// Every change goes through here, so every change can be undone.
function act(fn) {
  undo.push(JSON.stringify(S));
  if (undo.length > 200) undo.shift();
  fn();
  save();
  render();
}

function startFight(id) {
  const sc = TRACKERS.find((t) => t.id === id) || null;
  S = newState(sc);
  if (sc) {
    for (const p of sc.party || []) {
      const [c] = addCombatants(S, sc, `pc:${p}`, 1, 'pc');
      const at = (sc.partyHp || {})[p]; // [now, max] as the table stands
      if (c && at) { c.hp = at[0]; c.maxHp = at[1]; }
    }
    S.rev = sc.rev || 0;
  }
  S.log = [];
  undo = [];
  save();
}

// ------------------------------------------------------------------ rolling
function modeOf(ev) { return ev.shiftKey ? 'adv' : ev.ctrlKey || ev.altKey || ev.metaKey ? 'dis' : undefined; }
const d20Text = (r) => (r.rolls.length > 1 ? `${r.mode === 'adv' ? 'adv' : 'dis'} [${r.rolls.join(', ')}]` : `[${r.nat}]`);
function rollParts(dmg, crit) {
  return dmg.map(([dice, type]) => { const r = rollExpr(dice, { crit }); return { amt: r.total, type, text: `${r.text} ${type}` }; });
}
const sum = (parts) => parts.reduce((a, p) => a + p.amt, 0);

function rollAction(c, a, ev, { alt = false } = {}) {
  const who = c.name;
  const dmg = alt && a.alt ? a.alt.dmg : a.dmg;
  if (a.hit !== undefined) {
    const r = rollD20(modeOf(ev));
    const crit = r.nat === 20;
    const parts = dmg ? rollParts(dmg, crit) : [];
    const e = say(S, 'roll', '', { kind: 'atk', src: c.id, who, label: a.name, d20: d20Text(r), nat: r.nat, tot: r.nat + a.hit, bonus: a.hit, crit, parts, total: sum(parts) });
    S.pick = parts.length ? e.id : null;
  } else if (a.save) {
    const parts = dmg ? rollParts(dmg, false) : [];
    const e = say(S, 'roll', '', { kind: 'save', src: c.id, who, label: a.name, save: a.save, dc: a.dc, half: !!a.half, parts, total: sum(parts) });
    S.pick = e.id;
  } else if (a.heal) {
    const r = rollExpr(a.heal);
    say(S, 'roll', '', { kind: 'plain', who, label: a.name, detail: r.text, total: r.total });
    if (/herself|himself|itself|self/i.test(a.name)) heal(S, c, r.total, a.name);
  } else if (dmg) {
    const parts = rollParts(dmg, false);
    const e = say(S, 'roll', '', { kind: 'dmg', src: c.id, who, label: a.name, parts, total: sum(parts) });
    S.pick = e.id;
  } else {
    say(S, 'info', `${who}: ${a.name}.`);
  }
  if (a.uses && c.uses[a.key] > 0) c.uses[a.key] -= 1;
  if (a.recharge) c.spent[a.key] = true;
  if (a.conc) c.conc = true;
}

function useAction(c, key, ev, opt = {}) {
  const a = card(c).actions.find((x) => x.key === key);
  if (!a) return;
  if (a.cost === 'reaction') c.reacted = true;
  rollAction(c, a, ev, opt);
}

function rollSave(c, ability, ev, dc, label) {
  const k = card(c);
  const r = rollD20(modeOf(ev));
  const b = k.saves[ability] || 0;
  const tot = r.nat + b;
  const res = dc ? (tot >= dc ? ' Success.' : ' Failure.') : '';
  say(S, 'roll', '', { kind: 'plain', who: c.name, label: `${label || `${ability.toUpperCase()} save`}${dc ? ` (DC ${dc})` : ''}`, detail: `${d20Text(r)} ${signed(b)}`, total: tot, note: res.trim() });
  return tot;
}

// ------------------------------------------------------------------ pieces of the page
function hpBar(c) {
  if (c.lair) return '';
  const pct = Math.max(0, Math.min(100, Math.round((c.hp / Math.max(1, c.maxHp)) * 100)));
  const tone = pct > 50 ? 'ok' : pct > 25 ? 'low' : 'crit';
  const label = c.count !== undefined ? `${c.count} standing` : `${c.hp}${c.temp ? ` +${c.temp}` : ''} / ${c.maxHp}`;
  return `<div class="hp ${tone}"><span style="width:${pct}%"></span><b>${label}</b></div>`;
}

function condChips(c, withX) {
  const chips = (c.conds || []).map((x, i) => `<span class="cond" title="${esc(x.note || '')}${x.ends ? ` Ends at the ${x.ends.when} of its turn.` : ''}">${esc(x.name)}${withX ? `<button data-a="uncond" data-id="${c.id}" data-i="${i}" title="Remove">x</button>` : ''}</span>`);
  if (c.conc) chips.push('<span class="cond conc">Concentrating</span>');
  if (c.reacted && withX) chips.push('<span class="cond used">Reaction used</span>');
  return chips.join('');
}

function row(c, k, isCur) {
  const cls = ['row', c.side, isCur ? 'cur' : '', c.dead ? 'dead' : '', S.sel === c.id ? 'sel' : '', c.lair ? 'lair' : ''].join(' ');
  const init = `<input class="init" data-i="init" data-id="${c.id}" data-fk="init:${c.id}" value="${c.init ?? ''}" inputmode="numeric" title="Initiative" ${c.lair ? 'disabled' : ''}>`;
  if (c.lair) return `<div class="${cls}" data-a="sel" data-id="${c.id}">${init}<div class="who"><div class="nm">${esc(c.name)}</div><div class="sub">Lair action</div></div></div>`;
  const pips = k.leg ? `<span class="pips" title="Legendary actions left">${'&#9670;'.repeat(Math.max(0, c.legLeft))}${'&#9671;'.repeat(Math.max(0, k.leg - c.legLeft))}</span>` : '';
  return `<div class="${cls}" data-a="sel" data-id="${c.id}">
    ${init}
    <div class="who"><div class="nm">${esc(c.name)} ${pips}</div><div class="sub">AC ${k.ac}${condChips(c) ? ` ${condChips(c)}` : ''}</div></div>
    <div class="hpcol">${hpBar(c)}
      <div class="quick"><input data-i="amt" data-id="${c.id}" data-fk="amt:${c.id}" inputmode="numeric" placeholder="${c.count !== undefined ? '1' : 'hp'}" title="Type a number. Enter deals damage, Shift+Enter heals.">
      <button class="mini bad" data-a="dmg" data-id="${c.id}" title="Damage">&minus;</button><button class="mini good" data-a="heal" data-id="${c.id}" title="Heal">+</button></div>
    </div></div>`;
}

function orderPanel() {
  const ord = order(S);
  const waiting = S.list.filter((c) => !ord.includes(c));
  const rows = ord.map((c) => row(c, c.lair ? null : card(c), c.id === S.cur)).join('');
  const rest = waiting.map((c) => row(c, card(c), false)).join('');
  const setup = S.phase === 'setup';
  return `<section class="panel order">
    <h2>${setup ? 'Initiative' : `Round ${S.round}`}</h2>
    ${setup ? `<p class="hint">Type each player's roll in the box beside their name. Everything left blank is rolled when the fight begins.</p>
      <div class="bar"><button class="btn small" data-a="rollinit">Roll for the others now</button></div>` : ''}
    <div class="rows">${rows}${rest ? `<div class="sep">No initiative yet</div>${rest}` : ''}</div>
  </section>`;
}

function actionRow(c, a) {
  const left = a.uses ? c.uses[a.key] ?? 0 : null;
  const usesPips = a.uses ? `<span class="uses" title="Uses left. Click to change.">${Array.from({ length: a.uses }, (_, i) => `<button data-a="use" data-id="${c.id}" data-k="${a.key}" data-n="${i < left ? i : i + 1}" class="${i < left ? 'on' : ''}"></button>`).join('')}</span>` : '';
  const rech = a.recharge ? `<button class="tagbtn ${c.spent[a.key] ? 'spent' : ''}" data-a="recharge" data-id="${c.id}" data-k="${a.key}" title="Click to switch. Rolled at the start of each turn while spent.">${c.spent[a.key] ? 'spent' : 'ready'} &middot; recharge ${a.recharge}${a.recharge < 6 ? '-6' : ''}</button>` : '';
  const dmgText = a.dmg ? a.dmg.map(([dice, type]) => `${dice} ${type}`).join(' + ') : '';
  let btn = '';
  if (a.hit !== undefined) btn = `<button class="btn roll" data-a="act" data-id="${c.id}" data-k="${a.key}">${signed(a.hit)} to hit${dmgText ? ` &middot; ${esc(dmgText)}` : ''}</button>`;
  else if (a.save) btn = `<button class="btn roll" data-a="act" data-id="${c.id}" data-k="${a.key}">DC ${a.dc} ${cap(a.save)}${dmgText ? ` &middot; ${esc(dmgText)}` : ''}${a.half ? ' (half)' : ''}</button>`;
  else if (a.heal) btn = `<button class="btn roll" data-a="act" data-id="${c.id}" data-k="${a.key}">heal ${esc(a.heal)}</button>`;
  else if (a.dmg) btn = `<button class="btn roll" data-a="act" data-id="${c.id}" data-k="${a.key}">${esc(dmgText)}</button>`;
  else if (a.uses || a.recharge || a.cost === 'reaction') btn = `<button class="btn roll ghost" data-a="act" data-id="${c.id}" data-k="${a.key}">use</button>`;
  const alt = a.alt ? `<button class="btn roll" data-a="act" data-alt="1" data-id="${c.id}" data-k="${a.key}">${esc(a.alt.label)} &middot; ${esc(a.alt.dmg.map(([dice, type]) => `${dice} ${type}`).join(' + '))}</button>` : '';
  return `<div class="arow"><div class="aname"><b>${esc(a.name)}</b> ${usesPips} ${rech}${a.text ? `<div class="atext">${esc(a.text)}</div>` : ''}</div><div class="abtns">${btn}${alt}</div></div>`;
}

function promptRow(c, p, i) {
  const btn = p.roll || p.save ? `<button class="btn primary small" data-a="prompt" data-id="${c.id}" data-n="${i}">${esc(p.label || 'Roll')}</button>` : '';
  return `<div class="prompt"><span>${esc(p.text)}</span>${btn}<button class="btn small ghost" data-a="noprompt" data-id="${c.id}" data-n="${i}">Done</button></div>`;
}

function lairSheet(c) {
  const L = scenario() && scenario().lair;
  if (!L) return '';
  let body = `<p>${esc(L.text)}</p>`;
  if (L.save) {
    const sv = L.save;
    const targets = S.list.filter((t) => !t.lair && !t.dead && t.side === sv.side && !(sv.skipTypes || []).includes(card(t).type));
    body += `<div class="bar"><button class="btn primary" data-a="lairroll">Roll the ${cap(sv.ability)} save (DC ${sv.dc}) for the DM's creatures</button></div>
      <p class="hint">Players roll their own. Click a name to mark who failed.</p>
      <div class="targets">${targets.map((t) => { const has = (t.conds || []).some((x) => x.name === sv.cond.name); return `<button class="btn small ${has ? 'on' : ''}" data-a="laircond" data-id="${t.id}">${esc(t.name)}${has ? ': failed' : ''}</button>`; }).join('')}</div>`;
  }
  return `<section class="panel sheet"><h2>${esc(c.name)}</h2><div class="sheet-body"><div class="kick">Lair action &middot; initiative ${c.init}</div>${body}</div></section>`;
}

function sheetPanel() {
  const c = get(S, S.sel) || get(S, S.cur) || S.list.find((x) => !x.lair);
  if (!c) return '<section class="panel sheet"><h2>No one on the field</h2><div class="sheet-body"><p class="hint">Add creatures from the cast list.</p></div></section>';
  if (c.lair) return lairSheet(c);
  const k = card(c);
  const groups = [['action', 'Actions'], ['bonus', 'Bonus actions'], ['reaction', 'Reactions'], ['free', 'Free'], ['legendary', 'Legendary']];
  const acts = groups.map(([cost, title]) => {
    const list = k.actions.filter((a) => a.cost === cost);
    return list.length ? `<h3>${title}</h3>${list.map((a) => actionRow(c, a)).join('')}` : '';
  }).join('');
  const lr = k.lr ? `<span class="stat">Legendary Resistance <span class="uses">${Array.from({ length: k.lr }, (_, i) => `<button data-a="lr" data-id="${c.id}" data-n="${i < c.lrLeft ? i : i + 1}" class="${i < c.lrLeft ? 'on' : ''}"></button>`).join('')}</span></span>` : '';
  const leg = k.leg ? `<span class="stat">Legendary actions <span class="uses dia">${Array.from({ length: k.leg }, (_, i) => `<button data-a="legset" data-id="${c.id}" data-n="${i < c.legLeft ? i : i + 1}" class="${i < c.legLeft ? 'on' : ''}"></button>`).join('')}</span></span>` : '';
  const legList = (k.legendary || []).length ? `<h3>Legendary actions (${k.leg} a round, at the end of another creature's turn)</h3><div class="leglist">${k.legendary.map((l) => `<button class="btn small" data-a="leg" data-id="${c.id}" data-k="${l.key}" data-c="${l.cost}" ${c.legLeft < l.cost ? 'disabled' : ''}>${esc(l.name)} <i>${l.cost}</i></button>`).join('')}</div>` : '';
  const defs = [k.resist.length ? `Resists ${k.resist.join(', ')}` : '', k.immune.length ? `Immune to ${k.immune.join(', ')}` : '', k.vuln.length ? `Vulnerable to ${k.vuln.join(', ')}` : '', k.condImmune.length ? `Cannot be ${k.condImmune.join(', ')}` : ''].filter(Boolean).join('. ');
  const acting = c.id === S.cur;
  return `<section class="panel sheet ${c.side}">
    <h2>${esc(c.name)}${acting ? ' <em>acting now</em>' : ''}</h2>
    <div class="sheet-body">
      <div class="kick">${esc(k.sub || [k.type, k.cr !== undefined ? `CR ${k.cr}` : ''].filter(Boolean).join(' · '))}</div>
      ${(c.prompts || []).map((p, i) => promptRow(c, p, i)).join('')}
      <div class="stats">
        <span class="stat big">AC <b>${k.ac}</b></span>
        ${c.count !== undefined ? `<span class="stat big"><b>${c.count}</b> standing</span>` : `<span class="stat big">HP <input data-i="hp" data-id="${c.id}" data-fk="hp:${c.id}" value="${c.hp}"> / <input data-i="max" data-id="${c.id}" data-fk="max:${c.id}" value="${c.maxHp}"></span>
        <span class="stat">Temp <input data-i="temp" data-id="${c.id}" data-fk="temp:${c.id}" value="${c.temp || 0}"></span>`}
        <span class="stat">Init ${signed(k.init || 0)}</span>
        ${lr}${leg}
      </div>
      <div class="saves">${ABILS.map((a) => `<button class="btn small" data-a="save" data-id="${c.id}" data-k="${a}" title="Roll this save. Shift for advantage, Ctrl for disadvantage.">${a.toUpperCase()} ${signed(k.saves[a] || 0)}</button>`).join('')}</div>
      ${defs ? `<p class="defs">${esc(defs)}.</p>` : ''}
      <div class="condbar">${condChips(c, true)}
        <select data-i="addcond" data-id="${c.id}"><option value="">+ condition</option>${CONDITIONS.map((n) => `<option>${n}</option>`).join('')}<option value="__custom">Other...</option></select>
        <select data-i="addres" data-id="${c.id}"><option value="">+ resistance</option>${DAMAGE_TYPES.map((n) => `<option>${n}</option>`).join('')}</select>
        ${(c.resist || []).map((r, i) => `<span class="cond used">resists ${esc(r)}<button data-a="unres" data-id="${c.id}" data-i="${i}" title="Remove">x</button></span>`).join('')}
        <button class="btn small ${c.conc ? 'on' : ''}" data-a="conc" data-id="${c.id}">Concentration</button>
        <button class="btn small ${c.reacted ? 'on' : ''}" data-a="react" data-id="${c.id}">Reaction used</button>
      </div>
      ${(k.traits || []).length ? `<div class="traits">${k.traits.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
      ${legList}
      ${acts}
      <h3>Notes</h3>
      <textarea data-i="notes" data-id="${c.id}" data-fk="notes:${c.id}" rows="2" placeholder="Anything to remember about this one">${esc(c.notes || '')}</textarea>
      <div class="bar tail">
        <button class="btn small ghost" data-a="side" data-id="${c.id}">Move to the ${c.side === 'pc' ? 'opposition' : "party's side"}</button>
        <button class="btn small ghost" data-a="down" data-id="${c.id}">${c.dead ? 'Back in the fight' : 'Mark as down'}</button>
        <button class="btn small ghost" data-a="remove" data-id="${c.id}">Remove from the fight</button>
      </div>
    </div>
  </section>`;
}

// The result of a roll, with the people it could land on.
function picker(e) {
  const src = get(S, e.src);
  const side = src ? src.side : 'foe';
  const targets = S.list.filter((t) => !t.lair && !t.dead && t.id !== e.src).sort((a, b) => (a.side === side ? 1 : 0) - (b.side === side ? 1 : 0));
  const line = (t) => {
    const k = card(t);
    if (e.kind === 'atk') {
      const hit = e.crit || (e.nat !== 1 && e.tot >= k.ac);
      return `<div class="tline ${t.side}"><span>${esc(t.name)} <i>AC ${k.ac}</i> <b class="${hit ? 'good' : 'bad'}">${e.crit ? 'crit' : hit ? 'hit' : 'miss'}</b></span><span><button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="1">Full</button><button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="0.5">Half</button><button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="2">&times;2</button></span></div>`;
    }
    if (e.kind === 'save') {
      return `<div class="tline ${t.side}"><span>${esc(t.name)} <i>${cap(e.save)} ${signed(k.saves[e.save] || 0)}</i></span><span>${t.pc ? '' : `<button class="btn small primary" data-a="applyroll" data-e="${e.id}" data-id="${t.id}">Roll</button>`}<button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="1">Failed</button><button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="${e.half ? 0.5 : 0}">Saved</button></span></div>`;
    }
    return `<div class="tline ${t.side}"><span>${esc(t.name)}</span><span><button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="1">Full</button><button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="0.5">Half</button><button class="btn small" data-a="apply" data-e="${e.id}" data-id="${t.id}" data-m="2">&times;2</button></span></div>`;
  };
  return `<div class="picker">${targets.map(line).join('')}<div class="bar"><button class="btn small ghost" data-a="unpick">Close</button></div></div>`;
}

function logEntry(e) {
  if (e.t !== 'roll') return `<div class="ev ${e.t}">${esc(e.text)}</div>`;
  let head = '';
  if (e.kind === 'atk') {
    head = `<b>${esc(e.who)}</b> ${esc(e.label)}: ${esc(e.d20)} ${signed(e.bonus)} = <strong class="${e.crit ? 'good' : e.nat === 1 ? 'bad' : ''}">${e.tot}</strong>${e.crit ? ' <strong class="good">critical hit</strong>' : e.nat === 1 ? ' <strong class="bad">natural 1</strong>' : ''}`;
  } else if (e.kind === 'save') {
    head = `<b>${esc(e.who)}</b> ${esc(e.label)}: DC ${e.dc} ${cap(e.save)} save${e.half ? ', half on a success' : ''}`;
  } else if (e.kind === 'dmg') {
    head = `<b>${esc(e.who)}</b> ${esc(e.label)}`;
  } else {
    head = `<b>${esc(e.who)}</b> ${esc(e.label)}: ${esc(e.detail || '')} = <strong>${e.total}</strong>${e.note ? ` ${esc(e.note)}` : ''}`;
  }
  const dmg = e.parts && e.parts.length ? `<div class="dmgline">${e.parts.map((p) => esc(p.text)).join(' + ')} = <strong>${e.total}</strong> <button class="btn small ${S.pick === e.id ? 'on' : ''}" data-a="pick" data-e="${e.id}">Apply to...</button></div>` : '';
  return `<div class="ev roll">${head}${dmg}${S.pick === e.id ? picker(e) : ''}</div>`;
}

function benchPanel() {
  const sc = scenario();
  const items = sc ? (sc.bench || []).map((b, i) => {
    const k = resolveCard(b.ref, sc, S.level);
    if (!k) return '';
    return `<div class="brow"><div><b>${esc(k.name)}</b>${b.n > 1 ? ` &times;${b.n}` : ''}<div class="atext">AC ${k.ac} &middot; HP ${k.minion ? '1 each' : k.startHp ? `${k.startHp} of ${k.hp}` : k.hp}${b.note ? ` &middot; ${esc(b.note)}` : ''}</div></div>
      <div class="abtns"><button class="btn small ${b.side === 'pc' ? 'primary' : 'ghost'}" data-a="bench" data-n="${i}" data-s="pc">+ Party</button><button class="btn small ${b.side === 'foe' ? 'primary' : 'ghost'}" data-a="bench" data-n="${i}" data-s="foe">+ Opposition</button></div></div>`;
  }).join('') : '';
  const names = Object.values(ALL).map((t) => t.name).sort();
  return `<details class="panel bench" ${S.phase === 'setup' || S.benchOpen ? 'open' : ''} data-d="bench">
    <summary>The cast: add to either side</summary>
    <div class="sheet-body">${items}
      <h3>Anyone in the library</h3>
      <div class="adder"><input id="libName" list="libList" placeholder="Start typing a name"><datalist id="libList">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <input id="libN" type="number" min="1" max="30" value="1" title="How many">
        <button class="btn small" data-a="lib" data-s="pc">+ Party</button><button class="btn small" data-a="lib" data-s="foe">+ Opposition</button></div>
      <h3>Someone new</h3>
      <div class="adder custom"><input id="cuName" placeholder="Name"><input id="cuAc" type="number" placeholder="AC"><input id="cuHp" type="number" placeholder="HP"><input id="cuInit" type="number" placeholder="Init +"><input id="cuHit" type="number" placeholder="To hit +"><input id="cuDmg" placeholder="Damage, e.g. 2d6+3">
        <button class="btn small" data-a="custom" data-s="pc">+ Party</button><button class="btn small" data-a="custom" data-s="foe">+ Opposition</button></div>
    </div>
  </details>`;
}

function stopBanner() {
  const sc = scenario();
  if (S.phase === 'setup') {
    return `<div class="stop setup"><div><b>Before the fight.</b> Set the field below, enter the players' initiative, then begin.</div><button class="btn primary big" data-a="next">Roll initiative and begin</button></div>`;
  }
  if (S.phase === 'leg') {
    const ready = legendaryReady(S, sc, get(S, S.cur));
    return `<div class="stop leg"><div class="stop-body"><b>Stop: legendary action?</b> ${esc((get(S, S.cur) || {}).name || '')} has finished.
      ${ready.map((c) => `<div class="legrow"><span>${esc(c.name)} <span class="pips">${'&#9670;'.repeat(c.legLeft)}</span></span>${card(c).legendary.map((l) => `<button class="btn small" data-a="leg" data-id="${c.id}" data-k="${l.key}" data-c="${l.cost}" ${c.legLeft < l.cost ? 'disabled' : ''}>${esc(l.name)} <i>${l.cost}</i></button>`).join('')}</div>`).join('')}
      </div><button class="btn primary big" data-a="next">Continue</button></div>`;
  }
  if (S.phase === 'roundEnd') {
    const items = roundEndItems(S, sc);
    return `<div class="stop round"><div class="stop-body"><b>Stop: end of round ${S.round}.</b>
      ${items.length ? items.map((it) => { const i = sc.roundEnd.indexOf(it); return `<div class="legrow"><span>${esc(it.text)}</span>${it.add ? `<button class="btn small primary" data-a="wave" data-n="${i}">Add them</button>` : ''}${it.key ? `<button class="btn small ghost" data-a="wavedone" data-n="${i}">Dismiss</button>` : ''}</div>`; }).join('') : '<span class="hint">Nothing scheduled.</span>'}
      </div><button class="btn primary big" data-a="next">Begin round ${S.round + 1}</button></div>`;
  }
  const cur = get(S, S.cur);
  const ord = order(S).filter((c) => c.lair || !c.dead);
  const at = ord.findIndex((c) => c.id === S.cur);
  const up = ord[at + 1];
  return `<div class="stop turn"><div><b>${cur ? esc(cur.name) : ''}</b>${cur && cur.lair ? '' : ' is acting.'} <span class="hint">${up ? `Next: ${esc(up.name)}.` : 'Last turn of the round.'}</span></div><button class="btn primary big" data-a="next">Next turn</button></div>`;
}

function render() {
  const fk = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
  const logScroll = (document.querySelector('.log') || {}).scrollTop || 0;
  const sc = scenario();
  const toggles = sc ? (sc.toggles || []).map((t) => `<label class="check"><input type="checkbox" data-i="flag" data-k="${t.key}" ${(S.flags[t.key] ?? !!t.on) ? 'checked' : ''}> ${esc(t.label)}</label>`).join('') : '';
  app.innerHTML = `
    <header class="tbar">
      <div class="ttl"><a href="./">Encounters</a> &middot; <b>Battle tracker</b> <span class="dm-tag">DM ONLY</span></div>
      <label class="field"><select data-i="scenario"><option value="">An empty table</option>${TRACKERS.map((t) => `<option value="${t.id}" ${S.scenario === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <span class="grow"></span>
      <button class="btn small" data-a="undo" ${undo.length ? '' : 'disabled'} title="Ctrl+Z">Undo</button>
      <button class="btn small ghost" data-a="reset">${resetArmed ? 'Click again to clear the fight' : 'New fight'}</button>
      <button class="btn small ghost" data-a="theme">Theme</button>
    </header>
    ${stopBanner()}
    ${toggles ? `<div class="flags">${toggles}</div>` : ''}
    <div class="tcols">
      <div class="leftcol">${orderPanel()}${benchPanel()}</div>
      ${sheetPanel()}
      <div class="rightcol">
        <section class="panel dice">
          <h2>Dice</h2>
          <div class="sheet-body"><div class="tray">${[4, 6, 8, 10, 12, 20, 100].map((n) => `<button class="btn small" data-a="die" data-n="${n}">d${n}</button>`).join('')}
            <input id="expr" data-fk="expr" placeholder="2d8+7" title="Type dice and press Enter"><button class="btn small" data-a="expr">Roll</button></div>
            <p class="hint">Hold Shift for advantage, Ctrl for disadvantage. N or the right arrow moves to the next turn.</p></div>
        </section>
        <section class="panel"><h2>Rolls and log</h2><div class="log">${S.log.slice(0, 150).map(logEntry).join('')}</div></section>
        ${sc && sc.notes ? `<details class="panel"><summary>The field: ${esc(sc.where || sc.name)}</summary><div class="sheet-body traits">${sc.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div></details>` : ''}
      </div>
    </div>`;
  if (fk) { const el = app.querySelector(`[data-fk="${fk}"]`); if (el) { el.focus(); if (el.select && el.tagName === 'INPUT') el.select(); } }
  const lg = document.querySelector('.log'); if (lg) lg.scrollTop = logScroll;
}

// ------------------------------------------------------------------ what clicks do
function applyAmt(id, sign) {
  const el = app.querySelector(`[data-i="amt"][data-id="${id}"]`);
  const c = get(S, id);
  const n = Math.abs(parseInt(el && el.value, 10)) || (c.count !== undefined ? 1 : 0);
  if (!n) return;
  act(() => {
    if (sign < 0) { if (c.count !== undefined) for (let i = 0; i < n && c.count > 0; i++) damage(S, scenario(), c, [{ amt: 1, type: '' }]); else damage(S, scenario(), c, [{ amt: n, type: '' }]); } else heal(S, c, n);
  });
}

const clicks = {
  next: () => act(() => next(S, scenario())),
  undo: () => { if (!undo.length) return; S = JSON.parse(undo.pop()); save(); render(); },
  reset: () => { if (!resetArmed) { resetArmed = true; render(); setTimeout(() => { resetArmed = false; render(); }, 4000); return; } resetArmed = false; const keep = JSON.stringify(S); startFight(S.scenario); undo = [keep]; render(); },
  theme: () => { const root = document.documentElement; const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = t; localStorage.setItem('lazaret-theme', t); },
  sel: (el) => { S.sel = el.dataset.id; save(); render(); },
  rollinit: () => act(() => rollInitiative(S, scenario())),
  dmg: (el) => applyAmt(el.dataset.id, -1),
  heal: (el) => applyAmt(el.dataset.id, 1),
  act: (el, ev) => act(() => useAction(get(S, el.dataset.id), el.dataset.k, ev, { alt: !!el.dataset.alt })),
  leg: (el, ev) => act(() => { const c = get(S, el.dataset.id); const cost = +el.dataset.c; if (c.legLeft < cost) return; c.legLeft -= cost; say(S, 'info', `${c.name} spends ${cost} legendary ${cost > 1 ? 'actions' : 'action'}. ${c.legLeft} left.`); useAction(c, el.dataset.k, ev); }),
  save: (el, ev) => act(() => rollSave(get(S, el.dataset.id), el.dataset.k, ev)),
  use: (el) => act(() => { get(S, el.dataset.id).uses[el.dataset.k] = +el.dataset.n; }),
  lr: (el) => act(() => { const c = get(S, el.dataset.id); c.lrLeft = +el.dataset.n; say(S, 'info', `${c.name}: ${c.lrLeft} Legendary Resistance left.`); }),
  legset: (el) => act(() => { get(S, el.dataset.id).legLeft = +el.dataset.n; }),
  recharge: (el) => act(() => { const c = get(S, el.dataset.id); if (c.spent[el.dataset.k]) delete c.spent[el.dataset.k]; else c.spent[el.dataset.k] = true; }),
  conc: (el) => act(() => { const c = get(S, el.dataset.id); c.conc = !c.conc; }),
  react: (el) => act(() => { const c = get(S, el.dataset.id); c.reacted = !c.reacted; }),
  unres: (el) => act(() => { get(S, el.dataset.id).resist.splice(+el.dataset.i, 1); }),
  uncond: (el) => act(() => { get(S, el.dataset.id).conds.splice(+el.dataset.i, 1); }),
  side: (el) => act(() => { const c = get(S, el.dataset.id); c.side = c.side === 'pc' ? 'foe' : 'pc'; say(S, 'info', `${c.name} now fights for ${c.side === 'pc' ? 'the party' : 'the opposition'}.`); }),
  down: (el) => act(() => { const c = get(S, el.dataset.id); c.dead = !c.dead; }),
  remove: (el) => act(() => { const c = get(S, el.dataset.id); if (S.cur === c.id) next(S, scenario()); S.list = S.list.filter((x) => x.id !== c.id); if (S.sel === c.id) S.sel = S.cur; say(S, 'info', `${c.name} leaves the fight.`); }),
  pick: (el) => { S.pick = S.pick === +el.dataset.e ? null : +el.dataset.e; save(); render(); },
  unpick: () => { S.pick = null; save(); render(); },
  apply: (el) => act(() => { const e = S.log.find((x) => x.id === +el.dataset.e); const m = +el.dataset.m; const t = get(S, el.dataset.id); if (m === 0) say(S, 'hp', `${t.name} saves against ${e.label} and takes nothing.`); else if (t.count !== undefined && e.kind === 'save' && m < 1) say(S, 'hp', `${t.name} saves against ${e.label}: a minion takes nothing on a success.`); else damage(S, scenario(), t, e.parts, m, e.label); }),
  applyroll: (el, ev) => act(() => {
    const e = S.log.find((x) => x.id === +el.dataset.e); const t = get(S, el.dataset.id);
    const tot = rollSave(t, e.save, ev, e.dc, `${cap(e.save)} save against ${e.label}`);
    if (tot >= e.dc) { if (e.half && t.count === undefined) damage(S, scenario(), t, e.parts, 0.5, e.label); else say(S, 'hp', `${t.name} takes nothing.`); } else damage(S, scenario(), t, e.parts, 1, e.label);
    S.pick = e.id;
  }),
  die: (el, ev) => act(() => { const n = +el.dataset.n; if (n === 20) { const r = rollD20(modeOf(ev)); say(S, 'roll', '', { kind: 'plain', who: 'DM', label: 'd20', detail: d20Text(r), total: r.nat }); } else { const r = rollExpr(`1d${n}`); say(S, 'roll', '', { kind: 'plain', who: 'DM', label: `d${n}`, detail: r.text, total: r.total }); } }),
  expr: () => { const v = (document.getElementById('expr').value || '').trim(); if (!/\d/.test(v)) return; act(() => { const r = rollExpr(v); const e = say(S, 'roll', '', { kind: 'dmg', who: 'DM', label: v, parts: [{ amt: r.total, type: '', text: r.text }], total: r.total }); S.pick = null; void e; }); },
  bench: (el) => act(() => { const b = scenario().bench[+el.dataset.n]; const made = addCombatants(S, scenario(), b.ref, b.n || 1, el.dataset.s); if (made[0]) S.sel = made[0].id; S.benchOpen = true; }),
  lib: (el) => { const name = document.getElementById('libName').value.trim(); const n = Math.max(1, +document.getElementById('libN').value || 1); const tpl = Object.values(ALL).find((t) => t.name === name) || Object.values(ALL).find((t) => t.name.toLowerCase().startsWith(name.toLowerCase())); if (!name || !tpl) return; act(() => { addCombatants(S, scenario(), tpl.id, n, el.dataset.s); S.benchOpen = true; }); },
  custom: (el) => { const v = (id) => document.getElementById(id).value.trim(); if (!v('cuName')) return; const k = customCard({ name: v('cuName'), ac: v('cuAc'), hp: v('cuHp'), init: v('cuInit'), hit: v('cuHit'), dmg: v('cuDmg'), side: el.dataset.s }); act(() => { addCombatants(S, scenario(), k.id, 1, el.dataset.s, k); S.benchOpen = true; }); },
  wave: (el) => act(() => { const it = scenario().roundEnd[+el.dataset.n]; for (const [ref, n, side] of it.add) addCombatants(S, scenario(), ref, n, side); if (it.key) S.done[it.key] = true; }),
  wavedone: (el) => act(() => { const it = scenario().roundEnd[+el.dataset.n]; S.done[it.key] = true; }),
  prompt: (el, ev) => act(() => {
    const c = get(S, el.dataset.id); const p = c.prompts[+el.dataset.n];
    if (p.roll) {
      const r = rollExpr(p.roll); const on = r.total <= p.max;
      say(S, on ? 'alert' : 'info', `${c.name}, ${p.label || 'roll'}: ${r.total}. ${on ? `${p.cond.name}: ${p.cond.note}.` : 'Nothing.'}`);
      if (on && p.cond) addCond(c, p.cond);
    } else if (p.save) {
      const tot = rollSave(c, p.save, ev, p.dc, `${cap(p.save)} save`);
      say(S, 'alert', `${c.name}: ${tot >= p.dc ? p.pass : p.fail}`);
    }
    c.prompts.splice(+el.dataset.n, 1);
  }),
  noprompt: (el) => act(() => { get(S, el.dataset.id).prompts.splice(+el.dataset.n, 1); }),
  lairroll: (el, ev) => act(() => { const sv = scenario().lair.save; for (const t of S.list) { if (t.lair || t.dead || t.pc || t.side !== sv.side || (sv.skipTypes || []).includes(card(t).type)) continue; const tot = rollSave(t, sv.ability, ev, sv.dc, scenario().lair.name); if (tot < sv.dc) addCond(t, sv.cond); } }),
  laircond: (el) => act(() => { const sv = scenario().lair.save; const t = get(S, el.dataset.id); if ((t.conds || []).some((x) => x.name === sv.cond.name)) t.conds = t.conds.filter((x) => x.name !== sv.cond.name); else { addCond(t, sv.cond); say(S, 'info', `${t.name} fails against ${scenario().lair.name}: ${sv.cond.note}.`); } }),
};

const changes = {
  init: (el) => act(() => { const c = get(S, el.dataset.id); const v = el.value.trim(); c.init = v === '' || Number.isNaN(+v) ? null : +v; }),
  hp: (el) => act(() => { const c = get(S, el.dataset.id); c.hp = Math.max(0, +el.value || 0); if (c.hp > 0) c.dead = false; }),
  max: (el) => act(() => { const c = get(S, el.dataset.id); c.maxHp = Math.max(1, +el.value || 1); c.hp = Math.min(c.hp, c.maxHp); }),
  temp: (el) => act(() => { get(S, el.dataset.id).temp = Math.max(0, +el.value || 0); }),
  notes: (el) => { get(S, el.dataset.id).notes = el.value; save(); },
  addcond: (el) => { let name = el.value; if (!name) return; if (name === '__custom') { name = (window.prompt('Condition') || '').trim(); if (!name) { el.value = ''; return; } } act(() => addCond(get(S, el.dataset.id), { name })); },
  addres: (el) => { const v = el.value; if (!v) return; act(() => { const c = get(S, el.dataset.id); c.resist = [...new Set([...(c.resist || []), v])]; say(S, 'info', `${c.name} now resists ${v}.`); }); },
  scenario: (el) => { const keep = JSON.stringify(S); startFight(el.value || null); undo = [keep]; render(); },
  flag: (el) => act(() => {
    const k = el.dataset.k; S.flags[k] = el.checked;
    const t = (scenario().toggles || []).find((x) => x.key === k);
    if (t && !el.checked && t.off) { say(S, 'alert', t.off.text); for (const c of S.list.filter((x) => x.ref === t.off.to && !x.dead)) damage(S, scenario(), c, t.off.dmg.map(([amt, type]) => ({ amt: +amt, type }))); }
  }),
};

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  // a click on a box or button inside a row is for that control, not for selecting the row
  if (el.dataset.a === 'sel' && ev.target.closest('input, button, select')) return;
  const fn = clicks[el.dataset.a];
  if (fn) fn(el, ev);
});
app.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-i]');
  if (!el || !changes[el.dataset.i] || el.dataset.i === 'amt') return;
  // wait for the focus to land on the next box before the page is redrawn
  setTimeout(() => changes[el.dataset.i](el), 0);
});
app.addEventListener('toggle', (ev) => { if (ev.target.dataset && ev.target.dataset.d === 'bench' && S) { S.benchOpen = ev.target.open; save(); } }, true);
app.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  const el = ev.target;
  if (el.dataset.i === 'amt') { ev.preventDefault(); applyAmt(el.dataset.id, ev.shiftKey ? 1 : -1); } else if (el.id === 'expr') { ev.preventDefault(); clicks.expr(); } else if (el.dataset.i && el.tagName === 'INPUT') el.blur();
});
document.addEventListener('keydown', (ev) => {
  if (!S || /INPUT|TEXTAREA|SELECT/.test((ev.target.tagName || ''))) return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); clicks.undo(); } else if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && (ev.key === 'n' || ev.key === 'N' || ev.key === 'ArrowRight')) { ev.preventDefault(); clicks.next(); }
});

// ------------------------------------------------------------------ the DM gate
function gate(found, error) {
  const stored = localStorage.getItem('encounters-dm-pass') || '';
  app.innerHTML = `<div class="gate panel"><h2>Battle tracker</h2><div class="sheet-body">
    <p>This page is for the DM. It opens with the same passphrase as the DM content in the Encounter Builder.</p>
    ${found ? `<div class="bar"><input id="gatePass" type="password" placeholder="Passphrase" autocomplete="off" value="${esc(stored)}"><button class="btn primary" id="gateGo">Unlock</button></div>` : '<p class="err">No DM pack was found beside this page.</p>'}
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
    <p><a href="./">Back to the Encounter Builder</a></p></div></div>`;
  const go = document.getElementById('gateGo');
  if (!go) return;
  const run = () => open(found, document.getElementById('gatePass').value, true);
  go.addEventListener('click', run);
  document.getElementById('gatePass').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}

async function open(found, pass, typed) {
  try {
    const texts = await unlock(found, pass);
    await installTexts(texts);
    if (found.kind !== 'local') localStorage.setItem('encounters-dm-pass', pass);
  } catch (err) {
    gate(found, typed ? (found.kind === 'local' ? `The DM files did not load: ${err.message}` : 'That passphrase does not open the DM pack.') : '');
    return;
  }
  S = load();
  if (!S) startFight(TRACKERS[0] ? TRACKERS[0].id : null);
  render();
}

const savedTheme = localStorage.getItem('lazaret-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
void PARTY;
findPack().then((found) => {
  if (!found) { gate(null); return; }
  if (found.kind === 'local') { open(found, '', true); return; }
  const stored = localStorage.getItem('encounters-dm-pass');
  if (stored) open(found, stored, false); else gate(found);
});
