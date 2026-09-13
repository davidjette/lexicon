"""Import the frozen World Anvil corpus into src/content/docs/<kind>/<slug>.md.

Usage: python scripts/wa_import.py [--force]

Re-runnable. The World Anvil folder is only read. A file that was edited since the last import
(its hash no longer matches docs/import-manifest.json) is left alone unless --force is given,
so markdown edits are never clobbered.
"""
import hashlib
import json
import os
import re
import sys

import yaml

from wa_common import WA_DIR, KIND_OF_TYPE, KIND_LABELS, KNOWN_TAGS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'src', 'content', 'docs')
MANIFEST = os.path.join(ROOT, 'docs', 'import-manifest.json')
UNRESOLVED = os.path.join(ROOT, 'docs', 'unresolved-links.txt')
WA_WORLD = 'https://www.worldanvil.com/w/infantaverse-sydiot'

BLOCK = {'p', 'h2', 'h3', 'ul', 'ol', 'li', 'quote', 'table', 'tr', 'td', 'th', 'hr'}
TAG_RE = re.compile(r'\[(/?)(' + '|'.join(sorted(KNOWN_TAGS, key=len, reverse=True)) + r')(?:=([^\]]*))?\]', re.I)


# ---------------------------------------------------------------- parse
class Node:
    def __init__(self, tag, attr=None):
        self.tag, self.attr, self.children = tag, attr, []


def parse(src):
    root = Node('root')
    stack = [root]
    pos = 0
    for m in TAG_RE.finditer(src):
        if m.start() > pos:
            stack[-1].children.append(src[pos:m.start()])
        pos = m.end()
        closing, tag, attr = m.group(1), m.group(2).lower(), m.group(3)
        if tag == 'hr':
            if not closing:
                stack[-1].children.append(Node('hr'))
            continue
        if not closing:
            n = Node(tag, attr)
            stack[-1].children.append(n)
            stack.append(n)
        elif any(s.tag == tag for s in stack[1:]):
            while stack[-1].tag != tag:
                stack.pop()
            stack.pop()
        # a stray closing tag with no opener is dropped
    if pos < len(src):
        stack[-1].children.append(src[pos:])
    return root


# ---------------------------------------------------------------- render
S_OPEN, S_CLOSE = '\x01', '\x02'  # emphasis sentinels, resolved after the inline string is complete


def esc(text):
    text = text.replace('\\', '\\\\')
    text = re.sub(r'([*_`\[\]~<])', r'\\\1', text)
    return re.sub(r'&(?=#?\w+;)', '&amp;', text)


