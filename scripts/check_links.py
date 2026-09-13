"""Check every internal link in the built site (dist/) resolves to a built page.

Usage: python scripts/check_links.py   (run after `npm run build`)
"""
import collections
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
BASE = '/infantaverse'
ASSET = re.compile(r'\.(css|js|svg|png|jpe?g|xml|json|ico|webp|woff2?|txt)$')

files = glob.glob(os.path.join(DIST, '**', '*.html'), recursive=True)
pages = set()
for f in files:
    rel = os.path.relpath(f, DIST).replace(os.sep, '/')
    pages.add(BASE + '/' + (rel[:-len('index.html')] if rel.endswith('index.html') else rel))

broken = collections.defaultdict(set)
total = 0
for f in files:
    page = os.path.relpath(f, DIST).replace(os.sep, '/')
    for h in re.findall(r'href="([^"#?]*)[^"]*"', open(f, encoding='utf-8').read()):
        if not h.startswith('/') or h.startswith('//') or ASSET.search(h) or '/_astro/' in h or 'pagefind' in h:
            continue
        total += 1
        if h not in pages and h + '/' not in pages:
            broken[h].add(page)

print(f'{len(files)} pages, {total} internal links, {len(broken)} broken targets')
for h, where in sorted(broken.items()):
    print(f'  {h}  <- {", ".join(sorted(where)[:3])}{" ..." if len(where) > 3 else ""}')
sys.exit(1 if broken else 0)
