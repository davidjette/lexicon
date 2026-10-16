// Resolution rules: attacks, saves, damage, healing, conditions, concentration, dropping and dying.
// No browser code in here; the same file runs in the page, in the batch worker and under node.

import { makeRng, rollDice, d20, mod, signed, avgDice, maxDice } from './dice.js?v=mva9wh65';
import { engage, breakAll, isEngaged, hasRoom, cluster, enemiesInAura, inAllyAura, areaTargets } from './zones.js?v=mva9wh65';

export const DEFAULT_RULES = {
  critRule: 'maxPlusRoll', // table rule: maximum dice plus the dice again. 'double' is the book.
  monsterDamage: 'roll', // 'roll' | 'average'
  bossDeathSaves: true, // named bosses drop and make death saves like PCs
  attackDowned: false, // monsters keep hitting a PC who is at 0
  healFromZeroProne: true,
  auraOnCasterTurn: true, // Spirit Guardians also bites on the caster's own turn (2024 emanation)
  parryHalves: true,
  legendaryUse: 1, // chance a legendary creature takes each legendary action it could (a DM who forgets some: 0.5)
  legendaryHeavy: true, // legendary actions may be full spells and recharge abilities, where a block allows it
  movement: false, // ranks matter: one step between front, mid and back a turn, and melee only reaches the foremost rank
  ranks: false, // an area hits every enemy in the target's rank (front, mid, back); a large area hits two ranks
  maxRounds: 30,
};

const RANKS = ['front', 'mid', 'back'];
const INCAP = ['paralysed', 'stunned', 'unconscious', 'incapacitated', 'banished', 'petrified'];
const IMMOBILE = ['grappled', 'restrained', 'paralysed', 'stunned', 'unconscious', 'speed0', 'banished'];

export class Engine {
  constructor({ rules = {}, seed = 1 } = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.rng = makeRng(seed);
    this.seed = seed;
    this.uid = 0;
    this.list = [];
    this.byId = new Map();
    this.entries = [];
    this.round = 0;
    this.turnCount = 0;
    this.current = null;
    this.events = [];
    this.over = false;
    this.result = null;
    this.corpses = 0;
    this.flags = {};
    this.quiet = false; // batch runs skip building log text
  }

  // ---------- roster ----------
  add(tpl, { side, name, near = null, pos, summonedBy = null } = {}) {
    const id = `c${++this.uid}`;
    const c = {
      id,
      tpl,
      name: name || tpl.name,
      side: side || tpl.side || 'monster',
      hp: tpl.startHp ?? tpl.hp,
      maxHp: tpl.hp,
      baseMaxHp: tpl.hp,
      tempHp: 0,
      ac: tpl.ac,
      fx: [],
      engaged: new Set(),
      near,
      pos: pos || tpl.pos || 'front',
      used: {},
      ready: {},
      slots: tpl.slots ? { ...tpl.slots } : null,
      pact: tpl.pact ? { ...tpl.pact } : null,
      lr: tpl.lr || 0,
      leg: tpl.leg || 0,
      legLeft: tpl.leg || 0,
      conc: null,
      turn: {},
      reaction: true,
      dead: false,
      fled: false,
      down: false,
      stable: false,
      ds: { s: 0, f: 0 },
      summonedBy,
      form: null,
      memo: {},
      stats: { dealt: 0, taken: 0, downs: 0, healed: 0, turns: 0 },
    };
    if (tpl.spent) {
      // resources already used before the fight (set from the roster panel)
      for (const [k, v] of Object.entries(tpl.spent.used || {})) c.used[k] = v;
      if (c.slots) for (const [k, v] of Object.entries(tpl.spent.slots || {})) c.slots[k] = Math.max(0, c.slots[k] - v);
      if (c.pact && tpl.spent.pact) c.pact.n = Math.max(0, c.pact.n - tpl.spent.pact);
      Object.assign(c.memo, tpl.spent.memo || {});
      if (tpl.spent.hpFrac) c.hp = Math.max(1, Math.floor(c.maxHp * tpl.spent.hpFrac));
    }
    this.list.push(c);
    this.byId.set(id, c);
    return c;
  }

  get(id) {
    return this.byId.get(id);
  }
  side(s) {
    return this.list.filter((c) => c.side === s);
  }
  alive(c) {
    return !!c && !c.dead && !c.fled;
  }
  present(c) {
    return this.alive(c) && !this.has(c, 'banished');
  }
  active(c) {
    return this.present(c) && !c.down;
  }
  enemiesOf(c) {
    return this.list.filter((o) => o.side !== c.side && this.present(o));
  }
  alliesOf(c, includeSelf = false) {
    return this.list.filter((o) => o.side === c.side && this.present(o) && (includeSelf || o !== c));
  }
  actions(c) {
    return (c.form && c.tpl.forms[c.form].actions) || c.tpl.actions || {};
  }
  action(c, id) {
    return this.actions(c)[id] || (c.tpl.actions || {})[id];
  }
  abil(c, a) {
    const src = (c.form && c.tpl.forms[c.form].abil) || c.tpl.abil || {};
    return mod(src[a] ?? 10);
  }
  hasTag(c, t) {
    return (c.tpl.tags || []).includes(t);
  }

  // ---------- log ----------
  // `data` is the same fact as `text` in fields, for a screen that draws the fight.
  log(kind, text, actor, data) {
    if (this.quiet) return;
    const e = { n: this.events.length, round: this.round, kind, actor: actor ? actor.id : null, text };
    if (data) e.data = data;
    // the first thing an action logs carries who acted and what it was called
    if (this.acted) {
      if (kind !== 'turn' && kind !== 'round') e.acted = this.acted;
      this.acted = null;
    }
    if (this.cues && this.cues.length) {
      e.cues = this.cues;
      this.cues = [];
    }
    this.events.push(e);
  }

  // Something done out of turn that the battle screen should name: a reaction, an opportunity
  // attack, a legendary or lair action. It rides on the next event logged and changes nothing.
  cue(c, name, o = {}) {
    if (this.quiet) return;
    (this.cues = this.cues || []).push({ who: c.id, name, ...o });
  }

  // ---------- effects and conditions ----------
  has(c, cond) {
    for (const f of c.fx) if (f.cond === cond) return true;
    return false;
  }
  fxOf(c, id) {
    return c.fx.find((f) => f.id === id);
  }
  condImmune(c, cond) {
    if ((c.tpl.condImmune || []).includes(cond)) return true;
    for (const f of c.fx) if (f.immuneCond && f.immuneCond.includes(cond)) return true;
    // Aura of Courage / Aura of Devotion from a conscious paladin standing with this creature
    if (cond === 'frightened' || cond === 'charmed' || cond === 'dominated') {
      for (const p of this.side(c.side)) {
        if (p.tpl.auraCourage && this.active(p) && !this.incapacitated(p) && inAllyAura(this, p, c)) return true;
      }
    }
    return false;
  }
  incapacitated(c) {
    return c.down || INCAP.some((k) => this.has(c, k));
  }
  immobile(c) {
    return c.down || IMMOBILE.some((k) => this.has(c, k));
  }

  addFx(c, fx, src) {
    if (!this.alive(c)) return false;
    if (fx.cond && this.condImmune(c, fx.cond)) {
      this.log('info', `${c.name} is immune to ${fx.cond}.`, c);
      return false;
    }
    const id = fx.id || fx.cond || fx.name;
    const srcId = src ? src.id : null;
    c.fx = c.fx.filter((f) => !(f.id === id && f.srcId === srcId));
    const e = { ...fx, id, srcId };
    if (e.ends) e.ends = { ...e.ends };
    c.fx.push(e);
    if (fx.cond) {
      this.log('cond', `${c.name} is ${fx.cond}${fx.name && fx.name !== fx.cond ? ` (${fx.name})` : ''}.`, c, { tgt: c.id, cond: fx.cond, on: true });
      if (['paralysed', 'stunned', 'unconscious', 'incapacitated', 'banished', 'petrified'].includes(fx.cond)) this.breakConc(c);
      if (fx.cond === 'banished') breakAll(this, c);
    }
    return true;
  }

