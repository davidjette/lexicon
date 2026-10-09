"""Review the articles that have no lead image: does a picture make sense, is there already one on the
site that would serve (whole or cropped), or should one be generated? The queue is
drafts/image-queue.json (gitignored); nothing here touches an article.

  python scripts/image_queue.py scan
      Lists every article with no lead image that has at least --min-words words OR at least
      --min-links other articles linking to it (defaults 300 and 5). Sealed articles and placeholders
      are left out. For each it collects the images already on the site that name it: its own gallery,
      and any album photo, chat photo, map, card, portrait, upload or other article's image whose
      caption or file name carries the article's title or one of its other names. Prints the size of
      the job and writes the queue, keeping reviews already done. --kinds people,places limits it.

  python scripts/image_queue.py review --limit 20
      For queued articles not yet reviewed, asks Claude (headless `claude -p`, no tools) for a verdict
      under house/image-brief.md: existing (use this image), crop (cut it from this one), generate
      (with a prompt, alt text and caption) or none. Most-linked first, --batch articles per request.
      Claude reads captions, not pictures: an existing or crop verdict still needs a look.

  python scripts/image_queue.py show [--verdict generate]
      Prints the verdicts for review. Edit drafts/image-queue.json to change one.

Generate from a reviewed entry with scripts/gen_image.py gen <kind/slug> "<prompt>" --size <size>.
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'src', 'content', 'docs')
IMAGES = os.path.join(ROOT, 'public', 'images')
DATA = os.path.join(ROOT, 'src', 'data')
QUEUE = os.path.join(ROOT, 'drafts', 'image-queue.json')
BRIEF = os.path.join(ROOT, 'house', 'image-brief.md')
SIZES = {'people': '1024x1536', 'species': '1024x1536', 'items': '1024x1024'}  # everything else is landscape
LANDSCAPE = '1536x1024'
IMAGE_TOKENS = 1372  # the most one image has cost so far, at any of the three sizes
MAX_ARTICLE_CHARS = 12000
MAX_CANDIDATES = 8
NAMED_FOLDERS = ('cards', 'site', 'portraits', 'minis', 'starsong', 'documents', 'album', 'uploads')
REVIEWED = ('verdict', 'use', 'reason', 'prompt', 'alt', 'caption', 'size', 'cost_usd')


def articles():
    out = {}
    for path in glob.glob(os.path.join(DOCS, '*', '*.md')):
        t = open(path, encoding='utf-8').read()
        if not t.startswith('---'):
            continue
        end = t.index('\n---', 3)
        slug = os.path.relpath(path, DOCS).replace(os.sep, '/')[:-3]
        out[slug] = (t[:end], t[end + 4:])
    return out


def unsealed(body):
    body = re.sub(r'^:::redacted.*?^:::\s*$', '', body, flags=re.S | re.M)
    body = re.sub(r':redacted\[[^\]]*\](\{[^}]*\})?', '', body)
    return re.sub(r'<!--.*?-->', '', body, flags=re.S)


def unquote(s):
    s = s.strip()
    if s[:1] == '"':
        try:
            return json.loads(s)
        except ValueError:
            pass
    return s.strip('"\'')


def front_images(fm):
    """(src, alt + caption) for the lead image and gallery in one article's front matter."""
    out = []
    for m in re.finditer(r'src:\s*(\S+)((?:\n\s+(?:alt|caption):[^\n]*)*)', fm):
        text = ' - '.join(unquote(x) for x in re.findall(r'(?:alt|caption):\s*([^\n]*)', m.group(2)))
        out.append((m.group(1), text))
    return out


def names(fm, body):
    title = re.search(r'^title:\s*(.+)$', fm, re.M)
    found = [unquote(title.group(1))] if title else []
    aka = re.search(r'^\*Also known as:\*\s*(.+)$', body, re.M)
    if aka:
        line = re.sub(r'<small>.*?</small>|\([^)]*\)', '', aka.group(1))
        found += [re.sub(r'[*_"“”\[\]]', '', n).strip() for n in line.split('·')]
    found = [re.sub(r'^the\s+', '', n, flags=re.I) for n in found]
    return [n for n in dict.fromkeys(found) if len(n) >= 4]


def image_index(arts):
    """Every image already on the site that has words attached: [src, text, where]."""
    index = {}
    def add(src, text, where):
        if src not in index:
            index[src] = [src, text, where]
        elif text and text.lower() not in index[src][1].lower():
            index[src][1] += ' - ' + text
    for e in json.load(open(os.path.join(DATA, 'gallery.json'), encoding='utf-8')):
        add(e['src'], e.get('caption', ''), 'album photo')
    for e in json.load(open(os.path.join(DATA, 'gallery-chat.json'), encoding='utf-8')):
        add(e['src'], f"{e.get('title', '')} - {e.get('description', '')}", 'chat photo')
    for e in json.load(open(os.path.join(DATA, 'maps.json'), encoding='utf-8')):
        add(e['src'], e.get('title', ''), 'map')
    for folder in NAMED_FOLDERS:
        for f in sorted(os.listdir(os.path.join(IMAGES, folder))):
            stem, ext = os.path.splitext(f)
            if ext.lower() not in ('.webp', '.png', '.jpg', '.jpeg', '.gif'):
                continue
            words = re.sub(r'-m[a-z0-9]{7}$|-\d+$', '', stem).replace('-', ' ')
            add(f'/images/{folder}/{f}', words, folder)
    for slug, (fm, _) in arts.items():
        for src, text in front_images(fm):
            add(src, text, 'on ' + slug)
            if not index[src][2].endswith(slug) and 'on ' + slug not in index[src][2]:
                index[src][2] += ', on ' + slug
    return list(index.values())


