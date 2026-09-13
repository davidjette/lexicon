# -*- coding: utf-8 -*-
"""Notes to Claude: leave an instruction inside an article, and this applies it.

In any article, write an HTML comment addressed to Claude, anywhere in the body:

    <!-- @claude: rewrite the lead so it opens on her role in the Arcaneum -->

Then:
    python scripts/notes.py                 list every pending note (changes nothing)
    python scripts/notes.py --run           apply all pending notes, one article at a time
    python scripts/notes.py --run kara      only these slugs
    python scripts/notes.py --run --push    also push the commits (runs a full build first)

For each article with notes, Claude (headless `claude -p`) reads house/STYLE.md and canon/CANON.md,
carries out the notes, removes them, and edits only that article. The result is accepted only if:
  - no other file changed (the private canon included),
  - every note is gone and the front matter still parses,
  - QA shows no new problem: each check's count may not rise compared with the article before the edit.
An accepted article is committed on its own. A rejected one is restored exactly as it was, notes and
all, and the reason is written to canon/notes-log.md, which is private.

Note text is never committed to this public repo: the commit message is generic, the build strips
comments, and the pre-commit hook in .githooks/ refuses a staged note.
"""
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa  # noqa: E402
from wa_common import WA_DIR  # noqa: E402

ROOT = qa.ROOT
CANON = os.path.join(ROOT, 'canon')
LOG = os.path.join(CANON, 'notes-log.md')
NOTE = qa.NOTE
CLAUDE_TIMEOUT = 20 * 60
MAX_BUDGET_USD = '5'

PROMPT = """You are editing one article of The Lexicon, the public wiki for Dave's long-running D&D continuity.

Article file: {rel}

Dave has left {n} note(s) addressed to you inside that file, as HTML comments of the form
<!-- @claude: ... -->. They are:

{notes}

Do this, in order:
1. Read house/STYLE.md in full, starting with "The Lexicon (markdown)" addendum at the top. It is the
   specification for every article and it is strict.
2. Read canon/CANON.md. It is Dave's authoritative register of names, spellings, dates and rulings.
   It is a PRIVATE DM document: anything it marks as not yet revealed in-world must never be written
   into the article.
3. Read the article, then carry out every note. A note is Dave's instruction. Where a note states a
   fact about the world, that fact is Dave's and may be used; add "Dave, note of {today}" to the
   article's `sources` list in the front matter when you do.
4. Delete each note comment once you have carried it out.

Hard rules:
- Edit ONLY {rel}. Do not create, edit or delete any other file.
- Never invent a fact. Everything must come from the note, the article itself, CANON, or a source file
  you have read (the frozen source folder is {sources}).
- Follow STYLE: the defining lead, no process language (never "this article", "the record gives", "the
  sources", hedges or theses), no closing tagline, quotations verbatim, no square brackets in prose.
- Player-safe only. Never use the DM-only material STYLE §6.2 names.
- Every internal link must point at an existing file: `[Name](/<kind>/<slug>/)` where
  src/content/docs/<kind>/<slug>.md exists. Check with Glob before linking. Never invent a slug.
- Keep the front matter valid YAML with the same keys. Keep `description` to one sentence under 160
  characters, and update it if the lead changes what the subject is.
- Obliviated content is sealed with a redaction, never deleted (see the STYLE addendum).
- If a note cannot be carried out as written (it contradicts CANON, it needs a source that does not
  exist, it would publish DM-only or unrevealed material), do not carry out that note and do not delete
  it, and explain why on a line beginning "UNRESOLVED:".

Reply with one to three plain lines saying what you changed, plus any UNRESOLVED lines."""


def md5(path):
    try:
        return hashlib.md5(open(path, 'rb').read()).hexdigest()
    except FileNotFoundError:
        return None


def git(*args, check=True):
    r = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if check and r.returncode != 0:
        raise RuntimeError(f'git {" ".join(args)} failed: {r.stderr.strip()}')
    return r.stdout