  removeFx(c, pred, say = true) {
    const gone = c.fx.filter(pred);
    if (!gone.length) return;
    c.fx = c.fx.filter((f) => !pred(f));
    if (say) for (const g of gone) if (g.cond || g.announce) this.log('cond', `${c.name} is no longer ${g.cond || g.name}.`, c, { tgt: c.id, cond: g.cond || g.name, on: false });
  }

  // Tick durations anchored on `who`'s turn.
  tickFx(who, when) {
    for (const c of this.list) {
      if (!c.fx.length) continue;
      const out = [];
      for (const f of c.fx) {
        if (f.ends && f.ends.who === who.id && f.ends.when === when) {
          f.ends.turns -= 1;
          if (f.ends.turns <= 0) {
            if (f.cond || f.announce) this.log('cond', `${c.name} is no longer ${f.cond || f.name}.`, c, { tgt: c.id, cond: f.cond || f.name, on: false });
            continue;
          }
        }
        out.push(f);
      }
      c.fx = out;
    }
  }

  sum(c, key) {
    let n = 0;
    for (const f of c.fx) if (typeof f[key] === 'number') n += f[key];
    return n;
  }
  any(c, key) {
    for (const f of c.fx) if (f[key]) return f;
    return null;
  }

  concentrate(c, name) {
    this.breakConc(c);
    c.conc = { name };
  }
  breakConc(c) {
    if (!c.conc) return;
    const name = c.conc.name;
    c.conc = null;
    const ended = [];
    for (const o of this.list) {
      for (const f of o.fx) if (f.conc === c.id) ended.push([o, f]);
      o.fx = o.fx.filter((f) => f.conc !== c.id);
    }
    this.log('cond', `${c.name} loses concentration on ${name}.`, c);
    for (const [o, f] of ended) if (f.onEnd) f.onEnd(this, o);
  }

  // ---------- numbers ----------
  acOf(c) {
    const form = c.form && c.tpl.forms[c.form];
    return (form && form.ac ? form.ac : c.ac) + this.sum(c, 'ac');
  }

  resistMult(c, type) {
    const t = c.tpl;
    if ((t.immune || []).includes(type)) return 0;
    for (const f of c.fx) if (f.immune && f.immune.includes(type)) return 0;
    let m = 1;
    const resist = t.resist || [];
    let has = resist.includes(type) || (resist.includes('all-but-force-radiant') && type !== 'force' && type !== 'radiant');
    if (!has) for (const f of c.fx) if (f.resist && f.resist.includes(type)) has = true;
    if (has) m *= 0.5;
    if ((t.vuln || []).includes(type)) m *= 2;
    return m;
  }

  saveBonus(c, ability) {
    const s = c.tpl.saves || {};
    let b = s[ability] !== undefined ? s[ability] : this.abil(c, ability);
    // Aura of Protection from a conscious paladin standing with this creature
    let aura = 0;
    for (const p of this.side(c.side)) {
      if (!p.tpl.auraSave || !this.active(p) || this.incapacitated(p)) continue;
      if (p === c) continue; // a paladin's own bonus is already on the sheet
      if (inAllyAura(this, p, c)) aura = Math.max(aura, p.tpl.auraSave);
    }
    if (c.tpl.auraSave && c.tpl.auraSelfIncluded === false && this.active(c)) aura = Math.max(aura, c.tpl.auraSave);
    return b + aura + this.sum(c, 'saveBonus');
  }

  // ---------- d20 tests ----------
  save(c, ability, dc, o = {}) {
    let adv = 0;
    let dis = 0;
    const why = [];
    if ((ability === 'str' || ability === 'dex') && ['paralysed', 'stunned', 'unconscious', 'petrified'].some((k) => this.has(c, k))) {
      this.log('save', `${c.name} automatically fails the ${ability.toUpperCase()} save (DC ${dc}).`, c);
      return { success: false, auto: true };
    }
    if (o.autoFail) {
      this.log('save', `${c.name} automatically fails the ${ability.toUpperCase()} save (DC ${dc}).`, c);
      return { success: false, auto: true };
    }
    if (o.adv) adv++;
    if (o.dis) dis++;
    if (o.spell && c.tpl.magicAdv) { adv++; why.push('magic resistance'); }
    if (ability === 'dex' && this.has(c, 'restrained')) dis++;
    for (const f of c.fx) {
      if (f.advSave && (f.advSave === 'all' || f.advSave.includes(ability))) adv++;
      if (f.disSave && (f.disSave === 'all' || f.disSave.includes(ability))) dis++;
    }
    if (o.conc && c.tpl.concAdv) { adv++; why.push('War Caster'); }
    if ((c.tpl.saveAdvVs || []).some((t) => (o.tags || []).includes(t))) adv++;
    // A choir: three allied creatures tagged 'singer' give their side's undead advantage on saves.
    if (c.tpl.type === 'undead' && !this.hasTag(c, 'unsung')) {
      const singers = this.alliesOf(c, true).filter((x) => this.hasTag(x, 'singer') && this.active(x)).length;
      if (singers >= 3) { adv++; why.push('the choir'); }
    }
    const mode = adv && !dis ? 'adv' : dis && !adv ? 'dis' : 'normal';
    let r = o.fixed !== undefined ? { nat: o.fixed, text: `${o.fixedBy || 'fixed'}[${o.fixed}]` } : d20(this.rng, mode);
    let bonus = this.saveBonus(c, ability);
    let extra = '';
    for (const f of c.fx) {
      if (f.saveDice) {
        const x = rollDice(this.rng, f.saveDice);
        bonus += x.total;
        extra += ` +${f.name} ${x.total}`;
      }
    }
    let total = r.nat + bonus;
    let success = total >= dc;
    let text = `${c.name} ${ability.toUpperCase()} save: ${r.text}${signed(bonus)}${extra ? ` (${extra.trim()})` : ''} = ${total} vs DC ${dc}`;
    if (!success) {
      const again = this.hook(c, 'rerollSave', { ability, dc, total, o });
      if (again) {
        const r2 = d20(this.rng, 'normal');
        const t2 = r2.nat + bonus;
        text += `, fails; ${again}: ${r2.text}${signed(bonus)} = ${t2}`;
        if (t2 >= dc) success = true;
        total = Math.max(total, t2);
      }
    }
    // a die someone gave this creature, spent when it can turn the failure
    if (!success) {
      const add = this.boost(c, dc - total);
      if (add) { total += add.total; success = total >= dc; text += `, fails; ${add.text}`; }
    }
    // a friend steps in
    if (!success) {
      const sctx = { tgt: c, subject: c, ability, dc, total, add: 0, note: null, o };
      this.react('saveFailed', sctx);
      if (sctx.add) { total += sctx.add; success = total >= dc; text += `, fails; ${sctx.note || 'helped'} +${sctx.add} = ${total}`; }
    }
    let forced = null;
    if (!success) {
      forced = this.hook(c, 'forceSave', { ability, dc, total, o });
      if (forced) success = true;
    }
    if (forced) {
      text += `, fails; ${forced}`;
    } else if (!success && c.lr > 0 && o.lr !== false && this.worthResisting(c, o)) {
      c.lr -= 1;
      success = true;
      text += `, fails, and uses Legendary Resistance (${c.lr} left)`;
    } else {
      text += success ? ', succeeds' : ', fails';
    }
    if (why.length) text += ` [${why.join(', ')}]`;
    this.log('save', text + '.', c, { who: c.id, ability, dc, success, lr: !forced && /Legendary Resistance/.test(text) });
    return { success, total, nat: r.nat };
  }