def candidates(slug, fm, body, index):
    own = {src for src, _ in front_images(fm)}
    out = []
    for name in names(fm, body):
        pat = re.compile(r'(?<!\w)' + re.escape(name).replace(r'\ ', r'[\s-]+') + r'(?!\w)', re.I)
        for src, text, where in index:
            if src in own or any(c['src'] == src for c in out):
                continue
            m = pat.search(text)
            if m:
                out.append({'src': src, 'text': text[:240], 'where': where, 'match': 'named' if m.start() == 0 else 'mentioned'})
    out.sort(key=lambda c: c['match'] != 'named')
    return out[:MAX_CANDIDATES]


def load():
    return json.load(open(QUEUE, encoding='utf-8')) if os.path.exists(QUEUE) else []


def save(queue):
    os.makedirs(os.path.dirname(QUEUE), exist_ok=True)
    json.dump(queue, open(QUEUE, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)


def scan(a):
    arts = articles()
    index = image_index(arts)
    inbound = {s: set() for s in arts}
    for slug, (_, body) in arts.items():
        for target in set(re.findall(r'\]\(/([a-z]+/[^/)#]+)/?[)#]', body)):
            if target in inbound and target != slug:
                inbound[target].add(slug)
    kinds = set(a.kinds.split(',')) if a.kinds else None
    open_ = []
    for slug, (fm, body) in arts.items():
        if re.search(r'^(image|redacted):', fm, re.M) or re.search(r'^needsSource:\s*true', fm, re.M):
            continue
        if kinds and slug.split('/')[0] not in kinds:
            continue
        title = re.search(r'^title:\s*(.+)$', fm, re.M)
        open_.append({'article': slug, 'title': unquote(title.group(1)) if title else slug,
                      'words': len(re.findall(r'\w+', unsealed(body))), 'links': len(inbound[slug])})

    print(f'{len(arts)} articles, {len(open_)} with no lead image (sealed and placeholder articles left out)')
    print(f'{len(index)} existing images with a caption, title or name to match against\n')
    print('How many qualify at other thresholds (words OR links):')
    for w in (150, 300, 600, 1000):
        print(f'  {w:>5} words: ' + '  '.join(
            f'{l} links -> {sum(1 for e in open_ if e["words"] >= w or e["links"] >= l):>3}' for l in (3, 5, 10)))

    picked = [e for e in open_ if e['words'] >= a.min_words or e['links'] >= a.min_links]
    picked.sort(key=lambda e: (-e['links'], -e['words']))
    old = {e['article']: e for e in load()}
    for e in picked:
        fm, body = arts[e['article']]
        e['size'] = SIZES.get(e['article'].split('/')[0], LANDSCAPE)
        e['gallery'] = [{'src': s, 'text': t[:240]} for s, t in front_images(fm)]
        e['existing'] = candidates(e['article'], fm, body, index)
        for k in REVIEWED:
            if k in old.get(e['article'], {}):
                e[k] = old[e['article']][k]
    save(picked)

    def bucket(e):
        if e['gallery']:
            return 'has its own gallery to promote from'
        if any(c['match'] == 'named' for c in e['existing']):
            return 'an existing image is named for it'
        if e['existing']:
            return 'mentioned in an existing caption (crop or reuse?)'
        return 'nothing on the site names it'
    print(f'\nQueued at {a.min_words} words or {a.min_links} links: {len(picked)}')
    kinds_ = sorted({e['article'].split('/')[0] for e in picked})
    print(f'  {"":<50}' + ''.join(f'{k[:6]:>7}' for k in kinds_) + '  total')
    for b in ('has its own gallery to promote from', 'an existing image is named for it',
              'mentioned in an existing caption (crop or reuse?)', 'nothing on the site names it'):
        row = [sum(1 for e in picked if bucket(e) == b and e['article'].startswith(k + '/')) for k in kinds_]
        print(f'  {b:<50}' + ''.join(f'{n:>7}' for n in row) + f'{sum(row):>7}')
    chars = sum(min(len(unsealed(arts[e['article']][1])), MAX_ARTICLE_CHARS) for e in picked)
    done = sum(1 for e in picked if e.get('verdict'))
    print(f'\n  already reviewed: {done}')
    print(f'  article text Claude would read: about {chars // 4:,} tokens (articles cut at {MAX_ARTICLE_CHARS:,} characters)')
    print(f'  if every one were generated, one picture each: up to {len(picked) * IMAGE_TOKENS:,} OpenAI image tokens')
    print(f'\nWrote {os.path.relpath(QUEUE, ROOT)}')


def ask_claude(text):
    exe = shutil.which('claude')
    if not exe:
        sys.exit('the claude CLI is not on PATH')
    cmd = [exe, '-p', '--output-format', 'json', '--max-budget-usd', '2',
           '--disallowedTools', 'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Agent']
    r = subprocess.run(cmd, cwd=ROOT, input=text, capture_output=True, text=True, encoding='utf-8', timeout=600)
    data = json.loads(r.stdout)
    if data.get('is_error'):
        raise RuntimeError(str(data.get('result'))[:300])
    m = re.search(r'\{.*\}', data.get('result') or '', re.S)
    return json.loads(m.group(0)), data.get('total_cost_usd') or 0, data.get('usage') or {}


def review(a):
    queue, arts, brief = load(), articles(), open(BRIEF, encoding='utf-8').read()
    todo = [e for e in queue if not e.get('verdict') and e['article'] in arts][:a.limit]
    spent = tokens = done = 0
    # Several articles per request: each headless request carries a large fixed overhead.
    for start in range(0, len(todo), a.batch):
        group = todo[start:start + a.batch]
        text = (brief + '\n\nSeveral articles follow. Judge each one separately. Reply with one JSON object and nothing '
                'else, mapping each ARTICLE value to its own answer object.')
        for e in group:
            fm, body = arts[e['article']]
            desc = re.search(r'^description:\s*(.+)$', fm, re.M)
            have = [f"- {c['src']} (in its own gallery): {c['text']}" for c in e.get('gallery', [])]
            have += [f"- {c['src']} ({c['where']}): {c['text']}" for c in e.get('existing', [])]
            text += (f"\n\n=====\n\nARTICLE: {e['article']}\nTITLE: {e['title']}\n"
                     f"DESCRIPTION: {unquote(desc.group(1)) if desc else ''}\n"
                     f"IMAGES ALREADY ON THE SITE THAT NAME IT:\n" + ('\n'.join(have) or '- none') +
                     f"\n\n{unsealed(body)[:MAX_ARTICLE_CHARS]}")
        try:
            out, cost, usage = ask_claude(text)
        except Exception as err:  # noqa: BLE001
            print(f'batch of {len(group)} from {group[0]["article"]}: failed, {err}')
            continue
        spent += cost
        tokens += sum(v for k, v in usage.items() if k.endswith('_tokens') and isinstance(v, int))
        for e in group:
            o = out.get(e['article']) or {}
            ok = o.get('verdict') in ('existing', 'crop', 'generate', 'none') and (
                all(o.get(k) for k in ('prompt', 'alt', 'caption')) if o['verdict'] == 'generate' else True)
            if not ok:
                print(f'  {e["article"]}: no usable answer')
                continue
            for k in REVIEWED:
                e.pop(k, None) if k != 'size' else None
            e.update({k: o[k] for k in ('verdict', 'use', 'reason', 'prompt', 'alt', 'caption') if o.get(k)})
            e['cost_usd'] = round(cost / len(group), 4)
            if o.get('size') in ('1024x1024', '1536x1024', '1024x1536'):
                e['size'] = o['size']
            done += 1
        save(queue)
        print(f'[{min(start + a.batch, len(todo))}/{len(todo)}] ${cost:.3f} for {len(group)}')
    left = sum(1 for e in queue if not e.get('verdict'))
    print(f'\n{done} reviewed, ${spent:.2f} and {tokens:,} Claude tokens (cached reads included); {left} still to review')
    tally(queue)


def tally(queue):
    got = [e['verdict'] for e in queue if e.get('verdict')]
    print('verdicts so far: ' + ', '.join(f'{v} {got.count(v)}' for v in ('existing', 'crop', 'generate', 'none')))


def show(a):
    queue = load()
    for e in queue:
        if not e.get('verdict') or (a.verdict and e['verdict'] != a.verdict):
            continue
        print(f"\n{e['article']}  ({e['words']} words, {e['links']} links)  ->  {e['verdict'].upper()}"
              + (f"  {e['use']}" if e.get('use') else '') + f"\n  why:     {e.get('reason', '')}")
        if e['verdict'] == 'generate':
            print(f"  prompt:  {e['prompt']}\n  alt:     {e['alt']}\n  caption: {e['caption']}\n  size:    {e['size']}")
    print()
    tally(queue)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('scan')
    s.add_argument('--min-words', type=int, default=300)
    s.add_argument('--min-links', type=int, default=5)
    s.add_argument('--kinds', help='comma-separated, e.g. people,places')
    s.set_defaults(run=scan)
    rv = sub.add_parser('review')
    rv.add_argument('--limit', type=int, default=10)
    rv.add_argument('--batch', type=int, default=10, help='articles per request')
    rv.set_defaults(run=review)
    sh = sub.add_parser('show')
    sh.add_argument('--verdict', choices=('existing', 'crop', 'generate', 'none'))
    sh.set_defaults(run=show)
    a = p.parse_args()
    a.run(a)
