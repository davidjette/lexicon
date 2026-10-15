// The fight itself: initiative, rounds, turns, legendary and lair actions, reinforcements, and the
// stepper the interface drives. The flow is a generator that pauses at every decision.

import { Engine } from './rules.js?v=mv9nlcei';
import { d20, rollDice, signed } from './dice.js?v=mv9nlcei';
import { breakAll } from './zones.js?v=mv9nlcei';
import { AI } from './ai.js?v=mv9nlcei';

export class Encounter extends Engine {
  // setup: { pcs: [{ tpl, name, near, pos }], monsters: [...], rules, seed, scenario }
  // setup.control: { side: 'pc' } hands that side's turns to a player (the battle screen). Absent, every
  // turn is scripted.
  // scenario: { waves: [{ round, spawn: [[tpl, n]], side, label, every }], initAdv: 'pc' | 'monster', flags, endOnFlee }
  constructor(setup) {
    super({ rules: setup.rules, seed: setup.seed });
    this.ai = AI;
    this.scenario = setup.scenario || {};
    this.flags = { ...(this.scenario.flags || {}) };
    this.waves = (this.scenario.waves || []).map((w) => ({ ...w }));
    this.corpses = this.scenario.corpses || 0;
    this.quiet = !!setup.quiet;
    this.control = setup.control || null;
    for (const p of setup.pcs || []) this.add(p.tpl, { side: 'pc', name: p.name, near: p.near, pos: p.pos });
    for (const m of setup.monsters || []) this.add(m.tpl, { side: 'monster', name: m.name, near: m.near, pos: m.pos });
    // "near" was given as a template id or name; resolve it to a combatant
    for (const c of this.list) {
      if (!c.near) continue;
      const o = this.list.find((x) => x !== c && x.side === c.side && (x.tpl.id === c.near || x.name === c.near));
      c.near = o ? o.id : null;
    }
    this.pending = null;
    this.gen = null;
  }

  // ---------- stepping ----------
  start() {
    this.gen = this.flow();
    this.advance();
    return this;
  }
  advance() {
    const r = this.gen.next();
    this.pending = r.done ? null : r.value;
    if (r.done && !this.over) this.finish('timeout');
  }
  peek() {
    return this.pending;
  }
  setChoice(choice) {
    if (this.pending) this.pending.choice = choice;
  }
  step() {
    if (!this.gen) this.start();
    else if (this.pending) this.advance();
    return this.pending;
  }
  runToEnd() {
    if (!this.gen) this.start();
    let guard = 0;
    while (this.pending && guard++ < 20000) this.advance();
    return this.summary();
  }

  // ---------- initiative ----------
  rollInit(c) {
    // minions of one kind act together, on one roll
    const squad = c.tpl.minion ? `${c.side}:${c.tpl.id}` : null;
    this.squads = this.squads || {};
    if (squad && this.squads[squad]) {
      const e = this.squads[squad];
      return { id: c.id, init: e.init, dex: e.dex, tie: e.tie - 0.000001 * this.list.length };
    }
    const adv = c.tpl.initAdv || this.scenario.initAdv === c.side;
    const dis = this.scenario.initDis === c.side;
    const r = d20(this.rng, adv && !dis ? 'adv' : dis && !adv ? 'dis' : 'normal');
    const bonus = c.tpl.init !== undefined ? c.tpl.init : this.abil(c, 'dex');
    const init = r.nat + bonus;
    this.log('init', `${c.name} initiative: ${r.text}${signed(bonus)} = ${init}.`, c);
    const entry = { id: c.id, init, dex: this.abil(c, 'dex'), tie: this.rng.next() };
    if (squad) this.squads[squad] = entry;
    return entry;
  }

  sortEntries() {
    this.entries.sort((a, b) => b.init - a.init || b.dex - a.dex || b.tie - a.tie);
  }

