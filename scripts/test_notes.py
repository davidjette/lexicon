"""Self-test for the guards in scripts/notes.py, using a fake Claude that misbehaves on purpose.

Every scenario must be REJECTED and leave the article byte-identical, notes and all.
Nothing is committed and the private notes log is not touched.

Usage: python scripts/test_notes.py
"""
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notes  # noqa: E402
import qa  # noqa: E402

ROOT = qa.ROOT
TARGET = os.path.join(qa.DOCS, 'lore', 'redaction-test.md')
KARA = os.path.join(qa.DOCS, 'people', 'kara.md')
CANON_FILE = os.path.join(ROOT, 'canon', 'CANON.md')
NOTE = '\n<!-- @claude: self-test note -->\n'


def rewrite(path, fn):
    t = open(path, encoding='utf-8').read()
    open(path, 'w', encoding='utf-8', newline='\n').write(fn(t))


def drop_note(t):
    return t.replace(NOTE, '\n')


SCENARIOS = {
    'adds process language': lambda: rewrite(TARGET, lambda t: drop_note(t).replace(
        'A plain line after the block.', 'A plain line after the block, which this article cannot explain.')),
    'adds a broken link': lambda: rewrite(TARGET, lambda t: drop_note(t).replace(
        'A plain line after the block.', 'A plain line after [the block](/lore/no-such-article/).')),
    'adds an editorial bracket': lambda: rewrite(TARGET, lambda t: drop_note(t).replace(
        'A plain line after the block.', 'A plain line [sic] after the block.')),
    'leaves the note in': lambda: rewrite(TARGET, lambda t: t.replace('A plain line', 'One plain line')),
    'breaks the front matter': lambda: rewrite(TARGET, lambda t: drop_note(t).replace(
        'title: Redaction test', 'title:\n  - Redaction test')),
    'edits another article': lambda: (rewrite(TARGET, drop_note), rewrite(KARA, lambda t: t + '\nExtra.\n')),
    'edits the private canon': lambda: (rewrite(TARGET, drop_note), rewrite(CANON_FILE, lambda t: t + '\nExtra.\n')),
    'makes no change': lambda: None,
}


def main():
    if subprocess.run(['git', 'status', '--porcelain', '--', TARGET, KARA], cwd=ROOT, capture_output=True, text=True).stdout.strip():
        print('Refusing to run: the test article or kara.md has uncommitted changes.')
        return 1
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout
    kara_orig = open(KARA, 'rb').read()
    canon_orig = open(CANON_FILE, 'rb').read()
    notes.LOG = os.path.join(tempfile.mkdtemp(), 'notes-log.md')

    rewrite(TARGET, lambda t: t + NOTE)
    with_note = open(TARGET, 'rb').read()
    leak_index, known = qa.LeakIndex(), qa.known_targets()
    failed = 0
    try:
        for name, misbehave in SCENARIOS.items():
            notes.run_claude = lambda prompt, m=misbehave: (m(), ('Done.', 0))[1]
            a = qa.Article(TARGET)
            ok_reject = notes.apply(a, ['self-test note'], leak_index, known) is False
            restored = open(TARGET, 'rb').read() == with_note
            # the guards leave stray edits elsewhere for a human to inspect; the test cleans them up
            open(KARA, 'wb').write(kara_orig)
            open(CANON_FILE, 'wb').write(canon_orig)
            open(TARGET, 'wb').write(with_note)
            ok = ok_reject and restored
            failed += not ok
            print(f"{'ok  ' if ok else 'FAIL'} {name}: rejected={ok_reject} restored={restored}")
    finally:
        rewrite(TARGET, lambda t: t.replace(NOTE, ''))
    same_head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout == head
    clean = not subprocess.run(['git', 'status', '--porcelain', '--', TARGET, KARA], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    print(f"{'ok  ' if same_head and clean else 'FAIL'} nothing committed, test files clean afterwards")
    failed += not (same_head and clean)
    print('all guards hold' if not failed else f'{failed} scenario(s) failed')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
