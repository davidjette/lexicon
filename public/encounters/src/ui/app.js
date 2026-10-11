// The page: roster editing, the stepper, the log and the batch panel.

import { Encounter } from '../engine/combat.js';
import { AI } from '../engine/ai.js';
import { DEFAULT_RULES } from '../engine/rules.js';
import { switchDefaults } from '../data/encounters.js';
import { PRESETS, ALL, LIBRARY, packs } from '../data/registry.js';
import { findPack, unlock, installTexts } from '../dm-loader.js';
import { PARTY } from '../data/pcs.js';
import { rowsFromPreset, newRow, customRow, templateFor, baseTemplate, setupFromState } from '../data/build.js';

const $ = (id) => document.getElementById(id);

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = !!v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const state = {
  presetId: 'blank',
  sw: {},
  rows: [],
  rules: { ...DEFAULT_RULES },
  flags: {},
  prebuffs: { herosFeast: false },
  seed: 1 + Math.floor(Math.random() * 99999),
  logFilter: '',
  logCompact: false,
};
let enc = null;
let autoTimer = null;
let logCount = 0;
let worker = null;
let dmFound = null; // what findPack() returned
let dmTexts = null; // the unlocked pack, kept to hand to the batch worker

const preset = () => PRESETS.find((p) => p.id === state.presetId);

// ------------------------------------------------------------------ setup panel
function loadPreset(id) {
  state.presetId = id;
  const p = preset();
  state.sw = switchDefaults(p);
  state.rows = rowsFromPreset(id, state.sw);
  state.rules = { ...DEFAULT_RULES, ...(p.rules || {}) };
  const flags = p.scenario(state.sw).flags || {};
  state.flags = { focusBoss: !!flags.focusBoss };
  resetFight();
}

function switchChanged() {
  const keep = state.rows.filter((r) => r.kind === 'pc');
  const fresh = rowsFromPreset(state.presetId, state.sw).filter((r) => r.kind !== 'pc');
  state.rows = [...keep, ...fresh];
  resetFight();
}

const RULES_UI = [
  { key: 'critRule', label: 'Critical hits', options: [['maxPlusRoll', 'Maximum dice plus the dice again (this table)'], ['double', 'Roll the dice twice (the book)']] },
  { key: 'monsterDamage', label: 'Monster damage', options: [['roll', 'Rolled'], ['average', 'Fixed averages']] },
  { key: 'legendaryUse', label: 'Legendary actions taken', options: [[1, 'Every one available'], [0.75, 'About three in four'], [0.5, 'About half (some forgotten)'], [0, 'None']], number: true },
  { key: 'legendaryHeavy', label: 'A legendary action can be a full spell or a breath', check: true },
  { key: 'auraOnCasterTurn', label: "Spirit Guardians also bites on Eric's own turn", check: true },
  { key: 'bossDeathSaves', label: 'Named living bosses make death saves at 0', check: true },
  { key: 'attackDowned', label: 'Monsters keep attacking a character at 0', check: true },
  { key: 'parryHalves', label: "Gemma's Parry halves the hit (as run); off = d8+4", check: true },
  { key: 'healFromZeroProne', label: 'Healed from 0 means up but prone', check: true },
  { key: 'maxRounds', label: 'Stop after this many rounds', number: true, input: true },
];