  rollInitiative() {
    this.log('round', 'Initiative');
    for (const c of this.list) {
      const e = this.rollInit(c);
      this.entries.push(e);
      if (c.tpl.twoTurns) this.entries.push({ ...e, init: e.init - 10, second: true });
    }
    this.sortEntries();
    this.log('info', `Order: ${this.entries.map((e) => `${this.get(e.id).name}${e.second ? ' (second turn)' : ''} ${e.init}`).join(', ')}.`);
  }

  // Put a new creature on the field. `after` places it straight after that combatant in the order.
  spawn(tpl, { side, name, after, near, quietInit } = {}) {
    const c = this.add(tpl, { side, name, near });
    if (after) {
      let idx = -1;
      this.entries.forEach((e, i) => { if (e.id === after.id) idx = i; });
      const base = this.entries[idx];
      this.entries.splice(idx + 1, 0, { id: c.id, init: base.init, dex: -99, tie: base.tie - 0.0001 * this.entries.length });
    } else {
      const e = quietInit ? { id: c.id, init: 10 + this.abil(c, 'dex'), dex: this.abil(c, 'dex'), tie: this.rng.next() } : this.rollInit(c);
      this.entries.push(e);
      this.sortEntries();
    }
    return c;
  }

  nameFor(tpl, side) {
    const n = this.list.filter((c) => c.tpl.id === tpl.id && c.side === side).length;
    return n ? `${tpl.name} ${n + 1}` : tpl.name;
  }

  // ---------- flow ----------
  *flow() {
    this.rollInitiative();
    this.hookAll('onFightStart');
    while (!this.over) {
      this.round += 1;
      if (this.round > this.rules.maxRounds) { this.finish('timeout'); return; }
      this.log('round', `Round ${this.round}`);
      yield* this.lairPhase();
      let i = 0;
      while (i < this.entries.length && !this.over) {
        const e = this.entries[i];
        const c = this.get(e.id);
        if (this.alive(c)) {
          yield* this.turn(c, !!e.second);
          if (!this.over) yield* this.legendaryPhase(c);
        }
        i = this.entries.indexOf(e) + 1;
      }
      if (this.over) return;
      this.endOfRound();
      this.checkEnd();
      if (!this.over && this.scenario.partyLeavesAfter && this.round >= this.scenario.partyLeavesAfter) this.finish('withdrew');
    }
  }

  hookAll(name) {
    for (const c of [...this.list]) if (this.alive(c)) this.hook(c, name, {});
  }

