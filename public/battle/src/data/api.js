// What a DM pack file is handed. Pack files have no imports of their own, so that they can be
// shipped encrypted and loaded from memory once unlocked.

import * as lib from './lib.js?v=mva9wfpj';
import * as zones from '../engine/zones.js?v=mva9wfpj';
import { rollDice } from '../engine/dice.js?v=mva9wfpj';
import { ALL, register } from './registry.js?v=mva9wfpj';

export function makeApi() {
  return { ...lib, ...zones, rollDice, ALL, M: {}, X: {}, register: (pack) => register(pack, { dm: true }) };
}
