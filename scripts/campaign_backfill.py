"""Propose, then write, the `campaigns:` front matter that the campaign pages read.

    python scripts/campaign_backfill.py            # propose: prints coverage, writes drafts/campaign-backfill.{md,json}
    python scripts/campaign_backfill.py --write    # apply drafts/campaign-backfill.json to the articles

The proposal is evidence only. Nothing is written to an article until the JSON has been reviewed;
edit the JSON by hand to correct it, then run --write.

Evidence, strongest first:
  seed    the article is a campaign's overview, arc or player character
  slug    a session's file name carries the campaign's prefix
  field   fields.campaign or fields.setting names the campaign
  tag     a tag names the campaign
  hub     a session, arc or overview of the campaign links to the article (n = how many do)
  neighbour  nothing above applies; most of the articles it links to or is linked from are in the campaign

    python scripts/campaign_backfill.py --remove   # take the campaigns: block back out of every article
"""
import glob
import json
import os
import re
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'src', 'content', 'docs')
OUT = os.path.join(ROOT, 'drafts')

AGES, TWAT, DMH, UNF, USB, STAR = (
    'ages-of-the-infanta', 'ghosts-of-twatmarsh', 'dead-mans-hand', 'unforeseen', 'the-unforeseen-strike-back', 'starfall-tng')
ORDER = [AGES, TWAT, DMH, UNF, USB, STAR]

SEEDS = {
    AGES: ['lore/temple-holdings-llc', 'lore/arcaneum-campaign'] + ['history/arc-'],
    TWAT: ['lore/ghosts-of-twatmarsh'],
    DMH: ['lore/dead-mans-hand'],
    UNF: ['organizations/the-unforeseen', 'people/esther-crona', 'people/uriel-qualanthri', 'people/locke-pierce', 'people/john-c-lebeefe'],
    USB: ['organizations/the-inevitables', 'history/the-leef-newham-arc', 'people/gemma-corso', 'people/sir-dario-argentino', 'people/eric-the-cleric'],
    STAR: ['lore/starfall-the-next-generation', 'history/light-of-xaryxis', 'history/the-starsong-awakens'],
}
OVERVIEW = {AGES: 'lore/temple-holdings-llc', TWAT: 'lore/ghosts-of-twatmarsh', DMH: 'lore/dead-mans-hand',
            UNF: 'organizations/the-unforeseen', USB: 'organizations/the-inevitables', STAR: 'lore/starfall-the-next-generation'}
SESSION_PREFIX = {'episode-': UNF, 'throne-room-details': UNF, 'leef-': USB, 'sharn-': USB, 'korth-': USB, 'dead-mans-hand-': DMH}
FIELD = {'temple holdings': AGES, "dead man's hand": DMH, 'starfall': STAR}
TAGS = {"Dead Man's Hand": DMH, 'Starfall': STAR, 'The Starsong Awakens': STAR, 'Light of Xaryxis': STAR,
        'Ghosts of Twatmarsh': TWAT, 'Temple Holdings LLC': AGES, 'Arcaneum': AGES,
        'Leef / Newham arc': USB, 'Unforeseen Strikes Back': USB}
GROUP = {'people': 'People', 'places': 'Places', 'organizations': 'Organizations', 'history': 'History',
         'sessions': 'Sessions', 'items': 'Items & Lore', 'lore': 'Items & Lore', 'species': 'Items & Lore'}
LINK = re.compile(r'\]\(/((?:people|places|organizations|history|sessions|items|lore|species)/[a-z0-9-]+)/?(?:#[^)]*)?\)')
FM = re.compile(r'^---\r?\n(.*?)\r?\n---\r?\n?(.*)$', re.S)


def load():
    arts = {}
    for p in sorted(glob.glob(os.path.join(DOCS, '*', '*.md'))):
        key = os.path.relpath(p, DOCS).replace(os.sep, '/')[:-3]
        m = FM.match(open(p, encoding='utf-8').read())
        if not m or key.endswith('/index'):
            continue
        data = yaml.safe_load(m.group(1)) or {}
        if data.get('draft'):
            continue
        arts[key] = {'path': p, 'data': data, 'links': set(LINK.findall(m.group(2))) - {key}}
    return arts