  // Spend a held bonus die (fx.boostDie) when its best roll could close the gap.
  boost(c, gap) {
    const f = c.fx.find((x) => x.boostDie && maxDice(x.boostDie) >= gap && !(x.perTurn && x.lastTurn === this.turnCount));
    if (!f || gap <= 0) return null;
    const r = rollDice(this.rng, f.boostDie);
    if (f.perTurn) f.lastTurn = this.turnCount; else c.fx = c.fx.filter((x) => x !== f);
    return { total: r.total, text: `${f.name} ${r.text} = +${r.total}` };
  }

  worthResisting(c, o) {
    if (o.serious) return true;
    if (o.expected !== undefined) return o.expected >= Math.max(25, c.hp * 0.2);
    return true;
  }

  check(c, bonus, dc, label) {
    const r = d20(this.rng, 'normal');
    const total = r.nat + bonus;
    const ok = total >= dc;
    this.log('save', `${c.name} ${label}: ${r.text}${signed(bonus)} = ${total} vs DC ${dc}, ${ok ? 'succeeds' : 'fails'}.`, c);
    return ok;
  }

  // ---------- hooks and reactions ----------
  hook(c, name, ctx) {
    const h = c.tpl.hooks && c.tpl.hooks[name];
    return h ? h(this, c, ctx || {}) : undefined;
  }

  // Offer a trigger to everyone who has a matching reaction. A reaction is
  // { id, name, trigger, who: 'self' | 'ally' | 'enemy' | 'any', uses, free, when(E, me, ctx), run(E, me, ctx) }.
  react(trigger, ctx) {
    const subject = ctx.tgt || ctx.subject;
    for (const me of this.list) {
      const list = me.tpl.reactions;
      if (!list || !this.active(me) || this.incapacitated(me)) continue;
      for (const r of list) {
        if (r.trigger !== trigger) continue;
        if (!r.free && (!me.reaction || this.has(me, 'noReactions') || this.has(me, 'slowed'))) continue;
        const who = r.who || 'self';
        if (who === 'self' && me !== subject) continue;
        if (who === 'ally' && (me === subject || !subject || me.side !== subject.side)) continue;
        if (who === 'allyOrSelf' && (!subject || me.side !== subject.side)) continue;
        if (who === 'enemy' && (!subject || me.side === subject.side)) continue;
        if (r.uses && (me.used[r.id] || 0) >= r.uses) continue;
        if (r.warlock && this.has(me, 'pactVoid')) continue;
        if (r.spell && this.has(me, 'quiet')) continue;
        if (r.when && !r.when(this, me, ctx)) continue;
        if (!r.free) me.reaction = false;
        if (r.uses) me.used[r.id] = (me.used[r.id] || 0) + 1;
        // an aura that bites at the start of each turn is not called out every time
        if (trigger !== 'turnStart') {
          const other = ctx.caster || ctx.att || ctx.src || ctx.mover;
          this.cue(me, r.name, { kind: 'reaction', spell: !!r.spell, at: other && other !== me ? other.id : null });
        }
        r.run(this, me, ctx);
        if (ctx.stop) return;
      }
    }
  }

  // ---------- attacks ----------
  flies(c) {
    return !!c.tpl.flying || c.fx.some((f) => f.flying);
  }

  canReach(att, tgt) {
    if (isEngaged(att, tgt)) return true;
    if (this.immobile(att) || att.turn.stopped) return false;
    if (this.flies(tgt) && !this.flies(att) && !this.has(tgt, 'grounded')) return false;
    if (this.rules.movement && !this.roams(att)) {
      // on foot: the attacker has to get to its own front rank, and only the other side's
      // foremost standing rank can be reached
      if (RANKS.indexOf(att.pos) > (att.turn.move || 0)) return false;
      if (tgt.pos !== this.foremost(tgt.side)) return false;
    }
    return hasRoom(this, tgt);
  }

  // ---------- ranks and movement (table rule `movement`) ----------
  // A flyer that has not been grounded, or anyone who has teleported this turn, goes where it likes.
  roams(c) {
    return (this.flies(c) && !this.has(c, 'grounded')) || !!c.turn.teleported;
  }

  // The rank of a side that melee can get at: its front while anyone stands there, then mid, then back.
  foremost(side) {
    const up = this.side(side).filter((x) => this.present(x) && !x.down);
    // a creature in the air holds no line: those on the ground decide, unless nobody is
    const ground = up.filter((x) => !this.flies(x) || this.has(x, 'grounded'));
    const wall = ground.length ? ground : up;
    return RANKS.find((r) => wall.some((x) => x.pos === r)) || 'front';
  }

  // Whether c may change rank by `dir` (-1 toward the enemy, 1 away) right now, and what it costs:
  // 'free' for a flyer or after a teleport, 'move' from this turn's movement, 'dash' with the action.
  shiftCost(c, dir) {
    if (!this.rules.movement || this.immobile(c) || c.turn.stopped) return null;
    const to = RANKS[RANKS.indexOf(c.pos) + dir];
    if (!to) return null;
    if (this.roams(c)) return 'free';
    if ((c.turn.move || 0) > 0) return 'move';
    return c.turn.action ? 'dash' : null;
  }

  // Moves c one rank. Stepping away from enemies in melee leaves them, and they may strike.
  shift(c, dir) {
    const cost = this.shiftCost(c, dir);
    if (!cost) return false;
    if (cost === 'move') c.turn.move -= 1;
    if (cost === 'dash') c.turn.action = false;
    if (dir > 0 && c.engaged.size) this.withdraw(c, { label: 'breaks away' });
    if (!this.active(c)) return false;
    c.pos = RANKS[RANKS.indexOf(c.pos) + dir];
    this.log('move', `${c.name} ${dir < 0 ? 'moves up' : 'falls back'} to the ${c.pos} rank${cost === 'dash' ? ' (Dash)' : ''}.`, c, { who: c.id, rank: c.pos });
    return true;
  }

  closeWith(att, tgt) {
    if (isEngaged(att, tgt)) return true;
    if (!this.canReach(att, tgt)) return false;
    if (this.rules.movement && !this.roams(att)) while (att.pos !== 'front' && this.shift(att, -1));
    engage(att, tgt);
    this.log('move', `${att.name} closes with ${tgt.name}.`, att, { who: att.id, to: tgt.id });
    // with the ranks rule, walking into an emanation on your own turn means meeting it at once
    if (this.rules.ranks && this.current === att) {
      this.auraEnter(att);
      this.auraCarry(att, tgt);
    }
    this.react('entersReach', { subject: att, mover: att, tgt: att, into: tgt });
    return this.active(att) && isEngaged(att, tgt);
  }