def dirty_state():
    """Every changed or untracked file in the repo, with its content hash."""
    out = {}
    for line in git('status', '--porcelain', '--untracked-files=all').splitlines():
        path = line[3:].strip().strip('"')
        if ' -> ' in path:
            path = path.split(' -> ')[1]
        out[path] = md5(os.path.join(ROOT, path))
    return out


def canon_state():
    out = {}
    for base, _, files in os.walk(CANON):
        if os.sep + '.git' in base or base.endswith('.git'):
            continue
        for f in files:
            p = os.path.join(base, f)
            if os.path.abspath(p) != os.path.abspath(LOG):
                out[os.path.relpath(p, CANON)] = md5(p)
    return out


def pending(slugs=None):
    found = []
    for a in qa.load(set(slugs) if slugs else None, include_drafts=True):
        notes = [re.sub(r'\s+', ' ', re.sub(r'^\s*:?\s*', '', m.group(1))).strip() for m in NOTE.finditer(a.raw)]
        if notes:
            found.append((a, notes))
    return found


def front_matter_problems(a):
    d = a.data
    probs = []
    if not isinstance(d.get('title'), str) or not d['title'].strip():
        probs.append('title missing')
    if 'description' in d and not isinstance(d['description'], str):
        probs.append('description is not text')
    if not isinstance(d.get('tags', []), list) or not all(isinstance(t, str) for t in d.get('tags', [])):
        probs.append('tags must be a list of text')
    fields = d.get('fields', {})
    if not isinstance(fields, dict) or not all(isinstance(v, str) for v in fields.values()):
        probs.append('fields must map names to text')
    if not isinstance(d.get('sources', []), list):
        probs.append('sources must be a list')
    return probs


def counts(flags):
    c = {}
    for check, kind, _ in flags:
        if kind != 'note-to-claude':
            c[(check, kind)] = c.get((check, kind), 0) + 1
    return c


def log(entry):
    os.makedirs(CANON, exist_ok=True)
    new = not os.path.exists(LOG)
    with open(LOG, 'a', encoding='utf-8', newline='\n') as f:
        if new:
            f.write('# Notes log (private)\n\nWhat scripts/notes.py did with each note. Never committed to the public repo.\n')
        f.write(entry)


def run_claude(prompt):
    exe = shutil.which('claude')
    if not exe:
        raise RuntimeError('the claude CLI is not on PATH')
    cmd = [exe, '-p', '--output-format', 'json', '--permission-mode', 'acceptEdits',
           '--allowedTools', 'Read', 'Edit', 'Glob', 'Grep',
           '--disallowedTools', 'Bash', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch',
           '--add-dir', WA_DIR, '--max-budget-usd', MAX_BUDGET_USD]
    r = subprocess.run(cmd, cwd=ROOT, input=prompt, capture_output=True, text=True, encoding='utf-8',
                       timeout=CLAUDE_TIMEOUT)
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(f'claude returned no JSON (exit {r.returncode}): {(r.stderr or r.stdout).strip()[:400]}')
    if data.get('is_error'):
        raise RuntimeError(f"claude reported an error: {str(data.get('result'))[:400]}")
    return (data.get('result') or '').strip(), data.get('total_cost_usd')


