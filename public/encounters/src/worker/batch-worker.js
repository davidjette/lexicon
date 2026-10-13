// Runs the same fight many times off the main thread.

import { Encounter } from '../engine/combat.js?v=mv6a2vqv';
import { setupFromState } from '../data/build.js?v=mv6a2vqv';
import { tally } from '../engine/stats.js?v=mv6a2vqv';
import { installTexts } from '../dm-loader.js?v=mv6a2vqv';

self.onmessage = async (e) => {
  const { state, n, seed0, dmTexts, library } = e.data;
  const runs = [];
  try {
    if (dmTexts) await installTexts(dmTexts);
    if (library) await import('../library/index.js?v=mv6a2vqv');
    for (let i = 0; i < n; i++) {
      runs.push(new Encounter(setupFromState(state, seed0 + i, true)).start().runToEnd());
      if (i % 20 === 0) self.postMessage({ progress: i / n });
    }
    self.postMessage({ progress: 1, done: tally(runs) });
  } catch (err) {
    self.postMessage({ error: String(err && err.stack ? err.stack : err) });
  }
};