  attack(att, tgt, act, o = {}) {
    if (!this.present(tgt) || !this.active(att)) return { hit: false, void: true };
    const melee = !!act.melee;
    // redirects (a guardian stepping in front)
    const rd = { att, tgt, subject: tgt, act, melee };
    this.react('targeted', rd);
    if (rd.newTarget && this.present(rd.newTarget)) tgt = rd.newTarget;
    if (melee && !this.closeWith(att, tgt)) {
      this.log('miss', `${att.name} cannot reach ${tgt.name} for ${act.name}.`, att, { att: att.id, tgt: tgt.id, act: act.name, melee, hit: false, reach: false });
      return { hit: false, void: true };
    }
    if (!this.active(att)) return { hit: false, void: true };

    let adv = 0;
    let dis = 0;
    const why = [];
    const A = (w) => { adv++; why.push(w); };
    const D = (w) => { dis++; why.push(w); };
    if (o.adv) A(typeof o.adv === 'string' ? o.adv : 'advantage');
    if (o.dis) D(typeof o.dis === 'string' ? o.dis : 'disadvantage');
    const sees = att.tpl.eyeless || att.tpl.truesight;
    if (this.any(att, 'advAtk')) A(this.any(att, 'advAtk').name || 'advantage');
    const sap = this.any(att, 'disAtk');
    if (sap) {
      D(sap.name || 'disadvantage');
      if (sap.oneAttack) att.fx = att.fx.filter((f) => f !== sap);
    }
    if (att.turn.advNext) { A(att.turn.advNext); att.turn.advNext = null; }
    if (att.turn.disFirst) { D(att.turn.disFirst); att.turn.disFirst = null; }
    if (this.has(att, 'invisible') && !tgt.tpl.eyeless && !tgt.tpl.truesight) A('unseen attacker');
    if (this.has(tgt, 'invisible') && !sees) D('unseen target');
    for (const k of ['restrained', 'paralysed', 'stunned', 'unconscious', 'blinded']) if (this.has(tgt, k)) { A(`target ${k}`); break; }
    if (tgt.down && !this.has(tgt, 'unconscious')) A('target down');
    if (this.has(tgt, 'prone')) melee ? A('target prone') : D('target prone');
    if (this.any(tgt, 'advAgainst')) A(this.any(tgt, 'advAgainst').name);
    const da = this.any(tgt, 'disAgainst');
    if (da && !(da.unlessEyeless && sees)) D(da.name);
    for (const k of ['prone', 'restrained', 'blinded', 'poisoned', 'frightened']) if (this.has(att, k)) { D(`${k}`); break; }
    if (this.has(att, 'grappled')) {
      const g = att.fx.find((f) => f.cond === 'grappled');
      if (g && g.srcId !== tgt.id) D('grappled by another');
    }
    if (!melee && !act.noRangePenalty && [...att.engaged].some((id) => this.active(this.get(id)))) D('ranged in melee');
    if (att.tpl.packTactics && this.alliesOf(att).some((x) => this.hasTag(x, att.tpl.packTactics) && isEngaged(x, tgt) && this.active(x))) A('Pack Tactics');
    const hk = this.hook(att, 'attackMods', { tgt, act, melee }) || {};
    if (hk.adv) A(hk.adv);
    if (hk.dis) D(hk.dis);
    const thk = this.hook(tgt, 'defendMods', { att, act, melee }) || {};
    if (thk.dis) D(thk.dis);
    if (thk.adv) A(thk.adv);
    const mark = this.fxOf(att, 'inquisitorsMark');
    if (mark && mark.srcId !== tgt.id) D("Inquisitor's Mark");

    let mode = adv && !dis ? 'adv' : dis && !adv ? 'dis' : 'normal';
    let roll = d20(this.rng, mode);
    if (att.fx.some((f) => f.endsOnAttack)) att.fx = att.fx.filter((f) => !f.endsOnAttack);
    let bonus = act.toHit + this.sum(att, 'atk') + (hk.bonus || 0);
    let extra = '';
    for (const f of att.fx) {
      if (f.atkDice) {
        const x = rollDice(this.rng, f.atkDice);
        bonus += x.total;
        extra += ` +${f.name} ${x.total}`;
      }
    }
    let critMin = Math.min(act.critMin || 20, att.tpl.critMin || 20, hk.critMin || 20);
    if (att.tpl.crossedBlades && melee) {
      const mates = this.alliesOf(att).filter((x) => x.tpl.crossedBlades && isEngaged(x, tgt) && this.active(x)).length;
      if (mates >= 1) critMin = Math.min(critMin, 19);
    }
    const ctx = { att, tgt, subject: tgt, act, melee, nat: roll.nat, total: roll.nat + bonus, acBonus: 0, mode };
    ctx.crit = roll.nat >= critMin;
    ctx.hit = ctx.crit || (roll.nat !== 1 && ctx.total >= this.acOf(tgt));
    // reactions that change the roll (Shield, Warding Flare, Sentinel at Death's Door, Parry as +AC)
    if (ctx.hit) {
      this.react('attacked', ctx);
      if (ctx.reroll) {
        let nat = roll.nat;
        if (mode === 'adv') {
          nat = roll.first;
          extra += ` (${ctx.reroll}: advantage cancelled, the first die stands)`;
        } else if (mode === 'normal') {
          const r2 = d20(this.rng, 'normal');
          nat = Math.min(roll.nat, r2.nat);
          extra += ` (${ctx.reroll}: disadvantage, second die ${r2.nat})`;
        } else {
          extra += ` (${ctx.reroll}: already at disadvantage)`;
        }
        if (nat !== roll.nat) {
          roll = { nat, first: nat, text: `${roll.text}→[${nat}]` };
          ctx.nat = nat;
          ctx.total = nat + bonus;
          ctx.crit = nat >= critMin && !ctx.noCrit;
        }
      }
      if (ctx.noCrit) ctx.crit = false;
      ctx.hit = ctx.crit || (ctx.nat !== 1 && ctx.total >= this.acOf(tgt) + ctx.acBonus);
    }
    if (!ctx.hit) {
      const gap = this.acOf(tgt) + ctx.acBonus - ctx.total;
      // the attacker's own features: { add, label } or { reroll: label }
      const fix = this.hook(att, 'fixMiss', { ...ctx, gap, critMin }) || {};
      if (fix.reroll) {
        const r2 = d20(this.rng, 'normal');
        extra += ` (${fix.reroll}: ${r2.nat})`;
        if (r2.nat > ctx.nat) { ctx.nat = r2.nat; ctx.total = r2.nat + bonus; ctx.crit = r2.nat >= critMin; roll = { nat: r2.nat, first: r2.nat, text: `${roll.text}→[${r2.nat}]` }; }
      } else if (fix.add) {
        ctx.total += fix.add;
        bonus += fix.add;
        extra += ` +${fix.label} ${fix.add}`;
      } else if (ctx.nat !== 1) {
        const add = this.boost(att, gap);
        if (add) { ctx.total += add.total; bonus += add.total; extra += ` +${add.text}`; }
      }
      ctx.hit = ctx.crit || (ctx.nat !== 1 && ctx.total >= this.acOf(tgt) + ctx.acBonus);
    }
    const auto = melee && (this.has(tgt, 'paralysed') || this.has(tgt, 'unconscious'));
    if (ctx.hit && auto && !ctx.noCrit) ctx.crit = true;
    const ac = this.acOf(tgt) + ctx.acBonus;
    const head = `${att.name}: ${act.name} at ${tgt.name}, ${roll.text}${signed(bonus)}${extra} = ${ctx.total} vs AC ${ac}`;
    if (!ctx.hit) {
      this.log('miss', `${head}, ${ctx.nat === 1 ? 'natural 1, ' : ''}miss.${why.length ? ` [${why.join(', ')}]` : ''}`, att, { att: att.id, tgt: tgt.id, act: act.name, melee, hit: false, nat: ctx.nat });
      this.hook(att, 'onMiss', ctx);
      this.react('missed', ctx);
      return { hit: false, ctx };
    }
    this.log(ctx.crit ? 'crit' : 'hit', `${head}, ${ctx.crit ? 'CRITICAL HIT' : 'hit'}.${why.length ? ` [${why.join(', ')}]` : ''}`, att, { att: att.id, tgt: tgt.id, act: act.name, melee, hit: true, crit: !!ctx.crit, nat: ctx.nat });

    // damage
    const parts = [];
    const add = (dice, type, label) => parts.push({ dice, type, label });
    for (const [dice, type] of act.dmg || []) add(dice, type);
    if (act.weapon !== false) {
      for (const f of att.fx) {
        if (!f.extraDmg) continue;
        if (f.extraMeleeOnly && !melee) continue;
        for (const [dice, type] of f.extraDmg) add(dice, type, f.name);
      }
    }
    const more = this.hook(att, 'onHit', ctx);
    if (more && more.dmg) for (const [dice, type, label] of more.dmg) add(dice, type, label);
    if (act.vs) {
      for (const v of act.vs) if (v.when(this, tgt)) add(v.dice, v.type, v.label);
    }
    this.lastRolled = [];
    const dealt = parts.length ? this.rollAndDamage(att, tgt, parts, { crit: ctx.crit, act, attack: true, melee }) : 0;
    ctx.dealt = dealt;
    ctx.necrotic = this.lastRolled.filter((p) => p.type === 'necrotic').reduce((s, p) => s + Math.floor(p.amt * this.resistMult(tgt, 'necrotic')), 0);
    if (this.alive(tgt) && this.alive(att)) {
      if (act.onHit) this.applyFx(att, tgt, act.onHit, ctx);
      if (more && more.fx) this.applyFx(att, tgt, more.fx, ctx);
    }
    this.hook(att, 'afterHit', ctx);
    if (this.active(tgt)) this.react('hitBy', ctx);
    return { hit: true, crit: ctx.crit, dealt, ctx };
  }

