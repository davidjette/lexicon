// The party's heads-up panel under the stage: hit points, concentration, effects and conditions
// for each character, in the same words the encounter builder's live cards use.

const el = (tag, cls, ...kids) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.append(...kids.filter((x) => x !== null && x !== undefined));
  return n;
};

const slotText = (c) => (c.slots ? Object.entries(c.slots).filter(([, n]) => n > 0).map(([l, n]) => `${l}:${n}`).join(' ') : '');

function card(E, c) {
  const pct = Math.max(0, Math.min(100, (100 * c.hp) / Math.max(1, c.maxHp)));
  const fill = el('div');
  fill.style.width = `${pct}%`;
  const bar = el('div', `hpbar ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}`, fill);
  const tags = el('div', 'tags');
  if (c.dead) tags.append(el('span', 'tag bad', 'dead'));
  else if (c.fled) tags.append(el('span', 'tag', 'gone'));
  else if (c.down) tags.append(el('span', 'tag bad', c.stable ? 'stable at 0' : `dying: ${c.ds.s} saved, ${c.ds.f} failed`));
  if (c.conc) tags.append(el('span', 'tag conc', `concentrating: ${c.conc.name}`));
  const seen = new Set();
  for (const f of c.fx) {
    const label = f.cond && f.name && f.name !== f.cond ? `${f.cond} (${f.name})` : f.cond || f.name;
    if (!label || f.id === 'dying' || seen.has(label) || (f.aura && f.conc === c.id)) continue;
    seen.add(label);
    tags.append(el('span', `tag ${f.cond ? 'bad' : 'good'}`, label));
  }
  const res = [];
  if (c.turn && E.current === c && !E.over) res.push(`${c.turn.action ? 'Action' : 'no action'} · ${c.turn.bonus ? 'Bonus' : 'no bonus'}${E.rules.movement ? ` · ${c.turn.move > 0 ? 'Move' : 'no move'}` : ''}`);
  const slots = slotText(c);
  if (slots) res.push(`Slots ${slots}`);
  if (c.pact && c.pact.n > 0) res.push(`Pact ${c.pact.level}:${c.pact.n}`);
  if (E.rules.movement) res.push(`Rank: ${c.pos}`);
  const now = E.current === c && !E.over;
  return el('div', `party-card${now ? ' now' : ''}${c.dead || c.fled ? ' out' : ''}`,
    el('div', 'party-name', c.name),
    el('div', 'party-hp', `HP ${Math.max(0, c.hp)}/${c.maxHp}${c.tempHp ? ` +${c.tempHp} temp` : ''} · AC ${E.acOf(c)}`),
    bar,
    tags,
    res.length ? el('div', 'party-res', res.join(' · ')) : null);
}

export function renderParty(root, E) {
  if (!E) return root.replaceChildren();
  root.replaceChildren(...E.list.filter((c) => c.side === 'pc' && !c.summonedBy).map((c) => card(E, c)));
}
