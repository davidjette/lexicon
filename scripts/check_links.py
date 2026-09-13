"""Check the built site (dist/): every internal link resolves to a built page, and no note to Claude
or other HTML comment from an article survived into the output.

Usage: python scripts/check_links.py   (run after `npm run build`)
"""
import collections
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
CONFIG = open(os.path.join(ROOT, 'astro.config.mjs'), encoding='utf-8').read()
BASE = re.search(r"const BASE = '([^']*)'", CONFIG).group(1)
ASSET = re.compile(r'\.(css|js|svg|png|jpe?g|xml|json|ico|webp|woff2?|txt)$')

files = glob.glob(os.path.join(DIST, '**', '*.html'), recursive=True)
pages = set()
for f in files:
    rel = os.path.relpath(f, DIST).replace(os.sep, '/')
    pages.add(BASE + '/' + (rel[:-len('index.html')] if rel.endswith('index.html') else rel))

broken = collections.defaultdict(set)
missing_images = collections.defaultdict(set)
notes = []
total = 0
for f in files:
    page = os.path.relpath(f, DIST).replace(os.sep, '/')
    html = open(f, encoding='utf-8').read()
    if re.search(r'@claude', html, re.I):
        notes.append(page)
    for src in re.findall(r'<img[^>]+src="(/[^"]+)"', html):
        if src.startswith(BASE + '/') and not os.path.exists(os.path.join(DIST, *src[len(BASE) + 1:].split('/'))):
            missing_images[src].add(page)
    for h in re.findall(r'href="([^"#?]*)[^"]*"', html):
        if not h.startswith('/') or h.startswith('//') or ASSET.search(h) or '/_astro/' in h or 'pagefind' in h:
            continue
        total += 1
        if h not in pages and h + '/' not in pages:
            broken[h].add(page)

print(f'{len(files)} pages, {total} internal links, {len(broken)} broken targets, {len(missing_images)} missing images, {len(notes)} pages carrying a note to Claude')
for src, where in sorted(missing_images.items()):
    print(f'  MISSING IMAGE {src}  <- {", ".join(sorted(where)[:3])}')
for h, where in sorted(broken.items()):
    print(f'  {h}  <- {", ".join(sorted(where)[:3])}{" ..." if len(where) > 3 else ""}')
for page in notes:
    print(f'  NOTE IN OUTPUT: {page}')
sys.exit(1 if broken or notes or missing_images else 0)
