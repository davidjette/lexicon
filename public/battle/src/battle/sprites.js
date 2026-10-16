// Sprite sheets for the battle screen. A sheet is a grid with one pose per row; a pose table
// says which row, whether it loops, and how fast it plays. Art credits: assets/battlers/CREDITS.txt.

import * as Phaser from '../../vendor/phaser.esm.min.js?v=mvab2y30';
import { SHEETS } from './artmap.js?v=mvab2y30';

// Holder's Animated Battlers: 4 frames per pose in 160 px cells, 14 rows. The last row is the
// artist's credit panel, not a pose. Sprites are drawn facing left. A sheet with wider frames
// says so itself (cellW and footX in artmap.js).
const HOLDER = {
  cols: 4,
  rows: 14,
  cellW: 160,
  cellH: 160,
  footX: 80,
  footY: 142,
  faces: 'left',
  poses: {
    idle: { row: 0, loop: true, fps: 5 },
    guard: { row: 1, loop: true, fps: 5 },
    abnormal: { row: 2, loop: true, fps: 5 },
    damage: { row: 3, fps: 8 },
    attack: { row: 4, fps: 10, impact: 2 },
    item: { row: 5, fps: 6, impact: 2 },
    skill: { row: 6, fps: 8, impact: 2 },
    magic: { row: 7, fps: 5, impact: 2 },
    advance: { row: 8, loop: true, fps: 8 },
    escape: { row: 9, loop: true, fps: 8 },
    victory: { row: 10, loop: true, fps: 5 },
    enter: { row: 11, fps: 5 },
    dead: { row: 12, loop: true, fps: 5 },
  },
};

export const LAYOUTS = { holder: HOLDER };

const DIR = 'assets/battlers/';

export function preloadAllSheets(scene) {
  for (const id of Object.keys(SHEETS)) preloadSheet(scene, id);
}

export function preloadSheet(scene, id) {
  const s = SHEETS[id];
  const L = LAYOUTS[s.layout];
  for (const file of s.layers) {
    if (!scene.textures.exists(file)) {
      scene.load.spritesheet(file, `${DIR}${file}.png`, { frameWidth: s.cellW || L.cellW, frameHeight: L.cellH });
    }
  }
}

export function createAnims(scene, id) {
  const s = SHEETS[id];
  const L = LAYOUTS[s.layout];
  for (const file of s.layers) {
    scene.textures.get(file).setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const [pose, p] of Object.entries(L.poses)) {
      const key = `${file}:${pose}`;
      if (scene.anims.exists(key)) continue;
      const start = p.row * L.cols;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(file, { start, end: start + L.cols - 1 }),
        frameRate: p.fps,
        repeat: p.loop ? -1 : 0,
      });
    }
  }
}

// A battler drawn from a sprite sheet. `side` is 'pc' (stands on the left, looks right) or
// 'monster' (stands on the right, looks left).
export class SheetBattler {
  constructor(scene, id, x, y, side, scale = 2) {
    this.scene = scene;
    this.sheet = SHEETS[id];
    this.layout = LAYOUTS[this.sheet.layout];
    this.home = { x, y };
    const L = this.layout;
    const flip = (side === 'pc') === (L.faces === 'left');
    this.dir = side === 'pc' ? 1 : -1;
    this.parts = this.sheet.layers.map((file) => {
      const sp = scene.add.sprite(0, 0, file, 0);
      sp.setOrigin((this.sheet.footX || L.footX) / (this.sheet.cellW || L.cellW), L.footY / L.cellH);
      return sp;
    });
    this.node = scene.add.container(x, y, this.parts);
    this.node.setScale(flip ? -scale : scale, scale);
    // height: feet to the top of the head. mid: feet to the middle of the body, where a blow lands.
    this.height = (this.sheet.tall || 75) * scale;
    this.mid = (this.sheet.mid || 37) * scale;
    createAnims(scene, id);
    this.pose('idle');
  }

  // Colours every layer (a condition's tint); null clears it.
  tint(color) {
    for (const sp of this.parts) {
      if (color === null) sp.clearTint();
      else sp.setTint(color);
    }
  }

  // Plays a pose on every layer. Resolves when a one-shot pose ends (at once for a loop).
  // onImpact fires on the pose's impact frame, where the blow lands.
  pose(name, { onImpact } = {}) {
    const p = this.layout.poses[name];
    const body = this.parts[0];
    body.off('animationupdate');
    body.off('animationcomplete');
    for (const sp of this.parts) sp.play(`${sp.texture.key}:${name}`);
    if (p.loop) return Promise.resolve();
    return new Promise((resolve) => {
      let hit = false;
      const impact = () => {
        if (!hit && onImpact) onImpact();
        hit = true;
      };
      body.on('animationupdate', (anim, frame) => {
        if (frame.index - 1 >= (p.impact ?? 99)) impact();
      });
      body.once('animationcomplete', () => {
        impact();
        body.off('animationupdate');
        resolve();
      });
    });
  }
}
