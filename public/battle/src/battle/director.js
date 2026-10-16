// Turns a run of engine events into what happens on the stage. The engine has already resolved
// everything by the time an event exists; the director only decides how and when to show it.
import { TYPE_COLOR } from './stage.js?v=mvab2y30';
import { sfx } from './audio.js?v=mvab2y30';

// Out-of-turn things are called out in their own colours: reactions blue, legendary gold, lair violet.
const CUE_COLOR = { reaction: '#bfe0ff', legendary: '#ffd27a', lair: '#d9b8ff' };
const PAUSE = { round: 0, init: 0, turn: 120, info: 420, act: 380, save: 260, cond: 220, heal: 320, move: 0, down: 350, death: 400, end: 0 };

export class Director {
  constructor(stage, { onEvent } = {}) {
    this.stage = stage;
    this.onEvent = onEvent || (() => {});
  }

  unit(id) {
    return this.stage.units.get(id);
  }

  // Sends everyone who stepped out back to their place, except `keep`.
  async settle(keep) {
    const out = [...this.stage.units.values()].filter((u) => u.away && u !== keep);
    await Promise.all(out.map((u) => u.goHome()));
  }

  async play(events, E) {
    const st = this.stage;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const d = e.data;
      this.onEvent(e);
      if (e.kind === 'turn') this.said = null;
      // reactions, legendary and lair actions: named over whoever took them, before what they do
      for (const c of e.cues || []) await this.cue(c);
      // what the actor is doing, by name, once per run of the same action
      if (e.acted && this.unit(e.acted.who) && this.said !== `${e.acted.who}:${e.acted.name}`) {
        this.said = `${e.acted.who}:${e.acted.name}`;
        const lead = this.lead && this.lead.who === e.acted.who ? this.lead : null;
        this.lead = null;
        this.unit(e.acted.who).callout(lead ? `${lead.label}: ${e.acted.name}` : e.acted.name, lead ? CUE_COLOR[lead.kind] : undefined);
        this.auras(E);
        await st.wait(160);
      }
      switch (e.kind) {
        case 'round':
          await this.settle();
          if (/^Round/.test(e.text)) {
            sfx(st, 'round');
            await st.showBanner(e.text, 500);
          }
          break;
        case 'turn':
          await this.settle();
          st.markTurn(this.unit(e.actor));
          sfx(st, 'turn');
          break;
        case 'hit':
        case 'crit':
        case 'miss': {
          if (!d || d.reach === false) break;
          // the damage lines that belong to this blow follow it directly
          const dmg = [];
          while (events[i + 1] && events[i + 1].kind === 'dmg' && events[i + 1].data && events[i + 1].data.tgt === d.tgt) {
            dmg.push(events[++i]);
            this.onEvent(events[i]);
            // a parry or a dodge against this blow is named before it lands
            for (const c of events[i].cues || []) await this.cue(c);
          }
          await this.strike(d, dmg);
          break;
        }
        case 'dmg':
          if (d) this.damage(d, false);
          await st.wait(300);
          break;
        case 'act': {
          const u = d && this.unit(d.who);
          if (u && d.kind !== 'attack') {
            const caught = (d.targets || []).map((id) => this.unit(id)).filter(Boolean);
            // an aura biting someone inside it is the ring's doing, not a new casting
            if (u.aura && u.auraName === d.act) {
              u.pulseAura();
              break;
            }
            await this.settle(u);
            sfx(st, 'cast');
            await u.pose('magic');
            u.rest();
            if (d.kind === 'save' && caught.length > 1) st.area(caught, this.colorAhead(events, i));
          }
          break;
        }
        case 'save': {
          const u = d && this.unit(d.who);
          if (u && d.lr) {
            u.popup('Legendary Resistance', CUE_COLOR.legendary, 18);
            u.flash(0xffd27a);
            sfx(st, 'roar');
          } else if (u) u.popup(d.success ? 'Saved' : 'Failed', d.success ? '#b9d6a8' : '#e0a090', 17);
          break;
        }
        case 'info': {
          // a spell that was countered goes out in its caster's hands
          const u = d && d.countered && this.unit(d.countered);
          if (u) {
            u.popup('Countered', CUE_COLOR.reaction, 22);
            u.sparks('force', 0xb48cff, 10);
            sfx(st, 'miss');
            if (!u.fallen) u.pose('damage').then(() => u.rest());
            await st.wait(260);
          }
          break;
        }
        case 'heal': {
          const u = d && this.unit(d.tgt);
          if (u) {
            u.setHp(d.hp, d.maxHp);
            u.flash(0x8fe0a0);
            sfx(st, 'heal');
            u.popup(`+${d.amount}`, '#8fe0a0');
            if (d.hp > 0) u.setFallen(false);
          }
          break;
        }
        case 'cond': {
          const u = d && this.unit(d.tgt);
          if (u && d.on) {
            u.popup(d.cond, '#d9c7f0', 16);
            sfx(st, 'cond');
          }
          this.auras(E);
          break;
        }
        case 'move': {
          const u = d && this.unit(d.who);
          if (!u) break;
          if (d.rank) {
            // a step between ranks: everyone takes their new places
            await this.settle();
            sfx(st, 'step');
            await st.arrange(E.list);
            await st.wait(320);
          } else if (d.to && this.unit(d.to)) {
            await this.settle(u);
            await u.closeOn(this.unit(d.to));
          } else if (d.away) await u.goHome();
          break;
        }
        case 'down': {
          const u = d && this.unit(d.tgt);
          if (u) {
            u.setFallen(d.down);
            if (d.down) sfx(st, 'down');
          }
          break;
        }
        case 'death': {
          const u = d && this.unit(d.tgt);
          if (u) {
            u.setFallen(true, true);
            sfx(st, u.side === 'pc' ? 'down' : 'death');
          }
          break;
        }
        case 'end':
          await this.settle();
          break;
        default:
          break;
      }
      await st.wait(PAUSE[e.kind] ?? 200);
    }
    await this.sync(E);
  }

  async cue(c) {
    const st = this.stage;
    const u = this.unit(c.who);
    if (!u) return;
    // what a reaction does is not named a second time under the same name
    this.said = c.kind === 'reaction' ? `${c.who}:${c.name}` : null;
    if (c.kind === 'legendary' || c.kind === 'lair') {
      // the action that follows is called out under this heading
      this.lead = { who: c.who, kind: c.kind, label: c.kind === 'lair' ? 'Lair' : 'Legendary' };
      u.callout(c.name, CUE_COLOR[c.kind]);
      u.flash(c.kind === 'lair' ? 0xc89bff : 0xffd27a);
      sfx(st, 'roar');
      await st.wait(380);
      return;
    }
    const other = c.at && this.unit(c.at);
    u.callout(c.name, CUE_COLOR.reaction);
    u.flash(0x9fd0ff);
    if (/counterspell/i.test(c.name) && other) {
      // the counter flies at the caster; the save and the outcome follow as their own events
      sfx(st, 'cast');
      u.pose('magic').then(() => u.rest());
      await st.wait(220);
      await st.bolt(u, other, 0xb48cff);
      other.flash(0xb48cff);
      await st.wait(200);
      return;
    }
    sfx(st, c.spell ? 'cast' : 'cond');
    // a spell is cast; anything else is a braced stance held for a moment
    if (u.fallen) await st.wait(380);
    else if (c.spell) {
      u.pose('magic').then(() => u.rest());
      await st.wait(380);
    } else {
      u.pose('guard');
      await st.wait(380);
      u.rest();
    }
  }

  // The colour of the first typed damage that follows event i, before the next action starts.
  colorAhead(events, i) {
    for (let j = i + 1; j < events.length && events[j].kind !== 'act' && events[j].kind !== 'turn'; j++) {
      const types = events[j].kind === 'dmg' && events[j].data ? events[j].data.types : [];
      const t = types.find((x) => TYPE_COLOR[x]);
      if (t) return TYPE_COLOR[t];
    }
    return 0xffffff;
  }

  // A lasting emanation shows as a ring under its caster for as long as it is up.
  auras(E) {
    for (const c of E.list) {
      const u = this.unit(c.id);
      if (!u) continue;
      // a druid in another shape is drawn as that shape
      u.setForm(c.form && c.tpl.forms && c.tpl.forms[c.form] ? c.tpl.forms[c.form] : null);
      const f = !c.dead && !c.down && !c.fled ? c.fx.find((x) => x.aura) : null;
      const type = f && Array.isArray(f.aura.dmg) && f.aura.dmg[0] ? f.aura.dmg[0][1] : null;
      u.auraName = f ? f.name : null;
      u.setAura(f ? TYPE_COLOR[type] || 0xe8dfc8 : null);
      u.setStatus(c.dead || c.fled ? [] : c.fx.filter((x) => x.cond).map((x) => x.cond));
    }
  }

  damage(d, big) {
    const u = this.unit(d.tgt);
    if (!u) return;
    u.setHp(d.hp, d.maxHp, d.tempHp);
    u.hurt(d.amount, d.types, big);
    if (d.types.includes('fire')) sfx(this.stage, 'fire');
    if (big || d.amount >= d.maxHp * 0.25) this.stage.cameras.main.shake(140, 0.007);
  }

  async strike(d, dmg) {
    const st = this.stage;
    const att = this.unit(d.att);
    const tgt = this.unit(d.tgt);
    if (!att || !tgt) {
      for (const x of dmg) this.damage(x.data, d.crit);
      return;
    }
    await this.settle(att);
    if (d.melee) await att.closeOn(tgt);
    sfx(st, d.melee ? 'swing' : 'shoot');
    let landed;
    const done = new Promise((r) => (landed = r));
    const land = async () => {
      if (!d.melee) {
        const type = dmg.length ? dmg[0].data.types.find((t) => TYPE_COLOR[t]) : null;
        await st.bolt(att, tgt, TYPE_COLOR[type] || 0xffffff);
      }
      if (d.hit) {
        sfx(st, d.crit ? 'crit' : d.melee ? (att.isSheet ? 'slash' : 'hit') : 'thud');
        if (d.crit) tgt.popup('Critical', '#ffd27a', 18);
        for (const x of dmg) this.damage(x.data, d.crit);
        if (!dmg.length) tgt.flash();
      } else {
        tgt.popup('Miss', '#b9b2a3', 20);
        sfx(st, 'miss');
        st.tweens.add({ targets: tgt.node, x: tgt.node.x - 14 * tgt.dir, duration: 80, yoyo: true });
      }
      landed();
    };
    await att.pose('attack', { onImpact: land });
    await done;
    att.rest();
  }

  // After the events are shown, make the stage agree with the engine: bars, the fallen, arrivals
  // and departures. This also covers anything a text-only event changed.
  async sync(E) {
    const st = this.stage;
    await st.arrange(E.list);
    for (const c of E.list) {
      const u = this.unit(c.id);
      if (!u) continue;
      if (c.fled && !u.gone) { u.leave(); continue; }
      u.setHp(c.hp, c.maxHp, c.tempHp);
      u.setFallen(c.dead || c.down || c.hp <= 0, c.dead);
    }
    this.auras(E);
    const cur = E.pending && E.pending.actor;
    st.markTurn(cur ? this.unit(cur.id) : null);
  }
}
