// The browser editor rewrites front matter with js-yaml when it saves. Check that doing so to every
// article keeps every value identical, so a contributor's first save never changes data by accident.
//   node scripts/test-editor-roundtrip.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { isDeepStrictEqual } from 'node:util';

const DOCS = join(process.cwd(), 'src', 'content', 'docs');
const split = (c) => {
	const m = c.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	return { data: yaml.load(m[1]) || {}, body: m[2].replace(/^\n/, '') };
};
const join2 = (data, body) => `---\n${yaml.dump(data, { lineWidth: -1, noRefs: true })}---\n\n${body.replace(/^\n+/, '')}`;

let n = 0;
let bad = 0;
const walk = (dir) => {
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		if (statSync(p).isDirectory()) walk(p);
		else if (f.endsWith('.md')) {
			n += 1;
			const before = split(readFileSync(p, 'utf8'));
			const after = split(join2(before.data, before.body));
			if (!isDeepStrictEqual(before.data, after.data) || before.body !== after.body) {
				bad += 1;
				console.log(`changed: ${p}`);
			}
		}
	}
};
walk(DOCS);
console.log(`${n} articles, ${bad} changed by an editor save`);
process.exit(bad ? 1 : 0);
