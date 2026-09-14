# -*- coding: utf-8 -*-
"""Lexicon QA: markdown ports of the World Anvil pre-publish checkers.

Usage:
  python scripts/qa.py                 whole corpus
  python scripts/qa.py kara calix      only these slugs
  python scripts/qa.py --skip-leaks    style, brackets, descriptions, links only

Checks (see house/STYLE.md):
  style         defining lead, process language, closing taglines, internal CANON refs  (qa_style.py)
  brackets      editorial square brackets, which are almost always smoothed quotations     (qa_brackets.py)
  descriptions  process language in the listing description; over 160 chars is a warning (qa_excerpts.py)
  links         every internal link targets an existing article                            (qa_links.py)
  leaks         DM-only prose reaching an article, in body, description, fields or tags    (qa_leaks.py)
  notes         a note to Claude left in an article (must never be committed)

Exit 1 if anything fails. Warnings do not fail.
"""
import glob
import os
import re
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wa_common import CAMPAIGN_DIR  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'src', 'content', 'docs')
WA = os.path.join(CAMPAIGN_DIR, 'worldanvil')
MIDDOT = chr(183)
NOTE = re.compile(r'<!--\s*@claude\b(.*?)-->', re.S | re.I)
# Heuristic flags that need a human eye. They never fail the corpus run; the notes loop still rejects
# a NEW one introduced by a rewrite (scripts/notes.py compares before and after).
WARNING_KINDS = {'over-160-chars', 'possible-tagline'}


# ------------------------------------------------------------------ loading
class Article:
    def __init__(self, path, text=None):
        self.path = path
        self.slug = os.path.splitext(os.path.basename(path))[0]
        self.rel = os.path.relpath(path, DOCS).replace(os.sep, '/')
        raw = text if text is not None else open(path, encoding='utf-8').read()
        self.raw = raw
        m = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n?(.*)$', raw, re.S)
        self.data = (yaml.safe_load(m.group(1)) or {}) if m else {}
        self.body = m.group(2) if m else raw
        self.title = self.data.get('title') or ''


def load(slugs=None, include_drafts=False):
    out = []
    for p in sorted(glob.glob(os.path.join(DOCS, '**', '*.md'), recursive=True)):
        if os.path.basename(p).startswith('index.'):
            continue
        a = Article(p)
        if slugs and a.slug not in slugs:
            continue
        if a.data.get('draft') and not include_drafts and not slugs:
            continue
        out.append(a)
    return out


def plain(md):
    """Markdown to reading text: what the checks compare against."""
    t = NOTE.sub(' ', md)
    for _ in range(3):  # links and redactions nest one inside another
        t = re.sub(r'!?\[([^\[\]]*)\]\([^)]*\)', r'\1', t)
        t = re.sub(r':{1,3}redacted(?:\[([^\[\]]*)\])?(?:\{[^}]*\})?', lambda m: m.group(1) or ' ', t)
    t = re.sub(r'^\s*:::\s*$', ' ', t, flags=re.M)
    t = re.sub(r'</?(small|strong|em|br|span|div|sup|sub)[^>]*>', ' ', t)
    t = re.sub(r'^\s{0,3}(#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)', '', t, flags=re.M)
    t = t.replace('**', '').replace('\\', '')
    t = re.sub(r'(?<![\w*])\*(?!\s)|(?<!\s)\*(?![\w*])', '', t)
    return t


def flat(md):
    return re.sub(r'\s+', ' ', plain(md)).strip()


def paragraphs(body):
    return [p for p in re.split(r'\n\s*\n', body) if p.strip()]


# ------------------------------------------------------------------ style (qa_style.py)
BANNED = [
    ('gap-commentary', r"\bthe gap\b|rather than filling|than to fill|worth (stating|noting|saying)"),
    ('source-consulted', r"sources? (consulted|available|surveyed)|the record gives|no surviving (source|record)|no record survives|nothing survives"),
    ('self-reference', r"\bthis article\b|\bthe wiki\b|\bthe corpus\b|\bthis entry\b|\bthis file\b|as recorded here"),
    ('thesis-closer', r"which is itself|which is the whole point|is the whole of|that is why it mattered|everything else .{0,30}downstream"),
    ('hedge', r"\bpresumably\b|\bevidently\b|one suspects|it is tempting"),
    ('research-note', r"DM's (own )?account|recorded 2026-|session text (refers|survives|gives)|the sources (do not|say|give|are)"),
    ('internal-canon', r"CANON [0-9]"),
]
KEEP = re.compile(r'Recovered from the Oblivia', re.I)
DAVE_LINES = {'The future empress and mother of the God of Death.'}


