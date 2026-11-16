// What a DM pack file is handed. Pack files have no imports of their own, so that they can be
// shipped encrypted and loaded from memory once unlocked.

import * as lib from './lib.js?v=mwjk6oid';
import * as zones from '../engine/zones.js?v=mwjk6oid';
import { rollDice } from '../engine/dice.js?v=mwjk6oid';
import { ALL, register } from './registry.js?v=mwjk6oid';

export function makeApi() {
  return { ...lib, ...zones, rollDice, ALL, M: {}, X: {}, register: (pack) => register(pack, { dm: true }) };
}
