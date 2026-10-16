// Runs the same fight many times off the main thread.

import { Encounter } from '../engine/combat.js?v=mva9wh65';
import { setupFromState } from '../data/build.js?v=mva9wh65';
import { tally } from '../engine/stats.js?v=mva9wh65';
import { installTexts } from '../dm-loader.js?v=mva9wh65';

self.onmessage = async (e) => {
  const { state, n, seed0, dmTexts, library } = e.data;
  const runs = [];
  try {
    if (dmTexts) await installTexts(dmTexts);
    if (library) await import('../library/index.js?v=mva9wh65');
    for (let i = 0; i < n; i++) {
      runs.push(new Encounter(setupFromState(state, seed0 + i, true)).start().runToEnd());
      if (i % 20 === 0) self.postMessage({ progress: i / n });
    }
    self.postMessage({ progress: 1, done: tally(runs) });
  } catch (err) {
    self.postMessage({ error: String(err && err.stack ? err.stack : err) });
  }
};