function renderSetup() {
  const sel = $('presetSel');
  if (sel.dataset.count !== String(PRESETS.length)) {
    sel.dataset.count = String(PRESETS.length);
    sel.replaceChildren();
    const groups = [['Encounters', PRESETS.filter((p) => !p.dm)], ['DM ONLY', PRESETS.filter((p) => p.dm)]];
    for (const [label, list] of groups) {
      if (!list.length) continue;
      const og = h('optgroup', { label });
      for (const p of list) og.append(h('option', { value: p.id }, p.dm ? `DM ONLY · ${p.name}` : p.name));
      sel.append(og);
    }
    if (!sel.dataset.wired) {
      sel.dataset.wired = '1';
      sel.addEventListener('change', () => { loadPreset(sel.value); renderAll(); });
    }
  }
  sel.value = state.presetId;
  const p = preset();
  $('presetDm').hidden = !p.dm;
  $('presetWhere').textContent = p.where || '';
  $('presetBlurb').textContent = p.blurb || '';
  $('seedInput').value = state.seed;

  const sw = $('switches');
  sw.replaceChildren();
  for (const s of p.switches || []) {
    sw.append(h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: state.sw[s.key], onchange: (e) => { state.sw[s.key] = e.target.checked; switchChanged(); renderAll(); } }),
      s.label));
  }

  const rules = $('rules');
  rules.replaceChildren();
  const onRule = () => { resetFight(); renderAll(); };
  rules.append(h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: state.flags.focusBoss, onchange: (e) => { state.flags.focusBoss = e.target.checked; onRule(); } }),
    'The party goes for the boss before anyone else'));
  rules.append(h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: state.prebuffs.herosFeast, onchange: (e) => { state.prebuffs.herosFeast = e.target.checked; onRule(); } }),
    "Hero's Feast eaten beforehand (costs Eric's 6th-level slot)"));
  for (const r of RULES_UI) {
    if (r.check) {
      rules.append(h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: state.rules[r.key], onchange: (e) => { state.rules[r.key] = e.target.checked; onRule(); } }), r.label));
    } else if (r.input) {
      rules.append(h('label', { class: 'field' }, h('span', {}, r.label),
        h('input', { type: 'number', value: state.rules[r.key], min: 1, onchange: (e) => { state.rules[r.key] = +e.target.value || 30; onRule(); } })));
    } else {
      const s = h('select', { onchange: (e) => { state.rules[r.key] = r.number ? +e.target.value : e.target.value; onRule(); } },
        r.options.map(([v, t]) => h('option', { value: v, selected: String(state.rules[r.key]) === String(v) }, t)));
      rules.append(h('label', { class: 'field' }, h('span', {}, r.label), s));
    }
  }
}

// ------------------------------------------------------------------ rosters
function portrait(tpl, name) {
  const mono = () => h('div', { class: 'mono' }, (name || tpl.name).replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join(''));
  if (!tpl.img) return mono();
  const img = h('img', { src: `assets/${tpl.img}`, alt: '' });
  img.addEventListener('error', () => img.replaceWith(mono()));
  return img;
}

const subline = (tpl) => tpl.sub || [tpl.cr !== undefined ? `CR ${tpl.cr}` : null, tpl.type].filter(Boolean).join(' · ');

function renderAdder(side) {
  const box = $(side === 'pc' ? 'pcAdder' : 'monAdder');
  box.replaceChildren();
  if (enc) return;
  const sel = h('select', {});
  if (side === 'pc') {
    const missing = Object.keys(PARTY).filter((id) => !state.rows.some((r) => r.kind === 'pc' && r.ref === id));
    if (missing.length) sel.append(h('optgroup', { label: 'The Inevitables' }, missing.map((id) => h('option', { value: id }, PARTY[id]().name))));
  }
  const groups = [...LIBRARY].sort((a, b) => (side === 'pc' ? (b.ally ? 1 : 0) - (a.ally ? 1 : 0) : (a.ally ? 1 : 0) - (b.ally ? 1 : 0)));
  for (const g of groups) {
    sel.append(h('optgroup', { label: g.dm ? `DM ONLY · ${g.group}` : g.group },
      g.ids.filter((id) => ALL[id]).map((id) => h('option', { value: id }, `${ALL[id].name}${ALL[id].cr !== undefined ? ` (CR ${ALL[id].cr})` : ''}`))));
  }
  const n = h('input', { type: 'number', min: 1, max: 30, value: 1, title: 'How many' });
  const add = h('button', { class: 'btn small', onclick: () => {
    const id = sel.value;
    const count = PARTY[id] ? 1 : Math.max(1, Math.min(30, +n.value || 1));
    const have = state.rows.filter((r) => r.ref === id && r.side === side).length;
    for (let i = 0; i < count; i++) {
      const total = have + count;
      state.rows.push(newRow(side, id, PARTY[id] ? undefined : total > 1 ? `${ALL[id].name} ${have + i + 1}` : ALL[id].name));
    }
    renderAll();
  } }, 'Add');
  const custom = h('button', { class: 'btn small ghost', onclick: () => { $('customForm').elements.side.value = side; $('customDlg').showModal(); } }, 'Custom');
  box.append(sel, n, add, custom);
}

