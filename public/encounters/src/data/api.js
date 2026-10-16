// What a DM pack file is handed. Pack files have no imports of their own, so that they can be
// shipped encrypted and loaded from memory once unlocked.

import * as lib from './lib.js?v=mvacy2w1';
import * as zones from '../engine/zones.js?v=mvacy2w1';
import { rollDice } from '../engine/dice.js?v=mvacy2w1';
import { ALL, register } from './registry.js?v=mvacy2w1';

export function makeApi() {
  return { ...lib, ...zones, rollDice, ALL, M: {}, X: {}, register: (pack) => register(pack, { dm: true }) };
}