class Renderer:
    def __init__(self, resolve):
        self.resolve = resolve  # href -> new href or None

    def inline(self, nodes, table=False):
        out = []
        for n in nodes:
            if isinstance(n, str):
                out.append(esc(n))
                continue
            inner = self.inline(n.children, table)
            if n.tag in ('b', 'i'):
                mark = '**' if n.tag == 'b' else '*'
                stripped = inner.strip()
                if not stripped:
                    out.append(inner)
                    continue
                lead = inner[:len(inner) - len(inner.lstrip())]
                trail = inner[len(inner.rstrip()):]
                out.append(f'{lead}{S_OPEN}{mark}{S_OPEN}{stripped}{S_CLOSE}{mark}{S_CLOSE}{trail}')
            elif n.tag == 'small':
                out.append(f'<small>{inner}</small>')
            elif n.tag == 'url':
                href = self.resolve(n.attr or '')
                out.append(f'[{inner}]({href})' if href else inner)
            else:  # a block tag used inline: flatten
                out.append(inner)
        s = ''.join(out)
        return s

    @staticmethod
    def finish_inline(s, table=False):
        s = fix_emphasis(s)
        s = s.strip()
        if table:
            return s.replace('|', '\\|').replace('\n', '<br>')
        return re.sub(r'[ \t]*\n[ \t]*', '\\\n', s)  # hard line breaks (poems in quotes)

    def blocks(self, nodes):
        out, run = [], []

        def flush():
            if run:
                text = self.finish_inline(self.inline(run))
                if text:
                    out.append(guard_line_starts(text))
                run.clear()

        for n in nodes:
            if isinstance(n, str) or n.tag not in BLOCK:
                if isinstance(n, str) and not n.strip() and not run:
                    continue
                run.append(n)
                continue
            flush()
            r = self.block(n)
            if r:
                out.append(r)
        flush()
        return out

    def block(self, n):
        t = n.tag
        if t == 'p':
            text = self.finish_inline(self.inline(n.children))
            return guard_line_starts(text) if text else ''
        if t in ('h2', 'h3'):
            text = fix_emphasis(self.inline(n.children)).strip().replace('\n', ' ')
            return ('## ' if t == 'h2' else '### ') + text
        if t == 'hr':
            return '---'
        if t == 'quote':
            body = '\n\n'.join(self.blocks(n.children))
            return '\n'.join(('> ' + l) if l else '>' for l in body.split('\n'))
        if t in ('ul', 'ol'):
            items = [c for c in n.children if not isinstance(c, str) and c.tag == 'li']
            lines = []
            for i, li in enumerate(items, 1):
                marker = f'{i}. ' if t == 'ol' else '- '
                body = '\n\n'.join(self.blocks(li.children)) or ''
                pad = ' ' * len(marker)
                first, *rest = body.split('\n') if body else ['']
                lines.append(marker + first + ''.join('\n' + (pad + l if l else '') for l in rest))
            return '\n'.join(lines)
        if t == 'li':  # stray li outside a list
            return '- ' + '\n\n'.join(self.blocks(n.children))
        if t == 'table':
            rows = [c for c in n.children if not isinstance(c, str) and c.tag == 'tr']
            grid, header = [], False
            for ri, tr in enumerate(rows):
                cells = [c for c in tr.children if not isinstance(c, str) and c.tag in ('td', 'th')]
                if ri == 0 and cells and all(c.tag == 'th' for c in cells):
                    header = True
                grid.append([self.finish_inline(self.inline(c.children, True), table=True) for c in cells])
            if not grid:
                return ''
            width = max(len(r) for r in grid)
            grid = [r + [''] * (width - len(r)) for r in grid]
            if not header:
                grid.insert(0, [''] * width)
            md = ['| ' + ' | '.join(grid[0]) + ' |', '|' + '---|' * width]
            md += ['| ' + ' | '.join(r) + ' |' for r in grid[1:]]
            return '\n'.join(md)
        # tr/td/th outside a table: flatten
        return self.finish_inline(self.inline(n.children))


PUNCT = re.compile(r'[^\w\s]', re.U)


def fix_emphasis(s):
    """Resolve emphasis sentinels. Use **/* when CommonMark flanking rules allow it, else <strong>/<em>."""
    # the body may not contain an opener, so each match is an innermost pair
    pat = re.compile('\x01(\\*\\*?)\x01([^\x01]*?)\x02\\1\x02')
    while True:
        m = pat.search(s)
        if not m:
            break
        mark, body = m.group(1), m.group(2)
        before = s[m.start() - 1] if m.start() else ' '
        after = s[m.end()] if m.end() < len(s) else ' '
        first, last = body[0], body[-1]
        ok_open = not (PUNCT.match(first) and not (before.isspace() or PUNCT.match(before)))
        ok_close = not (PUNCT.match(last) and not (after.isspace() or PUNCT.match(after)))
        if ok_open and ok_close:
            rep = f'{mark}{body}{mark}'
        else:
            tag = 'strong' if mark == '**' else 'em'
            rep = f'<{tag}>{body}</{tag}>'
        s = s[:m.start()] + rep + s[m.end():]
    return s


def guard_line_starts(text):
    """Escape characters that would turn a paragraph line into a heading, list, quote or rule."""
    def g(line):
        line2 = re.sub(r'^(\s*)([#>+\-=])', r'\1\\\2', line)
        return re.sub(r'^(\s*\d+)([.)])(\s)', r'\1\\\2\3', line2)
    return '\n'.join(g(l) for l in text.split('\n'))


