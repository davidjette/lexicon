"""Build the Gallery page's images from a downloaded copy of the "D&D Pictures" Google Photos album.

Usage: python scripts/album_gallery.py <download folder>

The download folder holds album_photos.json (id, width, height, taken date per photo),
album_descriptions.json (description per photo id) and album_originals/<id>.<ext>. Those files were
produced by one-off download scripts; re-run them to refresh.

Writes public/images/gallery/<name>.webp (max 1600px wide), public/images/gallery/thumbs/<name>.webp
(480px wide) and src/data/gallery.json. Re-running skips images already converted.
"""
import datetime
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]
OUT = os.path.join(ROOT, 'public', 'images', 'gallery')
THUMBS = os.path.join(OUT, 'thumbs')
os.makedirs(THUMBS, exist_ok=True)

FIXES = [(r'\bGema\b', 'Gemma'), (r'\bStokton\b', 'Stockton'), (r'\bSation\b', 'Station'), (r'\bcaptial\b', 'capital'),
         (r'\bImerial\b', 'Imperial'), (r'\bImperal\b', 'Imperial'), (r'\bPalce\b', 'Palace'), (r'\bChancler\b', 'Chancellor'),
         (r'\bGhraham\b', 'Graham'), (r'\bListen Station\b', 'Listening Station'), (r'\binvisable\b', 'invisible'), (r'\s{2,}', ' ')]


def caption(text):
    if not text or re.fullmatch(r'\d{10,}', text):
        return ''
    for a, b in FIXES:
        text = re.sub(a, b, text)
    return re.sub(r'^Pictured:\s*', '', text).strip(' -')


photos = json.load(open(os.path.join(SRC, 'album_photos.json'), encoding='utf-8'))
descs = json.load(open(os.path.join(SRC, 'album_descriptions.json'), encoding='utf-8'))
originals = {f.split('.')[0]: f for f in os.listdir(os.path.join(SRC, 'album_originals')) if not f.endswith('.part')}

entries = []
per_day = {}
for p in sorted(photos, key=lambda p: p['taken']):
    if p['id'] not in originals:
        continue
    day = datetime.datetime.fromtimestamp(p['taken'] / 1000, datetime.timezone.utc).strftime('%Y-%m-%d')
    per_day[day] = per_day.get(day, 0) + 1
    name = f'{day}-{per_day[day]:02d}'
    full, thumb = os.path.join(OUT, name + '.webp'), os.path.join(THUMBS, name + '.webp')
    if not (os.path.exists(full) and os.path.exists(thumb)):
        with Image.open(os.path.join(SRC, 'album_originals', originals[p['id']])) as im:
            im.seek(0)  # first frame of an animated GIF
            im = im.convert('RGB')
            big = im if im.width <= 1600 else im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
            big.save(full, 'WEBP', quality=80, method=4)
            small = im.resize((480, round(im.height * 480 / im.width)), Image.LANCZOS)
            small.save(thumb, 'WEBP', quality=72, method=4)
    with Image.open(full) as im:
        w, h = im.size
    entries.append({
        'src': f'/images/gallery/{name}.webp',
        'thumb': f'/images/gallery/thumbs/{name}.webp',
        'width': w,
        'height': h,
        'date': day,
        'caption': caption((descs.get(p['id']) or {}).get('description', '')),
    })
    if len(entries) % 50 == 0:
        print(len(entries), flush=True)

entries.reverse()  # newest first
json.dump(entries, open(os.path.join(ROOT, 'src', 'data', 'gallery.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
size = sum(os.path.getsize(os.path.join(d, f)) for d in (OUT, THUMBS) for f in os.listdir(d) if f.endswith('.webp'))
print(f'{len(entries)} images, {sum(1 for e in entries if e["caption"])} captioned, {size / 1e6:.0f} MB')
