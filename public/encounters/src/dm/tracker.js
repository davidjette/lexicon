// DM ONLY. Fights set up for the battle tracker (tracker.html): who is on the field, who is
// waiting to be added, what each round brings, and any stat card written out for the table.
// Numbers for Uriel come from supplement-uriel-three-phases.md (second draft, 2026-11-06).
// No imports: see monsters.js.

export default function (api) {
const nextStart = { when: 'start', turns: 1 };
const nextEnd = { when: 'end', turns: 1 };

const urielNM = {
  from: 'urielReckoning',
  name: 'Uriel',
  side: 'foe', ac: 19, hp: 300, lr: 3, leg: 3, deathWard: true, carryKey: 'uriel',
  traits: [
    'Medium humanoid (elf), lawful evil. CR 17. Spell save DC 19. Speed 30 ft., floats.',
    'She floats 60 feet above the forecourt, level with the belfry. Only ranged attacks and flying creatures reach her until the labour brings her down.',
    'Immune to charmed, frightened, poisoned and exhaustion. Resists necrotic. Darkvision 60 ft., passive Perception 21.',
    'Death Ward: the first time she would drop to 0 she drops to 1 instead and takes a legendary action at once.',
    'If the child is killed, removed or destroyed she loses all her spells.',
    'At 0 hit points she does not die. The labour takes her, she sinks through the stone toward the Sept, and the fight ends.',
  ],
  turnStart: [
    { text: 'The Polygon', heal: 20, flag: 'polygon' },
    {
      text: 'Contraction: roll a d6. On a 1 or 2 she can take no legendary actions or reactions until the start of her next turn, and the first attack against her has advantage.',
      roll: '1d6', max: 2, label: 'Roll the contraction',
      cond: { name: 'Contraction', note: 'no legendary actions or reactions; the first attack against her has advantage', noLeg: true, ends: nextStart },
    },
  ],
  thresholds: [
    { at: 150, text: 'the labour takes hold. She sinks to 10 feet above the walk: reach weapons and anyone on the tomb or a pillar base can strike her, and her scythe reaches the ground. Breath of the Grave recharges at once.' },
    { at: 0, text: 'she folds over the child and sinks through the stone toward the Sept. The fight ends. Her risen guards stand still a moment, then keep coming.' },
  ],
  actions: [
    { key: 'bell', name: 'Ring the Original', cost: 'action', uses: 1, text: 'Round 1. The bell\'s lair action starts at once, and five risen guards reach the forecourt at the end of every round.' },
    { key: 'multi', name: 'Multiattack', cost: 'action', text: 'Two Mourning Dove attacks, one and a cantrip, or two cantrips.' },
    { key: 'dove', name: 'Mourning Dove (scythe)', cost: 'action', hit: 10, dmg: [['2d8+7', 'slashing']], text: 'Reach 10 ft., up to two targets within 5 ft. of each other. The next attack that hits a target makes it vulnerable to all of that attack\'s damage.' },
    { key: 'toll', name: 'Toll the Dead', cost: 'action', save: 'wis', dc: 19, dmg: [['3d8+6', 'necrotic']], alt: { label: 'target is hurt', dmg: [['4d8+6', 'necrotic']] } },
    { key: 'flame', name: 'Sacred Flame', cost: 'action', save: 'dex', dc: 19, dmg: [['3d8+6', 'radiant']] },
    { key: 'breath', name: 'Breath of the Grave', cost: 'action', recharge: 5, save: 'con', dc: 19, half: true, dmg: [['8d8', 'necrotic']], text: 'Living creatures within 20 ft. Undead of her choice in the area regain 36 hit points instead.' },
    { key: 'blight', name: 'Blight', cost: 'action', uses: 3, save: 'con', dc: 19, half: true, dmg: [['8d8', 'necrotic']] },
    { key: 'harm', name: 'Harm', cost: 'action', uses: 1, save: 'con', dc: 19, half: true, dmg: [['14d6', 'necrotic']], text: 'Cannot drop the target below 1. Its hit point maximum falls by the damage taken. Draft: with Aurorix in the fight she spends this on him on her first turn after the bell.' },
    { key: 'heal', name: 'Heal (herself)', cost: 'action', uses: 1, heal: '70' },
    { key: 'guardians', name: 'Spirit Guardians', cost: 'action', uses: 3, conc: true, save: 'wis', dc: 19, half: true, dmg: [['6d6', 'necrotic']], text: 'Concentration. A 15-ft emanation, and difficult terrain for enemies.' },
    { key: 'command', name: 'Command the Dead', cost: 'action', text: 'One undead ally within 60 ft. uses its reaction to move and attack.' },
    { key: 'orders', name: "Doctor's Orders (draft)", cost: 'bonus', text: 'One Sister within 60 ft. uses her reaction to make one attack.' },
    { key: 'sentinel', name: "Sentinel at Death's Door", cost: 'reaction', uses: 3, text: 'A critical hit on her or an ally within 30 ft. becomes a normal hit.' },
  ],
  legendary: [
    { key: 'dove', cost: 1, name: 'Mourning Dove' },
    { key: 'toll', cost: 1, name: 'Toll the Dead' },
    { key: 'flame', cost: 1, name: 'Sacred Flame' },
    { key: 'command', cost: 1, name: 'Command the Dead' },
    { key: 'breath', cost: 2, name: 'Breath of the Grave' },
    { key: 'blight', cost: 3, name: 'Blight' },
    { key: 'harm', cost: 3, name: 'Harm' },
  ],
};

const edenNM = {
  from: 'edenZ',
  name: 'Eden, EDN-00',
  traits: [
    'Speed 50 ft. She regains 20 hit points at the start of each turn. Against Uriel she has advantage and deals an extra 2d8.',
    'Leap (bonus action): 50 ft. with no opportunity attacks.',
    'On her death: a 20-ft lightning burst, DC 17 Dex, 35 (10d6) lightning, half on a success.',
    'Her units do what she does.',
  ],
  turnStart: [
    {
      text: 'The bell: outside a counter-tone\'s zone she makes a DC 19 Wisdom save (advantage on the first). On a failure Uriel chooses what she does this turn. On a success she acts as herself.',
      save: 'wis', dc: 19, label: 'Roll her save', notFlag: 'tone',
      fail: '"Yes... Mother." Uriel chooses her turn.', pass: '"I am... not... yours." She acts as herself.',
    },
  ],
};

const nosMatre = {
  id: 'nosMatre',
  name: 'Nos Matre: Uriel, phase 2',
  where: 'Over the forecourt of Nos Matre (area L32)',
  level: 15,
  cards: {
    urielNM, edenNM,
    aurorixNM: { from: 'aurorix', name: 'Aurorix', startHp: 39, traits: ['A young gold dragon in strength, hurt and still carrying exhaustion (39 of 178 going in). Immune to fire. He flies, so he can reach her.', "He makes the bell's save like any living creature."] },
    zeroOneNM: { from: 'zeroOneR', name: 'Zero-One', traits: ['Hurt: 40 of 70. Bless in round 1, healing word three times.'] },
    defectorsNM: { from: 'defectors', name: "Matheny's Defectors", traits: ['A crowd of six, with Ilma Vitt and Fima Nolan among them. Double damage from area effects; below 40 hit points its damage is halved. It cannot be grappled, restrained or knocked prone.'] },
    bandNM: { from: 'plazaBand', name: 'The Plaza Band', traits: ['A crowd of six. While it plays: a 60-ft counter-tone with no roll, shrinking to 30 ft below 30 hit points. Inside it the living make no saves against the bell and her control of undead fails.'] },
    corsairNM: { from: 'swashbuckler', name: "Roberts' Corsair" },
    valtrexNM: { from: 'valtrex', name: 'Valtrex', traits: ['A young black dragon in strength. Outside a counter-tone he goes mad again. If Aurorix is on the field the two dragons fight each other.'] },
  },
  party: ['gemma', 'eric', 'dario'],
  // where the table stood going in (Dave, 2026-11-13): [hit points now, maximum]
  rev: 3,
  partyHp: { gemma: [114, 142], eric: [61, 153], dario: [58, 109] },
  start: [['urielNM', 1, 'foe']],
  toggles: [
    { key: 'polygon', label: 'The Polygon stands (she regains 20 at the start of each turn)', on: true, off: { to: 'urielNM', dmg: [['60', 'psychic']], text: 'The Polygon breaks. Uriel takes 60 psychic damage and her voice no longer carries across the valley.' } },
    { key: 'bell', label: 'The Original is ringing', on: true },
    { key: 'potions', label: 'The party is under potions of necrotic resistance', on: true, partyResist: ['necrotic'] },
    { key: 'tone', label: 'A counter-tone is sounding (band 60 ft., Gemma 30 ft.)', on: false },
  ],
  lair: {
    name: 'The Original tolls',
    init: 20,
    text: 'From the moment she rings the bell (her action in round 1). Each living enemy, Aurorix included, makes a DC 15 Wisdom save or has disadvantage on attack rolls and can take no reactions until the end of its next turn. Inside a counter-tone\'s zone the living make no saves and her control of undead fails, though the risen dead keep coming. Every undead that hears the bell is hers, and Valtrex goes mad again.',
    save: { ability: 'wis', dc: 15, side: 'pc', skipTypes: ['undead', 'construct'], cond: { name: 'Shaken by the bell', note: 'disadvantage on attack rolls, no reactions', ends: nextEnd } },
  },
  roundEnd: [
    { text: 'Five risen guards reach the forecourt.', add: [['guardMinion', 5, 'foe']], flag: 'bell' },
    { key: 'belfry', rounds: [1, 2], text: 'Round 2: the pilgrims break and run, and the battle sisters come down from the belfry (one Sister of the Light, two Choirs of Novices). Eden\'s units are seen climbing the Stairs of Her Mercy.', add: [['whiteSister', 1, 'foe'], ['choirNovices', 2, 'foe']] },
    { key: 'eden', rounds: [1, 2, 3], text: 'Round 2 or 3: Eden reaches the forecourt with four units and goes for Uriel. The bell starts working on her. Add her on the side she is fighting for; switch her side from her card when it changes.', add: [['edenNM', 1, 'foe'], ['edenUnitZ', 4, 'foe']] },
    { key: 'walk', rounds: [2], text: 'From round 3 the walk is clear of pilgrims and covered in bodies, and those bodies rise as risen guards.' },
  ],
  notes: [
    'The lawns break open where the graves are. From the end of round 1 every square of lawn is difficult terrain.',
    'Pilgrims fill the walk for the first two rounds. It is difficult terrain while they are on it, and any area effect that lands on the walk in those rounds kills pilgrims.',
    'The Tomb of Kaius I gives full cover to anyone crouched behind it; anyone standing on it is 5 feet above the lawn.',
    'The cathedral doors are held by two white guards, who stand their post. The four Sisters of the Light beneath the Polygon fight only if it is touched (draft: from round 1 if Aurorix is in the fight).',
    'Counter-tone: 60 feet for the Plaza Band with no roll (30 feet below 30 hp). Gemma: Performance DC 15 to open a 30-foot zone, DC 18 to hold it each round.',
    'If Valtrex is called while Aurorix is on the field, the two dragons fight each other and neither helps the party.',
    'Esther (optional) comes over the cathedral roof and asks her two questions first. With the heart in the jar from the Surgery her will is her own and she goes straight for Uriel.',
    'Roberts arrives whenever you want him, with his corsairs coming up the Stairs.',
  ],
  bench: [
    { ref: 'aurorixNM', n: 1, side: 'pc', note: 'With the party. He makes the bell\'s save like any living creature.' },
    { ref: 'zeroOneNM', n: 1, side: 'pc', note: 'Bless in round 1, healing word three times.' },
    { ref: 'defectorsNM', n: 1, side: 'pc', note: 'Ilma Vitt and Fima Nolan with them. On the forecourt from the start.' },
    { ref: 'bandNM', n: 1, side: 'pc', note: 'If they have the horn: a 60-ft counter-tone.' },
    { ref: 'corsairNM', n: 4, side: 'pc', note: 'Roberts and his corsairs, up the Stairs.' },
    { ref: 'estherHalf', n: 1, side: 'pc', note: 'With her heart back, for the party.' },
    { ref: 'valtrexNM', n: 1, side: 'pc', note: 'If called. Mad outside a counter-tone.' },
    { ref: 'guardMinion', n: 5, side: 'foe', note: 'Five at the end of every round. Ten already standing if the party was slow to arrive.' },
    { ref: 'whiteSister', n: 1, side: 'foe', note: 'From the belfry in round 2. Four more stand beneath the Polygon.' },
    { ref: 'choirNovices', n: 2, side: 'foe', note: 'From the belfry in round 2.' },
    { ref: 'edenNM', n: 1, side: 'foe', note: 'Round 2 or 3. Uriel\'s under the bell, her own in a counter-tone.' },
    { ref: 'edenUnitZ', n: 4, side: 'foe', note: 'They do what Eden does.' },
    { ref: 'whiteGuardR', n: 2, side: 'foe', note: 'At the cathedral doors. They stand their post.' },
    { ref: 'estherRaised', n: 1, side: 'foe', note: 'Over the cathedral roof, if her questions go badly.' },
  ],
};

// ------------------------------------------------------------------ Phase 3: the Sept of Bones
const urielS5 = {
  from: 'urielSept',
  name: 'Uriel',
  side: 'foe', ac: 20, hp: 300, lr: 3, leg: 3, deathWard: true, carryKey: 'uriel',
  traits: [
    'Medium humanoid (elf), lawful evil. CR 18. Spell save DC 20. Speed 30 ft. She has given birth, and the contractions are over.',
    'Immune to charmed, frightened, poisoned and exhaustion. Resists necrotic. Darkvision 60 ft., passive Perception 21. The Sept is dark except for what the party brings.',
    'Death Ward: the first time she would drop to 0 she drops to 1 instead and takes a legendary action at once.',
    'The cord joins her to the Heir, 20 feet away. While it holds the Heir is part of her and can be killed; its death takes all of her spells.',
    'When the cord is cut she loses her spells and takes 50 damage at the start of each of her turns, and the Heir is free.',
    'Her Legendary Resistances and her daily spells (Blight, Harm, Heal, Spirit Guardians, Sentinel) are per day: what she spent at Nos Matre is still spent. Click the marks to change them.',
  ],
  turnStart: [
    { text: 'Opening strike: three Mourning Dove attacks against one creature.', rounds: [1] },
    { text: 'severed from the child', dmg: 50, notFlag: 'cord' },
  ],
  thresholds: [
    { at: 150, text: 'below half. On her next turn, if the cord still holds, she uses Take Him Back: "Forgive me, baby. Mother needs you inside her again."' },
    { at: 0, text: 'she falls. If the cord holds: "I made him. I made the dragon. Vol, Mother of all of us... I gave you a son." If it was cut: "Run, then. Run. He\'s hungry, and he has my patience."' },
  ],
  actions: [
    { key: 'multi', name: 'Multiattack', cost: 'action', text: 'Two Mourning Dove attacks, one and a cantrip, or two cantrips. On her first turn: three Mourning Dove attacks against one creature.' },
    { key: 'dove', name: 'Mourning Dove (scythe)', cost: 'action', hit: 11, dmg: [['2d8+7', 'slashing']], alt: { label: 'after Take Him Back', dmg: [['2d8+7', 'slashing'], ['2d8', 'necrotic']] }, text: 'Reach 10 ft., up to two targets within 5 ft. of each other. The next attack that hits a target makes it vulnerable to all of that attack\'s damage.' },
    { key: 'toll', name: 'Toll the Dead', cost: 'action', save: 'wis', dc: 20, dmg: [['3d8+6', 'necrotic']], alt: { label: 'target is hurt', dmg: [['4d8+6', 'necrotic']] } },
    { key: 'flame', name: 'Sacred Flame', cost: 'action', save: 'dex', dc: 20, dmg: [['3d8+6', 'radiant']] },
    { key: 'breath', name: 'Breath of the Grave', cost: 'action', recharge: 5, save: 'con', dc: 19, half: true, dmg: [['8d8', 'necrotic']], text: 'Living creatures within 20 ft. Undead of her choice in the area regain 36 hit points instead.' },
    { key: 'blight', name: 'Blight', cost: 'action', uses: 3, save: 'con', dc: 20, half: true, dmg: [['8d8', 'necrotic']] },
    { key: 'harm', name: 'Harm', cost: 'action', uses: 1, save: 'con', dc: 20, half: true, dmg: [['14d6', 'necrotic']], text: 'Cannot drop the target below 1. Its hit point maximum falls by the damage taken.' },
    { key: 'heal', name: 'Heal (herself)', cost: 'action', uses: 1, heal: '70' },
    { key: 'takeBack', name: 'Take Him Back (draft)', cost: 'action', uses: 1, heal: '40', self: true, hurts: { ref: 'heirS5', amt: 40 }, text: 'Below 150 hit points, cord whole. The Heir takes 40 and she regains 40. Until the end of the fight her Mourning Dove deals an extra 2d8 necrotic (the second button).' },
    { key: 'guardians', name: 'Spirit Guardians', cost: 'action', uses: 3, conc: true, save: 'wis', dc: 20, half: true, dmg: [['6d6', 'necrotic']], text: 'Concentration. A 15-ft emanation, and difficult terrain for enemies.' },
    { key: 'command', name: 'Command the Dead', cost: 'action', text: 'One undead ally within 60 ft. uses its reaction to move and attack.' },
    { key: 'notMySon', name: 'Not My Son (draft)', cost: 'reaction', text: 'When an attack hits the Heir while she is within 20 ft. of it, she takes the damage instead. "Don\'t you touch him!"' },
    { key: 'sentinel', name: "Sentinel at Death's Door", cost: 'reaction', uses: 3, text: 'A critical hit on her or an ally within 30 ft. becomes a normal hit.' },
  ],
  legendary: urielNM.legendary,
};

const heirS5 = {
  from: 'heir',
  name: 'The Heir of Vol',
  traits: [
    'Large undead dragon, CR 12 while joined. Speed 40 ft. Resists fire and necrotic; immune to poison.',
    'Joined: it is part of Uriel and can be killed like any creature. Its death takes all of her spells. She shields it with Not My Son.',
    'Free (after the cord is cut): each hit raises its hit point maximum by the damage taken, and it regains twice that amount. At 0 it gains 100 hit points and stands up again.',
    'Every round it is free it gains +1 to hit and +1 AC, and its attacks deal an extra 2d8 necrotic. Three rounds after the cut it fills the Sept, and a Ruby Nova follows.',
  ],
  turnStart: [
    { text: 'Free: it grows. Another +1 to hit and +1 AC this round, and its attacks deal an extra 2d8 necrotic. Keep the count in its notes.', notFlag: 'cord' },
  ],
  thresholds: [
    { at: 0, text: 'at 0. If the cord holds, it dies still joined to its mother and she loses all her spells. If it is free, it gains 100 hit points and stands up again: set its hit points, then "Back in the fight".' },
  ],
};

const cordS5 = {
  name: 'The cord', side: 'foe', object: true, ac: 15, hp: 40, immune: ['necrotic', 'poison'],
  sub: 'An object: it takes no turns',
  traits: [
    'It runs 20 feet from Uriel to the Heir. AC 15, 40 hit points, immune to necrotic and poison.',
    'Knell cuts it with any hit.',
    'Zero-One can cut it with the rite she used to raise Uriel: her action, within 5 feet of the cord, and a DC 15 Wisdom check, with advantage if Eric helps.',
    'When it is cut, untick "The cord holds" if it has not cleared itself.',
  ],
  thresholds: [
    { at: 0, clear: 'cord', text: 'it is cut. "What have you done? What have you done? He isn\'t mine anymore. He isn\'t anyone\'s." Uriel loses her spells and takes 50 at the start of each of her turns. The Heir is free, and the party has three rounds to get out.' },
  ],
};

const sept = {
  id: 'sept',
  name: 'The Sept of Bones: Uriel, phase 3',
  where: 'The Sept of Bones (area S5)',
  level: 15,
  rev: 1,
  cards: {
    urielS5, heirS5, cordS5,
    aurorixS5: { from: 'aurorix', name: 'Aurorix', traits: ['He will not go down unless someone talks him into it: he believes their death lies there. "Then let it be mine before it is yours."', 'A young gold dragon in strength. Immune to fire.'] },
    zeroOneS5: { from: 'zeroOneR', name: 'Zero-One', traits: ['The rite at the cord: her action within 5 feet of it, DC 15 Wisdom check, with advantage if Eric helps. "I put the light in you once, Uriel. I can take back what I gave."'] },
    defectorsS5: { from: 'defectors', name: "Matheny's Defectors", traits: ['A crowd of six. Double damage from area effects; below 40 hit points its damage is halved. It cannot be grappled, restrained or knocked prone.'] },
    corsairS5: { from: 'swashbuckler', name: "Roberts' Corsair" },
  },
  party: ['gemma', 'eric', 'dario'],
  start: [['urielS5', 1, 'foe'], ['heirS5', 1, 'foe'], ['cordS5', 1, 'foe']],
  toggles: [
    { key: 'cord', label: 'The cord holds (Uriel and the Heir are joined)', on: true, off: { text: 'The cord is cut. Uriel loses her spells and takes 50 damage at the start of each of her turns. The Heir is free: the party has three rounds to get out, and the climb has to start now.' } },
    { key: 'potions', label: 'The party is under potions of necrotic resistance', on: true, partyResist: ['necrotic'] },
  ],
  lair: {
    name: 'The bone floor',
    init: 20,
    text: 'Four risen guards come out of the bone floor, every round and without limit. Where they rise the floor is broken and counts as difficult terrain. They cannot rise onto the eight-sided platforms.',
    add: [['guardMinion', 4, 'foe']],
    addLabel: 'Four risen guards rise',
  },
  roundEnd: [
    { notFlag: 'cord', text: 'The Heir is free. Count the rounds since the cut: at the end of the third it fills the Sept and the Ruby Nova follows. The stair is 100 feet; a character who Dashes reaches the top in two rounds.' },
  ],
  notes: [
    'Darkness. There is no light except what the party brings. Uriel has darkvision to 60 feet.',
    'The bone floor is cobbled with bones. Wherever guards have risen it is broken and counts as difficult terrain.',
    'The eight-sided platforms are 5 feet high. Draft: a creature on a platform has +2 to ranged attack rolls against creatures on the floor, and guards cannot rise onto them.',
    'The spired pillars give full cover.',
    'The stair is 100 feet long and lit dimly by the statues\' lamps. A character who Dashes reaches the top in two rounds.',
    'Aurorix will not go down unless someone talks him into it.',
    'Kitsune, to Gemma alone: "The child, little sprite. You swore it to me unharmed."',
    'Cutting the cord: AC 15, 40 hit points, immune to necrotic and poison. Knell cuts it with any hit. Zero-One\'s rite: her action within 5 feet, DC 15 Wisdom check, advantage if Eric helps.',
    'If the Heir is free at the end: a Hundreds officer at the top of the shaft ("Mister Pierce\'s compliments. You have very little time to be off this hill"), then Roberts at the boat.',
  ],
  bench: [
    { ref: 'zeroOneS5', n: 1, side: 'pc', note: 'She can cut the cord with the rite.' },
    { ref: 'defectorsS5', n: 1, side: 'pc', note: 'If they came down with the party.' },
    { ref: 'aurorixS5', n: 1, side: 'pc', note: 'Only if talked into it.' },
    { ref: 'estherHalf', n: 1, side: 'pc', note: 'Half-Raised, beside the party. "I\'ll have yours with my hands."' },
    { ref: 'corsairS5', n: 4, side: 'pc', note: 'If Roberts sends them down.' },
    { ref: 'guardMinion', n: 4, side: 'foe', note: 'Four on every lair action.' },
  ],
};

api.register({ trackers: [nosMatre, sept] });
}