function editCard(r) {
  const base = baseTemplate(r);
  const tpl = templateFor(r);
  const over = (r.over = r.over || {});
  const num = (label, key, val) => h('label', { class: 'check' }, label,
    h('input', { type: 'number', value: over[key] !== undefined ? over[key] : val, onchange: (e) => { over[key] = +e.target.value; } }));
  const line = h('div', { class: 'line' },
    num('AC', 'ac', base.ac), num('HP', 'hp', base.hp),
    h('label', { class: 'check' }, 'Line',
      h('select', { onchange: (e) => { r.pos = e.target.value; } }, ['front', 'mid', 'back'].map((p) => h('option', { value: p, selected: r.pos === p }, p)))),
  );
  if (r.kind === 'pc') {
    const levels = r.level12 ? [12] : [13, 14, 15];
    line.append(h('label', { class: 'check' }, 'Level',
      h('select', { onchange: (e) => { r.level = +e.target.value; renderAll(); } }, levels.map((l) => h('option', { value: l, selected: (r.level || levels[0]) === l }, l)))));
    if (r.ref !== 'dario' && state.rows.some((x) => x.kind === 'pc' && x.ref === 'dario')) {
      line.append(h('label', { class: 'check', title: "Inside Dario's Aura of Protection, and in melee where he is" },
        h('input', { type: 'checkbox', checked: r.near === 'dario', onchange: (e) => { r.near = e.target.checked ? 'dario' : null; } }), 'Stays beside Dario'));
    }
    if (!r.spentData) {
      line.append(h('label', { class: 'check' }, 'Resources',
        h('select', { onchange: (e) => { r.spent = e.target.value; } },
          [['fresh', 'Fresh from a long rest'], ['half', 'After a hard fight']].map(([v, t]) => h('option', { value: v, selected: r.spent === v }, t)))));
    } else line.append(h('span', { class: 'tag' }, 'resources as at the table'));
  }
  const tools = h('div', { class: 'tools' });
  if (r.kind !== 'pc') tools.append(h('button', { class: 'btn small ghost', title: 'Add another of these', onclick: () => {
    const copy = JSON.parse(JSON.stringify(r));
    const fresh = r.kind === 'custom' ? customRow(r.side, copy.custom) : newRow(r.side, r.ref);
    Object.assign(copy, { uid: fresh.uid, name: `${r.name.replace(/ \d+$/, '')} ${state.rows.filter((x) => x.ref === r.ref && x.side === r.side).length + 1}` });
    state.rows.splice(state.rows.indexOf(r) + 1, 0, copy);
    renderAll();
  } }, '+1'));
  tools.append(h('button', { class: 'btn small ghost', title: 'Remove from the fight', onclick: () => { state.rows = state.rows.filter((x) => x !== r); renderAll(); } }, 'Remove'));
  line.append(tools);

  // numbers and tactics
  const det = h('details', {}, h('summary', {}, r.kind === 'pc' ? 'Tactics and numbers' : 'Numbers'));
  if (r.kind === 'pc' && base.dialInfo) {
    r.dials = r.dials || {};
    const dl = h('div', { class: 'line' });
    for (const [key, info] of Object.entries(base.dialInfo)) {
      const cur = r.dials[key] !== undefined ? r.dials[key] : base.dials[key];
      if (Array.isArray(info)) {
        dl.append(h('label', { class: 'check' }, key.replace(/([A-Z])/g, ' $1').toLowerCase(),
          h('select', { onchange: (e) => { r.dials[key] = typeof info[0] === 'number' ? +e.target.value : e.target.value; renderAll(); } },
            info.map((v) => h('option', { value: v, selected: String(cur) === String(v) }, v)))));
      } else {
        dl.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!cur, onchange: (e) => { r.dials[key] = e.target.checked; } }), info));
      }
    }
    det.append(dl);
  }
  const rowsEl = [];
  for (const [id, act] of Object.entries(tpl.actions || {})) {
    if (act.kind !== 'attack' && !(act.kind === 'save' && typeof act.dc === 'number')) continue;
    over.acts = over.acts || {};
    const set = (k, v, i) => {
      const a = (over.acts[id] = over.acts[id] || {});
      if (k === 'dmg') { a.dmg = a.dmg || []; a.dmg[i] = v; } else a[k] = v;
    };
    const cells = [h('td', {}, act.name)];
    if (act.kind === 'attack') cells.push(h('td', {}, h('input', { type: 'number', value: act.toHit, title: 'to hit', onchange: (e) => set('toHit', +e.target.value) })));
    else cells.push(h('td', {}, h('input', { type: 'number', value: act.dc, title: 'save DC', onchange: (e) => set('dc', +e.target.value) })));
    const dmg = Array.isArray(act.dmg) ? act.dmg : [];
    cells.push(h('td', {}, dmg.map(([dice, type], i) => h('input', { type: 'text', value: dice, title: type, onchange: (e) => set('dmg', e.target.value, i) }))));
    rowsEl.push(h('tr', {}, cells));
  }
  if (rowsEl.length) det.append(h('table', {}, h('tr', {}, h('td', { class: 'label' }, 'Action'), h('td', { class: 'label' }, 'To hit / DC'), h('td', { class: 'label' }, 'Damage dice')), rowsEl));

  return h('div', { class: `unit ${base.dm ? 'dm' : ''}` },
    portrait(base, r.name),
    h('div', {},
      h('div', { class: 'name' }, r.name, base.dm ? h('span', { class: 'dm-tag', style: 'margin-left:.4rem' }, 'DM ONLY') : null),
      h('div', { class: 'sub' }, subline(base)),
      line),
    det);
}

