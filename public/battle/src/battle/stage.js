// The battlefield: six columns (party Back, Mid, Front on the left; opposition Front, Mid, Back on
// the right) and one Unit per combatant. A Unit is a battler plus its name, hit point bar and the
// small effects every battler shares. The engine has no coordinates; the columns come from each
// combatant's side and line.
import * as Phaser from '../../vendor/phaser.esm.min.js';
import { preloadAllSheets, SheetBattler } from './sprites.js';
import { sheetFor, sizeFactor, sheetScale } from './artmap.js';
import { TokenBattler } from './token.js';
import { preloadSfx, sfx } from './audio.js';

export const W = 1200;
export const H = 675;
const COLS = { pc: { back: 110, mid: 270, front: 430 }, monster: { front: 770, mid: 930, back: 1090 } };
// where feet may stand. A background is a 16:9 picture whose ground starts about 60% of the way
// down, so the lines of battlers sit on it.
const TOP = 412;
const BOTTOM = 612;
// A fight names its own picture with `bg: 'file.webp'` on the preset (in assets/backgrounds/).
export const DEFAULT_BG = 'forest-clearing.webp';
// the pictures on offer in the page's Background list
export { BACKGROUNDS } from './backgrounds.js';

export const TYPE_COLOR = {
  fire: 0xff8a3c, cold: 0x9fd8ff, lightning: 0xffe45c, thunder: 0x7fe0d0, acid: 0xb6e04a, poison: 0x7ac74f,
  necrotic: 0xa070d8, radiant: 0xffe9a0, psychic: 0xff8ad0, force: 0xc49bff,
};
// The tint a condition gives its victim. Where several apply, the first in this list shows.
export const STATUS_COLOR = {
  petrified: 0x9a9aa4, paralysed: 0xf0e070, stunned: 0xf0e070, unconscious: 0x9a9aa4, incapacitated: 0xf0e070,
  dominated: 0xf49ad0, charmed: 0xf49ad0, restrained: 0xe0a050, grappled: 0xe0a050, speed0: 0xe0a050, grounded: 0xe0a050,
  frightened: 0xb890f0, poisoned: 0x8fe070, blinded: 0x8088a0, slowed: 0x8ab8f0,
};
const STATUS_ORDER = Object.keys(STATUS_COLOR);
// how far a type's sparks drift up (negative) or down as they fly
const TYPE_DRIFT = { fire: -46, radiant: -46, necrotic: -24, cold: 40, acid: 46, poison: 46 };
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export class Unit {
  constructor(scene, c, x, y) {
    this.scene = scene;
    this.id = c.id;
    this.side = c.side;
    this.name = c.name;
    const sheet = sheetFor(c.tpl);
    const big = sizeFactor(c.tpl);
    this.b = sheet
      ? new SheetBattler(scene, sheet, x, y, c.side, 2 * big * sheetScale(sheet))
      : new TokenBattler(scene, { img: c.tpl.img, name: c.name }, x, y, c.side, Math.round(76 * big));
    this.isSheet = !!sheet;
    // half the width it takes up on the field, for clicks and for standing beside it
    this.half = Math.round(52 * big);
    this.node = this.b.node;
    this.dir = this.b.dir;
    this.home = { x, y };
    this.away = false;
    this.fallen = false;
    this.label = scene.add.text(x, y + 6, c.name, { fontFamily: 'EB Garamond, serif', fontSize: 15, color: '#d9d2c0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0);
    this.barBack = scene.add.rectangle(x, y + 28, 74, 7, 0x000000).setStrokeStyle(1, 0x5a5466);
    this.bar = scene.add.rectangle(x - 36, y + 28, 72, 5, 0x6fbf5f).setOrigin(0, 0.5);
    this.hpText = scene.add.text(x, y + 34, '', { fontFamily: 'EB Garamond, serif', fontSize: 13, color: '#b9b2a3' }).setOrigin(0.5, 0);
    this.setHp(c.hp, c.maxHp, c.tempHp);
    this.place();
  }

  // keeps the things drawn lower on the field in front
  place() {
    const d = Math.round(this.node.y);
    this.node.setDepth(d);
    for (const o of [this.label, this.barBack, this.bar, this.hpText]) o.setDepth(3000);
  }

  setHome(x, y) {
    this.home = { x, y };
    this.b.home = this.home;
    this.label.setPosition(x, y + 6);
    this.barBack.setPosition(x, y + 28);
    this.bar.setPosition(x - 36, y + 28);
    this.hpText.setPosition(x, y + 34);
    if (this.away) return this.place();
    // a change of rank is walked; small shuffles within a column just happen
    if (Math.abs(this.node.x - x) > 40 && !this.fallen) {
      this.b.pose('advance');
      this.scene.tweens.add({ targets: this.node, x, y, duration: 300, ease: 'Quad.easeOut', onComplete: () => { this.place(); this.rest(); } });
    } else {
      this.node.setPosition(x, y);
      this.place();
    }
  }

  setHp(hp, maxHp, tempHp = 0) {
    const f = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    this.scene.tweens.add({ targets: this.bar, scaleX: f, duration: 200 });
    this.bar.setFillStyle(f > 0.5 ? 0x6fbf5f : f > 0.25 ? 0xd9b24a : 0xc8503c);
    this.hpText.setText(this.side === 'pc' ? `${Math.max(0, hp)}/${maxHp}${tempHp ? ` +${tempHp}` : ''}` : '');
  }

  pose(name, o) {
    return this.b.pose(name, o);
  }

  move(x, y, ms = 240) {
    this.b.pose('advance');
    sfx(this.scene, 'step');
    return new Promise((r) =>
      this.scene.tweens.add({
        targets: this.node, x, y, duration: ms, ease: 'Quad.easeOut',
        onUpdate: () => this.node.setDepth(Math.round(this.node.y)),
        onComplete: r,
      }));
  }

  // steps up beside another unit, on the side it is facing
  async closeOn(other) {
    const x = other.node.x - (this.half + other.half - 18) * this.dir;
    const y = other.node.y + 2;
    if (Math.abs(this.node.x - x) < 4 && Math.abs(this.node.y - y) < 4) return;
    this.away = true;
    await this.move(x, y);
    this.rest();
  }

  async goHome() {
    if (!this.away) return;
    this.away = false;
    this.b.pose('escape');
    await new Promise((r) => this.scene.tweens.add({ targets: this.node, x: this.home.x, y: this.home.y, duration: 220, ease: 'Quad.easeOut', onComplete: r }));
    this.place();
    this.rest();
  }

  popup(text, color = '#ffffff', size = 26) {
    const s = this.scene;
    const n = (this.popups = (this.popups || 0) + 1);
    s.time.delayedCall(700, () => { this.popups -= 1; });
    const t = s.add.text(this.node.x + (n % 2 ? 0 : 22), this.node.y - this.b.height - 6 - (n - 1) * 20, text, { fontFamily: 'Cinzel, serif', fontSize: size, color, stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(5000);
    s.tweens.add({ targets: t, y: t.y - 46, alpha: 0, duration: 1000, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  // The name of what this combatant is doing, shown over its head for a moment.
  callout(text) {
    const s = this.scene;
    if (this.call) this.call.destroy();
    const t = s.add.text(this.node.x, this.node.y - this.b.height - 30, text, { fontFamily: 'Cinzel, serif', fontSize: 19, color: '#f3e7c4', backgroundColor: 'rgba(18, 15, 24, 0.86)', padding: { x: 10, y: 5 }, stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(5200);
    t.x = Math.max(t.width / 2 + 6, Math.min(W - t.width / 2 - 6, t.x));
    t.y = Math.max(t.height / 2 + 4, t.y);
    this.call = t;
    s.tweens.chain({ targets: t, tweens: [{ scale: { from: 0.8, to: 1 }, duration: 110 }, { alpha: 1, duration: 1250 }, { alpha: 0, duration: 300 }], onComplete: () => { t.destroy(); if (this.call === t) this.call = null; } });
  }

  // A lasting emanation (Spirit Guardians and the like): a ring on the ground that follows its
  // caster. null takes it away.
  setAura(color) {
    if (color === (this.auraColor ?? null)) return;
    this.auraColor = color;
    if (this.aura) { this.aura.destroy(); this.aura = null; }
    if (color === null) return;
    const k = Math.abs(this.node.scaleX) || 1;
    const ring = this.scene.add.ellipse(0, 0, 270 / k, 92 / k, color, 0.16).setStrokeStyle(3 / k, color, 0.85);
    this.node.addAt(ring, 0);
    this.scene.tweens.add({ targets: ring, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.aura = ring;
  }

  pulseAura() {
    if (!this.aura) return;
    this.scene.tweens.add({ targets: this.aura, scale: 1.25, duration: 160, yoyo: true });
  }

  flash(color = 0xffffff) {
    const s = this.scene;
    const g = s.add.circle(this.node.x, this.node.y - this.b.mid, 26, color, 0.85).setDepth(4000);
    s.tweens.add({ targets: g, scale: 2.4, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  // Sparks in the colour of the damage. Each type has its own way of flying: fire and radiant
  // rise, cold, acid and poison fall, the rest burst outward.
  sparks(type, color, n = 8) {
    const s = this.scene;
    const cy = this.node.y - this.b.mid;
    const lift = TYPE_DRIFT[type] ?? 0;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const far = 30 + Math.random() * 34;
      const g = s.add.rectangle(this.node.x, cy, 9, 9, color).setDepth(4100).setAngle(Math.random() * 90);
      s.tweens.add({ targets: g, x: g.x + Math.cos(a) * far, y: g.y + Math.sin(a) * far * (lift ? 0.5 : 1) + lift, alpha: 0.15, scale: 0.6, duration: 420 + Math.random() * 180, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
    }
  }

  hurt(amount, types = [], big = false) {
    const type = types.find((t) => TYPE_COLOR[t]);
    const col = TYPE_COLOR[type] || 0xffffff;
    this.flash(col);
    if (type) this.sparks(type, col, big ? 14 : 8);
    this.popup(String(amount), hex(col), big ? 36 : 28);
    if (!this.fallen && !this.prone) this.b.pose('damage').then(() => this.rest());
  }

  // The pose a unit holds when nothing is happening: lying down when fallen or prone, the ailing
  // pose under a condition, otherwise standing ready.
  rest() {
    this.b.pose(this.fallen || this.prone ? 'dead' : this.ailing ? 'abnormal' : 'idle');
  }

  setFallen(down, dead = false) {
    if (down !== this.fallen) {
      this.fallen = down;
      this.rest();
    }
    this.node.setAlpha(dead ? 0.4 : 1);
    this.label.setAlpha(dead ? 0.4 : 1);
  }

  // Conditions on the unit: it lies down while prone, and takes the colour of the worst one.
  setStatus(conds) {
    // a flyer brought down sits on the ground the same way
    const prone = conds.includes('prone') || conds.includes('grounded');
    const hit = STATUS_ORDER.find((k) => conds.includes(k));
    const color = hit ? STATUS_COLOR[hit] : null;
    if (color !== (this.statusColor ?? null)) {
      this.statusColor = color;
      this.b.tint(color);
    }
    if (prone !== !!this.prone || !!hit !== !!this.ailing) {
      this.prone = prone;
      this.ailing = !!hit;
      if (!this.away) this.rest();
    }
  }

  leave() {
    for (const o of [this.node, this.label, this.barBack, this.bar, this.hpText]) this.scene.tweens.add({ targets: o, alpha: 0, duration: 400 });
    this.gone = true;
  }
}

export class Stage extends Phaser.Scene {
  constructor() {
    super('stage');
    this.units = new Map();
    this.ready = new Promise((r) => (this.markReady = r));
  }

  preload() {
    preloadAllSheets(this);
    preloadSfx(this);
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x15131a);
    this.add.rectangle(W / 2, (TOP + BOTTOM) / 2 + 20, W, BOTTOM - TOP + 150, 0x211e29);
    this.add.rectangle(W / 2, TOP - 56, W, 2, 0x34303f);
    for (const [side, cols] of Object.entries(COLS)) {
      for (const [line, x] of Object.entries(cols)) {
        this.add.text(x, H - 14, line.toUpperCase(), { fontFamily: 'Spectral SC, serif', fontSize: 13, color: side === 'pc' ? '#9db8dc' : '#dc9a80', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(2);
      }
    }
    this.banner = this.add.text(W / 2, 46, '', { fontFamily: 'Cinzel, serif', fontSize: 30, color: '#e8dfc8', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(6000).setAlpha(0);
    this.turnMark = this.add.triangle(0, 0, -9, -8, 9, -8, 0, 6, 0xe8c66a).setDepth(5500).setVisible(false);
    this.tweens.add({ targets: this.turnMark, scaleY: 0.6, duration: 450, yoyo: true, repeat: -1 });
    this.pickRings = [];
    this.input.on('pointerdown', (p) => {
      if (!this.picking) return;
      const hit = this.picking.ids.map((id) => this.units.get(id)).filter((u) => u && Math.abs(p.worldX - u.node.x) < u.half && p.worldY < u.node.y + 40 && p.worldY > u.node.y - u.b.height - 10);
      hit.sort((a, b) => Math.abs(p.worldX - a.node.x) + Math.abs(p.worldY - (a.node.y - a.b.mid)) - Math.abs(p.worldX - b.node.x) - Math.abs(p.worldY - (b.node.y - b.b.mid)));
      if (hit.length) this.picking.take(hit[0].id);
    });
    this.markReady();
  }

  // Puts a picture behind the fight. A file that is not there falls back to the default picture.
  setBackground(file) {
    const name = file || DEFAULT_BG;
    const key = `bg:${name}`;
    const show = () => {
      if (!this.textures.exists(key)) return name === DEFAULT_BG ? undefined : this.setBackground(DEFAULT_BG);
      if (!this.bg) {
        this.bg = this.add.image(W / 2, H / 2, key).setDepth(1);
        // a light veil so battlers and their labels stand out from the picture
        this.veil = this.add.rectangle(W / 2, H / 2, W, H, 0x0c0a12, 0.18).setDepth(1);
      }
      this.bg.setTexture(key).setDisplaySize(W, H).setVisible(true);
      this.veil.setVisible(true);
    };
    if (this.textures.exists(key)) return Promise.resolve(show());
    return new Promise((resolve) => {
      this.load.image(key, `assets/backgrounds/${name}`);
      this.load.once('complete', () => resolve(show()));
      this.load.start();
    });
  }

  // The plain field, as on the staging screen before a fight begins.
  hideBackground() {
    if (this.bg) for (const o of [this.bg, this.veil]) o.setVisible(false);
  }

  // Marks the units the player may click as a target; null clears the marks.
  pick(ids, take) {
    for (const r of this.pickRings) r.destroy();
    this.pickRings = [];
    this.picking = ids ? { ids, take } : null;
    for (const id of ids || []) {
      const u = this.units.get(id);
      if (!u) continue;
      const r = this.add.ellipse(u.node.x, u.node.y - 2, u.half * 2 - 12, 26).setStrokeStyle(3, 0xe8c66a).setDepth(u.node.y - 1);
      this.tweens.add({ targets: r, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
      this.pickRings.push(r);
    }
  }

  setSpeed(x) {
    this.tweens.timeScale = x;
    this.time.timeScale = x;
    this.anims.globalTimeScale = x;
  }

  wait(ms) {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  loadPortraits(list) {
    const need = [...new Set(list.map((c) => (sheetFor(c.tpl) ? null : c.tpl.img)).filter((img) => img && !this.textures.exists(img)))];
    if (!need.length) return Promise.resolve();
    return new Promise((resolve) => {
      for (const img of need) this.load.image(img, `assets/${img}`);
      this.load.once('complete', resolve);
      this.load.start();
    });
  }

  // Lines every present combatant up in its column. New arrivals get a unit; the rest slide over.
  async arrange(list) {
    const here = list.filter((c) => !c.fled);
    await this.loadPortraits(here.filter((c) => !this.units.has(c.id)));
    const groups = {};
    for (const c of here) (groups[`${c.side}:${c.pos || 'front'}`] ||= []).push(c);
    for (const [key, group] of Object.entries(groups)) {
      const [side, line] = key.split(':');
      const x0 = (COLS[side] || COLS.monster)[line] ?? COLS[side].front;
      // up to three stand in a line, a little staggered; a bigger group zigzags in two files.
      // Bigger creatures get more room: the space between two neighbours follows their sizes.
      const crowd = group.length > 3;
      const room = group.slice(1).map((c, i) => (sizeFactor(c.tpl) + sizeFactor(group[i].tpl)) / 2);
      const total = room.reduce((a, b) => a + b, 0);
      const gap = Math.min(crowd ? 84 : 190, (BOTTOM - TOP) / Math.max(1, total));
      let y = (TOP + BOTTOM) / 2 - (gap * total) / 2;
      group.forEach((c, i) => {
        const sway = crowd ? 60 : group.length === 3 ? 22 : 0;
        const x = x0 + (i % 2 ? sway : -sway);
        if (i) y += gap * room[i - 1];
        const u = this.units.get(c.id);
        if (u) u.setHome(x, y);
        else {
          const nu = new Unit(this, c, x, y);
          nu.node.setAlpha(0);
          this.tweens.add({ targets: nu.node, alpha: 1, duration: 300 });
          this.units.get(c.id) || this.units.set(c.id, nu);
        }
      });
    }
  }

  clear() {
    for (const u of this.units.values()) for (const o of [u.node, u.label, u.barBack, u.bar, u.hpText, u.call]) if (o) o.destroy();
    this.units.clear();
    this.pick(null);
    this.turnMark.setVisible(false);
  }

  showBanner(text, hold = 700) {
    this.banner.setText(text).setAlpha(0);
    return new Promise((r) => this.tweens.chain({ targets: this.banner, tweens: [{ alpha: 1, duration: 160 }, { alpha: 1, duration: hold }, { alpha: 0, duration: 220 }], onComplete: r }));
  }

  markTurn(u) {
    if (!u) return this.turnMark.setVisible(false);
    this.turnMark.setPosition(u.home.x, u.home.y - u.b.height - 14).setVisible(true);
  }

  // An area effect landing: one patch of colour over everyone it catches.
  area(units, color = 0xffffff) {
    if (!units.length) return;
    const x0 = Math.min(...units.map((u) => u.node.x - u.half)) - 14;
    const x1 = Math.max(...units.map((u) => u.node.x + u.half)) + 14;
    const y0 = Math.min(...units.map((u) => u.node.y - u.b.height)) - 10;
    const y1 = Math.max(...units.map((u) => u.node.y)) + 22;
    const g = this.add.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) * 1.15, (y1 - y0) * 1.15, color, 0.3).setStrokeStyle(3, color, 0.9).setDepth(3900).setScale(0.6);
    this.tweens.chain({ targets: g, tweens: [{ scale: 1, duration: 170, ease: 'Quad.easeOut' }, { alpha: 0, duration: 620 }], onComplete: () => g.destroy() });
  }

  bolt(from, to, color = 0xffffff) {
    const g = this.add.circle(from.node.x + 30 * from.dir, from.node.y - from.b.mid, 7, color).setDepth(4500);
    return new Promise((r) => this.tweens.add({ targets: g, x: to.node.x, y: to.node.y - to.b.mid, duration: 170, onComplete: () => { g.destroy(); r(); } }));
  }
}

export function makeGame(parent) {
  const stage = new Stage();
  const game = new Phaser.Game({ type: Phaser.AUTO, parent, width: W, height: H, backgroundColor: '#15131a', scene: stage });
  return { game, stage };
}
