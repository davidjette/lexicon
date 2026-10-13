// Sound for the battle screen. Effects are short CC0 clips in assets/sfx (credits there), keyed
// by cue so a clip can be swapped in one place. Music is optional: it plays only when a music/
// folder beside the page holds a manifest.json. That folder is not committed here; the battle demo
// (tools/publish_battle.mjs) carries its rendered tracks.

// cue -> clips; one is picked at random each time
const SFX = {
  swing: ['swing1', 'swing2'],
  hit: ['hit1', 'hit2', 'hit3'],
  slash: ['slash1', 'slash2', 'slash3'],
  crit: ['crit1', 'crit2'],
  miss: ['miss1', 'miss2'],
  shoot: ['shoot1'],
  thud: ['thud1'],
  cast: ['cast1', 'cast2'],
  fire: ['fire1', 'fire2', 'fire3'],
  heal: ['heal1'],
  cond: ['cond1'],
  down: ['down1'],
  death: ['death1'],
  hurt: ['hurt1', 'hurt2'],
  roar: ['roar1'],
  step: ['step1', 'step2', 'step3'],
  turn: ['turn1'],
  round: ['round1'],
  click: ['click1'],
  select: ['select1'],
  back: ['back1'],
  endturn: ['endturn1'],
  error: ['error1'],
};
const QUIET = { step: 0.5, turn: 0.35, cond: 0.5, hurt: 0.6, swing: 0.7 };

const saved = JSON.parse(localStorage.getItem('battle-audio') || '{}');
export const audio = { sfx: saved.sfx ?? 0.7, music: saved.music ?? 0.5, manifest: null, track: null, cue: null };

export function setVolume(kind, v) {
  audio[kind] = v;
  localStorage.setItem('battle-audio', JSON.stringify({ sfx: audio.sfx, music: audio.music }));
  if (kind === 'music' && audio.track) audio.track.setVolume(v);
}

export function preloadSfx(scene) {
  for (const clip of new Set(Object.values(SFX).flat())) scene.load.audio(clip, `assets/sfx/${clip}.ogg`);
}

export function sfx(scene, cue) {
  const clips = SFX[cue];
  if (!clips || audio.sfx <= 0) return;
  const clip = clips[Math.floor(Math.random() * clips.length)];
  if (scene.cache.audio.exists(clip)) scene.sound.play(clip, { volume: audio.sfx * (QUIET[cue] ?? 1) });
}

// music/manifest.json: { "battle": ["a.ogg"], "boss": [...], "victory": [...], "defeat": [...] }
export async function loadMusic() {
  try {
    const r = await fetch('music/manifest.json', { cache: 'no-store' });
    if (r.ok) audio.manifest = await r.json();
  } catch { /* no music folder */ }
  return audio.manifest;
}

// Switches to a track for the cue, fading the old one out. A cue with no tracks stops the music.
export function playMusic(scene, cue, { loop = true } = {}) {
  if (audio.cue === cue) return;
  audio.cue = cue;
  const old = audio.track;
  if (old) scene.tweens.add({ targets: old, volume: 0, duration: 600, onComplete: () => old.destroy() });
  audio.track = null;
  const list = (audio.manifest && audio.manifest[cue]) || [];
  if (!list.length) return;
  const file = list[Math.floor(Math.random() * list.length)];
  const key = `music:${file}`;
  const start = () => {
    if (audio.cue !== cue) return;
    audio.track = scene.sound.add(key, { loop, volume: audio.music });
    audio.track.play();
  };
  if (scene.cache.audio.exists(key)) return start();
  scene.load.audio(key, `music/${file}`);
  scene.load.once(`filecomplete-audio-${key}`, start);
  scene.load.start();
}