# ---------------------------------------------------------------- main
def main():
    force = '--force' in sys.argv
    arts = {}
    for f in sorted(os.listdir(os.path.join(WA_DIR, 'articles'))):
        if f.endswith('.json'):
            d = json.load(open(os.path.join(WA_DIR, 'articles', f), encoding='utf-8'))
            arts[d['slug']] = d

    # live World Anvil slug -> local slug
    live = {}
    table = json.load(open(os.path.join(WA_DIR, 'slugtable.json'), encoding='utf-8'))['table']
    for local, wa_slug in table.items():
        # two local slugs can share one live slug; prefer the one that is an article
        if local in arts or wa_slug not in live:
            live[wa_slug] = local
    for s, d in arts.items():
        if d.get('wa_slug'):
            live.setdefault(d['wa_slug'], s)
    live_ci = {k.lower(): v for k, v in live.items()}

    unresolved = []
    current = {}

    def resolver(slug):
        def resolve(href):
            m = re.match(r'^/w/infantaverse-sydiot/a/([^#?]+)(#.*)?$', href)
            if m:
                target = live.get(m.group(1)) or live_ci.get(m.group(1).lower())
                if target in arts:
                    kind = KIND_OF_TYPE[arts[target]['type']]
                    return f'/{kind}/{target}/' + (m.group(2) or '')
                unresolved.append(f'{slug}\t{href}')
                return None
            if href.startswith('/w/infantaverse-sydiot/'):
                return WA_WORLD + href[len('/w/infantaverse-sydiot'):]
            if re.match(r'^https?://', href):
                return href
            unresolved.append(f'{slug}\t{href}')
            return None
        return resolve

    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    written = skipped = 0
    for slug, d in arts.items():
        kind = KIND_OF_TYPE[d['type']]
        src = open(os.path.join(WA_DIR, 'articles', slug + '.bbcode'), encoding='utf-8').read()
        body = '\n\n'.join(Renderer(resolver(slug)).blocks(parse(src).children)) + '\n'

        fm = {'title': d['title'], 'description': d['excerpt']}
        order = sidebar_order(slug, d)
        if order is not None:
            fm['sidebar'] = {'order': order}
        fm.update({
            'type': d['type'],
            'kind': kind,
            'tags': d.get('tags') or [],
            'icon': d.get('icon'),
            'fields': d.get('fields') or {},
            'sources': d.get('sources') or [],
            'published': d.get('published'),
            'wa': {k: v for k, v in {'slug': table.get(slug) or d.get('wa_slug'), 'uuid': d.get('wa_uuid'),
                                     'category': d.get('category_uuid'), 'note': d.get('note'),
                                     'image_card': d.get('image_card')}.items() if v},
        })
        text = '---\n' + yaml.safe_dump(fm, allow_unicode=True, sort_keys=False, width=100000) + '---\n\n' + body

        rel = f'{kind}/{slug}.md'
        path = os.path.join(DOCS, kind, slug + '.md')
        new_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
        if os.path.exists(path) and not force:
            on_disk = hashlib.md5(open(path, 'rb').read()).hexdigest()
            if on_disk != manifest.get(rel) and on_disk != new_hash:
                skipped += 1
                print(f'  kept (edited since import): {rel}')
                current[rel] = manifest.get(rel)
                continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'w', encoding='utf-8', newline='\n').write(text)
        current[rel] = new_hash
        written += 1

    for kind, label in KIND_LABELS.items():
        idx = os.path.join(DOCS, kind, 'index.mdx')
        if not os.path.exists(idx):
            os.makedirs(os.path.dirname(idx), exist_ok=True)
            open(idx, 'w', encoding='utf-8', newline='\n').write(
                f"---\ntitle: {label}\nsidebar:\n  order: -1\n  label: All {label.lower()}\n---\n\n"
                f"import KindIndex from '../../../components/KindIndex.astro';\n\n<KindIndex kind=\"{kind}\" />\n")

    json.dump(current, open(MANIFEST, 'w', encoding='utf-8'), indent=1, sort_keys=True)
    open(UNRESOLVED, 'w', encoding='utf-8', newline='\n').write('\n'.join(unresolved) + ('\n' if unresolved else ''))
    print(f'written {written}, kept {skipped}, unresolved links {len(unresolved)}')


ROMAN = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8}


def sidebar_order(slug, d):
    m = re.match(r'arc-(i|ii|iii|iv|v|vi|vii|viii)-', slug)
    if m:
        return ROMAN[m.group(1)]
    m = re.match(r'(sharn-ep|korth-ep|episode)-(\d+)-', slug)
    if m:
        return {'episode': 100, 'sharn-ep': 200, 'korth-ep': 300}[m.group(1)] + int(m.group(2))
    return None


if __name__ == '__main__':
    main()