  rollAndDamage(src, tgt, parts, o = {}) {
    const avg = src && src.side === 'monster' && this.rules.monsterDamage === 'average';
    const rolled = [];
    const texts = [];
    for (const p of parts) {
      const r = rollDice(this.rng, p.dice, { crit: o.crit, critRule: this.rules.critRule, average: avg });
      rolled.push({ amt: r.total, type: p.type });
      texts.push(`${p.label ? p.label + ' ' : ''}${r.text} ${p.type}`);
    }
    this.lastRolled = rolled;
    const mult = src && src.tpl.outMult ? src.tpl.outMult(this, src) : 1;
    return this.damage(tgt, rolled, src, { ...o, mult, rollText: texts.join('; ') });
  }

  // parts: [{ amt, type }]
  damage(tgt, parts, src, o = {}) {
    if (!this.alive(tgt)) return 0;
    let total = 0;
    const notes = [];
    for (const p of parts) {
      const m = this.resistMult(tgt, p.type);
      if (m === 0) notes.push(`immune to ${p.type}`);
      else if (m < 1) notes.push(`resists ${p.type}`);
      else if (m > 1) notes.push(`vulnerable to ${p.type}`);
      total += Math.floor(p.amt * m);
    }
    if (o.half) total = Math.floor(total / 2);
    if (o.mult !== undefined && o.mult !== 1) total = Math.floor(total * o.mult);
    if (o.area && tgt.tpl.areaVuln) {
      total *= 2;
      notes.push('a unit: double damage from area effects');
    }
    const curse = o.attack && this.fxOf(tgt, 'curse');
    if (curse) {
      total *= 2;
      notes.push('cursed: vulnerable to this attack');
      this.removeFx(tgt, (f) => f.id === 'curse', false);
    }
    const pre = { tgt, subject: tgt, src, total, parts, o, mult: 1, note: null };
    if (o.attack && total > 0) this.react('preDamage', pre);
    else if (total > 0 && src) this.react('preHarm', pre);
    if (pre.mult !== 1) {
      total = Math.floor(total * pre.mult);
      if (pre.note) notes.push(pre.note);
    }
    const types = [...new Set(parts.map((p) => p.type))];
    let absorbed = 0;
    if (tgt.tempHp > 0 && total > 0) {
      absorbed = Math.min(tgt.tempHp, total);
      tgt.tempHp -= absorbed;
    }
    const through = total - absorbed;
    const before = tgt.hp;
    tgt.hp -= through;
    tgt.stats.taken += through;
    if (src) src.stats.dealt += through;
    if (types.includes('radiant')) tgt.turn.radiantHit = true;
    const tail = `${absorbed ? ` (${absorbed} off temp HP)` : ''}${notes.length ? ` [${notes.join(', ')}]` : ''}`;
    this.log('dmg', `  ${o.rollText ? o.rollText + ' → ' : ''}${tgt.name} takes ${total} ${types.join('/')}${tail}. HP ${Math.max(0, tgt.hp)}/${tgt.maxHp}.`, src || tgt, { src: src ? src.id : null, tgt: tgt.id, amount: total, types, hp: Math.max(0, tgt.hp), maxHp: tgt.maxHp, tempHp: tgt.tempHp });
    if (total > 0) this.removeFx(tgt, (f) => f.endsOnDamage);
    this.hook(tgt, 'onDamaged', { src, total, types, o });
    if (tgt.down && before <= 0) {
      // damage while at 0
      if (through > 0) this.deathFail(tgt, o.crit ? 2 : 1, through >= tgt.maxHp);
      tgt.hp = 0;
      return total;
    }
    if (tgt.hp <= 0) {
      this.dropped(tgt, src, { overflow: -tgt.hp, crit: !!o.crit, types, through });
    } else if (total > 0 && tgt.conc) {
      const dc = Math.min(30, Math.max(10, Math.floor(total / 2)));
      const r = this.save(tgt, 'con', dc, { conc: true, lr: false, dis: !!(src && src.tpl.concBreaker) });
      if (!r.success) this.breakConc(tgt);
    }
    if (this.active(tgt) && src && through > 0) {
      for (const f of [...tgt.fx]) {
        if (!f.saveOnHarm || !tgt.fx.includes(f)) continue;
        const charmer = this.get(f.srcId);
        if (f.cond === 'charmed' && charmer && src.side !== charmer.side) continue;
        const r = this.save(tgt, f.saveOnHarm.ability, f.saveOnHarm.dc, { serious: true });
        if (r.success) this.removeFx(tgt, (x) => x === f);
      }
    }
    if (this.active(tgt) && src && through > 0) this.react('damaged', { tgt, subject: tgt, src, total, o });
    return total;
  }

  dropped(c, src, { overflow: over, crit, types, through }) {
    let overflow = over;
    c.hp = 0;
    // Death Ward and the like
    if (c.tpl.deathWard && !c.used.deathWard) {
      c.used.deathWard = 1;
      c.hp = 1;
      this.log('info', `${c.name}'s Death Ward holds: 1 HP.`, c);
      this.hook(c, 'onDeathWard', { src });
      return;
    }
    if (c.tpl.undeadFortitude && !crit && !types.includes('radiant')) {
      const r = this.save(c, 'con', 5 + through, { lr: false });
      if (r.success) {
        c.hp = 1;
        this.log('info', `${c.name} stays up on Undead Fortitude: 1 HP.`, c);
        return;
      }
    }
    const ctx = { tgt: c, subject: c, src, saved: false };
    this.react('dropping', ctx);
    if (ctx.saved) return;
    const zero = { src, overflow, crit, types };
    const special = this.hook(c, 'onZero', zero);
    if (special === 'handled') return;
    overflow = zero.overflow;
    this.breakConc(c);
    const saves = c.side === 'pc' ? c.tpl.deathSaves !== false : this.rules.bossDeathSaves && c.tpl.boss && c.tpl.type !== 'undead' && c.tpl.type !== 'construct';
    if (saves && overflow < c.maxHp) {
      c.down = true;
      c.stable = false;
      c.ds = { s: 0, f: 0 };
      c.stats.downs += 1;
      c.fx = c.fx.filter((f) => !f.endsWhenDown);
      this.addFx(c, { cond: 'unconscious', id: 'dying' }, null);
      if (!this.has(c, 'prone')) c.fx.push({ id: 'prone', cond: 'prone', srcId: null });
      this.log('down', `${c.name} drops to 0 HP and is dying.`, c, { tgt: c.id, down: true });
      this.react('dropped', { tgt: c, subject: c, src });
      return;
    }
    this.kill(c, src, saves ? 'massive damage' : null);
  }