def is_header_para(p):
    s = p.strip()
    f = flat(s)
    if not f or re.fullmatch(r'(-{3,}|\*{3,}|_{3,})', s):  # empty, or a horizontal rule
        return True
    if f.lower().startswith(('also known as', 'aliases')):
        return True
    if s.startswith('>'):
        return True
    if s.startswith('<small>') and s.endswith('</small>'):  # hatnote
        return True
    if MIDDOT in f and len(f) < 320:
        return True
    if re.fullmatch(r'\*\*.*\*\*', s, re.S) and len(f) < 320:
        return True
    return False


def lead_of(body):
    for p in paragraphs(body):
        if p.lstrip().startswith('#'):
            break
        if is_header_para(p):
            continue
        return flat(p)
    return ''


def tagline_of(body):
    ps = paragraphs(NOTE.sub('', body))
    if not ps:
        return None
    last = ps[-1]
    f = flat(last)
    if re.search(r'\]\(', last):
        return None
    if last.lstrip().startswith('>'):
        return None
    if f.startswith(('Related:', 'Items:', 'Holdings:', 'Organizations')):
        return None
    # a bold-labelled inline field ("**Hobbies & Pets:** Unknown.") is a template block, not a tagline
    if re.match(r'^\*\*[^*]{1,40}\*\*\s*[:—-]|^\*\*[^*]{1,40}:\*\*', last.strip()):
        return None
    if re.match(r'^[A-Z][\w &]{1,30}\s[—]\s', f):
        return None
    if f in DAVE_LINES:
        return None
    if f and len(f) <= 120 and not f.lower().startswith('recovered from the oblivia'):
        return f
    return None


def check_style(a):
    out = []
    no_quotes = '\n'.join(l for l in a.body.split('\n') if not l.lstrip().startswith('>'))
    text = flat(no_quotes)
    for name, pat in BANNED:
        for m in re.finditer(pat, text, re.I):
            snip = text[max(0, m.start() - 45):m.end() + 45]
            if name == 'research-note' and KEEP.search(snip):
                continue
            out.append((name, snip))
    lead = lead_of(a.body)
    core = re.sub(r'\s+', ' ', a.title.split(',')[0].split('(')[0].strip())
    pat = r'(?<!\w)%s(?!\w)[^.]{0,90}?\b(is|was|are|were)\b' % re.escape(core) if core else None
    if not pat or not re.search(pat, lead[:200], re.I):
        out.append(('no-defining-lead', lead[:150]))
    tl = tagline_of(a.body)
    if tl:
        out.append(('possible-tagline', tl))
    return out


# ------------------------------------------------------------------ brackets (qa_brackets.py)
def check_brackets(a):
    out = []
    t = NOTE.sub(' ', a.body)
    t = re.sub(r'^(```|~~~).*?^\1', ' ', t, flags=re.S | re.M)
    t = re.sub(r'`[^`\n]*`', ' ', t)
    for _ in range(4):
        t = re.sub(r'!?\[([^\[\]]*)\]\([^)]*\)', r'(\1)', t)
        t = re.sub(r':{1,3}redacted(?:\[([^\[\]]*)\])?(?:\{[^}]*\})?', lambda m: '(%s)' % (m.group(1) or ''), t)
    for m in re.finditer(r'\\?\[|\\?\]', t):
        ctx = re.sub(r'\s+', ' ', t[max(0, m.start() - 60):m.end() + 40])
        glued = m.group(0).endswith('[') and m.start() > 0 and re.match(r'\w', t[m.start() - 1] if not m.group(0).startswith('\\') else t[m.start() - 1])
        out.append(('glued-bracket' if glued else 'editorial-bracket', ctx))
    meta = [a.data.get('description') or ''] + [str(v) for v in (a.data.get('fields') or {}).values()] + [str(x) for x in (a.data.get('tags') or [])]
    for v in meta:
        if '[' in v or ']' in v:
            out.append(('bracket-in-metadata', v[:110]))
    # an opening bracket and its closer both count once; report each bracket pair once
    dedup, seen = [], set()
    for k, c in out:
        if (k, c) not in seen:
            seen.add((k, c))
            dedup.append((k, c))
    return dedup


