// What a DM pack file is handed. Pack files have no imports of their own, so that they can be
// shipped encrypted and loaded from memory once unlocked.

import * as lib from './lib.js?v=mvadgbdp';
import * as zones from '../engine/zones.js?v=mvadgbdp';
import { rollDice } from '../engine/dice.js?v=mvadgbdp';
import { ALL, register } from './registry.js?v=mvadgbdp';

export function makeApi() {
  return { ...lib, ...zones, rollDice, ALL, M: {}, X: {}, register: (pack) => register(pack, { dm: true }) };
}