  kill(c, src, why) {
    if (c.dead) return;
    c.dead = true;
    c.down = false;
    c.hp = 0;
    this.breakConc(c);
    const wasEngaged = [...c.engaged].map((id) => this.get(id)).filter(Boolean);
    breakAll(this, c);
    c.fx = [];
    this.corpses += c.tpl.noCorpse ? 0 : 1;
    this.log('death', `${c.name} is ${c.tpl.type === 'undead' || c.tpl.type === 'construct' ? 'destroyed' : 'dead'}${why ? ` (${why})` : ''}.`, c, { tgt: c.id });
    this.hook(c, 'onDeath', { src, wasEngaged });
    this.react('died', { tgt: c, subject: c, src });
    // effects this creature was sustaining without concentration
    for (const o of this.list) o.fx = o.fx.filter((f) => !(f.srcId === c.id && f.endsWithSource));
  }

  deathFail(c, n, massive) {
    if (massive) return this.kill(c, null, 'massive damage');
    c.stable = false;
    c.ds.f += n;
    this.log('down', `${c.name} takes damage at 0 HP: ${n} failed death save${n > 1 ? 's' : ''} (${c.ds.f} of 3).`, c);
    if (c.ds.f >= 3) this.kill(c, null, 'three failed death saves');
  }

  deathSave(c) {
    if (!c.down || c.stable || c.dead) return;
    const r = d20(this.rng, 'normal');
    if (r.nat === 20) {
      this.log('down', `${c.name} death save: ${r.text}, natural 20. Back up at 1 HP.`, c, { tgt: c.id, down: false });
      this.revive(c, 1);
      return;
    }
    if (r.nat === 1) c.ds.f += 2;
    else if (r.nat >= 10) c.ds.s += 1;
    else c.ds.f += 1;
    this.log('down', `${c.name} death save: ${r.text}, ${r.nat >= 10 ? 'success' : r.nat === 1 ? 'natural 1, two failures' : 'failure'} (${c.ds.s} saved, ${c.ds.f} failed).`, c);
    if (c.ds.f >= 3) this.kill(c, null, 'three failed death saves');
    else if (c.ds.s >= 3) {
      c.stable = true;
      this.log('down', `${c.name} is stable at 0 HP.`, c);
    }
  }

  revive(c, hp) {
    c.down = false;
    c.stable = false;
    c.ds = { s: 0, f: 0 };
    c.hp = Math.min(c.maxHp, hp);
    c.fx = c.fx.filter((f) => f.id !== 'dying');
    if (!this.rules.healFromZeroProne) c.fx = c.fx.filter((f) => f.cond !== 'prone');
  }

  heal(c, amt, src, label = 'healing') {
    if (!this.alive(c) || amt <= 0) return 0;
    if (this.has(c, 'noHeal')) {
      this.log('heal', `${c.name} cannot regain hit points right now.`, src || c);
      return 0;
    }
    const was = c.hp;
    if (c.down) this.revive(c, amt);
    else c.hp = Math.min(c.maxHp, c.hp + amt);
    const got = c.hp - was;
    if (src) src.stats.healed += got;
    this.log('heal', `${c.name} regains ${got} HP from ${label}${was <= 0 ? ' and is back up, prone' : ''}. HP ${c.hp}/${c.maxHp}.`, src || c, { src: src ? src.id : null, tgt: c.id, amount: got, hp: c.hp, maxHp: c.maxHp });
    return got;
  }

  tempHp(c, amt, label) {
    if (!this.alive(c) || c.tpl.minion) return;
    if (amt > c.tempHp) {
      c.tempHp = amt;
      this.log('heal', `${c.name} has ${amt} temporary HP${label ? ` (${label})` : ''}.`, c);
    }
  }

  reduceMax(c, amt, label) {
    if (amt <= 0 || !this.alive(c)) return;
    if (this.any(c, 'noMaxHpLoss')) {
      this.log('info', `${c.name}'s hit point maximum cannot be reduced (${this.any(c, 'noMaxHpLoss').name}).`, c);
      return;
    }
    c.maxHp = Math.max(0, c.maxHp - amt);
    if (c.hp > c.maxHp) c.hp = c.maxHp;
    this.log('cond', `${c.name}'s hit point maximum drops by ${amt} to ${c.maxHp}${label ? ` (${label})` : ''}.`, c);
    if (c.maxHp <= 0) this.kill(c, null, 'hit point maximum reduced to 0');
  }

  // ---------- effect lists on actions ----------
  // dur: { who: 'src' | 'tgt', when: 'start' | 'end', turns }
  resolveDur(dur, src, tgt) {
    if (!dur) return undefined;
    const who = dur.who === 'tgt' ? tgt : src;
    return { who: who.id, when: dur.when || 'end', turns: dur.turns || 1 };
  }

  applyFx(src, tgt, list, ctx = {}) {
    for (const x of list) {
      if (!this.alive(tgt)) return;
      switch (x.fx) {
        case 'cond': {
          if (tgt.down && x.cond !== 'prone') break;
          const f = { cond: x.cond, name: x.name || x.cond, ends: this.resolveDur(x.dur, src, tgt), saveEnds: x.saveEnds, endsOnDamage: x.endsOnDamage, saveOnHarm: x.saveOnHarm };
          if (x.conc) {
            f.conc = src.id;
            // a concentration spell lasts a minute at most
            if (!f.ends) f.ends = { who: src.id, when: 'end', turns: 10 };
          }
          if (x.escape) f.escape = x.escape;
          if (x.more) Object.assign(f, x.more);
          this.addFx(tgt, f, src);
          break;
        }
        case 'prone':
          if (!this.has(tgt, 'prone')) this.addFx(tgt, { cond: 'prone' }, src);
          break;
        case 'grapple':
          if (!this.has(tgt, 'grappled')) this.addFx(tgt, { cond: 'grappled', escape: x.dc, endsWithSource: true }, src);
          break;
        case 'save': {
          if (tgt.down) break;
          if (x.oncePerTurn) {
            if (src.turn[`once:${x.oncePerTurn}`]) break;
            src.turn[`once:${x.oncePerTurn}`] = true;
          }
          const r = this.save(tgt, x.ability, x.dc, { serious: x.serious !== false, spell: x.spell });
          if (!r.success && x.onFail) this.applyFx(src, tgt, x.onFail, { ...ctx, failBy: x.dc - (r.total ?? 0) });
          if (r.success && x.onSave) this.applyFx(src, tgt, x.onSave, ctx);
          break;
        }
        case 'maxHp': {
          const amt = x.amount === 'dealtNecrotic' ? ctx.necrotic || 0 : x.amount === 'dealt' ? ctx.dealt || 0 : x.amount;
          this.reduceMax(tgt, amt, x.label);
          break;
        }
        case 'healSelf': {
          const amt = x.amount === 'dealtNecrotic' ? ctx.necrotic || 0 : x.amount === 'halfDealt' ? Math.floor((ctx.dealt || 0) / 2) : x.amount;
          this.heal(src, amt, src, x.label || 'the hit');
          break;
        }
        case 'push':
          this.push(src, tgt, x.label);
          break;
        case 'curse':
          this.addFx(tgt, { id: 'curse', name: 'cursed' }, src);
          this.log('cond', `${tgt.name} is cursed: vulnerable to the next attack that hits.`, tgt);
          break;
        case 'effect':
          this.addFx(tgt, { ...x.effect, ends: this.resolveDur(x.dur, src, tgt), conc: x.conc ? src.id : undefined }, src);
          if (x.say) this.log('cond', `${tgt.name}: ${x.say}`, tgt);
          break;
        case 'dmg':
          this.rollAndDamage(src, tgt, x.dmg.map(([dice, type]) => ({ dice, type })), {});
          break;
        case 'call':
          x.run(this, src, tgt, ctx);
          break;
        default:
          throw new Error(`unknown fx ${x.fx}`);
      }
    }
  }

