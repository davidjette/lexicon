// Characters added through the bestiary inbox (the Encounter Builder's "Add to library" form).
// Each record is read from an uploaded sheet by Claude (skill: bestiary-inbox) and has the same shape
// as a record in heroes-data.js, so buildHero() runs it the same way. Kept apart from heroes-data.js
// because tools/import_sheets.mjs rewrites that file whole. Public characters only: a DM-only
// character goes in src/dm/added.js as a stat block with side: 'pc'.
//
// Shape (see heroes-data.js for full examples):
//   { id: 'hero-<slug>', name, campaign, classLine: 'Human Fighter 5', level: 5,
//     abil: { str, dex, con, int, wis, cha }, ac, hp, init, saves: { dex: 5 }, resist: [], perAction: 1,
//     attacks: [{ name, toHit, save, dc, dmg: '1d8+3', type: 'slashing', melee: true, spell: false, slot: 0, count: 1 }],
//     spells: { 'fire bolt': 0, fireball: 3 }, dc, spellHit, spellMod, slots: { 1: 4, 2: 3 } | null, pact: null,
//     classes: { fighter: 5 }, subclasses: {}, features: { 'Second Wind': { act: 'bonus', uses: 1, reset: 'short' } },
//     feats: [], options: [], items: [{ name, attuned, kind }],
//     sheet: { source: 'inbox/<submission folder>', date: 'YYYY-MM-DD' } }

