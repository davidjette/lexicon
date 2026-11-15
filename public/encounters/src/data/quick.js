// One-click groups for the Encounter Builder: whole parties for the left side, and a villain with
// their following for the right. Only ids are kept here; anything not loaded (the wider library
// arrives after the page, the Lazaret files after that) is skipped until it is.

// Each party also heads its own group in the party side's list, in this order.
export const PARTIES = [
  { name: 'The Inevitables', note: 'Sharn and Korth', ids: ['gemma', 'eric', 'dario'] },
  { name: 'The Unforeseen', note: 'the first Karrnath campaign',
    ids: ['hero-uriel-qualanthri', 'hero-esther-crona', 'hero-locke-pierce', 'hero-lord-john-c-lebeouf', 'hero-richard-blaze'] },
  // the eleven of the party portrait; Zanzibar before his fall
  { name: 'Temple Holdings', note: 'Ages of the Infanta',
    ids: ['hero-kara', 'hero-revan-nimbus-darkcember', 'hero-brother-magnus', 'hero-drefaen-gallidan', 'hero-eloise', 'hero-roland-deschain',
      'zanzibar', 'hero-sir-cuthbert-velvet-couch', 'hero-stoth-youngglade', 'hero-arana-mageblood', 'hero-yoshi'] },
  // the company of Dead Man's Hand. Rodriel has no sheet in the library; Tripp Sandhill stands eighth.
  { name: 'Fateful Eight', note: "Dead Man's Hand",
    ids: ['hero-heyu', 'hero-lenore-bishop', 'hero-shadowhigh', 'hero-maverick-asswell-dela-nubenoir', 'hero-battle-beast',
      'hero-n-i-c-c-o-l-o-mach-v', 'hero-barold-the-ram-bonds', 'hero-tripp-sandhill'] },
  { name: 'Twatmarsh 3', note: "Neptune's Rejects", ids: ['hero-gabriella-hellwood', 'hero-scrunt-pissfoot', 'hero-dolores-weathervein'] },
  // the captain and the five division heads of the crew roster
  { name: 'SSJ Zanzibar', note: 'Starfall: the command crew',
    ids: ['hero-james-x-smallberries-jim', 'hero-hyperion-tidzan-dassiya-sandy', 'hero-caprica', 'hero-barrias-ruby-eye', 'hero-dr-glup', 'hero-buttsack'] },
];

// The rest of each campaign's characters are listed under the same heading as its party.
export const PARTY_OF_CAMPAIGN = {
  'Characters: The Unforeseen': 'The Unforeseen',
  'Characters: Ages of the Infanta': 'Temple Holdings',
  "Characters: Dead Man's Hand": 'Fateful Eight',
  'Characters: Ghosts of Twatmarsh': 'Twatmarsh 3',
  'Characters: Starfall The Next Generation': 'SSJ Zanzibar',
};

// A villain and their following: [id, how many]. Numbers are the ones the set fights use. The
// Lazaret's groups are registered by its own file (src/dm/revised.js, `quick`) and are shown after these.
export const FOES = [
  { name: 'Thar and his druids', list: [['redBird', 1], ['darkDruid', 4]] },
  { name: 'Esther and the Iron Veil', list: [['lordCommanderEsther', 1], ['honorGuard', 4]] },
  { name: 'Faith Zeir and the Children', list: [['faithZeir', 1], ['childOfEmber', 4]] },
  { name: 'Malrik Zeir and Umbra', list: [['malrikZeir', 1], ['recruiter', 3]] },
  { name: 'Eden and her units', list: [['edenPrime', 1], ['edenHybridUnit', 6]] },
  { name: 'St. Cloud and his elementals', list: [['stCloud', 1], ['srd-earth-elemental', 1], ['srd-water-elemental', 1], ['srd-fire-elemental', 1], ['srd-air-elemental', 1]] },
  { name: 'Gorrelach & Gunt and spawn', list: [['gorrelachGunt', 1], ['maggotSpawn', 4]] },
  { name: 'Archmage Valen', list: [['valen', 1]] },
  { name: 'Panahedradom', list: [['panahedradom', 1]] },
  { name: 'Vecna', list: [['vecna', 1]] },
];
