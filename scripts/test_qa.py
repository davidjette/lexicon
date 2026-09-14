"""Self-test for scripts/qa.py: each check must catch a planted defect and pass a clean article.

Usage: python scripts/test_qa.py
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa  # noqa: E402

CLEAN = """---
title: Test Subject
description: A test subject.
tags: [Test]
fields: {age: Unknown}
---

**Human · Fighter · Alive**

Test Subject is a fighter of [Temple Holdings LLC](/lore/temple-holdings-llc/). He was born in Sharn.

## History

He fought at [the Egg](/places/the-egg/): "may our children forgive us." <small>(Arc VIII.)</small>
"""


def article(text):
    return qa.Article(os.path.join(qa.DOCS, 'people', 'test-subject.md'), text)


def kinds(text, index):
    a = article(text)
    return {k for _, k, _ in qa.run([a], leak_index=index, known=qa.known_targets()).get(a.slug, [])}


def main():
    index = qa.LeakIndex()
    dm_shingle = random.Random(1).choice(sorted(index.dm1))
    cases = {
        'clean': (CLEAN, set()),
        'process language': (CLEAN.replace('He was born in Sharn.', 'He was born in Sharn, which this article cannot confirm.'), {'self-reference'}),
        'editorial bracket': (CLEAN.replace('may our children', 'may [all] our children'), {'editorial-bracket'}),
        'glued bracket': (CLEAN.replace('He fought', 'He fight[s]'), {'glued-bracket'}),
        'bracket in metadata': (CLEAN.replace('age: Unknown', 'age: "[about] 40"'), {'bracket-in-metadata'}),
        'no defining lead': (CLEAN.replace('Test Subject is a fighter', 'A fighter'), {'no-defining-lead'}),
        'broken link': (CLEAN.replace('/lore/temple-holdings-llc/', '/lore/no-such-article/'), {'broken-link'}),
        'note left in': (CLEAN + '\n<!-- @claude: expand this -->\n', {'note-to-claude'}),
        'process language in description': (CLEAN.replace('A test subject.', 'The record gives little on him.'), {'source-consulted'}),
        'DM-only leak in body': (CLEAN.replace('He was born in Sharn.', 'He was born in Sharn. ' + dm_shingle + '.'), {'leak-file'}),
        'DM-only leak in a field': (CLEAN.replace('age: Unknown', 'age: "' + dm_shingle + '"'), {'leak-file'}),
        'unquoted colon in sources': (CLEAN.replace('tags: [Test]', 'tags: [Test]\nsources:\n- Oral Histories: The Inevitables, 2024-06-01'), {'not-a-string'}),
        'number as a tag': (CLEAN.replace('tags: [Test]', 'tags: [Test, 1.0]'), {'not-a-string'}),
        'unquoted date': (CLEAN.replace('tags: [Test]', 'tags: [Test]\npublished: 2026-09-14'), {'not-a-string'}),
        'redaction and link syntax are not brackets': (CLEAN.replace('He was born in Sharn.', 'He was born in :redacted[the vault under [Sharn](/places/sharn/)]{id="t"}.'), set()),
    }
    failed = 0
    for name, (text, expected) in cases.items():
        got = kinds(text, index)
        ok = expected <= got and (expected or not got)
        failed += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {name}: expected {sorted(expected) or 'nothing'}, got {sorted(got) or 'nothing'}")
    print('all checks catch their defect' if not failed else f'{failed} case(s) failed')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