def propose(arts):
    ev = {k: {} for k in arts}  # article -> campaign -> [evidence]

    def add(key, campaign, why):
        ev[key].setdefault(campaign, []).append(why)

    for key, a in arts.items():
        d, slug = a['data'], key.split('/')[1]
        for c, seeds in SEEDS.items():
            if any(key == s or (s.endswith('-') and key.startswith(s)) for s in seeds):
                add(key, c, 'seed')
        if key.startswith('sessions/'):
            for prefix, c in SESSION_PREFIX.items():
                if slug.startswith(prefix):
                    add(key, c, 'slug')
        fields = d.get('fields') or {}
        for name in ('campaign', 'setting'):
            for needle, c in FIELD.items():
                if needle in str(fields.get(name, '')).lower():
                    add(key, c, 'field')
        for t in d.get('tags') or []:
            if t in TAGS:
                add(key, TAGS[t], 'tag')

    # hubs: the narrative articles of each campaign, whose links say who and what was in it
    hubs = {c: [k for k in arts if any(w in ('seed', 'slug') for w in ev[k].get(c, []))
                and k.split('/')[0] in ('sessions', 'history', 'lore', 'organizations')] for c in ORDER}
    # a session belongs to the campaign it was played in, and an overview to its own campaign
    fixed = {k for k in arts if k.startswith('sessions/') and ev[k]} | set(OVERVIEW.values())
    for c in ORDER:
        counts = {}
        for h in hubs[c]:
            for target in arts[h]['links']:
                if target in arts and target not in fixed:
                    counts[target] = counts.get(target, 0) + 1
        for target, n in counts.items():
            add(target, c, f'hub x{n}')

    # what is still unplaced takes the campaigns of the articles it links to and is linked from,
    # when one campaign (or the two Eberron campaigns together) holds most of them
    inbound = {k: set() for k in arts}
    for k, a in arts.items():
        for t in a['links']:
            if t in arts:
                inbound[t].add(k)
    placed = {k: set(per) for k, per in ev.items()}
    for key in [k for k in arts if not ev[k]]:
        near = [n for n in (arts[key]['links'] & set(arts)) | inbound[key] if placed[n]]
        tally = {c: sum(c in placed[n] for n in near) for c in ORDER}
        top = max(tally.values(), default=0)
        if top:
            for c in ORDER:
                if tally[c] >= 0.6 * top:
                    add(key, c, f'neighbour x{tally[c]} of {len(near)}')
    return ev


def strength(whys):
    return 'certain' if any(w in ('seed', 'slug', 'field', 'tag') for w in whys) else 'proposed'


def report(arts, ev):
    os.makedirs(OUT, exist_ok=True)
    groups = ['People', 'Places', 'Organizations', 'History', 'Sessions', 'Items & Lore']
    table = {c: {g: [0, 0] for g in groups} for c in ORDER}
    for key, per in ev.items():
        for c, whys in per.items():
            table[c][GROUP[key.split('/')[0]]][0 if strength(whys) == 'certain' else 1] += 1
    lines = ['# Campaign backfill proposal', '', 'Counts are certain + proposed.', '',
             '| Campaign | ' + ' | '.join(groups) + ' | Total |', '|---|' + '---|' * (len(groups) + 1)]
    for c in ORDER:
        cells = [f'{table[c][g][0]} + {table[c][g][1]}' for g in groups]
        lines.append(f'| {c} | ' + ' | '.join(cells) + f' | {sum(sum(v) for v in table[c].values())} |')
    unassigned = sorted(k for k, per in ev.items() if not per)
    both = sorted(k for k, per in ev.items() if UNF in per and USB in per)
    multi = sorted((k for k, per in ev.items() if len(per) >= 3), key=lambda k: -len(ev[k]))
    lines += ['', f'Articles: {len(arts)}. Unassigned: {len(unassigned)}. In both Eberron campaigns: {len(both)}. In three or more: {len(multi)}.']
    print('\n'.join(lines))

    def row(k):
        return f'- `{k}` ' + '; '.join(f'{c}: {", ".join(w)}' for c, w in sorted(ev[k].items(), key=lambda x: ORDER.index(x[0])))
    for c in ORDER:
        lines += ['', f'## {c}']
        for g in groups:
            members = sorted(k for k, per in ev.items() if c in per and GROUP[k.split('/')[0]] == g)
            if members:
                lines += ['', f'### {g} ({len(members)})'] + [f'- `{k}` ({strength(ev[k][c])}: {", ".join(ev[k][c])})' for k in members]
    lines += ['', f'## In both Eberron campaigns ({len(both)})'] + [row(k) for k in both]
    lines += ['', f'## In three or more campaigns ({len(multi)})'] + [row(k) for k in multi]
    lines += ['', f'## Unassigned ({len(unassigned)})'] + [f'- `{k}`' for k in unassigned]
    open(os.path.join(OUT, 'campaign-backfill.md'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')
    proposal = {k: [c for c in ORDER if c in per] for k, per in sorted(ev.items()) if per}
    json.dump(proposal, open(os.path.join(OUT, 'campaign-backfill.json'), 'w', encoding='utf-8', newline='\n'), indent=1)
    print(f'\nWrote drafts/campaign-backfill.md and drafts/campaign-backfill.json ({len(proposal)} articles).')


def write(arts, proposal):
    """Set each article's campaigns: block (last key of the front matter); an empty list removes it."""
    changed = 0
    for key, a in arts.items():
        campaigns = proposal.get(key, [])
        raw = open(a['path'], encoding='utf-8', newline='').read()
        m = re.match(r'^(---\r?\n)(.*?)(\r?\n---\r?\n?)', raw, re.S)
        nl = '\r\n' if '\r\n' in m.group(1) else '\n'
        fm = re.sub(r'^campaigns:.*?(?=^\S|\Z)', '', m.group(2) + nl, flags=re.S | re.M).rstrip('\r\n')
        block = nl + 'campaigns:' + ''.join(f'{nl}  - {c}' for c in campaigns) if campaigns else ''
        new = m.group(1) + fm + block + m.group(3) + raw[m.end():]
        if new != raw:
            open(a['path'], 'w', encoding='utf-8', newline='').write(new)
            changed += 1
    print(f'Changed {changed} articles.')


if __name__ == '__main__':
    articles = load()
    if '--write' in sys.argv:
        write(articles, json.load(open(os.path.join(OUT, 'campaign-backfill.json'), encoding='utf-8')))
    elif '--remove' in sys.argv:
        write(articles, {})
    else:
        report(articles, propose(articles))
