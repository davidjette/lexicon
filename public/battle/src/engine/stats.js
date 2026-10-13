// Summaries over many runs of the same fight.

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export function tally(runs) {
  const n = runs.length;
  const results = {};
  for (const r of runs) results[r.result] = (results[r.result] || 0) + 1;
  const names = runs[0].pcs.map((p) => p.name);
  const pcs = names.map((name, i) => {
    const rows = runs.map((r) => r.pcs[i]).filter(Boolean);
    return {
      name,
      pc: rows[0].pc,
      dropped: pct(rows.filter((x) => x.downs > 0 || x.dead).length, n),
      died: pct(rows.filter((x) => x.dead).length, n),
      meanDowns: Math.round(mean(rows.map((x) => x.downs)) * 100) / 100,
      meanTaken: Math.round(mean(rows.map((x) => x.taken))),
      meanDealt: Math.round(mean(rows.map((x) => x.dealt))),
      meanHpLeft: Math.round(mean(rows.map((x) => x.hp))),
      meanSlotsLeft: Math.round(mean(rows.map((x) => x.slotsLeft)) * 10) / 10,
    };
  });
  const core = (r) => r.pcs.filter((p) => p.pc);
  const bosses = {};
  for (const r of runs) {
    for (const m of r.monsters.filter((x) => x.boss)) {
      const b = (bosses[m.tpl] = bosses[m.tpl] || { name: m.name, killed: 0, fled: 0, hpLeft: [], seen: 0 });
      b.seen += 1;
      if (m.dead || m.down) b.killed += 1;
      else if (m.fled) b.fled += 1;
      b.hpLeft.push(m.hp);
    }
  }
  const rounds = runs.map((r) => r.rounds);
  const pick = (res, fn) => {
    const pool = runs.filter((r) => r.result === res);
    return pool.length ? pool.sort(fn)[Math.floor(pool.length / 2)].seed : null;
  };
  return {
    n,
    results,
    win: pct((results.victory || 0) + (results.escaped || 0), n),
    victory: pct(results.victory || 0, n),
    escaped: pct(results.escaped || 0, n),
    defeat: pct(results.defeat || 0, n),
    withdrew: pct(results.withdrew || 0, n),
    timeout: pct(results.timeout || 0, n),
    dragon: pct(results.dragon || 0, n),
    anyDeath: pct(runs.filter((r) => core(r).some((p) => p.dead)).length, n),
    anyDrop: pct(runs.filter((r) => core(r).some((p) => p.downs > 0 || p.dead)).length, n),
    allDead: pct(runs.filter((r) => core(r).every((p) => p.dead)).length, n),
    rounds: { mean: Math.round(mean(rounds) * 10) / 10, median: median(rounds), min: Math.min(...rounds), max: Math.max(...rounds) },
    pcs,
    bosses: Object.values(bosses).map((b) => ({ name: b.name, killed: pct(b.killed, b.seen), fled: pct(b.fled, b.seen), meanHpLeft: Math.round(mean(b.hpLeft)) })),
    sampleSeeds: {
      victory: pick('victory', (a, b) => a.rounds - b.rounds),
      escaped: pick('escaped', (a, b) => a.rounds - b.rounds),
      defeat: pick('defeat', (a, b) => a.rounds - b.rounds),
    },
  };
}

export function formatTally(t) {
  const lines = [];
  lines.push(`${t.n} runs: party holds the field ${t.win}% (kills everything ${t.victory}%, boss driven off ${t.escaped}%), party down ${t.defeat}%${t.withdrew ? `, withdrew ${t.withdrew}%` : ''}${t.timeout ? `, no result ${t.timeout}%` : ''}${t.dragon ? `, the dragon wakes ${t.dragon}%` : ''}`);
  lines.push(`rounds: mean ${t.rounds.mean}, median ${t.rounds.median}, range ${t.rounds.min}-${t.rounds.max}`);
  lines.push(`at least one PC dropped ${t.anyDrop}%, at least one PC dead ${t.anyDeath}%, all dead ${t.allDead}%`);
  for (const p of t.pcs) lines.push(`  ${p.name.padEnd(28)} dropped ${String(p.dropped).padStart(5)}%  died ${String(p.died).padStart(5)}%  took ${String(p.meanTaken).padStart(4)}  dealt ${String(p.meanDealt).padStart(4)}  HP left ${String(p.meanHpLeft).padStart(3)}  slots left ${p.meanSlotsLeft}`);
  for (const b of t.bosses) lines.push(`  ${b.name.padEnd(28)} killed ${b.killed}%  left the fight ${b.fled}%  mean HP left ${b.meanHpLeft}`);
  const s = t.sampleSeeds;
  lines.push(`sample seeds: victory ${s.victory ?? '-'}, driven off ${s.escaped ?? '-'}, defeat ${s.defeat ?? '-'}`);
  return lines.join('\n');
}