export const ADDED_HEROES = [
  {
    id: 'hero-everest', name: 'Everest', campaign: 'Inbox', classLine: 'Human Cleric 1 (Life Domain)', level: 1,
    classes: { cleric: 1 }, subclasses: { cleric: 'life domain' }, prof: 2,
    abil: { str: 17, dex: 14, con: 18, int: 15, wis: 20, cha: 15 },
    ac: 15, init: 2, hp: 12,
    saves: { str: 3, dex: 2, con: 4, int: 2, wis: 7, cha: 4 },
    resist: [], perAction: 1,
    attacks: [
      { name: 'Mace', toHit: 5, save: null, dc: null, dmg: '1d6+3', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false },
      { name: 'Spear', toHit: 5, save: null, dc: null, dmg: '1d6+3', type: 'piercing', melee: true, spell: false, slot: 0, count: 1, props: ['thrown', 'versatile'], conc: false, martialArts: false },
      { name: 'Unarmed Strike', toHit: 5, save: null, dc: null, dmg: '4', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false },
    ],
    spells: {
      mending: 0, 'sacred flame': 0, guidance: 0,
      bane: 1, bless: 1, command: 1, 'create or destroy water': 1, 'cure wounds': 1, 'detect evil and good': 1, 'detect magic': 1,
      'detect poison and disease': 1, 'guiding bolt': 1, 'healing word': 1, 'inflict wounds': 1, 'protection from evil and good': 1,
      'purify food and drink': 1, sanctuary: 1, 'shield of faith': 1,
    },
    dc: 15, spellHit: 7, spellMod: 5, slots: { 1: 2 }, pact: null,
    features: { spellcasting: {}, 'divine domain': {}, 'bonus proficiency': {}, 'disciple of life': {}, 'ability score increase': {}, languages: {} },
    feats: [], options: [],
    items: [{ name: 'leather', kind: 'armor' }, { name: 'shield', kind: 'armor' }, { name: 'mace', kind: 'weapon' }, { name: 'spear', kind: 'weapon' }],
    potions: {}, rogue: 0, barbarian: 0, fighter: 0, monk: 0, paladin: 0,
    sheet: { source: 'inbox/submissions/2026-10-15-everett-mv9olfgv', date: '2026-10-15' },
  },

  // Mortymer 3.0: PDF sheet. The Blade of Drowning Echoes has no damage type on the sheet (slashing assumed).
  {
    img: 'mortymer.webp',
    id: 'hero-mortymer', name: 'Mortymer', campaign: 'Shrouded City', classLine: 'Human Sorcerer 18 (Sea Sorcery) / Rogue 2', level: 20,
    classes: { sorcerer: 18, rogue: 2 }, subclasses: { sorcerer: 'sea sorcery' }, prof: 6,
    abil: { str: 10, dex: 17, con: 14, int: 12, wis: 12, cha: 20 },
    ac: 16, init: 3, hp: 117,
    saves: { str: 2, dex: 11, con: 10, int: 9, wis: 3, cha: 13 },
    resist: ['fire', 'bludgeoning', 'piercing', 'slashing'], perAction: 1,
    attacks: [
      { name: 'Blade of Drowning Echoes', toHit: 11, save: null, dc: null, dmg: '1d8+5', type: 'slashing', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: false },
      { name: 'Harpoon', toHit: 9, save: null, dc: null, dmg: '1d8+3', type: 'piercing', melee: true, spell: false, slot: 0, count: 1, props: ['thrown'], conc: false, martialArts: false },
      { name: 'Dagger', toHit: 9, save: null, dc: null, dmg: '1d4+3', type: 'piercing', melee: true, spell: false, slot: 0, count: 1, props: ['finesse', 'light', 'thrown'], conc: false, martialArts: false },
      { name: 'Fire Bolt', toHit: 11, save: null, dc: null, dmg: '4d10', type: 'fire', melee: false, spell: true, slot: 0, count: 1, conc: false, martialArts: false },
      { name: 'Ray of Frost', toHit: 11, save: null, dc: null, dmg: '4d8', type: 'cold', melee: false, spell: true, slot: 0, count: 1, conc: false, martialArts: false },
    ],
    spells: {
      'fire bolt': 0, gust: 0, light: 0, 'mold earth': 0, 'ray of frost': 0, 'shape water': 0,
      'absorb elements': 1, 'create or destroy water': 1, 'earth tremor': 1, 'ice knife': 1,
      'gust of wind': 2, 'misty step': 2, 'elemental weapon': 3, fireball: 3, fly: 3,
      'control water': 4, 'fire shield': 4, stoneskin: 4, 'cone of cold': 5, 'conjure elemental': 5,
      'bones of the earth': 6, 'chain lightning': 6, whirlwind: 7, tsunami: 8, wish: 9,
    },
    dc: 19, spellHit: 11, spellMod: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 }, pact: null,
    sorcery: 18, meta: ['quickened', 'twinned', 'heightened', 'careful'],
    // Heart of Winter (he carries 8): Dave, 2026-10-16, "unleashes a massive power"; approximated as a burst of cold at
    // his spell DC, twice a fight, that leaves those who fail frozen in place until the end of their next turn.
    powers: [{ name: 'Heart of Winter', save: 'con', dc: 19, dmg: [['10d10', 'cold']], half: true, uses: 2,
      area: { type: 'near', max: 6, spread: 0.5 }, onFail: [{ fx: 'cond', cond: 'speed0', name: 'Heart of Winter', dur: { who: 'tgt', when: 'end', turns: 1 } }] }],
    features: {
      spellcasting: {}, 'sorcerous origin': {}, 'font of magic': {}, metamagic: {},
      'sorcery points': { act: 'action', uses: 18, reset: 'long' }, 'convert sorcery points': { act: 'bonus' },
      'quickened spell': { act: 'special' }, 'twinned spell': { act: 'special' }, 'heightened spell': { act: 'special' }, 'careful spell': { act: 'special' },
      'soul of the sea': {}, 'curse of the sea': { act: 'special' }, 'watery defense': { act: 'reaction', uses: 1, reset: 'short' },
      'shifting form': {}, 'water soul': {},
      expertise: {}, 'sneak attack': { act: 'special', dice: '1d6' }, "thieves' cant": {}, 'cunning action': { act: 'bonus' },
    },
    feats: [], options: ['quickened spell', 'twinned spell', 'heightened spell', 'careful spell'],
    items: [
      { name: 'blade of drowning echoes', kind: 'weapon' }, { name: 'heart of winter', kind: 'wondrous item' }, { name: 'cloak of the manta ray', kind: 'wondrous item' },
      { name: 'ring of protection', kind: 'ring', attuned: true }, { name: 'leather', kind: 'armor' },
    ],
    potions: { 'potion of healing (superior)': 1 }, rogue: 2, barbarian: 0, fighter: 0, monk: 0, paladin: 0,
    sheet: { source: 'inbox/submissions/2026-10-16-mortymer-mva98rpm', date: '2026-10-16' },
  },

  // Lucky (Drombo Underhill): D&D Beyond character 155793509, PDF of 2026-10-15.
  {
    img: 'lucky.webp',
    id: 'hero-lucky', name: 'Lucky', campaign: 'Shrouded City', classLine: 'Halfling Bard 18 (College of Eloquence) / Wizard 2 (School of Divination)', level: 20,
    classes: { bard: 18, wizard: 2 }, subclasses: { bard: 'college of eloquence', wizard: 'school of divination' }, prof: 6,
    abil: { str: 8, dex: 14, con: 16, int: 10, wis: 10, cha: 20 },
    ac: 17, init: 5, hp: 161,
    saves: { str: 1, dex: 10, con: 5, int: 2, wis: 2, cha: 13 },
    resist: ['fire'], perAction: 1,
    attacks: [
      { name: 'Frost Brand Rapier', toHit: 8, save: null, dc: null, dmg: '1d8+2', type: 'piercing', extra: [['1d6', 'cold']], melee: true, spell: false, slot: 0, count: 1, props: ['finesse'], conc: false, martialArts: false },
      { name: 'Shadow Blade', toHit: 8, save: null, dc: null, dmg: '4d8+2', type: 'psychic', melee: true, spell: true, slot: 4, count: 1, conc: true, martialArts: false },
    ],
    spells: {
      'mage hand': 0, 'vicious mockery': 0, message: 0, 'blade ward': 0, prestidigitation: 0, 'minor illusion': 0, 'booming blade': 0,
      'healing word': 1, 'silvery barbs': 1, shield: 1, sleep: 1, 'mage armor': 1, identify: 1, 'detect magic': 1, 'comprehend languages': 1,
      'find familiar': 1, 'protection from evil and good': 1, 'disguise self': 1, 'feather fall': 1, bless: 1,
      invisibility: 2, suggestion: 2, 'misty step': 2, 'shadow blade': 2,
      'major image': 3, counterspell: 3, 'thunder step': 3,
      'charm monster': 4, 'greater invisibility': 4, polymorph: 4, 'find greater steed': 4,
      'synaptic static': 5, mislead: 5, 'wall of force': 5,
      'mass suggestion': 6, "otto's irresistible dance": 6, sunbeam: 6, contingency: 6,
      'power word fortify': 7, teleport: 7, "mordenkainen's magnificent mansion": 7,
      'dominate monster': 8, feeblemind: 8, foresight: 9,
    },
    dc: 19, spellHit: 11, spellMod: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, pact: null,
    features: {
      spellcasting: {}, 'bardic inspiration': { act: 'bonus', uses: 5, reset: 'short' }, 'jack of all trades': {}, 'song of rest': {},
      'bard college': {}, expertise: {}, 'silver tongue': {}, 'unsettling words': { act: 'bonus' }, 'font of inspiration': {},
      countercharm: { act: 'action' }, 'unfailing inspiration': {}, 'universal speech': { act: 'action', uses: 1, reset: 'long' },
      'magical secrets': {}, 'infectious inspiration': { act: 'reaction', uses: 5, reset: 'long' },
      'arcane recovery': { act: 'special', uses: 1, reset: 'long' }, 'arcane tradition': {}, 'divination savant': {},
      portent: { act: 'special', uses: 2, reset: 'long' },
      luck: {}, 'naturally stealthy': {}, brave: {}, 'halfling nimbleness': {},
      lucky: { act: 'none', uses: 3, reset: 'long' }, parry: { act: 'reaction' },
    },
    feats: ['lucky', 'actor', 'defensive duelist'], options: [],
    items: [
      { name: 'cloak of the bat', kind: 'wondrous item', attuned: true }, { name: 'ring of protection +2', kind: 'ring', attuned: true },
      { name: 'frost brand rapier', kind: 'weapon', attuned: true }, { name: 'amulet of proof against detection and location', kind: 'wondrous item' },
    ],
    potions: { 'potion of healing (greater)': 6, 'potion of healing (superior)': 4, 'potion of healing (supreme)': 2, 'potion of healing': 7 },
    rogue: 0, barbarian: 0, fighter: 0, monk: 0, paladin: 0,
    sheet: { source: 'dndbeyond/155793509 (sent by Dave in chat)', date: '2026-10-16' },
  },

  // Rinn Silverhawk: Fight Club 5 GM export (stat block only; no features). The export lists the whole ranger
  // spell list rather than the spells Rinn knows. Spell DC and attack are worked out from Wisdom 17 and +6.
  {
    id: 'hero-rinn-silverhawk', name: 'Rinn Silverhawk', campaign: 'Shrouded City', classLine: 'Wood Elf Ranger 20', level: 20,
    classes: { ranger: 20 }, subclasses: {}, prof: 6,
    abil: { str: 10, dex: 20, con: 15, int: 13, wis: 17, cha: 8 },
    ac: 22, init: 5, hp: 161,
    saves: { str: 9, dex: 14, con: 11, int: 1, wis: 3, cha: -1 },
    resist: [], perAction: 2, archer: true,
    attacks: [
      { name: "Dragon's Wrath (longbow)", toHit: 13, save: null, dc: null, dmg: '1d8+7', type: 'piercing', melee: false, spell: false, slot: 0, count: 1, props: ['two-handed', 'heavy'], conc: false, martialArts: false },
      { name: 'Longsword, +1', toHit: 12, save: null, dc: null, dmg: '1d8+6', type: 'slashing', melee: true, spell: false, slot: 0, count: 1, props: ['versatile'], conc: false, martialArts: false },
      { name: 'Longsword of Sharpness', toHit: 11, save: null, dc: null, dmg: '1d8+5', type: 'slashing', on20: [['4d6', 'slashing', 'Sharpness']], melee: true, spell: false, slot: 0, count: 1, props: ['versatile'], conc: false, martialArts: false },
      { name: 'Shortsword', toHit: 11, save: null, dc: null, dmg: '1d6+5', type: 'piercing', melee: true, spell: false, slot: 0, count: 1, props: ['finesse', 'light'], conc: false, martialArts: false },
      { name: 'Dagger', toHit: 11, save: null, dc: null, dmg: '1d4+5', type: 'piercing', melee: true, spell: false, slot: 0, count: 1, props: ['finesse', 'light', 'thrown'], conc: false, martialArts: false },
      { name: 'Longbow', toHit: 11, save: null, dc: null, dmg: '1d8+5', type: 'piercing', melee: false, spell: false, slot: 0, count: 1, props: ['two-handed', 'heavy'], conc: false, martialArts: false },
    ],
    spells: { 'cure wounds': 1, 'steel wind strike': 5 },
    dc: 17, spellHit: 9, spellMod: 3, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, pact: null,
    features: { spellcasting: {}, 'extra attack': {} },
    feats: [], options: [],
    items: [{ name: 'studded leather armor, +2', kind: 'armor' }, { name: "dragon's wrath", kind: 'weapon' }, { name: 'longsword of sharpness', kind: 'weapon' }],
    potions: {}, rogue: 0, barbarian: 0, fighter: 0, monk: 0, paladin: 0,
    sheet: { source: 'inbox/submissions/2026-10-16-rinn-silverhawk-mva9b2kz (Fight Club GM export)', date: '2026-10-16' },
  },

  // Roscoe Rumblebottom: Fight Club 5 character file. AC, saves and initiative are not printed in it and are
  // worked out from the scores: AC 10 + Dex 5 + Wis 3 + Ring of Protection 1; Diamond Soul gives every save
  // (+6, +1 ring); Alert gives +5 initiative. Attack lines are as the file prints them.
  {
    id: 'hero-roscoe-rumblebottom', name: 'Roscoe Rumblebottom', campaign: 'Shrouded City', classLine: 'Lightfoot Halfling Rogue 6 (Assassin) / Monk 14 (Way of Shadow)', level: 20,
    classes: { rogue: 6, monk: 14 }, subclasses: { rogue: 'assassin', monk: 'way of shadow' }, prof: 6,
    abil: { str: 10, dex: 20, con: 10, int: 14, wis: 16, cha: 16 },
    ac: 19, init: 10, hp: 123,
    saves: { str: 7, dex: 12, con: 7, int: 9, wis: 10, cha: 10 },
    resist: [], perAction: 2,
    attacks: [
      { name: 'Trench Knife', toHit: 11, save: null, dc: null, dmg: '1d8+6', type: 'slashing', melee: true, spell: false, slot: 0, count: 1, props: ['finesse', 'light'], conc: false, martialArts: false },
      { name: 'Dagger of Venom', toHit: 10, save: null, dc: null, dmg: '1d4+5', type: 'piercing', melee: true, spell: false, slot: 0, count: 1, props: ['finesse', 'light', 'thrown'], conc: false, martialArts: false },
      { name: 'Hand Crossbow', toHit: 10, save: null, dc: null, dmg: '1d6+5', type: 'piercing', melee: false, spell: false, slot: 0, count: 1, props: ['light'], conc: false, martialArts: false },
      { name: 'Unarmed Strike', toHit: 10, save: null, dc: null, dmg: '1d8+5', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: [], conc: false, martialArts: true },
    ],
    spells: { 'minor illusion': 0, darkness: 2, darkvision: 2, 'pass without trace': 2, silence: 2 },
    dc: null, spellHit: null, spellMod: 3, slots: null, pact: null,
    features: {
      expertise: {}, 'sneak attack': { act: 'special', dice: '3d6' }, "thieves' cant": {}, 'cunning action': { act: 'bonus' },
      'roguish archetype': {}, assassinate: {}, 'steady aim': { act: 'bonus' }, 'uncanny dodge': { act: 'reaction' },
      'unarmored defense': {}, 'martial arts': {}, ki: {}, 'ki points': { act: 'special', uses: 14, reset: 'short' },
      'flurry of blows': { act: 'bonus' }, 'patient defense': { act: 'bonus' }, 'step of the wind': { act: 'bonus' },
      'unarmored movement': {}, 'dedicated weapon': {}, 'deflect missiles': { act: 'reaction' }, 'monastic tradition': {},
      'shadow arts': {}, 'ki-fueled attack': { act: 'bonus' }, 'slow fall': { act: 'reaction' }, 'quickened healing': { act: 'action' },
      'extra attack': {}, 'stunning strike': { act: 'special' }, 'focused aim': { act: 'special' }, 'ki-empowered strikes': {},
      'shadow step': { act: 'bonus' }, evasion: {}, 'stillness of mind': { act: 'action' }, 'unarmored movement improvement': {},
      'purity of body': {}, 'cloak of shadows': { act: 'action' }, 'tongue of the sun and moon': {}, 'diamond soul': {},
      lucky: {}, brave: {}, 'halfling nimbleness': {}, 'naturally stealthy': {},
    },
    feats: ['alert', 'observant', 'mobile'], options: [],
    items: [
      { name: 'ring of protection', kind: 'ring', attuned: true }, { name: 'boots of elvenkind', kind: 'wondrous item' },
      { name: 'goggles of night', kind: 'wondrous item' }, { name: 'dagger of venom', kind: 'weapon' },
      { name: 'amulet of proof against detection and location', kind: 'wondrous item' }, { name: 'brooch of sending', kind: 'wondrous item' },
    ],
    potions: { 'potion of healing (superior)': 5, 'potion of speed': 2, 'potion of healing (supreme)': 1, 'potion of healing (greater)': 2 },
    rogue: 6, barbarian: 0, fighter: 0, monk: 14, paladin: 0,
    sheet: { source: 'inbox/submissions/2026-10-16-roscoe-rumblebottom-mva97abz (Fight Club character file)', date: '2026-10-16' },
  },

  // Ian McTarley: his PDF sheet (Dave, 2026-10-16), a Necromancer and an archlich. Paralyzing Touch is from his
  // Fight Club GM export (the PDF lists only the quarterstaff).
  {
    id: 'hero-ian-mctarley', name: 'Ian McTarley', campaign: 'Shrouded City', classLine: 'Half-Elf (Lich) Wizard 20 (School of Necromancy)', level: 20,
    classes: { wizard: 20 }, subclasses: { wizard: 'school of necromancy' }, prof: 6,
    abil: { str: 10, dex: 10, con: 12, int: 22, wis: 17, cha: 16 },
    ac: 14, init: 0, hp: 98,
    saves: { str: 2, dex: 2, con: 9, int: 14, wis: 11, cha: 5 },
    resist: ['cold', 'lightning', 'necrotic', 'poison'], condImmune: ['charmed', 'exhaustion', 'frightened', 'paralysed', 'poisoned'], lr: 1,
    perAction: 1,
    attacks: [
      { name: 'Quarterstaff', toHit: 6, save: null, dc: null, dmg: '1d8', type: 'bludgeoning', melee: true, spell: false, slot: 0, count: 1, props: ['versatile'], conc: false, martialArts: false },
      { name: 'Paralyzing Touch', toHit: 12, save: null, dc: null, dmg: '3d6', type: 'cold', melee: true, spell: false, slot: 0, count: 1, conc: false, martialArts: false,
        onHit: [{ fx: 'save', ability: 'con', dc: 20, onFail: [{ fx: 'cond', cond: 'paralysed', name: 'Paralyzing Touch', dur: { who: 'tgt', when: 'end', turns: 1 } }] }] },
      { name: 'Chill Touch', toHit: 12, save: null, dc: null, dmg: '4d8', type: 'necrotic', melee: false, spell: true, slot: 0, count: 1, conc: false, martialArts: false,
        onHit: [{ fx: 'cond', cond: 'noHeal', name: 'Chill Touch', dur: { who: 'src', when: 'start', turns: 1 } }] },
    ],
    spells: {
      'chill touch': 0, 'mage hand': 0, mending: 0, message: 0, prestidigitation: 0,
      alarm: 1, 'cause fear': 1, 'charm person': 1, 'detect magic': 1, 'false life': 1, identify: 1, 'mage armor': 1, 'magic missile': 1, 'ray of sickness': 1, shield: 1,
      'blindness/deafness': 2, 'detect thoughts': 2, 'misty step': 2, "nystul's magic aura": 2, 'ray of enfeeblement': 2,
      'animate dead': 3, 'bestow curse': 3, counterspell: 3, 'life transference': 3, 'magic circle': 3, 'major image': 3, 'protection from energy': 3, 'summon undead': 3, 'vampiric touch': 3,
      blight: 4, 'dimension door': 4, 'resilient sphere': 4,
      commune: 5, 'danse macabre': 5, enervation: 5, 'negative energy flood': 5,
      'arcane gate': 6, 'circle of death': 6, contingency: 6, 'create undead': 6, 'find the path': 6, 'magic jar': 6, 'soul cage': 6,
      'finger of death': 7, forcecage: 7, 'mirage arcane': 7, 'reverse gravity': 7,
      "abi-dalzim's horrid wilting": 8, 'mind blank': 8,
      'astral projection': 9, gotterdammerung: 9, 'meteor swarm': 9,
    },
    dc: 20, spellHit: 12, spellMod: 6, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, pact: null,
    features: {
      spellcasting: {}, 'arcane recovery': { act: 'special', uses: 1, reset: 'long' }, 'arcane tradition': {}, 'necromancy savant': {},
      'grim harvest': {}, 'undead thralls': {}, 'inured to undeath': {}, 'command undead': { act: 'action' },
      'spell mastery': {}, 'signature spells': {}, 'archlich spellcraft': { act: 'special' },
      'undead fortitude': { act: 'special', uses: 1, reset: 'long' }, 'legendary resistance': { act: 'special', uses: 1, reset: 'long' },
      'turn resistance': {}, 'true sight': {}, 'eternal mind': {}, 'soul anchor': {}, 'skill versatility': {},
    },
    feats: [], options: [],
    items: [
      { name: 'staff of the tower', kind: 'staff' }, { name: 'robe of stars', kind: 'wondrous item' }, { name: 'cloak of displacement', kind: 'wondrous item' },
      { name: 'ring of protection', kind: 'ring', attuned: true }, { name: 'eyes of charming', kind: 'wondrous item' },
      { name: 'veil of infinite visions', kind: 'wondrous item' }, { name: 'mirrorheart amulet', kind: 'wondrous item' }, { name: 'brooch of sending', kind: 'wondrous item' },
    ],
    potions: { 'potion of healing': 1, 'potion of healing (greater)': 1, 'potion of healing (superior)': 1 },
    rogue: 0, barbarian: 0, fighter: 0, monk: 0, paladin: 0,
    sheet: { source: 'Ian McTarley.pdf and Fight Club GM export (sent by Dave in chat)', date: '2026-10-16' },
  },

];