const PC_RES = {
  gemma: (c) => `Pact slots ${c.pact.n}/${c.tpl.pact.n} · Misty Step ${5 - (c.used.misty || 0)}/5 · superiority ${4 - (c.used.sup || 0)}/4 · luck ${5 - (c.used.luck || 0)}/5 · Action Surge ${c.used.surge ? 0 : 1}`,
  eric: (c) => `Slots ${slotText(c)} · Warding Flare ${5 - (c.used.flare || 0)}/5 · Channel Divinity ${3 - (c.used.radiance || 0)}/3`,
  dario: (c) => `Slots ${slotText(c)} · Lay on Hands ${c.memo.loh ?? 5 * (c.tpl.level || 13)} · Channel Divinity ${3 - (c.used.sacred || 0)}/3`,
};
const slotText = (c) => (c.slots ? Object.entries(c.slots).map(([l, n]) => `${l}:${n}`).join(' ') : '');

function liveCard(c) {
  const pct = Math.max(0, Math.min(100, (100 * c.hp) / Math.max(1, c.maxHp)));
  const bar = h('div', { class: `hpbar ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}` }, h('div', { style: `width:${pct}%` }));
  if (c.tempHp) bar.append(h('div', { class: 'temp', style: `width:${Math.min(100, (100 * c.tempHp) / c.maxHp)}%` }));
  const tags = h('div', { class: 'tags' });
  if (c.dead) tags.append(h('span', { class: 'tag bad' }, c.tpl.type === 'undead' || c.tpl.type === 'construct' ? 'destroyed' : 'dead'));
  else if (c.fled) tags.append(h('span', { class: 'tag' }, 'gone'));
  else if (c.down) tags.append(h('span', { class: 'tag bad' }, c.stable ? 'stable at 0' : `dying: ${c.ds.s} saved, ${c.ds.f} failed`));
  if (c.conc) tags.append(h('span', { class: 'tag conc' }, `concentrating: ${c.conc.name}`));
  const seen = new Set();
  for (const f of c.fx) {
    const label = f.cond && f.name && f.name !== f.cond ? `${f.cond} (${f.name})` : f.cond || f.name;
    if (!label || f.id === 'dying' || seen.has(label) || (f.aura && f.conc === c.id)) continue;
    seen.add(label);
    tags.append(h('span', { class: `tag ${f.cond ? 'bad' : 'good'}` }, label));
  }
  const res = [];
  const key = c.tpl.id;
  if (PC_RES[key]) res.push(PC_RES[key](c));
  else if (c.slots) res.push(`Slots ${slotText(c)}`);
  if (c.leg) res.push(`Legendary actions ${c.legLeft}/${c.leg}`);
  if (c.tpl.lr) res.push(`Legendary Resistance ${c.lr}/${c.tpl.lr}`);
  const now = enc && enc.current === c && !enc.over;
  return h('div', { class: `unit ${now ? 'now' : ''} ${c.dead || c.fled ? 'dead' : ''} ${c.down ? 'down' : ''}` },
    portrait(c.tpl, c.name),
    h('div', {},
      h('div', { class: 'name' }, c.name),
      h('div', { class: 'nums' }, `HP ${Math.max(0, c.hp)}/${c.maxHp}${c.tempHp ? ` +${c.tempHp} temp` : ''} · AC ${enc.acOf(c)}`),
      bar, tags,
      res.length ? h('div', { class: 'res' }, res.join(' · ')) : null));
}