  *turn(c, second) {
    this.current = c;
    this.turnCount += 1;
    c.stats.turns += 1;
    const radiant = c.turn.radiantHit;
    c.turn = { action: true, bonus: true, second, first: !c.memo.acted };
    if (this.rules.movement) c.turn.move = 1;
    c.reaction = true;
    if (c.leg && !second) c.legLeft = c.leg;
    this.log('turn', `${c.name}'s turn${second ? ' (second)' : ''}. HP ${c.hp}/${c.maxHp}${c.tempHp ? ` +${c.tempHp} temp` : ''}.`, c);
    this.tickFx(c, 'start');
    if (this.has(c, 'banished')) {
      this.log('info', `${c.name} is banished and does nothing.`, c);
      this.tickFx(c, 'end');
      return;
    }
    if (c.down) {
      this.deathSave(c);
      this.checkEnd();
      if (c.down || c.dead) { this.tickFx(c, 'end'); return; }
    }
    // recharge
    for (const [id, act] of Object.entries(this.actions(c))) {
      if (act.recharge && c.ready[id] === false) {
        const r = this.rng.int(6);
        if (r >= act.recharge) {
          c.ready[id] = true;
          this.log('info', `${c.name} recharges ${act.name} (d6: ${r}).`, c);
        }
      }
    }
    // regeneration
    const regen = c.tpl.regen;
    if (regen && c.hp > 0 && c.hp < c.maxHp) {
      if (radiant && !c.tpl.regenAlways) this.log('info', `${c.name} does not regenerate (radiant damage).`, c);
      else this.heal(c, regen, c, 'regeneration');
    }
    this.hook(c, 'onTurnStart', { second });
    this.react('turnStart', { subject: c, tgt: c });
    this.auraTick(c, 'enemyStart');
    this.checkEnd();
    if (this.over || !this.alive(c)) return;

    if (this.active(c)) {
      // flee threshold
      if (c.tpl.fleeAt && c.hp <= c.maxHp * c.tpl.fleeAt && !this.incapacitated(c) && !(c.tpl.fleeIf && !c.tpl.fleeIf(this, c))) {
        this.log('end', `${c.name} ${c.tpl.fleeText || 'breaks off and leaves the fight'}.`, c);
        c.fled = true;
        this.breakConc(c);
        breakAll(this, c);
        this.flags.escaped = c.name;
        this.checkEnd();
        return;
      }
      if (this.has(c, 'prone') && !this.immobile(c)) {
        this.removeFx(c, (f) => f.cond === 'prone', false);
        // with ranks in play, getting up is the whole of the turn's movement
        if (this.rules.movement) c.turn.move = 0;
        this.log('move', `${c.name} stands up${this.rules.movement ? ' (all of this turn\'s movement)' : ''}.`, c);
      }
      if (this.incapacitated(c)) {
        this.log('info', `${c.name} cannot act.`, c);
      } else {
        const skip = this.hook(c, 'skipTurn', {});
        if (skip) this.log('info', `${c.name} ${skip}`, c);
        else if (this.has(c, 'dominated')) this.dominatedTurn(c);
        else if (this.playerRuns(c)) {
          // the player picks each action; the turn ends on a pass or when nothing is left to do
          for (let n = 0; n < 12; n++) {
            if (!this.active(c) || this.incapacitated(c) || this.over) break;
            if (this.ai.options(this, c, 'turn', { full: true }).every((o) => o.pass || o.withdraw || o.shift)) break;
            const d = { actor: c, kind: 'turn', choice: null, human: true };
            yield d;
            if (this.over || !this.active(c)) break;
            if (!d.choice || d.choice.pass) break;
            this.execute(c, d.choice);
            this.checkEnd();
          }
        } else {
          if (this.rules.movement) this.scriptedRetreat(c);
          for (let n = 0; n < 12; n++) {
            if (!this.active(c) || this.incapacitated(c) || this.over) break;
            const choice = this.ai.next(this, c);
            if (!choice) break;
            const d = { actor: c, kind: 'turn', choice };
            yield d;
            if (this.over || !this.active(c)) break;
            this.execute(c, d.choice);
            this.checkEnd();
          }
          if (this.rules.movement && !this.over) this.scriptedAdvance(c);
        }
      }
      c.memo.acted = true;
    }
    if (this.over) return;
    // end of turn
    if (this.active(c) && this.rules.auraOnCasterTurn) this.auraSweep(c);
    if (this.present(c)) this.auraTick(c, 'enemyEnd');
    if (this.alive(c)) {
      for (const f of [...c.fx]) {
        if (!f.saveEnds || !c.fx.includes(f)) continue;
        const r = this.save(c, f.saveEnds.ability, f.saveEnds.dc, { lr: true, serious: true, spell: f.saveEnds.spell });
        if (r.success) this.removeFx(c, (x) => x === f);
      }
    }
    this.tickFx(c, 'end');
    if (this.alive(c)) this.hook(c, 'onTurnEnd', {});
    this.checkEnd();
  }

  // Scripted movement, before acting: a creature that fights at range, or is badly hurt, gets out
  // of melee by falling back a rank, but only when someone on its side still stands in front of it
  // afterwards (otherwise the enemy simply follows).
  fightsAtRange(c) {
    const basic = this.action(c, c.tpl.basic);
    return !!basic && !basic.melee;
  }

