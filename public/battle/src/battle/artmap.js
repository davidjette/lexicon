// Which sprite sheet stands in for a creature, and how big it is drawn. Nothing here touches the
// renderer, so tools/art_coverage.mjs can print the whole assignment from the command line.
// Art credits: assets/battlers/CREDITS.txt.

// layers are drawn in order; every layer of a sheet shares the same grid.
// Each sprite comes in several colour versions (1a, 1b, 2c and so on); a weapon has its own.
const hero = (name, weapon, v = '1a', wv = v) => ({ layout: 'holder', layers: weapon ? [`${name}-${wv}-${weapon}`, `${name}-${v}`, `${name}-${wv}-${weapon}-above`] : [`${name}-${v}`] });
// a sheet whose files do not follow the name-version-weapon pattern
const own = (...layers) => ({ layout: 'holder', layers });
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
  roland: hero('roland'),
  cuthbert: hero('cuthbert'),
  stcloud: hero('stcloud'),
  valen: hero('valen'),
  celion: hero('celion'),
  kara: own('kara-staff', 'kara', 'kara-staff-above'),
  revan: hero('revan', 'sword'),
  magnus: own('magnus-axe', 'magnus', 'magnus-axe-above'),
  xiii: own('xiii'),
  zanzibar: hero('zanzibar', 'sword'),
  darkzanzibar: hero('darkzanzibar', 'sword'),
  yoshi: own('graham-1b-axe', 'yoshi-1a', 'graham-1b-axe-above'),
  arana: hero('arana', 'blade'),
  drefan: hero('drefan'),
  stoth: hero('stoth'),
  brownsleeves: hero('brownsleeves'),
  anders: hero('anders'),
  francesco: hero('francesco'),
  gabriella: hero('gabriella', 'sword'),
  dolores: hero('dolores', 'blade'),
  oshi: hero('oshi'),
  scrunt: hero('scrunt'),
  bullseye: hero('bullseye'),
  // Starfall: the crew of Astral Command, in uniform by division
  jim: hero('jim'),
  barrias: hero('barrias', 'sword'),
  buttsack: foe('buttsack', { scale: 1.1 }),
  carlos: hero('carlos'),
  glup: hero('glup'),
  forbes: hero('forbes'),
  kol: hero('kol'),
  dorlin: { ...hero('dorlin'), scale: 0.9 },
  kili: { ...hero('kili'), scale: 0.85 },
  catrina: hero('catrina', 'sword'),
  caprica: hero('caprica'),
  hyperion: hero('hyperion', 'staff'),
  paytra: hero('paytra'),
  flap: { ...hero('flap'), scale: 0.85 },
  se7en: hero('se7en'),
  umwelt: own('graham-1a-axe', 'umwelt-1a', 'graham-1a-axe-above'),
  kreen: hero('kreen'),
  // Shrouded City: the halflings are pressed short and drawn a little smaller; Rinn carries a drawn longbow (no pack has a bow)
  mortymer: hero('mortymer', 'sword'),
  lucky: { ...hero('lucky', 'rapier'), scale: 0.9 },
  roscoe: { ...hero('roscoe', 'dagger'), scale: 0.9 },
  rinn: hero('rinn', 'bow'),
  ian: hero('ian', 'staff'),
  // Vecna the Archlich, named by his template (battler: 'vecna'), drawn larger than a person
  vecna: { ...hero('vecna', 'dagger'), scale: 1.25 },
  // a child, drawn smaller than the adults
  eloise: { ...hero('eloise'), scale: 0.85 },
  calix: foe('calix'),
  // beasts and undead, from Holder's enemies in other colours and sizes
  vampire: hero('vampire'),
  lich: foe('lich'),
  troll: foe('troll'),
  ogre: foe('ogre'),
  hillGiant: foe('hillgiant'),
  frostGiant: foe('frostgiant'),
  fireGiant: foe('firegiant'),
  stoneGiant: foe('stonegiant'),
  fiend: foe('fiend'),
  wolf: foe('asimole', { cellW: 192, footX: 96, scale: 0.4 }, '1b'),
  beastBrown: foe('asimole', { cellW: 192, footX: 96, scale: 0.45 }, '1d'),
  beastGreen: foe('asimole', { cellW: 192, footX: 96, scale: 0.45 }, '1e'),
  beastGold: foe('asimole', { cellW: 192, footX: 96, scale: 0.45 }, '1g'),
  drakeBlack: foe('bat', { scale: 1.7, tall: 72, mid: 58 }, '1b'),
  drakeGreen: foe('bat', { scale: 1.7, tall: 72, mid: 58 }, '1d'),
  drakeBrown: foe('bat', { scale: 1.7, tall: 72, mid: 58 }, '1e'),
  drakeDoom: foe('bat', { scale: 1.7, tall: 72, mid: 58 }),
  wisp: foe('lantern'),
  mimic: foe('barrel'),
  golem: foe('defencer', { scale: 2 }),
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
  [/^kara\b/i, 'kara'],
  [/^roland deschain/i, 'roland'],
  [/^revan\b/i, 'revan'],
  [/^brother magnus/i, 'magnus'],
  [/^drefaen/i, 'drefan'],
  [/^dark zanzibar/i, 'darkzanzibar'],
  [/^yoshi\b/i, 'yoshi'],
  [/cuthbert/i, 'cuthbert'],
  [/^stoth\b/i, 'stoth'],
  [/^arana\b/i, 'arana'],
  [/^x-iii/i, 'xiii'],
  [/brownsleeves/i, 'brownsleeves'],
  [/^eloise/i, 'eloise'],
  [/smallberries/i, 'jim'],
  [/^barrias/i, 'barrias'],
  [/^buttsack/i, 'buttsack'],
  [/^carlos vega/i, 'carlos'],
  [/glup/i, 'glup'],
  [/^forbes/i, 'forbes'],
  [/^kol hanaka/i, 'kol'],
  [/^dorlin/i, 'dorlin'],
  [/^kili/i, 'kili'],
  [/catrina/i, 'catrina'],
  [/^caprica/i, 'caprica'],
  [/^hyperion/i, 'hyperion'],
  [/^paytra/i, 'paytra'],
  [/^f.l.a.p/i, 'flap'],
  [/^se7en/i, 'se7en'],
  [/^umwelt/i, 'umwelt'],
  [/^chad/i, 'kreen'],
  [/^anders s/i, 'anders'],
  [/meatbaldi/i, 'francesco'],
  [/^gabriella/i, 'gabriella'],
  [/^dolores/i, 'dolores'],
  [/^oshi/i, 'oshi'],
  [/^scrunt/i, 'scrunt'],
  [/^bullseye/i, 'bullseye'],
  [/^uriel qualanthri/i, 'uriel'],
  [/^locke pierce/i, 'locke'],
  [/lebeouf|lebeefe/i, 'lebeefe'],
  [/^mortymer/i, 'mortymer'],
  [/^lucky\b/i, 'lucky'],
  [/rumblebottom/i, 'roscoe'],
  [/silverhawk/i, 'rinn'],
  [/mctarley/i, 'ian'],
];
const BY_NAME = [
  [/red dragon/i, 'firebird'],
  [/black dragon/i, 'drakeBlack'],
  [/wyvern/i, 'drakeGreen'],
  [/vrock/i, 'drakeBrown'],
  [/\bwolf\b|werewolf/i, 'wolf'],
  [/owlbear|manticore|minotaur/i, 'beastBrown'],
  [/hydra|basilisk/i, 'beastGreen'],
  [/chimera/i, 'beastGold'],
  [/troll/i, 'troll'],
  [/ogre/i, 'ogre'],
  [/hill giant/i, 'hillGiant'],
  [/frost giant/i, 'frostGiant'],
  [/fire giant/i, 'fireGiant'],
  [/stone giant/i, 'stoneGiant'],
  [/vampire/i, 'vampire'],
  [/\blich\b/i, 'lich'],
  [/will-o/i, 'wisp'],
  [/mimic/i, 'mimic'],
  [/golem/i, 'golem'],
  [/devil|erinyes|balor/i, 'fiend'],
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
