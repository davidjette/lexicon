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
  // spell slots as one short line, highest level last; the full reading is in the tooltip
  const slots = slotText(c);
  const pact = c.pact && c.pact.n > 0 ? `pact ${c.pact.level}:${c.pact.n}` : '';
  const res = [slots, pact].filter(Boolean).join('  ');
  const now = E.current === c && !E.over;
  const head = el('div', 'party-head', el('span', 'party-name', c.name, c.tpl.level && !/level/i.test(c.name) ? el('span', 'party-level', ` · level ${c.tpl.level}`) : null), el('span', 'party-hp', `${Math.max(0, c.hp)}/${c.maxHp}${c.tempHp ? ` +${c.tempHp}` : ''} · AC ${E.acOf(c)}`));
  const slotLine = res ? el('div', 'party-res', `Slots ${res}`) : null;
  if (slotLine) slotLine.title = 'Spell slots left, as level:count';
  return el('div', `party-card${now ? ' now' : ''}${c.dead || c.fled ? ' out' : ''}`, head, bar, tags, slotLine);
}

export function renderParty(root, E) {
  if (!E) return root.replaceChildren();
  root.replaceChildren(...E.list.filter((c) => c.side === 'pc' && !c.summonedBy).map((c) => card(E, c)));
}