  scriptedRetreat(c) {
    if (!this.active(c) || this.incapacitated(c) || c.pos === 'back' || this.roams(c)) return;
    if (!this.fightsAtRange(c)) return;
    const pressed = [...c.engaged].some((id) => this.active(this.get(id)));
    if (!pressed && c.hp > c.maxHp * 0.3) return;
    const mine = ['front', 'mid', 'back'].indexOf(c.pos);
    const cover = this.side(c.side).some((x) => x !== c && this.present(x) && !x.down && ['front', 'mid', 'back'].indexOf(x.pos) <= mine);
    if (cover && this.shiftCost(c, 1) === 'move') this.shift(c, 1);
  }

  // After acting: a creature that fights hand to hand and found nothing to do walks toward the
  // enemy, with a Dash if its action is still unspent.
  scriptedAdvance(c) {
    if (!this.active(c) || this.incapacitated(c) || c.pos === 'front' || this.roams(c)) return;
    if (this.fightsAtRange(c) || !c.turn.action) return;
    while (c.pos !== 'front' && this.shift(c, -1));
  }

  // Summoned creatures and companions stay scripted.
  playerRuns(c) {
    return !!this.control && this.control.side === c.side && !c.summonedBy;
  }

  // A dominated creature spends its turn attacking a friend with its basic attack.
  dominatedTurn(c) {
    const act = this.action(c, c.tpl.basic);
    const friends = this.alliesOf(c).filter((a) => !a.down);
    if (!act || !friends.length) return this.log('info', `${c.name} is dominated and stands idle.`, c);
    const t = this.rng.pick(friends);
    this.log('act', `${c.name} is dominated and turns on ${t.name}.`, c);
    for (let i = 0; i < (c.tpl.basicN || 1); i++) {
      if (!this.active(c) || !this.present(t)) break;
      if (act.kind === 'save') this.saveEffect(c, act, [t]);
      else this.attack(c, t, act, {});
    }
  }

  execute(c, choice) {
    if (!choice || choice.pass) {
      c.turn.action = false;
      c.turn.bonus = false;
      return;
    }
    if (choice.shift) {
      this.shift(c, choice.shift);
      return;
    }
    if (choice.withdraw) this.withdraw(c, choice.withdraw === true ? {} : choice.withdraw);
    if (choice.engage) {
      const t = this.get(choice.engage);
      if (t && this.present(t)) this.closeWith(c, t);
    }
    if (choice.say) this.log('info', `${c.name} ${choice.say}`, c);
    if (choice.act) {
      const before = c.turn.action;
      const beforeB = c.turn.bonus;
      this.perform(c, choice);
      // an action that could not be used still spends the slot it was aimed at, so the turn moves on
      const act = this.action(c, choice.act);
      const cost = choice.cost || (act && act.cost) || 'action';
      if (cost === 'action' && before && c.turn.action && !choice.free) c.turn.action = false;
      if (cost === 'bonus' && beforeB && c.turn.bonus && !choice.free) c.turn.bonus = false;
    } else if (choice.endAction) {
      c.turn.action = false;
    }
  }

  *legendaryPhase(after) {
    for (const L of [...this.list]) {
      if (L === after || !L.leg || L.legLeft <= 0) continue;
      if (!this.active(L) || this.incapacitated(L) || this.over) continue;
      const choice = this.ai.legendary(this, L, after);
      if (!choice) continue;
      const d = { actor: L, kind: 'legendary', choice };
      yield d;
      if (this.over || !this.active(L) || !d.choice || d.choice.pass) continue;
      this.cue(L, 'Legendary Action', { kind: 'legendary' });
      this.log('act', `${L.name} takes a legendary action (${L.legLeft} left before this).`, L);
      const saved = L.turn;
      L.turn = { ...saved, action: true, bonus: true, legendary: true };
      this.perform(L, { ...d.choice, cost: 'leg' });
      L.turn = { ...saved, ...{ slotSpell: saved.slotSpell } };
      this.checkEnd();
    }
  }

