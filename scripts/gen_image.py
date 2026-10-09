"""Generate an image with OpenAI and place it on an article. Two steps, so a person looks at the
picture before it reaches the site.

  python scripts/gen_image.py gen people/arana "Arana at the rail of an airship, looking down at Sharn"
      Writes drafts/images/arana-<time>-1.png (gitignored) and a .json beside it holding the prompt.
      Options: -n 3 (several candidates), --size 1536x1024 | 1024x1536 | 1024x1024, --model, --no-style.

  python scripts/gen_image.py place drafts/images/arana-<time>-1.png --alt "Arana aboard an airship" \
      --caption "AI image of a woman at the rail of an airship above a city of towers."
      Writes public/images/generated/arana.webp (at most 1600px wide) and adds it to the article: as the
      lead image when the article has none, otherwise to its gallery (--gallery forces the gallery).

The house style in house/image-style.txt is appended to every prompt. The key is OPENAI_IMAGE_GEN_API_KEY
in .env (Dave's personal OpenAI organization). Each placement is logged to the private canon/image-log.md.
Captions follow the chat-photo convention and begin "AI image of ...".
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
        sys.exit(f'no article {slug}')
    return path


def gen(a):
    article(a.article)
    prompt = a.prompt.strip()
    if not a.no_style:
        prompt += '\n\n' + open(STYLE, encoding='utf-8').read().strip()
    body = json.dumps({'model': a.model, 'prompt': prompt, 'size': a.size, 'n': a.n}).encode()
    req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=body,
                                 headers={'Authorization': 'Bearer ' + api_key(), 'Content-Type': 'application/json'})
    try:
        res = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        sys.exit(f'OpenAI refused the request ({e.code}): {e.read().decode(errors="replace")}')
    os.makedirs(DRAFTS, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    for i, d in enumerate(res['data'], 1):
        path = os.path.join(DRAFTS, f"{a.article.split('/')[-1]}-{stamp}-{i}.png")
        open(path, 'wb').write(base64.b64decode(d['b64_json']))
        meta = {'article': a.article, 'prompt': prompt, 'model': a.model, 'size': a.size, 'made': stamp}
        json.dump(meta, open(path[:-4] + '.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
        print(os.path.relpath(path, ROOT))
    print('usage:', json.dumps(res.get('usage', {})))


def place(a):
    meta = json.load(open(os.path.splitext(a.draft)[0] + '.json', encoding='utf-8'))
    slug = meta['article']
    path = article(slug)
    os.makedirs(OUT, exist_ok=True)
    base = a.name or slug.split('/')[-1]
    name, k = base, 1
    while os.path.exists(os.path.join(OUT, name + '.webp')):
        k += 1
        name = f'{base}-{k}'
    with Image.open(a.draft) as im:
        im = im.convert('RGB')
        big = im if im.width <= 1600 else im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        big.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=82)
    src = f'/images/generated/{name}.webp'

    q = lambda s: json.dumps(s, ensure_ascii=False)
    t = open(path, encoding='utf-8').read()
    end = t.index('\n---', 3)
    fm = t[:end]
    entry = f'src: {src}\n  alt: {q(a.alt)}\n  caption: {q(a.caption)}'
    if not a.gallery and not re.search(r'^image:', fm, re.M):
        fm += '\nimage:\n  ' + entry
        where = 'lead image'
    else:
        s = fm + '\n'
        g = re.search(r'^gallery:[^\n]*\n((?:[ -][^\n]*\n)*)', s, re.M)
        if g:
            fm = (s[:g.end(1)] + '- ' + entry + '\n' + s[g.end(1):]).rstrip('\n')
        else:
            fm += '\ngallery:\n- ' + entry
        where = 'gallery'
    open(path, 'w', encoding='utf-8', newline='\n').write(fm + t[end:])

    if os.path.isdir(os.path.dirname(LOG)):
        with open(LOG, 'a', encoding='utf-8', newline='\n') as f:
            f.write(f"\n## {datetime.date.today()} {slug} ({where})\n\n- file: {src}\n- model: {meta['model']}, {meta['size']}\n"
                    f"- prompt: {meta['prompt']}\n")
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
    pl.add_argument('--caption', required=True, help='begin with "AI image of ..."')
    pl.add_argument('--gallery', action='store_true', help='add to the gallery even when the article has no lead image')
    pl.add_argument('--name', help='file name without extension; defaults to the article slug')
    pl.set_defaults(run=place)
    a = p.parse_args()
    a.run(a)
