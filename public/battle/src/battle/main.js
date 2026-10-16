// The battle screen: the same engine and the same fights as the encounter builder, played out
// on a stage. This file owns the page controls and the step loop.
import { Encounter } from '../engine/combat.js?v=mvacy1e5';
import { DEFAULT_RULES } from '../engine/rules.js?v=mvacy1e5';
import { switchDefaults } from '../data/encounters.js?v=mvacy1e5';
import { PRESETS } from '../data/registry.js?v=mvacy1e5';
import { rowsFromPreset, setupFromState } from '../data/build.js?v=mvacy1e5';
import { findPack, unlock, installTexts } from '../dm-loader.js?v=mvacy1e5';
import { makeGame, BACKGROUNDS } from './stage.js?v=mvacy1e5';
import { Director } from './director.js?v=mvacy1e5';
import { Hud } from './hud.js?v=mvacy1e5';
import { renderParty } from './party.js?v=mvacy1e5';
import { audio, setVolume, loadMusic, playMusic } from './audio.js?v=mvacy1e5';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// A demo copy of the page (<html data-demo="id,id,...">) offers those fights and nothing else.
const DEMO = (document.documentElement.dataset.demo || '').split(',').filter(Boolean);

const { game, stage } = makeGame('stage');
const director = new Director(stage, { onEvent: showEvent });
const hud = new Hud($('hud'), stage);
let enc = null;
let shown = 0; // how many engine events have been played
let busy = false;
let playing = false;
let fightNo = 0;

const RESULT = { victory: 'Victory', defeat: 'Defeat', escaped: 'Escaped', timeout: 'Out of time', withdrew: 'Withdrawn' };

function showEvent(e) {
  if (e.kind !== 'init') $('caption').textContent = e.text.trim();
  const line = document.createElement('div');
  line.className = `log-line k-${e.kind}`;
  line.textContent = e.text;
  $('log').append(line);
  $('log').scrollTop = $('log').scrollHeight;
}

// A fight sent over from the builder page ("Battle screen" button there).
const BUILDER = '@builder';
function builderFight() {
  try {
    const f = JSON.parse(localStorage.getItem('battle-fight') || 'null');
    return f && Array.isArray(f.rows) ? f : null;
  } catch { return null; }
}

function stateFor(presetId) {
  if (presetId === BUILDER) return builderFight();
  const p = PRESETS.find((x) => x.id === presetId);
  const sw = switchDefaults(p);
  const flags = p.scenario(sw).flags || {};
  return { presetId, sw, rows: rowsFromPreset(presetId, sw), rules: { ...DEFAULT_RULES, ...(p.rules || {}) }, flags: { focusBoss: !!flags.focusBoss }, prebuffs: { herosFeast: false } };
}

