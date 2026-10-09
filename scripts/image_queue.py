"""Find articles that have no lead image but enough material to illustrate, and prepare an image
prompt for each. The queue is drafts/image-queue.json (gitignored); nothing here touches an article.

  python scripts/image_queue.py scan
      Lists every article with no lead image that has at least --min-words words OR at least
      --min-links other articles linking to it (defaults 300 and 5). Sealed articles and placeholders
      are left out. Prints the size of the job and writes the queue, keeping prompts already prepared.
      --kinds people,places limits it to those kinds.

  python scripts/image_queue.py prompts --limit 20
      For queued articles without a prompt, asks Claude (headless `claude -p`, no tools) to write one
      from the article text under house/image-brief.md, with alt text and a caption. Most-linked first,
      --batch articles per request (default 10).

  python scripts/image_queue.py show
      Prints the prepared prompts for review. Edit drafts/image-queue.json to change one.

Generate from a prepared entry with scripts/gen_image.py gen <kind/slug> "<prompt>" --size <size>.
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
QUEUE = os.path.join(ROOT, 'drafts', 'image-queue.json')
BRIEF = os.path.join(ROOT, 'house', 'image-brief.md')
SIZES = {'people': '1024x1536', 'species': '1024x1536', 'items': '1024x1024'}  # everything else is landscape
LANDSCAPE = '1536x1024'
IMAGE_TOKENS = 1372  # the most one image has cost so far, at any of the three sizes
MAX_ARTICLE_CHARS = 12000


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


def load():
    return json.load(open(QUEUE, encoding='utf-8')) if os.path.exists(QUEUE) else []


def save(queue):
    os.makedirs(os.path.dirname(QUEUE), exist_ok=True)
    json.dump(queue, open(QUEUE, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)


def scan(a):
    arts = articles()
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
        open_.append({'article': slug, 'title': title.group(1).strip().strip('"\'') if title else slug,
                      'words': len(re.findall(r'\w+', unsealed(body))), 'links': len(inbound[slug])})

    print(f'{len(arts)} articles, {len(open_)} with no lead image (sealed and placeholder articles left out)\n')
    print('How many qualify at other thresholds (words OR links):')
    for w in (150, 300, 600, 1000):
        print(f'  {w:>5} words: ' + '  '.join(
            f'{l} links -> {sum(1 for e in open_ if e["words"] >= w or e["links"] >= l):>3}' for l in (3, 5, 10)))

    picked = [e for e in open_ if e['words'] >= a.min_words or e['links'] >= a.min_links]
    picked.sort(key=lambda e: (-e['links'], -e['words']))
    old = {e['article']: e for e in load()}
    for e in picked:
        e['size'] = SIZES.get(e['article'].split('/')[0], LANDSCAPE)
        for k in ('prompt', 'alt', 'caption', 'size', 'cost_usd'):
            if k in old.get(e['article'], {}):
                e[k] = old[e['article']][k]
    save(picked)

    print(f'\nQueued at {a.min_words} words or {a.min_links} links: {len(picked)}')
    by = {}
    for e in picked:
        by[e['article'].split('/')[0]] = by.get(e['article'].split('/')[0], 0) + 1
    print('  ' + ', '.join(f'{k} {v}' for k, v in sorted(by.items(), key=lambda kv: -kv[1])))
    chars = sum(min(len(unsealed(arts[e['article']][1])), MAX_ARTICLE_CHARS) for e in picked)
    todo = sum(1 for e in picked if not e.get('prompt'))
    print(f'  prompts already prepared: {len(picked) - todo}')
    print(f'  article text Claude would read: about {chars // 4:,} tokens (articles cut at {MAX_ARTICLE_CHARS:,} characters)')
    print(f'  image output, one picture each: up to {len(picked) * IMAGE_TOKENS:,} OpenAI image tokens')
    print(f'\nWrote {os.path.relpath(QUEUE, ROOT)}')


def ask_claude(text):
    exe = shutil.which('claude')
    if not exe:
        sys.exit('the claude CLI is not on PATH')
    cmd = [exe, '-p', '--output-format', 'json', '--max-budget-usd', '1',
           '--disallowedTools', 'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Agent']
    r = subprocess.run(cmd, cwd=ROOT, input=text, capture_output=True, text=True, encoding='utf-8', timeout=300)
    data = json.loads(r.stdout)
    if data.get('is_error'):
        raise RuntimeError(str(data.get('result'))[:300])
    m = re.search(r'\{.*\}', data.get('result') or '', re.S)
    return json.loads(m.group(0)), data.get('total_cost_usd') or 0, data.get('usage') or {}


def prompts(a):
    queue, arts, brief = load(), articles(), open(BRIEF, encoding='utf-8').read()
    todo = [e for e in queue if not e.get('prompt') and e['article'] in arts][:a.limit]
    spent = tokens = done = 0
    # Several articles per request: each headless request carries a large fixed overhead.
    for start in range(0, len(todo), a.batch):
        group = todo[start:start + a.batch]
        text = (brief + '\n\nSeveral articles follow. Write for each one separately. Reply with one JSON object and nothing '
                'else, mapping each ARTICLE value to its own {"prompt", "alt", "caption", "size"} object.')
        for e in group:
            fm, body = arts[e['article']]
            desc = re.search(r'^description:\s*(.+)$', fm, re.M)
            text += (f"\n\n=====\n\nARTICLE: {e['article']}\nTITLE: {e['title']}\n"
                     f"DESCRIPTION: {desc.group(1) if desc else ''}\n\n{unsealed(body)[:MAX_ARTICLE_CHARS]}")
        try:
            out, cost, usage = ask_claude(text)
        except Exception as err:  # noqa: BLE001
            print(f'batch of {len(group)} from {group[0]["article"]}: failed, {err}')
            continue
        spent += cost
        tokens += sum(v for k, v in usage.items() if k.endswith('_tokens') and isinstance(v, int))
        for e in group:
            o = out.get(e['article'])
            if not o or not all(o.get(k) for k in ('prompt', 'alt', 'caption')):
                print(f'  {e["article"]}: no usable answer')
                continue
            e.update({'prompt': o['prompt'], 'alt': o['alt'], 'caption': o['caption'], 'cost_usd': round(cost / len(group), 4)})
            if o.get('size') in ('1024x1024', '1536x1024', '1024x1536'):
                e['size'] = o['size']
            done += 1
        save(queue)
        print(f'[{min(start + a.batch, len(todo))}/{len(todo)}] ${cost:.3f} for {len(group)}')
    left = sum(1 for e in queue if not e.get('prompt'))
    print(f'\n{done} prepared, ${spent:.2f} and {tokens:,} Claude tokens (cached reads included); {left} still without a prompt')


def show(a):
    for e in load():
        if e.get('prompt'):
            print(f"\n{e['article']}  ({e['words']} words, {e['links']} links, {e['size']})\n  prompt:  {e['prompt']}\n"
                  f"  alt:     {e['alt']}\n  caption: {e['caption']}")


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('scan')
    s.add_argument('--min-words', type=int, default=300)
    s.add_argument('--min-links', type=int, default=5)
    s.add_argument('--kinds', help='comma-separated, e.g. people,places')
    s.set_defaults(run=scan)
    pr = sub.add_parser('prompts')
    pr.add_argument('--limit', type=int, default=10)
    pr.add_argument('--batch', type=int, default=10, help='articles per request')
    pr.set_defaults(run=prompts)
    sub.add_parser('show').set_defaults(run=show)
    a = p.parse_args()
    a.run(a)