  push(src, tgt, label) {
    if (this.condImmune(tgt, 'push') || tgt.tpl.size === 'gargantuan') return;
    if (tgt.engaged.size) {
      breakAll(this, tgt);
      // a grapple does not survive being thrown clear
      this.removeFx(tgt, (f) => f.cond === 'grappled', false);
      for (const o of this.list) this.removeFx(o, (f) => f.cond === 'grappled' && f.srcId === tgt.id);
      this.log('move', `${tgt.name} is pushed out of melee${label ? ` (${label})` : ''}.`, src, { who: tgt.id, away: true });
    }
    tgt.turn.pushed = true;
  }

  // Saving-throw effect against one or more targets. Damage is rolled once and shared.
  saveEffect(src, act, targets) {
    const dc = act.dc;
    const avg = src.side === 'monster' && this.rules.monsterDamage === 'average';
    let rolled = null;
    const dmgList = typeof act.dmg === 'function' ? act.dmg(this, targets[0]) : act.dmg;
    const mult = src.tpl.outMult ? src.tpl.outMult(this, src) : 1;
    const area = !!act.area || !!act.isArea || targets.length > 1;
    if (dmgList) {
      rolled = dmgList.map(([dice, type]) => {
        const r = rollDice(this.rng, dice, { average: avg });
        return { amt: r.total, type, text: `${r.text} ${type}` };
      });
      this.log('act', `${src.name}: ${act.name} (DC ${dc} ${act.save.toUpperCase()}), ${rolled.map((r) => r.text).join('; ')} = ${rolled.reduce((s, r) => s + r.amt, 0)}.`, src, { who: src.id, act: act.name, kind: 'save', targets: targets.map((t) => t.id) });
    } else {
      this.log('act', `${src.name}: ${act.name} (DC ${dc} ${act.save.toUpperCase()}).`, src, { who: src.id, act: act.name, kind: 'save', targets: targets.map((t) => t.id) });
    }
    const expected = rolled ? rolled.reduce((s, r) => s + r.amt, 0) : 0;
    for (const t of targets) {
      if (!this.present(t)) continue;
      if (act.notUndead && (t.tpl.type === 'undead' || t.tpl.type === 'construct')) continue;
      const serious = !!(act.onFail && act.onFail.length);
      // the caster may have a die set aside for this target's save
      const told = this.hook(src, 'foretell', { tgt: t, act, dc, expected, serious, first: t === targets[0] });
      const r = this.save(t, act.save, dc, { spell: act.spell, serious, expected, tags: act.tags, dis: act.disFor && act.disFor(this, t), ...(told ? { fixed: told.die, fixedBy: told.label } : {}) });
      const ctx = {};
      // a minion that saves against an area takes nothing
      if (rolled && r.success && t.tpl.minion) continue;
      // Evasion: nothing on a made Dexterity save for half, and half on a failed one
      const evades = rolled && act.save === 'dex' && act.half && t.tpl.evasion && !this.incapacitated(t);
      if (evades && r.success) { this.log('info', `${t.name} takes nothing (Evasion).`, t); continue; }
      if (rolled) {
        if (!r.success || act.half) {
          const dealt = this.damage(t, rolled.map((x) => ({ amt: x.amt, type: x.type })), src, { half: r.success || evades, act, mult, area });
          ctx.dealt = dealt;
          ctx.necrotic = rolled.filter((x) => x.type === 'necrotic').reduce((s, x) => s + x.amt, 0);
          if (r.success) ctx.necrotic = Math.floor(ctx.necrotic / 2);
        }
      }
      if (!this.alive(t)) continue;
      if (!r.success && act.onFail) this.applyFx(src, t, act.onFail, { ...ctx, failBy: dc - (r.total ?? 0) });
      if (r.success && act.onSave) this.applyFx(src, t, act.onSave, ctx);
    }
  }

  // ---------- emanations ----------
  auraTick(c, when) {
    for (const caster of this.list) {
      if (caster.side === c.side || !this.active(caster)) continue;
      for (const f of caster.fx) {
        if (!f.aura || !f.aura.on.includes(when)) continue;
        if (!enemiesInAura(this, caster).includes(c)) continue;
        this.auraHit(caster, f, c);
      }
    }
  }

  // A creature that has just come into reach of an enemy: any emanation it is now inside bites,
  // once a turn as always.
  auraEnter(c) {
    for (const caster of this.list) {
      if (caster.side === c.side || !this.active(caster)) continue;
      for (const f of caster.fx) {
        if (f.aura && this.active(c) && enemiesInAura(this, caster).includes(c)) this.auraHit(caster, f, c);
      }
    }
  }

  // A caster who steps into a rank to strike brings their emanation with them: everyone on the
  // other side in that rank meets it then, once a turn as always.
  auraCarry(caster, tgt) {
    for (const f of caster.fx) {
      if (!f.aura) continue;
      for (const e of this.enemiesOf(caster)) {
        if (this.active(caster) && this.present(e) && e.pos === tgt.pos) this.auraHit(caster, f, e);
      }
    }
  }

  auraSweep(caster) {
    for (const f of caster.fx) {
      if (!f.aura || !f.aura.on.includes('casterTurn')) continue;
      for (const e of enemiesInAura(this, caster)) this.auraHit(caster, f, e);
    }
  }

  auraHit(caster, f, tgt) {
    const key = `aura:${caster.id}:${f.id}`;
    if (tgt.memo[key] === this.turnCount || !this.present(tgt)) return;
    tgt.memo[key] = this.turnCount;
    const a = f.aura;
    this.saveEffect(caster, { name: f.name, save: a.save, dc: a.dc, dmg: a.dmg, half: true, spell: true, onFail: a.onFail, isArea: true }, [tgt]);
  }

  // ---------- resources ----------
  usable(c, id, o = {}) {
    const act = this.action(c, id);
    if (!act) return false;
    const cost = o.cost || act.cost || 'action';
    if (!o.free) {
      if (cost === 'action' && !c.turn.action) return false;
      if (cost === 'bonus' && !c.turn.bonus) return false;
      if (cost === 'leg' && c.legLeft < (o.legCost || act.legCost || 1)) return false;
      if (cost === 'reaction' && !c.reaction) return false;
    }
    if (act.uses && (c.used[act.usesKey || id] || 0) >= act.uses) return false;
    if (act.recharge && c.ready[id] === false) return false;
    if (act.spell && this.has(c, 'quiet')) return false;
    if (act.warlock && this.has(c, 'pactVoid')) return false;
    if (act.spell && c.memo.noSpells) return false;
    if (act.formless && c.form) return false;
    if (act.slot) {
      if (c.turn.slotSpell && !act.freeUse) return false;
      if (!this.slotFor(c, act, o.level)) return false;
    }
    if (act.when && !act.when(this, c)) return false;
    return true;
  }

  // lowest slot that can carry the action, or the level asked for
  slotFor(c, act, level) {
    if (act.freeKey && (c.used[act.freeKey] || 0) < (act.freeUses || 1)) return { free: true, level: act.slot };
    if (act.pact || (c.pact && !c.slots)) {
      if (c.pact && c.pact.n > 0 && c.pact.level >= act.slot) return { pact: true, level: c.pact.level };
      return null;
    }
    if (!c.slots) return null;
    const from = Math.max(act.slot, level || act.slot);
    for (let l = from; l <= 9; l++) if (c.slots[l] > 0) return { level: l };
    if (level) for (let l = act.slot; l < from; l++) if (c.slots[l] > 0) return { level: l };
    return null;
  }

