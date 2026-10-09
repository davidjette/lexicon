"""Generate an image with OpenAI and place it on an article. Two steps, so a person looks at the
picture before it reaches the site.

  python scripts/gen_image.py gen people/arana "Arana at the rail of an airship, looking down at Sharn"
      Writes drafts/images/arana-<time>-1.png (gitignored) and a .json beside it holding the prompt.
      Options: -n 3 (several candidates), --size 1536x1024 | 1024x1536 | 1024x1024, --model, --no-style.

  python scripts/gen_image.py place drafts/images/arana-<time>-1.png --alt "Arana aboard an airship" \
      --caption "Lexical rendering of a woman at the rail of an airship above a city of towers."
      Writes public/images/generated/arana.webp (at most 1600px wide) and adds it to the article: as the
      lead image when the article has none, otherwise to its gallery (--gallery forces the gallery).

The house style in house/image-style.txt is appended to every prompt. The key is OPENAI_IMAGE_GEN_API_KEY
in .env (Dave's personal OpenAI organization). Each placement is logged to the private canon/image-log.md.
Captions follow the chat-photo convention and begin "Lexical rendering of ...".

scripts/image_queue.py uses the functions here to work through many articles at once.
"""
import argparse
import base64
import datetime
import json
import os
import re
import sys
import urllib.error
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'src', 'content', 'docs')
DRAFTS = os.path.join(ROOT, 'drafts', 'images')
OUT = os.path.join(ROOT, 'public', 'images', 'generated')
STYLE = os.path.join(ROOT, 'house', 'image-style.txt')
LOG = os.path.join(ROOT, 'canon', 'image-log.md')
MODEL = 'gpt-image-2.5-sunburst'


def api_key():
    for line in open(os.path.join(ROOT, '.env'), encoding='utf-8'):
        m = re.match(r'\s*OPENAI_IMAGE_GEN_API_KEY\s*=\s*(.+)', line)
        if m:
            return m.group(1).strip().strip('"\'')
    sys.exit('OPENAI_IMAGE_GEN_API_KEY is not in .env')


def article(slug):
    path = os.path.join(DOCS, *slug.split('/')) + '.md'
    if not os.path.exists(path):
        raise FileNotFoundError(f'no article {slug}')
    return path


def generate(slug, prompt, size='1024x1024', model=MODEL, n=1, style=True):
    """Ask OpenAI for n candidates. Returns (draft paths, usage). Raises RuntimeError when refused."""
    article(slug)
    prompt = prompt.strip()
    if style:
        prompt += '\n\n' + open(STYLE, encoding='utf-8').read().strip()
    body = json.dumps({'model': model, 'prompt': prompt, 'size': size, 'n': n}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=body,
                                 headers={'Authorization': 'Bearer ' + api_key(), 'Content-Type': 'application/json'})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'OpenAI refused the request ({e.code}): {e.read().decode(errors="replace")[:400]}')
    os.makedirs(DRAFTS, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    paths = []
    for i, d in enumerate(res['data'], 1):
        path = os.path.join(DRAFTS, f"{slug.split('/')[-1]}-{stamp}-{i}.png")
        open(path, 'wb').write(base64.b64decode(d['b64_json']))
        meta = {'article': slug, 'prompt': prompt, 'model': model, 'size': size, 'made': stamp}
        json.dump(meta, open(path[:-4] + '.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
        paths.append(path)
    return paths, res.get('usage', {})


def publish(draft, base):
    """Convert a draft to WebP in public/images/generated. Returns its site path."""
    os.makedirs(OUT, exist_ok=True)
    name, k = base, 1
    while os.path.exists(os.path.join(OUT, name + '.webp')):
        k += 1
        name = f'{base}-{k}'
    with Image.open(draft) as im:
        im = im.convert('RGB')
        big = im if im.width <= 1600 else im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        big.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=82)
    return f'/images/generated/{name}.webp'


def add_image(slug, src, alt, caption=None, gallery=False):
    """Add an image to an article's front matter: the lead when it has none, otherwise the gallery.
    An entry for the same src already in the gallery is moved, not repeated. Returns where it went."""
    q = lambda s: json.dumps(s, ensure_ascii=False)
    path = article(slug)
    t = open(path, encoding='utf-8').read()
    end = t.index('\n---', 3)
    fm = t[:end] + '\n'
    lead = not gallery and not re.search(r'^image:', fm, re.M)
    if lead:
        fm = re.sub(r'^- src: ' + re.escape(src) + r'\n(?:  [^\n]*\n)*', '', fm, flags=re.M)
        fm = re.sub(r'^gallery:[^\n]*\n(?![ -])', '', fm, flags=re.M)  # a gallery left empty
    entry = f'src: {src}\n  alt: {q(alt)}' + (f'\n  caption: {q(caption)}' if caption else '')
    if lead:
        fm += 'image:\n  ' + entry + '\n'
    else:
        g = re.search(r'^gallery:[^\n]*\n((?:[ -][^\n]*\n)*)', fm, re.M)
        if g:
            fm = fm[:g.end(1)] + '- ' + entry + '\n' + fm[g.end(1):]
        else:
            fm += 'gallery:\n- ' + entry + '\n'
    open(path, 'w', encoding='utf-8', newline='\n').write(fm.rstrip('\n') + t[end:])
    return 'lead image' if lead else 'gallery'


def log(slug, where, src, note):
    if os.path.isdir(os.path.dirname(LOG)):
        with open(LOG, 'a', encoding='utf-8', newline='\n') as f:
            f.write(f'\n## {datetime.date.today()} {slug} ({where})\n\n- file: {src}\n{note}\n')


def place_draft(draft, alt, caption, gallery=False, name=None):
    meta = json.load(open(os.path.splitext(draft)[0] + '.json', encoding='utf-8'))
    slug = meta['article']
    src = publish(draft, name or slug.split('/')[-1])
    where = add_image(slug, src, alt, caption, gallery)
    log(slug, where, src, f"- model: {meta['model']}, {meta['size']}\n- prompt: {meta['prompt']}")
    return slug, src, where


def gen(a):
    try:
        paths, usage = generate(a.article, a.prompt, a.size, a.model, a.n, not a.no_style)
    except (RuntimeError, FileNotFoundError) as e:
        sys.exit(str(e))
    for p in paths:
        print(os.path.relpath(p, ROOT))
    print('usage:', json.dumps(usage))


def place(a):
    slug, src, where = place_draft(a.draft, a.alt, a.caption, a.gallery, a.name)
    print(f'{src} placed on {slug} as {where}')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    g = sub.add_parser('gen')
    g.add_argument('article', help='kind/slug, e.g. people/arana')
    g.add_argument('prompt', help='what the picture shows')
    g.add_argument('-n', type=int, default=1)
    g.add_argument('--size', default='1024x1024')
    g.add_argument('--model', default=MODEL)
    g.add_argument('--no-style', action='store_true', help='do not append house/image-style.txt')
    g.set_defaults(run=gen)
    pl = sub.add_parser('place')
    pl.add_argument('draft', help='a .png from drafts/images')
    pl.add_argument('--alt', required=True)
    pl.add_argument('--caption', required=True, help='begin with "Lexical rendering of ..."')
    pl.add_argument('--gallery', action='store_true', help='add to the gallery even when the article has no lead image')
    pl.add_argument('--name', help='file name without extension; defaults to the article slug')
    pl.set_defaults(run=place)
    a = p.parse_args()
    a.run(a)