# ------------------------------------------------------------------ descriptions (qa_excerpts.py)
DESC_BANNED = [
    ('gap-commentary', r"\bthe gap\b|rather than filling|worth (stating|noting)"),
    ('source-consulted', r"sources? consulted|the record gives|no surviving (source|record)|no record survives"),
    ('self-reference', r"\bthis article\b|\bthe wiki\b|\bthis file\b|\bthe corpus\b"),
    ('thesis-closer', r"which is itself|which is the whole|that is why it matter|is the whole of (it|the)|the point is"),
    ('hedge', r"\bpresumably\b|\bevidently\b|one suspects"),
    ('research-note', r"DM's (own )?account|recorded 2026-|CANON \d"),
]


def check_descriptions(a):
    e = (a.data.get('description') or '').strip()
    out = [(name, e[:110]) for name, pat in DESC_BANNED if re.search(pat, e, re.I)]
    if not e:
        out.append(('empty-description', ''))
    elif len(e) > 160:
        out.append(('over-160-chars', e[:110]))
    return out


# ------------------------------------------------------------------ links (qa_links.py)
def check_links(a, known):
    out = []
    for m in re.finditer(r'\]\((/[^)\s#?]*)', a.body):
        target = m.group(1)
        if target.startswith('/images/'):
            # an inline image, not an article link: it only has to exist as a file
            if not os.path.exists(os.path.join(ROOT, 'public', *target.strip('/').split('/'))):
                out.append(('missing-image', target))
            continue
        key = target.strip('/')
        if key not in known:
            out.append(('broken-link', target))
    return out


def known_targets():
    known = {''}
    for p in glob.glob(os.path.join(DOCS, '**', '*.md*'), recursive=True):
        rel = os.path.relpath(p, DOCS).replace(os.sep, '/')
        rel = re.sub(r'\.(md|mdx)$', '', rel)
        known.add(re.sub(r'/?index$', '', rel))
    known.add('sealed-records')
    known.add('maps')
    maps = os.path.join(ROOT, 'src', 'data', 'maps.json')
    if os.path.exists(maps):
        import json
        known.update('maps/' + m['id'] for m in json.load(open(maps, encoding='utf-8')))
    return known


# ------------------------------------------------------------------ leaks (qa_leaks.py)
N = 10  # shingle length in words; 6 produced heavy false positives on shared vocabulary
ANNOTATION = re.compile(r'\[DM:?\s*(.{10,600}?)\]', re.S)
COMMENT = re.compile(r'<!--(.{10,800}?)-->', re.S)
# Verified false positives, (slug, DM file). See house/LEAK-ADJUDICATIONS.md.
KNOWN_GOOD = {
    ('the-undying-court', 'preview.txt'),
    ('the-warforged-decree', 'preview(11).txt'),
    ('hallorn-d-lyrandar', 'preview(2).txt'),
    ('uriel-qualanthri', 'preview(4).txt'),
}


def words(s):
    s = s.lower().replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"')
    return re.findall(r'[a-z0-9]+', s)


def shingles(text):
    w = words(text)
    return {' '.join(w[i:i + N]) for i in range(max(0, len(w) - N + 1))}


def read(p):
    try:
        return open(p, encoding='utf-8', errors='replace').read()
    except Exception:
        return ''


