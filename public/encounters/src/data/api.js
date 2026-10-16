// What a DM pack file is handed. Pack files have no imports of their own, so that they can be
// shipped encrypted and loaded from memory once unlocked.

import * as lib from './lib.js?v=mvac1ufw';
import * as zones from '../engine/zones.js?v=mvac1ufw';
import { rollDice } from '../engine/dice.js?v=mvac1ufw';
import { ALL, register } from './registry.js?v=mvac1ufw';

export function makeApi() {
  return { ...lib, ...zones, rollDice, ALL, M: {}, X: {}, register: (pack) => register(pack, { dm: true }) };
}