def apply(a, notes, leak_index, known):
    rel = os.path.relpath(a.path, ROOT).replace(os.sep, '/')
    today = datetime.date.today().isoformat()
    original = open(a.path, 'rb').read()
    others_before = {p: h for p, h in dirty_state().items() if p != rel}
    canon_before = canon_state()
    before_flags = qa.run([a], leak_index=leak_index, known=known).get(a.slug, [])

    def restore(reason, reply=''):
        open(a.path, 'wb').write(original)
        log(f'\n## {today} {a.slug}: REJECTED\n\n**Reason:** {reason}\n\n**Notes:**\n'
            + ''.join(f'- {n}\n' for n in notes) + (f'\n**Claude said:**\n\n{reply}\n' if reply else ''))
        print(f'  REJECTED, article restored: {reason}')
        return False

    prompt = PROMPT.format(rel=rel, n=len(notes), notes='\n'.join(f'{i}. {n}' for i, n in enumerate(notes, 1)),
                           today=today, sources=WA_DIR.replace('\\', '/') + '/sources')
    print(f'  asking Claude ({len(notes)} note(s))...')
    try:
        reply, cost = run_claude(prompt)
    except Exception as e:  # noqa: BLE001
        return restore(str(e))

    others_after = {p: h for p, h in dirty_state().items() if p != rel}
    if others_after != others_before:
        changed = sorted(set(others_after.items()) ^ set(others_before.items()))
        return restore('files other than the article changed: ' + ', '.join(sorted({p for p, _ in changed})) +
                       ' (left as they are for you to inspect)', reply)
    if canon_state() != canon_before:
        return restore('the private canon folder changed (left as it is for you to inspect)', reply)
    if open(a.path, 'rb').read() == original:
        return restore('Claude made no change', reply)

    after = qa.Article(a.path)
    if NOTE.search(after.raw):
        return restore('not every note was carried out', reply)
    probs = front_matter_problems(after)
    if probs:
        return restore('front matter broken: ' + '; '.join(probs), reply)
    after_flags = qa.run([after], leak_index=leak_index, known=known).get(after.slug, [])
    cb, ca = counts(before_flags), counts(after_flags)
    new = {k: ca[k] - cb.get(k, 0) for k in ca if ca[k] > cb.get(k, 0)}
    if new:
        detail = '; '.join(f'{c}:{k} +{n}' for (c, k), n in new.items())
        examples = [f'[{c}:{k}] {d}' for c, k, d in after_flags if (c, k) in new][:4]
        return restore(f'QA found new problems ({detail}): ' + ' | '.join(examples), reply)

    git('add', '--', rel)
    git('commit', '-q', '-m', f'Notes: apply {len(notes)} note(s) to {after.title}', '--', rel)
    sha = git('rev-parse', '--short', 'HEAD').strip()
    log(f'\n## {today} {a.slug}: APPLIED in {sha}\n\n**Notes:**\n' + ''.join(f'- {n}\n' for n in notes)
        + f'\n**Claude said:**\n\n{reply}\n' + (f'\nCost: ${cost:.2f}\n' if cost else ''))
    print(f'  applied and committed {sha}' + (f' (${cost:.2f})' if cost else ''))
    print('  ' + reply.replace('\n', '\n  '))
    return True


def main():
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    todo = pending(args or None)
    if not todo:
        print('No pending notes.')
        return 0
    for a, notes in todo:
        print(f'{a.rel}: {len(notes)} note(s)')
        for n in notes:
            print(f'   - {n}')
    if '--run' not in sys.argv:
        print('\nDry run. Add --run to apply them.')
        return 0
    if git('diff', '--cached', '--name-only').strip():
        print('Refusing to run: there are staged changes. Commit or unstage them first.')
        return 1

    print('\nBuilding the leak index...')
    leak_index = qa.LeakIndex()
    known = qa.known_targets()
    results = []
    for a, notes in todo:
        print(f'\n{a.rel}')
        results.append(apply(a, notes, leak_index, known))
    ok = sum(results)
    print(f'\n{ok} applied, {len(results) - ok} rejected. Details: canon/notes-log.md')

    if ok and '--push' in sys.argv:
        print('\nBuilding the site before pushing...')
        if subprocess.run('npm run build', cwd=ROOT, shell=True).returncode != 0:
            print('Build failed: not pushing.')
            return 1
        if subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'check_links.py')], cwd=ROOT).returncode != 0:
            print('Built site failed its checks: not pushing.')
            return 1
        git('push')
        print('Pushed.')
    return 0 if ok == len(results) else 1


if __name__ == '__main__':
    sys.exit(main())