function renderSides() {
  for (const side of ['pc', 'monster']) {
    const box = $(side === 'pc' ? 'pcCards' : 'monCards');
    renderAdder(side);
    if (enc) {
      const list = enc.side(side);
      const live = list.filter((c) => !c.dead && !c.fled);
      const gone = list.filter((c) => c.dead || c.fled);
      box.replaceChildren(...live.map(liveCard), ...gone.map(liveCard));
    } else {
      box.replaceChildren(...state.rows.filter((r) => r.side === side).map(editCard));
      if (!box.children.length) box.append(h('p', { class: 'blurb' }, 'Nobody here yet. Add from the list above.'));
    }
  }
}

// ------------------------------------------------------------------ centre: order, pending decision, result
function describe(c, choice) {
  if (!choice || choice.pass) return 'does nothing more';
  const act = enc.action(c, choice.act);
  if (!act) return choice.act || 'acts';
  let name = act.name;
  if (act.kind === 'multi') name = `Multiattack: ${(act.options[choice.opt || 0] || act.options[0]).map((id) => (enc.action(c, id) || {}).name).join(' + ')}`;
  const names = (choice.targets || []).map((id) => enc.get(id)).filter(Boolean).map((t) => t.name);
  const bits = [name];
  if (choice.level) bits.push(`at level ${choice.level}`);
  if (choice.mode) bits.push(`(${choice.mode}${choice.rider ? `, ${choice.rider}` : ''})`);
  if (names.length) bits.push(`→ ${names.join(', ')}`);
  return bits.join(' ');
}

function renderCenter() {
  $('roundTitle').textContent = !enc ? 'Not started' : enc.over ? `Finished in round ${enc.round}` : `Round ${enc.round}`;
  const order = $('order');
  order.replaceChildren();
  if (enc) {
    for (const e of enc.entries) {
      const c = enc.get(e.id);
      const now = enc.current === c && !!enc.turnSecond === !!e.second;
      order.append(h('span', { class: `chip ${c.side} ${enc.current === c && !enc.over ? 'now' : ''} ${c.dead || c.fled ? 'gone' : ''}`, title: `Initiative ${e.init}` }, `${c.name}${e.second ? ' (2nd)' : ''} ${e.init}`));
      void now;
    }
  }

  const box = $('pending');
  box.replaceChildren();
  const d = enc && !enc.over ? enc.peek() : null;
  if (d) {
    if (!d.script) d.script = d.choice;
    const c = d.actor;
    const kind = d.kind === 'legendary' ? 'legendary action' : d.kind === 'lair' ? 'lair action' : 'on their turn';
    box.append(h('div', {}, h('span', { class: 'who' }, c.name), ` · next, ${kind}`));
    box.append(h('div', { class: 'script' }, `The script picks: ${describe(c, d.script)}`));
    const opts = [{ script: true, name: `As scripted: ${describe(c, d.script)}`, targets: [] }, ...AI.options(enc, c, d.kind)];
    const tSel = h('select', {});
    const aSel = h('select', {}, opts.map((o, i) => h('option', { value: i }, o.script ? o.name : `${o.name}${o.cost === 'bonus' ? ' (bonus action)' : o.cost === 'leg' ? ` (costs ${o.legCost})` : ''}`)));
    let idx = d.pickedIdx || 0;
    aSel.value = idx;
    const fillTargets = () => {
      const o = opts[+aSel.value];
      tSel.replaceChildren(...(o.targets || []).map((t) => h('option', { value: t.id }, t.name)));
      tSel.disabled = !(o.targets || []).length;
      if (d.pickedTarget && [...tSel.options].some((x) => x.value === d.pickedTarget)) tSel.value = d.pickedTarget;
    };
    const apply = () => {
      idx = +aSel.value;
      d.pickedIdx = idx;
      d.pickedTarget = tSel.value || null;
      const o = opts[idx];
      if (o.script) enc.setChoice(d.script);
      else if (o.pass) enc.setChoice({ pass: true });
      else enc.setChoice({ act: o.act, opt: o.opt, cost: o.cost, legCost: o.legCost, free: o.free, targets: tSel.value ? [tSel.value] : [] });
    };
    fillTargets();
    aSel.addEventListener('change', () => { d.pickedTarget = null; fillTargets(); apply(); });
    tSel.addEventListener('change', apply);
    box.append(h('div', { class: 'row' },
      h('label', { class: 'field' }, h('span', {}, 'Or choose'), aSel),
      h('label', { class: 'field' }, h('span', {}, 'Target'), tSel)));
  }

  const res = $('result');
  res.textContent = '';
  if (enc && enc.over) {
    const text = { victory: 'The party wins.', defeat: 'The party is down.', escaped: `${enc.flags.escaped} escapes; the party holds the field.`, timeout: 'No result.', withdrew: 'The party breaks off.' }[enc.result];
    res.textContent = `${text} Seed ${enc.seed}.`;
  }

  $('startBtn').textContent = enc ? 'Restart with this seed' : 'Roll initiative';
  for (const id of ['stepBtn', 'turnBtn', 'roundBtn', 'autoBtn', 'endBtn']) $(id).disabled = !!(enc && enc.over);
  $('autoBtn').classList.toggle('on', !!autoTimer);
  $('autoBtn').textContent = autoTimer ? 'Pause' : 'Auto';
}

