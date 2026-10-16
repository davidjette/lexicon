// Set-piece fights for the battle page, put together from the library (Dave, 2026-10-12). Each is
// marked demo: true, which is what puts it on the public battle page beside the summit fight.

import { register, ALL } from '../data/registry.js?v=mvadgcsz';

// Zanzibar before his fall. No sheet of his own is in the library, so he fights from Dark
// Zanzibar's sheet under his own name and sprite.
const zanzibar = { ...ALL['hero-dark-zanzibar'], id: 'zanzibar', name: 'Zanzibar', battler: 'zanzibar' };

// Eden herself, for the public page. Her real stat block is DM material, so this is the public
// Hybrid Unit's block with a boss's hit points. PLACEHOLDER numbers until Dave supplies hers.
const edenPrime = { ...ALL.edenHybridUnit, id: 'edenPrime', name: 'Eden', battler: 'eden', boss: true, cr: 12, hp: 180 };

const plain = { switches: [], scenario: () => ({ flags: {} }), demo: true };

register({
  creatures: { zanzibar, edenPrime },
  presets: [
    {
      ...plain,
      id: 'battleAriel',
      name: 'The Battle of the Ariel',
      where: 'The deck of the Ariel, over the desert',
      blurb: 'Kara, Drefan, Brother Magnus, Revan, Roland, Eloise and Zanzibar against Wainwright St. Cloud and four elementals.',
      party: [],
      allies: [['hero-kara', 1], ['hero-drefaen-gallidan', 1], ['hero-brother-magnus', 1], ['hero-revan-nimbus-darkcember', 1],
        ['hero-roland-deschain', 1], ['hero-eloise', 1], ['zanzibar', 1]],
      monsters: [['stCloud', 1], ['srd-earth-elemental', 1], ['srd-water-elemental', 1], ['srd-fire-elemental', 1], ['srd-air-elemental', 1]],
      bg: 'desert-airship.webp',
    },
    {
      ...plain,
      id: 'battleSharn',
      name: 'The Battle of Sharn',
      where: 'A balcony over Sharn',
      blurb: 'Gemma, Eric and Dario against Lord Commander Esther Crona and four of her Honor Guard.',
      monsters: [['lordCommanderEsther', 1], ['honorGuard', 4]],
      bg: 'sharn-balcony.webp',
    },
    {
      ...plain,
      id: 'battleMournland',
      name: 'The Battle of the Mournland Portal',
      where: 'The portal in the Mournland',
      blurb: 'Gemma, Eric and Dario with three knights against Eden and six of her units.',
      allies: [['srd-knight', 3]],
      monsters: [['edenPrime', 1], ['edenHybridUnit', 6]],
      bg: 'mournlands.webp',
    },
    {
      ...plain,
      id: 'battleTannhauser',
      name: 'The Battle of Tannhauser Gate',
      where: 'The bridge',
      blurb: 'Jim Smallberries and Caprica against Captain Catrina McQuade.',
      party: [],
      allies: [['hero-james-x-smallberries-jim', 1], ['hero-caprica', 1]],
      monsters: [['hero-captain-catrina-mcquade', 1]],
      bg: 'starship-bridge.webp',
    },
    {
      ...plain,
      id: 'battleSaltmarsh',
      name: 'The Battle of Saltmarsh',
      where: 'The burning temple',
      blurb: 'Scrunt Pissfoot, Gabriella Hellwood and Dolores Weathervein against a bandit captain, his veterans and the cult that hired them.',
      party: [],
      allies: [['hero-scrunt-pissfoot', 1], ['hero-gabriella-hellwood', 1], ['hero-dolores-weathervein', 1]],
      monsters: [['srd-bandit-captain', 1], ['srd-veteran', 2], ['srd-cult-fanatic', 2], ['srd-cultist', 3]],
      bg: 'burning-temple.webp',
    },
    {
      ...plain,
      id: 'battleEngineRoom',
      name: 'The Engine Room Battle',
      where: 'The engine room',
      blurb: "Barrias, Buttsack, Se7en and Sandy against four will-o'-wisps and an air elemental.",
      party: [],
      allies: [['hero-barrias-ruby-eye', 1], ['hero-buttsack', 1], ['hero-se7en', 1], ['hero-hyperion-tidzan-dassiya-sandy', 1]],
      monsters: [['srd-will-o-wisp', 4], ['srd-air-elemental', 1]],
      bg: 'engine-room.webp',
    },
    {
      // Dave, 2026-10-16: the Shrouded City characters against Vecna, in the ossuary, to the Magus theme
      // (the ossuary's own cue in music/cues.json).
      ...plain,
      id: 'battleShroudedCity',
      name: 'The Battle of Shrouded City',
      where: 'The ossuary beneath the Shrouded City',
      blurb: 'Mortymer, Lucky, Rinn Silverhawk, Roscoe Rumblebottom and Ian McTarley against Vecna the Archlich.',
      party: [],
      allies: [['hero-mortymer', 1], ['hero-lucky', 1], ['hero-rinn-silverhawk', 1], ['hero-roscoe-rumblebottom', 1], ['hero-ian-mctarley', 1]],
      monsters: [['vecna', 1]],
      bg: 'ossuary.webp',
    },
  ],
});