function fillPresets() {
  const sel = $('preset');
  const keep = sel.value || (params.get('from') === 'builder' ? BUILDER : params.get('preset')) || 'replaySummit';
  const sent = builderFight();
  const count = (side) => sent.rows.filter((r) => r.side === side).length;
  sel.replaceChildren(
    ...(sent ? [new Option(`From the builder: ${count('pc')} against ${count('monster')}`, BUILDER)] : []),
    ...PRESETS.filter((p) => (DEMO.length ? DEMO.includes(p.id) : p.id !== 'blank')).map((p) => new Option(`${p.dm ? 'DM · ' : ''}${p.name || p.id}`, p.id)));
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

async function playNew() {
  const mine = fightNo;
  const events = enc.events.slice(shown);
  shown = enc.events.length;
  await director.play(events, enc);
  if (mine === fightNo) renderParty($('party'), enc);
  if (mine === fightNo && enc.over) {
    setPlaying(false);
    playMusic(stage, enc.result === 'victory' ? 'victory' : 'defeat', { loop: false });
    // whoever holds the field celebrates
    const winners = enc.result === 'victory' ? 'pc' : enc.result === 'defeat' ? 'monster' : null;
    for (const u of stage.units.values()) if (u.side === winners) u.cheer();
    await stage.showBanner(RESULT[enc.result] || enc.result, 1600);
  }
}

// The staging screen: the fights on offer down the middle, and the two sides of the chosen one
// standing on the plain field. Nothing is rolled until Fight! is pressed.
async function showSelect() {
  fightNo += 1;
  setPlaying(false);
  hud.cancel();
  while (busy) await stage.wait(50);
  const mine = fightNo;
  enc = null;
  renderParty($('party'), null);
  $('log').replaceChildren();
  fillPresets();
  const play = $('mode').value === 'play';
  $('pick-play').classList.toggle('ghost', !play);
  $('pick-watch').classList.toggle('ghost', play);
  $('select-list').replaceChildren(...[...$('preset').options].map((o) => {
    const b = document.createElement('button');
    b.className = o.value === $('preset').value ? 'btn chosen' : 'btn ghost';
    b.textContent = o.text;
    b.onclick = () => { $('preset').value = o.value; showSelect(); };
    return b;
  }));
  $('select').hidden = false;
  playMusic(stage, 'menu');
  // line both sides up as they will start
  stage.clear();
  stage.hideBackground();
  $('caption').textContent = '';
  let ok = true;
  try {
    const staged = new Encounter(setupFromState(stateFor($('preset').value), 1));
    if (mine === fightNo) await stage.arrange(staged.list);
  } catch {
    ok = false;
    $('caption').textContent = 'This fight could not be set up. If it uses DM creatures, unlock the DM pack on the builder page first.';
  }
  $('fight').disabled = !ok;
}

// The music for a fight: the track that belongs to the place if it has one (music/cues.json,
// "bg:<file name>"), otherwise the boss or battle theme.
function fightCue(place) {
  const own = place && `bg:${place.replace('.webp', '')}`;
  if (own && audio.manifest && (audio.manifest[own] || []).length) return own;
  return enc && enc.list.some((c) => c.side === 'monster' && (c.tpl.boss || c.tpl.leg)) ? 'boss' : 'battle';
}

async function newFight() {
  $('select').hidden = true;
  fightNo += 1;
  setPlaying(false);
  hud.cancel();
  while (busy) await stage.wait(50);
  busy = true;
  const mine = fightNo;
  stage.clear();
  $('log').replaceChildren();
  $('caption').textContent = '';
  const seed = Math.max(1, +$('seed').value || 1);
  try {
    const state = stateFor($('preset').value);
    for (const rule of ['ranks', 'movement']) if ($(rule).checked) state.rules = { ...state.rules, [rule]: true };
    const setup = setupFromState(state, seed);
    if ($('mode').value === 'play') setup.control = { side: 'pc' };
    enc = new Encounter(setup).start();
  } catch {
    // a builder fight that names DM creatures, opened while the DM pack is locked
    enc = null;
    busy = false;
    $('caption').textContent = 'This fight could not be set up. If it uses DM creatures, unlock the DM pack on the builder page first.';
    return;
  }
  window.enc = enc;
  shown = 0;
  const fightPreset = PRESETS.find((p) => p.id === (stateFor($('preset').value) || {}).presetId);
  // a fight sent from the builder has no place of its own: it gets a background picked by its seed
  const anywhere = $('preset').value === BUILDER && BACKGROUNDS.length ? BACKGROUNDS[(+$('seed').value || 0) % BACKGROUNDS.length][0] : undefined;
  const place = $('bg').value || (fightPreset && fightPreset.bg) || anywhere;
  audio.cue = null;
  playMusic(stage, fightCue(place));
  await stage.setBackground(place);
  await stage.arrange(enc.list);
  await playNew();
  busy = false;
  if (mine === fightNo && $('mode').value === 'play') run();
}

// One engine step: the pending action resolves, and the stage plays what it produced.
async function advance() {
  if (!enc || enc.over || busy) return;
  busy = true;
  const mine = fightNo;
  try {
    // on a party member's turn in play mode, the engine waits for the player's pick
    if (enc.pending && enc.pending.human) {
      const choice = await hud.ask(enc, enc.pending.actor);
      if (mine !== fightNo) return;
      enc.setChoice(choice);
    }
    enc.step();
    await playNew();
  } finally {
    busy = false;
  }
}

function setPlaying(on) {
  playing = on;
  $('play').textContent = on ? 'Pause' : 'Play';
}

async function run() {
  if (playing) return setPlaying(false);
  setPlaying(true);
  while (playing && enc && !enc.over) {
    if (busy) await stage.wait(50);
    else await advance();
  }
  setPlaying(false);
}

async function tryDm() {
  try {
    // the public copy has no pack of its own; a fight sent from the builder may still need the builder's
    const found = (await findPack()) || (DEMO.length ? await findPack('../encounters/') : null);
    if (!found) return;
    const pass = found.kind === 'local' ? null : localStorage.getItem('encounters-dm-pass');
    if (found.kind !== 'local' && !pass) return;
    await installTexts(await unlock(found, pass));
    fillPresets();
  } catch { /* stays locked */ }
}

async function init() {
  await stage.ready;
  await document.fonts.ready;
  fillPresets();
  // the wider library and the DM pack have to be in before a builder fight can name them
  await import('../library/index.js?v=mvacy1e5').catch(() => {});
  await tryDm();
  fillPresets();
  // a link that names its fight wins over whatever the list fell back to while it was filling
  const asked = params.get('from') === 'builder' ? BUILDER : params.get('preset');
  if (asked && [...$('preset').options].some((o) => o.value === asked)) $('preset').value = asked;
  const sent = params.get('from') === 'builder' && builderFight();
  $('seed').value = params.get('seed') || (sent && sent.seed) || 1 + Math.floor(Math.random() * 99999);
  const speed = +params.get('speed') || 1;
  $('speed').value = String(speed);
  stage.setSpeed(speed);
  $('speed').onchange = () => stage.setSpeed(+$('speed').value);
  for (const kind of ['sfx', 'music']) {
    $(kind).value = audio[kind];
    $(kind).oninput = () => setVolume(kind, +$(kind).value);
  }
  // the music slider only shows where there is music to play
  if (!(await loadMusic())) $('music').parentElement.style.display = 'none';
  $('new').onclick = newFight;
  $('preset').onchange = () => ($('select').hidden ? newFight() : showSelect());
  $('fight').onclick = newFight;
  $('mode').value = params.get('mode') || 'play';
  $('mode').onchange = newFight;
  $('step').onclick = () => { setPlaying(false); advance(); };
  $('play').onclick = run;
  $('reseed').onclick = () => { $('seed').value = 1 + Math.floor(Math.random() * 99999); newFight(); };
  $('menu').onclick = showSelect;
  for (const rule of ['ranks', 'movement']) {
    // on unless the player has turned it off here before
    $(rule).checked = localStorage.getItem(`battle-${rule}`) !== '0';
    $(rule).onchange = () => { localStorage.setItem(`battle-${rule}`, $(rule).checked ? '1' : '0'); if (enc) newFight(); };
  }
  $('bg').append(...BACKGROUNDS.map(([file, name]) => new Option(name, file)));
  $('bg').onchange = () => {
    stage.setBackground($('bg').value || undefined);
    if (enc && !enc.result && $('bg').value) playMusic(stage, fightCue($('bg').value));
  };
  for (const m of ['play', 'watch']) $(`pick-${m}`).onclick = () => { $('mode').onchange = null; $('mode').value = m; $('mode').onchange = newFight; showSelect(); };
  // a link that names its fight goes straight in; otherwise the page opens on the selection screen
  if (params.get('auto') || params.get('preset') || params.get('from') || params.get('seed')) {
    await newFight();
    if (params.get('auto')) run();
  } else await showSelect();
}

window.battle = { game, stage, director, hud, get enc() { return enc; } };
init();