// ------------------------------------------------------------------ log
const HIDE_COMPACT = new Set(['save', 'init', 'info', 'move', 'miss']);

function eventVisible(ev) {
  if (ev.kind === 'round') return true;
  if (state.logCompact && HIDE_COMPACT.has(ev.kind)) return false;
  if (!state.logFilter) return true;
  const actor = ev.actor ? enc.get(ev.actor) : null;
  return (actor && actor.name === state.logFilter) || ev.text.includes(state.logFilter);
}

function eventEl(ev) {
  const actor = ev.actor ? enc.get(ev.actor) : null;
  return h('div', { class: `ev ${ev.kind} ${actor && ev.kind !== 'round' && ev.kind !== 'turn' ? `side-${actor.side}` : ''}` }, ev.text.replace(/^ {2}/, ''));
}

function renderLog(full) {
  const box = $('log');
  if (!enc) { box.replaceChildren(); logCount = 0; return; }
  if (full) { box.replaceChildren(); logCount = 0; }
  const frag = document.createDocumentFragment();
  for (let i = logCount; i < enc.events.length; i++) if (eventVisible(enc.events[i])) frag.append(eventEl(enc.events[i]));
  logCount = enc.events.length;
  box.append(frag);
  box.scrollTop = box.scrollHeight;

  const sel = $('logFilter');
  const names = ['', ...enc.list.map((c) => c.name)];
  if (sel.options.length !== names.length) {
    sel.replaceChildren(...names.map((n) => h('option', { value: n, selected: n === state.logFilter }, n || 'Everyone')));
  }
}

function exportLog(md) {
  if (!enc) return;
  const p = preset();
  const lines = [];
  if (md) lines.push(`# ${p.name}`, '', `Seed ${enc.seed}. Result: ${enc.result || 'in progress'}.`, '');
  else lines.push(`${p.name} (seed ${enc.seed})`, '');
  for (const ev of enc.events) {
    if (ev.kind === 'round') lines.push('', md ? `## ${ev.text}` : `== ${ev.text} ==`);
    else if (ev.kind === 'turn') lines.push('', md ? `**${ev.text}**` : ev.text);
    else lines.push(md ? `- ${ev.text.trim()}` : `  ${ev.text}`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `${p.id}-seed-${enc.seed}.${md ? 'md' : 'txt'}` });
  document.body.append(a);
  a.click();
  a.remove();
}

// ------------------------------------------------------------------ running the fight
function stopAuto() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

function resetFight() {
  stopAuto();
  enc = null;
  logCount = 0;
}

function start() {
  stopAuto();
  if (!state.rows.some((r) => r.side === 'pc') || !state.rows.some((r) => r.side === 'monster')) {
    $('result').textContent = 'Both sides need at least one combatant.';
    return false;
  }
  enc = new Encounter(setupFromState(state, state.seed)).start();
  window.enc = enc;
  renderAll(true);
  return true;
}

function step() {
  if (!enc) return start();
  if (!enc.over) enc.step();
  renderAll();
  return true;
}

function stepWhile(test) {
  if (!enc && !start()) return;
  let guard = 0;
  const mark = test();
  do enc.step(); while (enc.peek() && !enc.over && test() === mark && guard++ < 5000);
  renderAll();
}

function toggleAuto() {
  if (autoTimer) { stopAuto(); renderCenter(); return; }
  if (!enc && !start()) return;
  const tick = () => {
    if (!enc || enc.over) { stopAuto(); renderCenter(); return; }
    enc.step();
    renderAll();
  };
  const delay = () => 1150 - 110 * +$('speed').value;
  autoTimer = setInterval(tick, delay());
  $('speed').onchange = () => { if (autoTimer) { clearInterval(autoTimer); autoTimer = setInterval(tick, delay()); } };
  renderCenter();
}

