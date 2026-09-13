// Sealed (whole-article) redactions, read straight from the article files so that the markdown
// pipeline, the registry and the listings all agree on what is sealed and by which names.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import yaml from 'js-yaml';

const DOCS = join(process.cwd(), 'src', 'content', 'docs');
let cache = { at: 0, value: null };

/**
 * Every sealed article: { key: 'people/stonecypher', title, label, names: [...] }.
 * `names` are the aliases an author lists under `redacted.names`; a sentence naming one is sealed too.
 */
export function sealedArticles() {
	if (cache.value && Date.now() - cache.at < 2000) return cache.value;
	const out = [];
	const walk = (dir) => {
		for (const f of readdirSync(dir)) {
			const p = join(dir, f);
			if (statSync(p).isDirectory()) walk(p);
			else if (/\.mdx?$/.test(f)) {
				const text = readFileSync(p, 'utf8');
				if (!/^---[\s\S]*?\nredacted:/m.test(text)) continue;
				const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
				const data = m ? yaml.load(m[1]) || {} : {};
				if (!data.redacted || data.draft) continue;
				const key = relative(DOCS, p).split(sep).join('/').replace(/\.mdx?$/, '');
				const names = Array.isArray(data.redacted.names) ? data.redacted.names.filter((n) => typeof n === 'string' && n.trim()) : [];
				out.push({ key, title: data.title, label: data.redacted.label, names });
			}
		}
	};
	walk(DOCS);
	cache = { at: Date.now(), value: out };
	return out;
}

/** Article key ("people/stonecypher") for an internal href, or null. */
export function hrefKey(href) {
	const m = String(href || '').match(/^(?:\/[a-z0-9-]+)?\/((?:people|places|organizations|history|sessions|items|lore|species)\/[a-z0-9-]+)\/?(?:[#?].*)?$/);
	return m ? m[1] : null;
}

export function nameRegex(sealed) {
	const names = sealed.flatMap((s) => s.names).sort((a, b) => b.length - a.length);
	if (!names.length) return null;
	const esc = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return new RegExp(`(?<![\\w-])(?:${esc.join('|')})(?![\\w-])`);
}

/** Sealed article keys a markdown body refers to, by link or by listed name. */
export function referencesIn(body, sealed, selfKey) {
	const keys = new Set(sealed.map((s) => s.key));
	const found = new Set();
	for (const m of String(body).matchAll(/\]\((\/[^)\s]*)\)/g)) {
		const k = hrefKey(m[1]);
		if (k && keys.has(k) && k !== selfKey) found.add(k);
	}
	for (const s of sealed) {
		if (s.key === selfKey || !s.names.length) continue;
		if (nameRegex([s])?.test(body)) found.add(s.key);
	}
	return [...found];
}