  *lairPhase() {
    for (const c of [...this.list]) {
      if (!c.tpl.lair || !this.active(c) || this.incapacitated(c) || this.flags.noLair) continue;
      const choice = this.ai.lair(this, c);
      if (!choice) continue;
      const d = { actor: c, kind: 'lair', choice };
      yield d;
      if (this.over || !d.choice || d.choice.pass) continue;
      this.cue(c, 'Lair Action', { kind: 'lair' });
      this.log('act', `Lair action (initiative 20): ${c.name}.`, c);
      const saved = c.turn;
      c.turn = { action: true, bonus: true };
      this.perform(c, { ...d.choice, free: true });
      c.turn = saved;
      c.memo.lastLair = d.choice.act;
      this.checkEnd();
    }
  }

  endOfRound() {
    for (const w of this.waves) {
      const due = w.every ? this.round >= w.round && (this.round - w.round) % w.every === 0 : this.round === w.round;
      if (!due || w.done || (w.if && !w.if(this)) || (w.until && w.until(this))) continue;
      if (w.once) w.done = true;
      const side = w.side || 'monster';
      const names = [];
      for (const [tpl, n] of w.spawn) {
        for (let i = 0; i < n; i++) {
          const c = this.spawn(tpl, { side, name: this.nameFor(tpl, side), quietInit: true });
          names.push(c.name);
        }
      }
      this.log('info', `${w.label || 'Reinforcements arrive'} at the end of round ${this.round}: ${names.join(', ')}.`);
    }
  }

  // ---------- ending ----------
  checkEnd() {
    if (this.over) return;
    const pcs = this.side('pc').filter((c) => c.tpl.pc);
    const core = pcs.length ? pcs : this.side('pc');
    const standing = core.filter((c) => this.alive(c) && !c.down);
    if (!standing.length) return this.finish('defeat');
    if (this.flags.escaped && this.scenario.endOnFlee !== false) return this.finish('escaped');
    const foes = this.side('monster').filter((c) => this.alive(c) && !c.down && !c.tpl.noncombatant);
    const pending = this.waves.some((w) => !w.done && (w.every || w.round > this.round) && (w.side || 'monster') === 'monster' && !(w.if && !w.if(this)) && !(w.until && w.until(this)));
    if (!foes.length && !pending) return this.finish(this.flags.escaped ? 'escaped' : 'victory');
  }

  finish(result) {
    if (this.over) return;
    this.over = true;
    this.result = result;
    const text = {
      victory: 'The party wins.',
      defeat: 'The party is down.',
      escaped: `${this.flags.escaped} escapes; the party holds the field.`,
      timeout: `No result after ${this.rules.maxRounds} rounds.`,
      withdrew: `The party breaks off at the end of round ${this.round}.`,
      dragon: 'The dragon is awake. Whoever is still in the palace should not be.',
    }[result];
    this.log('end', text);
  }

  summary() {
    const row = (c) => ({
      id: c.id,
      tpl: c.tpl.id,
      name: c.name,
      side: c.side,
      pc: !!c.tpl.pc,
      boss: !!c.tpl.boss,
      hp: Math.max(0, c.hp),
      maxHp: c.baseMaxHp,
      dead: c.dead,
      down: c.down,
      fled: c.fled,
      downs: c.stats.downs,
      dealt: c.stats.dealt,
      taken: c.stats.taken,
      slotsLeft: this.slotsLeft(c),
    });
    return {
      seed: this.seed,
      result: this.result,
      rounds: this.round,
      pcs: this.side('pc').map(row),
      monsters: this.side('monster').map(row),
    };
  }
}

export function runOnce(setup) {
  return new Encounter(setup).start().runToEnd();
}

export { rollDice };
