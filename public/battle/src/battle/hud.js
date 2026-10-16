// The player's menu. On a party member's turn it lists what the engine says that character can
// do (AI.options), then asks for a slot level and a target where the action needs one. The
// answer is a choice object the engine's step mode already understands.
import { AI } from '../engine/ai.js?v=mvadc21h';
import { sfx } from './audio.js?v=mvadc21h';

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids.filter((x) => x !== null && x !== undefined));
  return n;
};

const GROUPS = [['action', 'Action'], ['bonus', 'Bonus action'], ['free', 'Free'], ['move', 'Move']];

export class Hud {
  constructor(root, stage) {
    this.root = root;
    this.stage = stage;
    this.done = null;
  }

  hide() {
    this.root.replaceChildren();
    this.root.hidden = true;
    this.stage.pick(null);
  }

  // Drops a question that is still open (the fight was restarted).
  cancel() {
    const done = this.done;
    this.done = null;
    this.hide();
    if (done) done(null);
  }

  ask(E, c) {
    return new Promise((resolve) => {
      this.done = resolve;
      this.showActions(E, c);
    });
  }

  answer(choice) {
    const done = this.done;
    this.done = null;
    this.hide();
    if (done) done(choice);
  }

  head(E, c, note) {
    const slots = c.slots ? Object.keys(c.slots).filter((l) => c.slots[l] > 0).map((l) => `${l}:${c.slots[l]}`).join('  ') : '';
    const pact = c.pact && c.pact.n > 0 ? `Pact ${c.pact.level}:${c.pact.n}` : '';
    return el('div', { class: 'hud-head' },
      el('strong', {}, c.name),
      el('span', {}, `HP ${c.hp}/${c.maxHp}${c.tempHp ? ` +${c.tempHp}` : ''}`),
      el('span', { class: c.turn.action ? 'pip on' : 'pip' }, 'Action'),
      el('span', { class: c.turn.bonus ? 'pip on' : 'pip' }, 'Bonus'),
      slots || pact ? el('span', { class: 'hud-slots' }, `Slots ${[slots, pact].filter(Boolean).join('  ')}`) : null,
      note ? el('em', {}, note) : null);
  }

  showActions(E, c) {
    const opts = AI.options(E, c, 'turn', { full: true });
    const cols = GROUPS.map(([cost, title]) => {
      const mine = opts.filter((o) => !o.pass && (o.cost || 'action') === cost);
      if (!mine.length) return null;
      return el('div', { class: 'hud-col' }, el('div', { class: 'hud-title' }, title),
        ...mine.map((o) => el('button', { class: 'btn small', onclick: () => this.chose(E, c, o) }, o.name)));
    });
    const end = el('div', { class: 'hud-col' }, el('div', { class: 'hud-title' }, 'Turn'),
      el('button', { class: 'btn small ghost', onclick: () => { sfx(this.stage, 'endturn'); this.answer({ pass: true }); } }, 'End turn'));
    this.root.replaceChildren(this.head(E, c), el('div', { class: 'hud-cols' }, ...cols, end));
    this.root.hidden = false;
    this.stage.pick(null);
  }

  chose(E, c, o) {
    sfx(this.stage, 'select');
    if (o.withdraw) return this.answer({ withdraw: true });
    if (o.shift) return this.answer({ shift: o.shift });
    const choice = { act: o.act, opt: o.opt, cost: o.cost, free: o.free, targets: [], ...(o.choice || {}) };
    if (o.levels) return this.showLevels(E, c, o, choice);
    this.showTypes(E, c, o, choice);
  }

  // A spell whose caster picks the damage type (Chromatic Orb) asks for it before the target.
  showTypes(E, c, o, choice) {
    const act = o.act && E.action(c, o.act);
    if (!act || !act.types) return this.showTargets(E, c, o, choice);
    const back = el('button', { class: 'btn small ghost', onclick: () => { sfx(this.stage, 'back'); this.showActions(E, c); } }, 'Back');
    this.root.replaceChildren(this.head(E, c, `${o.name}: which damage type?`),
      el('div', { class: 'hud-row' }, ...act.types.map((t) => el('button', { class: 'btn small', onclick: () => { sfx(this.stage, 'select'); this.showTargets(E, c, o, { ...choice, type: t }); } }, t[0].toUpperCase() + t.slice(1))), back));
  }

  showLevels(E, c, o, choice) {
    const back = el('button', { class: 'btn small ghost', onclick: () => { sfx(this.stage, 'back'); this.showActions(E, c); } }, 'Back');
    this.root.replaceChildren(this.head(E, c, `${o.name}: which slot?`),
      el('div', { class: 'hud-row' }, ...o.levels.map((l) => el('button', { class: 'btn small', onclick: () => { sfx(this.stage, 'select'); this.showTypes(E, c, o, { ...choice, level: l }); } }, `Level ${l} (${c.slots[l]} left)`)), back));
  }

  showTargets(E, c, o, choice) {
    const far = new Set(o.targets.filter((t) => t.far).map((t) => t.id));
    const live = o.targets.map((t) => E.get(t.id)).filter((t) => t && E.present(t) && (t.side === c.side || !t.dead));
    if (!o.targets.length) return this.answer(choice);
    if (!live.length) return this.showActions(E, c);
    const take = (id) => { sfx(this.stage, 'click'); this.answer({ ...choice, targets: [id] }); };
    const back = el('button', { class: 'btn small ghost', onclick: () => { sfx(this.stage, 'back'); this.showActions(E, c); } }, 'Back');
    const label = (t) => (t.side === c.side ? `${t.name} (${t.hp}/${t.maxHp})` : `${t.name}${t.down ? ' (down)' : ''}`);
    this.root.replaceChildren(this.head(E, c, `${o.name}: choose a target, here or on the field`),
      el('div', { class: 'hud-row' }, ...live.map((t) => (far.has(t.id)
        ? el('button', { class: 'btn small ghost', disabled: '', title: 'Out of reach: get to your front rank, and the enemy rank in front of this one must fall first' }, `${label(t)} (out of reach)`)
        : el('button', { class: 'btn small', onclick: () => take(t.id) }, label(t)))), back));
    this.stage.pick(live.filter((t) => !far.has(t.id)).map((t) => t.id), take);
  }
}