function renderAll(fullLog) {
  renderSetup();
  renderSides();
  renderCenter();
  renderLog(fullLog);
}

// ------------------------------------------------------------------ batch
function renderBatch(t) {
  const out = $('batchOut');
  out.replaceChildren();
  const seg = (cls, label, v) => (v > 0 ? h('div', { class: cls, style: `width:${v}%`, title: `${label} ${v}%` }, v >= 7 ? `${v}%` : '') : null);
  out.append(h('p', { class: 'headline' }, `The party is still standing at the end of ${Math.round((t.win + t.withdrew) * 10) / 10}% of ${t.n} fights.`));
  out.append(h('div', { class: 'outcome' },
    seg('o-victory', 'Wins outright', t.victory), seg('o-escaped', 'Boss driven off', t.escaped), seg('o-withdrew', 'Party withdraws', t.withdrew),
    seg('o-timeout', 'No result', t.timeout), seg('o-defeat', 'Party down', t.defeat)));
  out.append(h('div', { class: 'legend' },
    h('span', {}, h('i', { class: 'o-victory' }), `Wins outright ${t.victory}%`),
    h('span', {}, h('i', { class: 'o-escaped' }), `Boss driven off ${t.escaped}%`),
    t.withdrew ? h('span', {}, h('i', { class: 'o-withdrew' }), `Party withdraws ${t.withdrew}%`) : null,
    t.timeout ? h('span', {}, h('i', { class: 'o-timeout' }), `No result ${t.timeout}%`) : null,
    h('span', {}, h('i', { class: 'o-defeat' }), `Every character down ${t.defeat}%`)));
  out.append(h('p', { class: 'blurb' }, `At least one character dropped to 0 in ${t.anyDrop}% of fights and at least one died in ${t.anyDeath}%. Fights ran ${t.rounds.median} rounds at the median (${t.rounds.min} to ${t.rounds.max}).`));

  out.append(h('table', { class: 'stats' },
    h('tr', {}, ['', 'Dropped to 0', 'Died', 'Damage taken', 'Damage dealt', 'HP left', 'Slots left'].map((x) => h('th', {}, x))),
    t.pcs.map((p) => h('tr', {}, [p.name, `${p.dropped}%`, `${p.died}%`, p.meanTaken, p.meanDealt, p.meanHpLeft, p.meanSlotsLeft].map((x) => h('td', {}, x))))));
  if (t.bosses.length) {
    out.append(h('table', { class: 'stats' },
      h('tr', {}, ['', 'Killed', 'Left the fight', 'Mean HP left'].map((x) => h('th', {}, x))),
      t.bosses.map((b) => h('tr', {}, [b.name, `${b.killed}%`, `${b.fled}%`, b.meanHpLeft].map((x) => h('td', {}, x))))));
  }
  const seeds = h('div', { class: 'seeds' }, 'Open a typical run step by step:');
  const s = t.sampleSeeds;
  for (const [label, seed] of [['a win', s.victory], ['the boss driven off', s.escaped], ['a loss', s.defeat]]) {
    if (!seed) continue;
    seeds.append(h('button', { class: 'btn small', onclick: () => { state.seed = seed; start(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, `${label} (seed ${seed})`));
  }
  out.append(seeds);
}

function runBatch() {
  if (worker) worker.terminate();
  const n = Math.max(10, Math.min(20000, +$('batchN').value || 1000));
  const payload = JSON.parse(JSON.stringify({ presetId: state.presetId, sw: state.sw, rows: state.rows, rules: state.rules, flags: state.flags, prebuffs: state.prebuffs }));
  $('batchBar').style.width = '0%';
  $('batchOut').replaceChildren(h('p', { class: 'blurb' }, `Running ${n} fights.`));
  $('batchBtn').disabled = true;
  worker = new Worker(new URL('../worker/batch-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    if (e.data.progress !== undefined) $('batchBar').style.width = `${Math.round(e.data.progress * 100)}%`;
    if (e.data.error) { $('batchOut').replaceChildren(h('p', { class: 'blurb' }, `The batch stopped on an error: ${e.data.error}`)); $('batchBtn').disabled = false; }
    if (e.data.done) { window.lastBatch = e.data.done; renderBatch(e.data.done); $('batchBtn').disabled = false; }
  };
  worker.onerror = (e) => { $('batchOut').replaceChildren(h('p', { class: 'blurb' }, `The batch could not start: ${e.message}`)); $('batchBtn').disabled = false; };
  worker.postMessage({ state: payload, n, seed0: state.seed, dmTexts });
}

// ------------------------------------------------------------------ DM ONLY
function renderDm(error) {
  const bar = $('dmBar');
  const body = $('dmBody');
  if (!dmFound) { bar.hidden = true; return; }
  bar.hidden = false;
  body.replaceChildren();
  document.body.classList.toggle('dm-on', packs.dm);
  if (packs.dm) {
    body.append(
      h('p', {}, h('strong', {}, 'DM content is unlocked. '), 'Unreleased stat blocks and encounters are in the lists, each marked DM ONLY. Do not share this screen with players.'),
      h('button', { class: 'btn small', onclick: () => location.reload() }, 'Lock again'));
    return;
  }
  const local = dmFound.kind === 'local';
  const pass = h('input', { type: 'password', placeholder: 'Passphrase', autocomplete: 'off', value: localStorage.getItem('encounters-dm-pass') || '' });
  const sure = h('input', { type: 'checkbox' });
  const go = h('button', { class: 'btn small primary', disabled: true }, 'Unlock DM content');
  sure.addEventListener('change', () => { go.disabled = !sure.checked; });
  const run = async () => {
    if (!sure.checked) return;
    go.disabled = true;
    go.textContent = 'Unlocking';
    try {
      dmTexts = await unlock(dmFound, pass.value);
      await installTexts(dmTexts);
      if (!local) localStorage.setItem('encounters-dm-pass', pass.value);
      renderDm();
      renderAll();
    } catch (err) {
      dmTexts = null;
      renderDm(local ? `The DM files did not load: ${err.message}` : 'That passphrase does not open the DM pack.');
    }
  };
  go.addEventListener('click', run);
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  body.append(
    h('p', {}, 'Stat blocks and encounters the players have not met yet. Spoilers for the campaign.'),
    local ? h('span', { class: 'tag' }, 'working copy: no passphrase needed') : pass,
    h('label', { class: 'check' }, sure, 'I am running this campaign'),
    go);
  if (error) body.append(h('div', { class: 'err' }, error));
}

// ------------------------------------------------------------------ wiring
function init() {
  const saved = localStorage.getItem('lazaret-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  const themeLabel = () => { $('themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? 'Parchment' : 'Midnight'; };
  themeLabel();
  $('themeBtn').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('lazaret-theme', next);
    themeLabel();
  };

  $('seedInput').onchange = (e) => { state.seed = Math.max(1, +e.target.value || 1); };
  $('newSeedBtn').onclick = () => { state.seed = 1 + Math.floor(Math.random() * 999999); $('seedInput').value = state.seed; };
  $('startBtn').onclick = start;
  $('stepBtn').onclick = step;
  $('turnBtn').onclick = () => stepWhile(() => enc.current);
  $('roundBtn').onclick = () => stepWhile(() => enc.round);
  $('autoBtn').onclick = toggleAuto;
  $('endBtn').onclick = () => { if (!enc && !start()) return; stopAuto(); enc.runToEnd(); renderAll(); };
  $('resetBtn').onclick = () => { resetFight(); renderAll(true); };
  $('logFilter').onchange = (e) => { state.logFilter = e.target.value; renderLog(true); };
  $('logCompact').onchange = (e) => { state.logCompact = e.target.checked; renderLog(true); };
  $('exportTxt').onclick = () => exportLog(false);
  $('exportMd').onclick = () => exportLog(true);
  $('batchBtn').onclick = runBatch;

  $('customDlg').addEventListener('close', () => {
    if ($('customDlg').returnValue !== 'ok') return;
    const f = $('customForm').elements;
    state.rows.push(customRow(f.side.value, {
      name: f.name.value, ac: +f.ac.value, hp: +f.hp.value, init: +f.init.value, save: +f.save.value,
      attacks: [{ name: f.aname.value, n: +f.an.value, toHit: +f.ahit.value, dmg: f.admg.value, type: f.atype.value, ranged: f.aranged.checked }],
    }));
    renderAll();
  });

  loadPreset(state.presetId);
  renderAll(true);
  findPack().then((found) => { dmFound = found; renderDm(); });
  window.sim = { state, start, step, runBatch, get enc() { return enc; } };
}

init();
