"""Publish reviewed photos from a Messenger chat export to the Gallery and to articles.

Usage: python scripts/chat_photos.py <photos folder> <meta.json> [<meta.json> ...] [--place]

Each meta file is a JSON array of {file, date, keep, title, description, articles: [{slug, role}], confidence}
(written by the photo review; see canon/oral-histories/photo-meta/BRIEF.md). Kept photos become
public/images/chat/<date>-<id>.webp (max 1600px wide) plus a 480px thumb, and are listed in
src/data/gallery-chat.json, which the Gallery page merges with the album. Photos that repeat an album
image or an earlier chat photo (by perceptual hash) are skipped.

With --place, each photo is also added to the articles it was matched to: as the lead image when the
article has none and the photo's role is "lead", otherwise to the article's gallery (at most
MAX_GALLERY per article). Images an article already shows are not added twice, and photos identified
with low confidence go to the Gallery only.
"""
import glob
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'src', 'content', 'docs')
OUT = os.path.join(ROOT, 'public', 'images', 'chat')
THUMBS = os.path.join(OUT, 'thumbs')
DATA = os.path.join(ROOT, 'src', 'data', 'gallery-chat.json')
MAX_GALLERY = 8
SIMILAR = 6  # dHash bits: at or below this, two images are the same picture


def dhash(im, size=8):
    g = im.convert('L').resize((size + 1, size), Image.LANCZOS)
    px = list(g.getdata())
    bits = [px[r * (size + 1) + c] > px[r * (size + 1) + c + 1] for r in range(size) for c in range(size)]
    return sum(1 << i for i, b in enumerate(bits) if b)


def near(h, hashes):
    return next((src for src, x in hashes if bin(h ^ x).count('1') <= SIMILAR), None)


def site_path(p):
    return '/' + os.path.relpath(p, os.path.join(ROOT, 'public')).replace(os.sep, '/')


def publish(photos, metas):
    os.makedirs(THUMBS, exist_ok=True)
    album = []
    for t in glob.glob(os.path.join(ROOT, 'public', 'images', 'gallery', 'thumbs', '*.webp')):
        album.append(('/images/gallery/' + os.path.basename(t), dhash(Image.open(t))))
    entries, seen, placed = [], [], []
    for m in metas:
        if not m.get('keep'):
            continue
        path = os.path.join(photos, m['file'])
        if not os.path.exists(path):
            print('missing', m['file'])
            continue
        im = Image.open(path)
        im = im.convert('RGB')
        h = dhash(im)
        dup = near(h, album)
        if dup:
            placed.append((m, dup))
            continue
        dup = near(h, seen)
        if dup:
            placed.append((m, dup))
            continue
        name = f"{m['date']}-{os.path.splitext(m['file'])[0]}"
        full = os.path.join(OUT, name + '.webp')
        thumb = os.path.join(THUMBS, name + '.webp')
        big = im if im.width <= 1600 else im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        if not os.path.exists(full):
            big.save(full, 'WEBP', quality=82)
        if not os.path.exists(thumb):
            (im if im.width <= 480 else im.resize((480, round(im.height * 480 / im.width)), Image.LANCZOS)).save(thumb, 'WEBP', quality=78)
        src = site_path(full)
        seen.append((src, h))
        entries.append({'src': src, 'thumb': site_path(thumb), 'width': big.width, 'height': big.height, 'date': m['date'],
                        'caption': m['description'], 'title': m['title'], 'description': m['description']})
        placed.append((m, src))
    entries.sort(key=lambda e: e['date'], reverse=True)
    json.dump(entries, open(DATA, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{len(entries)} chat photos in the gallery ({len(placed) - len(entries)} repeats of album or chat images)')
    return placed


def front_matter(path):
    t = open(path, encoding='utf-8').read()
    end = t.index('\n---', 3)
    return t, end


def place(placed):
    q = lambda s: json.dumps(s, ensure_ascii=False)
    rank = {'high': 0, 'medium': 1, 'low': 2}
    by_slug = {}
    for m, src in placed:
        if m.get('confidence') == 'low':
            continue  # gallery only: an uncertain identification stays off the articles
        for a in m.get('articles') or []:
            by_slug.setdefault(a['slug'], []).append((a.get('role'), rank.get(m.get('confidence'), 3), m, src))
    for slug, items in sorted(by_slug.items()):
        path = os.path.join(DOCS, *slug.split('/')) + '.md'
        if not os.path.exists(path):
            print('no article', slug)
            continue
        t, end = front_matter(path)
        fm = t[:end]
        shown = set(re.findall(r'src:\s*(\S+)', fm))
        items = [i for i in items if i[3] not in shown]
        items.sort(key=lambda i: (i[0] != 'lead', i[1], i[2]['date']))
        add = ''
        if not re.search(r'^image:', fm, re.M):
            lead = next((i for i in items if i[0] == 'lead'), None)
            if lead:
                items.remove(lead)
                add += f"\nimage:\n  src: {lead[3]}\n  alt: {q(lead[2]['title'])}\n  caption: {q(lead[2]['description'])}"
                shown.add(lead[3])
        gallery_count = len(re.findall(r'^- src:', fm, re.M))
        new = []
        for role, _, m, src in items:
            if gallery_count + len(new) >= MAX_GALLERY or src in shown:
                continue
            shown.add(src)
            new.append(f"- src: {src}\n  alt: {q(m['title'])}\n  caption: {q(m['description'])}")
        if new:
            s = fm + '\n'
            g = re.search(r'^gallery:[^\n]*\n((?:[ -][^\n]*\n)*)', s, re.M)
            if g:
                s = s[:g.end(1)] + '\n'.join(new) + '\n' + s[g.end(1):]
                fm = s.rstrip('\n')
            else:
                add += '\ngallery:\n' + '\n'.join(new)
        if add or new:
            open(path, 'w', encoding='utf-8', newline='\n').write(fm + add + t[end:])
            print('placed on', slug)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    metas = [m for f in args[1:] for m in json.load(open(f, encoding='utf-8'))]
    placed = publish(args[0], metas)
    if '--place' in sys.argv:
        place(placed)