class LeakIndex:
    def __init__(self):
        if not os.path.isdir(os.path.join(WA, 'dmnotes')):
            raise FileNotFoundError(f'DM-only files not found under {CAMPAIGN_DIR}; the leak check cannot run here')
        dm_files = (glob.glob(os.path.join(WA, 'dmnotes', '*.txt'))
                    + glob.glob(os.path.join(WA, 'sources', 'site', 'dm-notes.txt'))
                    + glob.glob(os.path.join(CAMPAIGN_DIR, 'handouts', 'hells-bells-intel-web.md'))
                    + glob.glob(os.path.join(CAMPAIGN_DIR, 'handouts', 'module-korranberg*.md'))
                    + glob.glob(os.path.join(CAMPAIGN_DIR, 'handouts', 'session-plan-*.md')))
        mixed = glob.glob(os.path.join(CAMPAIGN_DIR, 'handouts', '*.md')) + glob.glob(os.path.join(CAMPAIGN_DIR, '*.md'))

        safe = []
        for p in glob.glob(os.path.join(WA, 'sources', '**', '*.txt'), recursive=True):
            if 'dm-notes' not in p:
                safe.append(read(p))
        for p in [os.path.join(ROOT, 'canon', 'CANON.md')] + glob.glob(os.path.join(ROOT, 'sources', '**', '*.*'), recursive=True):
            safe.append(read(p))
        for p in mixed:
            if 'hells-bells-intel-web' in p or 'module-korranberg' in p or 'session-plan-' in p:
                continue
            safe.append(COMMENT.sub(' ', ANNOTATION.sub(' ', read(p))))
        SAFE = shingles(' '.join(safe))

        self.dm1, self.dm2 = {}, {}
        for p in dm_files:
            for s in shingles(read(p)):
                if s not in SAFE:
                    self.dm1.setdefault(s, os.path.basename(p))
        for p in mixed:
            t = read(p)
            for m in list(ANNOTATION.finditer(t)) + list(COMMENT.finditer(t)):
                for s in shingles(m.group(1)):
                    if s not in SAFE:
                        self.dm2.setdefault(s, os.path.basename(p))

    def check(self, a):
        parts = [flat(a.body), str(a.data.get('description') or '')]
        parts += [str(v) for v in (a.data.get('fields') or {}).values()]
        parts += [str(t) for t in (a.data.get('tags') or [])]
        redacted = a.data.get('redacted') or {}
        parts += [str(v) for v in redacted.values()]
        found = {}
        for s in shingles(' '.join(parts)):
            if s in self.dm1:
                found.setdefault(('FILE', self.dm1[s]), []).append(s)
            elif s in self.dm2:
                found.setdefault(('ANNOTATION', self.dm2[s]), []).append(s)
        out = []
        for (kind, src), ss in found.items():
            if (a.slug, src) in KNOWN_GOOD:
                continue
            out.append((f'leak-{kind.lower()}', f'{src}: "{ss[0]}"'))
        return out


# ------------------------------------------------------------------ notes
def check_notes(a):
    return [('note-to-claude', re.sub(r'\s+', ' ', m.group(1)).strip()[:110]) for m in NOTE.finditer(a.raw)]


# ------------------------------------------------------------------ runner
def run(articles, leaks=True, known=None, leak_index=None):
    """Return {slug: [(check, kind, detail)]} for the given articles."""
    known = known or known_targets()
    if leaks and leak_index is None:
        leak_index = LeakIndex()
    report = {}
    for a in articles:
        flags = [('style', k, d) for k, d in check_style(a)]
        flags += [('brackets', k, d) for k, d in check_brackets(a)]
        flags += [('descriptions', k, d) for k, d in check_descriptions(a)]
        flags += [('links', k, d) for k, d in check_links(a, known)]
        flags += [('notes', k, d) for k, d in check_notes(a)]
        if leaks:
            flags += [('leaks', k, d) for k, d in leak_index.check(a)]
        if flags:
            report[a.slug] = flags
    return report


def failures(flags):
    return [f for f in flags if f[1] not in WARNING_KINDS]


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    leaks = '--skip-leaks' not in sys.argv
    articles = load(set(args) if args else None)
    report = run(articles, leaks=leaks)
    counts = {}
    failed = 0
    for slug, flags in sorted(report.items()):
        bad = failures(flags)
        failed += bool(bad)
        print(f'\n{slug}' + ('' if bad else '  (warnings only)'))
        for check, kind, detail in flags:
            counts[(check, kind)] = counts.get((check, kind), 0) + 1
            print(f'   [{check}:{kind}] {detail}')
    print('\n' + '=' * 70)
    print(f'QA over {len(articles)} articles' + ('' if leaks else ' (leak check skipped)') + f': {failed} failing, {len(report) - failed} with warnings only')
    for (check, kind), n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f'  {check}:{kind:<22} {n}' + ('  (warning)' if kind in WARNING_KINDS else ''))
    print('CLEAN' if not failed else 'FAIL: fix before publishing.')
    print('=' * 70)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
