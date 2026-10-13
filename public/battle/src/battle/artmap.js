// Which sprite sheet stands in for a creature, and how big it is drawn. Nothing here touches the
// renderer, so tools/art_coverage.mjs can print the whole assignment from the command line.
// Art credits: assets/battlers/CREDITS.txt.

// layers are drawn in order; every layer of a sheet shares the same grid.
// Each sprite comes in several colour versions (1a, 1b, 2c and so on); a weapon has its own.
const hero = (name, weapon, v = '1a', wv = v) => ({ layout: 'holder', layers: weapon ? [`${name}-${wv}-${weapon}`, `${name}-${v}`, `${name}-${wv}-${weapon}-above`] : [`${name}-${v}`] });
const foe = (name, extra = {}, v = '1a') => ({ layout: 'holder', layers: [`${name}-${v}`], ...extra });

export const SHEETS = {
  graham: hero('graham', 'axe'),
  ulric: hero('ulric', 'axe'),
  violet: hero('violet', 'crossbow'),
  sally: hero('sally', 'wand'),
  james: hero('james'),
  kai: hero('kai'),
  zombie: foe('zombie'),
  treant: foe('treant'),
  slime: foe('slime'),
  bat: foe('bat'),
  hobgob: foe('hobgob'),
  genie: foe('genie'),
  fairy: foe('fairy'),
  creeps: foe('creeps'),
  spore: foe('spore'),
  frog: foe('frog'),
  // named by a creature (battler: '...'), never matched by class or name
  general: hero('graham', 'axe', '1b'),
  witch: hero('sally', 'wand', '2c', '1c'),
  // the bat in its red colours, drawn large; it flies, so its body is well above its feet
  firebird: foe('bat', { scale: 1.7, tall: 72, mid: 58 }, '1g'),
  // characters with a sheet of their own, built by tools/sprite_kit.py from sprites/recipes/
  esther: hero('esther', 'sword'),
  uriel: hero('uriel', 'staff'),
  urielB: hero('uriel', 'staff', '1b'),
  urielC: hero('uriel', 'staff', '1c'),
  urielD: hero('uriel', 'staff', '1d'),
  dove: hero('dove', 'staff'),
  doveWhite: hero('dove', 'staff', '1b'),
  doveRed: hero('dove', 'staff', '1c'),
  doveKnight: hero('dove', 'axe', '2a'),
  locke: hero('locke'),
  lebeefe: hero('lebeefe'),
  gemma: hero('gemma', 'sword'),
  eric: hero('eric'),
  dario: hero('dario', 'sword'),
  guardian: hero('guardian', 'sword'),
  faith: hero('faith'),
  malrik: hero('malrik'),
  hallorn: hero('hallorn'),
  eden: hero('eden', 'blade'),
  priest: foe('priest'),
  husk: foe('husk'),
  doveElder: hero('dove', 'staff', '1d'),
  risen: hero('risen'),
  // the one sheet with wider frames
  asimole: foe('asimole', { cellW: 192, footX: 96, scale: 0.45 }),
};

// A template may name a sheet outright (tpl.battler; null asks for a token). Otherwise characters
// are matched on their class line, and everything else on its name, then its type, then a class
// line if it has one. A creature with its own portrait keeps the portrait. No match means the
// creature is drawn as a portrait or monogram token.
const BY_CLASS = [
  [/paladin|fighter|barbarian/i, 'graham'],
  [/cleric/i, 'ulric'],
  [/ranger|rogue|artificer/i, 'violet'],
  [/wizard|sorcerer|warlock|bard/i, 'sally'],
  [/monk/i, 'kai'],
  [/druid/i, 'james'],
];
// characters with a sheet of their own are matched on their name before their class line
const BY_HERO = [
  [/^gemma corso/i, 'gemma'],
  [/^chancellor eric/i, 'eric'],
  [/dario argentino/i, 'dario'],
  [/^esther crona/i, 'esther'],
  [/^uriel qualanthri/i, 'uriel'],
  [/^locke pierce/i, 'locke'],
  [/lebeouf|lebeefe/i, 'lebeefe'],
];
const BY_NAME = [
  [/zombie|ghoul|ghast|wight|mummy|skeleton|infected/i, 'zombie'],
  [/treant|blight|shambling|awakened tree/i, 'treant'],
  [/ooze|slime|jelly|pudding|gelatinous/i, 'slime'],
  [/\bbat\b|stirge|\bimp\b/i, 'bat'],
  [/goblin|bugbear|\borc\b|kobold/i, 'hobgob'],
  [/djinni|efreeti|genie|marid|\bdao\b|air elemental|water elemental/i, 'genie'],
  [/pixie|sprite|dryad/i, 'fairy'],
  [/shadow|wraith|specter|spectre|ghost|banshee/i, 'creeps'],
  [/myconid|shrieker|fungus/i, 'spore'],
  [/frog|toad|bullywug|slaad/i, 'frog'],
  [/hell hound|fire elemental|earth elemental|magmin|salamander/i, 'asimole'],
  // people without a class line
  [/knight|gladiator|champion/i, 'graham'],
  [/bandit|thug|guard|veteran|soldier|priest|acolyte/i, 'ulric'],
  [/assassin|\bspy\b|scout|archer|hunter/i, 'violet'],
  [/mage|cultist|cult fanatic|warlock|wizard|sorcerer/i, 'sally'],
];
const BY_TYPE = { ooze: 'slime' };

function byClass(line) {
  // the first class named on the line is the main one
  let best = null;
  for (const [re, id] of BY_CLASS) {
    const m = re.exec(line);
    if (m && (!best || m.index < best.at)) best = { at: m.index, id };
  }
  return best ? best.id : null;
}

export function sheetFor(tpl) {
  if (tpl.battler !== undefined) return SHEETS[tpl.battler] ? tpl.battler : null;
  if (tpl.pc || tpl.hero) {
    const own = BY_HERO.find(([re]) => re.test(tpl.name || ''));
    return own ? own[1] : byClass(`${tpl.sub || ''}`);
  }
  if (tpl.img) return null;
  for (const [re, id] of BY_NAME) if (re.test(tpl.name || '')) return id;
  if (BY_TYPE[tpl.type]) return BY_TYPE[tpl.type];
  // a villain's line reads "Wizard 18 · the Arcaneum"; a monster's reads "CR 5 · giant · SRD"
  return /^CR\b/.test(tpl.sub || '') ? null : byClass(`${tpl.sub || ''}`);
}

// How much bigger than a person a creature is drawn. Small and Tiny creatures are not shrunk:
// the sheets for them are already small in the frame.
const SIZE = { large: 1.3, huge: 1.6, gargantuan: 1.9 };
export const sizeFactor = (tpl) => SIZE[tpl.size] || 1;
// a sheet drawn larger than the rest in its frame is scaled down to match them
export const sheetScale = (id) => (SHEETS[id] && SHEETS[id].scale) || 1;
