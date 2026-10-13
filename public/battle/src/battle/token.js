// A battler with no sprite sheet: a framed portrait, or a monogram when there is no portrait.
// It answers the same pose() calls as a sheet battler, with slides, shakes and flashes.

export function preloadPortrait(scene, img) {
  if (img && !scene.textures.exists(img)) scene.load.image(img, `assets/${img}`);
}

export class TokenBattler {
  constructor(scene, { img, name }, x, y, side, size = 96) {
    this.scene = scene;
    this.home = { x, y };
    this.dir = side === 'pc' ? 1 : -1;
    const rim = side === 'pc' ? 0x7fa7d8 : 0xc8643c;
    const kids = [scene.add.rectangle(0, -size / 2, size + 8, size + 8, rim)];
    if (img && scene.textures.exists(img)) {
      this.face = scene.add.image(0, -size / 2, img).setDisplaySize(size, size);
    } else {
      this.face = scene.add.rectangle(0, -size / 2, size, size, 0x2a2733);
      const initials = name.replace(/[^A-Za-z ]/g, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
      kids.push(scene.add.text(0, -size / 2, initials.toUpperCase(), { fontFamily: 'Cinzel, serif', fontSize: size * 0.42, color: '#e8dfc8' }).setOrigin(0.5));
    }
    kids.splice(1, 0, this.face);
    this.node = scene.add.container(x, y, kids);
    this.height = size + 16;
    this.mid = this.height / 2;
  }

  tween(cfg) {
    return new Promise((resolve) => this.scene.tweens.add({ targets: this.node, ...cfg, onComplete: resolve }));
  }

  pose(name, { onImpact } = {}) {
    const n = this.node;
    if (name === 'attack' || name === 'skill' || name === 'item') {
      return this.tween({ x: n.x + 26 * this.dir, duration: 90, yoyo: true, ease: 'Quad.easeOut', onYoyo: () => onImpact && onImpact() });
    }
    if (name === 'magic') {
      return this.tween({ scale: 1.12, duration: 220, yoyo: true, onYoyo: () => onImpact && onImpact() });
    }
    if (name === 'damage') {
      return this.tween({ x: n.x - 8 * this.dir, duration: 45, yoyo: true, repeat: 2 });
    }
    if (name === 'dead') {
      return this.tween({ angle: -80 * this.dir, duration: 300 });
    }
    if (name === 'idle') {
      n.setAlpha(1);
      n.setAngle(0);
    }
    return Promise.resolve();
  }
}