  pay(c, act, id, choice = {}) {
    const cost = choice.cost || act.cost || 'action';
    if (!choice.free) {
      if (cost === 'action') c.turn.action = false;
      else if (cost === 'bonus') c.turn.bonus = false;
      else if (cost === 'leg') c.legLeft -= choice.legCost || act.legCost || 1;
      else if (cost === 'reaction') c.reaction = false;
    }
    if (act.uses) c.used[act.usesKey || id] = (c.used[act.usesKey || id] || 0) + 1;
    if (act.recharge) c.ready[id] = false;
    let level = 0;
    if (act.slot) {
      const s = this.slotFor(c, act, choice.level);
      if (s.free) c.used[act.freeKey] = (c.used[act.freeKey] || 0) + 1;
      else if (s.pact) { c.pact.n -= 1; c.turn.slotSpell = true; }
      else { c.slots[s.level] -= 1; c.turn.slotSpell = true; }
      level = s.level;
    }
    return level;
  }

  slotsLeft(c) {
    let n = 0;
    if (c.slots) for (const k of Object.keys(c.slots)) n += c.slots[k];
    if (c.pact) n += c.pact.n;
    return n;
  }

  // ---------- running an action ----------
  perform(c, choice) {
    const id = choice.act;
    const act = this.action(c, id);
    if (!act) return;
    if (!this.usable(c, id, choice)) return;
    const level = this.pay(c, act, id, choice);
    if (act.takes) c.turn[act.takes] = false;
    if (choice.hasted) c.turn.hasted = true;
    if (act.slot && !choice.quietCast) {
      const ctx = { subject: c, tgt: c, caster: c, act, level, countered: false };
      this.react('spellCast', ctx);
      if (ctx.countered) {
        this.log('info', `${c.name}'s ${act.name} is countered.`, c, { countered: c.id });
        return;
      }
    }
    this.run(c, act, { ...choice, level, id });
    if (act.conc && !act.selfManaged) c.conc = c.conc || { name: act.name };
  }

  target(c, act, choice, i = 0) {
    const ids = choice.targets || [];
    let t = this.get(ids[i] !== undefined ? ids[i] : ids[0]);
    if (act.ally) return t && this.alive(t) ? t : null;
    if (!t || !this.present(t) || (t.down && !this.rules.attackDowned && !choice.forceDowned)) {
      t = this.ai ? this.ai.pickTarget(this, c, act) : null;
    }
    return t;
  }

  run(c, act, choice) {
    if (act.kind !== 'multi') this.acted = { who: c.id, name: act.name };
    switch (act.kind) {
      case 'attack': {
        // one attack only for Haste's extra action, and for a slowed creature
        const n = choice.one || this.has(c, 'slowed') ? 1 : act.n || 1;
        for (let i = 0; i < n; i++) {
          if (!this.active(c)) break;
          const t = this.target(c, act, choice, i);
          if (!t) break;
          this.attack(c, t, act, choice.attackOpts || {});
          if (act.also && this.active(c)) {
            const others = [...c.engaged].map((x) => this.get(x)).filter((x) => x !== t && this.present(x) && !x.down).slice(0, act.also);
            for (const x of others) this.attack(c, x, act, {});
          }
        }
        break;
      }
      case 'save': {
        const t = act.area && (act.area.type === 'engaged' || act.area.type === 'all') ? null : this.target(c, act, choice);
        let targets = act.area ? areaTargets(this, c, t, act.area) : t ? [t] : [];
        if (act.only) targets = targets.filter((x) => act.only(this, x));
        if (!targets.length) { this.log('info', `${c.name}: ${act.name} has no target.`, c); break; }
        if (act.conc) this.concentrate(c, act.name);
        this.saveEffect(c, act, targets);
        break;
      }
      case 'multi': {
        let opt = act.options[choice.opt || 0] || act.options[0];
        opt = opt.filter((sid) => this.action(c, sid));
        if (this.has(c, 'slowed')) opt = opt.slice(0, 1);
        let k = 0;
        for (const sid of opt) {
          if (!this.active(c)) break;
          const sub = this.action(c, sid);
          const ok = (!sub.uses || (c.used[sub.usesKey || sid] || 0) < sub.uses) && !(sub.recharge && c.ready[sid] === false);
          const use = ok ? sub : this.action(c, act.options[0][0]);
          const useId = ok ? sid : act.options[0][0];
          if (use.uses) c.used[use.usesKey || useId] = (c.used[use.usesKey || useId] || 0) + 1;
          if (use.recharge) c.ready[useId] = false;
          this.run(c, use, { targets: [choice.targets ? choice.targets[k] ?? choice.targets[0] : undefined], id: useId });
          k++;
        }
        break;
      }
      case 'heal': {
        const t = act.self ? c : this.target(c, { ...act, ally: true }, choice) || c;
        const r = rollDice(this.rng, act.dice);
        this.log('act', `${c.name}: ${act.name} on ${t.name}, ${r.text} = ${r.total}.`, c, { who: c.id, act: act.name, kind: 'heal', targets: [t.id] });
        this.heal(t, r.total, c, act.name);
        break;
      }
      case 'buff': {
        const targets = act.self ? [c] : (choice.targets || []).map((id) => this.get(id)).filter((t) => t && this.alive(t));
        this.log('act', `${c.name}: ${act.name}${act.self ? '' : ` on ${targets.map((t) => t.name).join(', ')}`}.`, c, { who: c.id, act: act.name, kind: 'buff', targets: targets.map((t) => t.id) });
        if (act.conc) this.concentrate(c, act.name);
        for (const t of targets) {
          this.addFx(t, { ...act.effect, name: act.effect.name || act.name, conc: act.conc ? c.id : undefined, ends: this.resolveDur(act.dur, c, t) }, c);
        }
        break;
      }
      case 'special':
        act.run(this, c, act, choice);
        break;
      default:
        throw new Error(`unknown action kind ${act.kind} on ${c.name}`);
    }
  }

  // ---------- leaving melee ----------
  withdraw(c, { teleport = false, label = 'pulls back' } = {}) {
    if (teleport) c.turn.teleported = true;
    if (!c.engaged.size) return;
    const foes = [...c.engaged].map((id) => this.get(id)).filter((e) => this.active(e));
    breakAll(this, c);
    this.removeFx(c, (f) => f.cond === 'grappled' && teleport);
    this.log('move', `${c.name} ${label}.`, c, { who: c.id, away: true });
    if (teleport || c.turn.noOA || c.tpl.noOA) return;
    for (const e of foes) {
      if (!this.active(c)) break;
      if (!e.reaction || this.incapacitated(e) || this.has(e, 'noReactions') || this.has(e, 'slowed')) continue;
      const oa = this.hook(e, 'opportunity', { tgt: c });
      const id = oa || e.tpl.oa;
      const act = id && this.action(e, id);
      if (!act || !act.melee && !oa) continue;
      e.reaction = false;
      this.cue(e, 'Opportunity Attack', { kind: 'reaction', at: c.id });
      this.log('act', `${e.name} takes an opportunity attack.`, e);
      engage(e, c);
      this.attack(e, c, act, {});
      breakAll(this, c);
    }
  }

  // expected damage of an action against a typical target, for AI comparisons
  expected(c, act) {
    if (!act) return 0;
    if (act.kind === 'attack') return (act.n || 1) * (act.dmg || []).reduce((s, [d]) => s + avgDice(d), 0) * 0.65;
    if (act.kind === 'save') return (act.dmg || []).reduce((s, [d]) => s + avgDice(d), 0) * 0.7;
    if (act.kind === 'multi') return act.options[0].reduce((s, id) => s + this.expected(c, this.action(c, id)), 0);
    return act.value || 0;
  }
}
