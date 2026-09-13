import { getCollection, type CollectionEntry } from 'astro:content';
import { scanRedactions } from './redactions.mjs';
import { sealedArticles, nameRegex, referencesIn } from './sealed.mjs';

export const KINDS = {
	people: 'People',
	places: 'Places',
	organizations: 'Organizations',
	history: 'History',
	sessions: 'Sessions',
	items: 'Items',
	lore: 'Lore',
	species: 'Species & Creatures',
} as const;
export type Kind = keyof typeof KINDS;

export type Doc = CollectionEntry<'docs'>;

/** Content articles only: excludes the home page and kind index pages. */
export async function getArticles(kind?: Kind): Promise<Doc[]> {
	return getCollection(
		'docs',
		(e) =>
			e.id.includes('/') && // articles live in a kind folder; the home page and kind indexes do not
			!e.id.endsWith('/index') &&
			!(import.meta.env.PROD && e.data.draft) &&
			(kind ? e.data.kind === kind || (!e.data.kind && e.id.startsWith(`${kind}/`)) : true),
	);
}

export function href(entry: Doc, hash = ''): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return `${base}/${entry.id}/${hash}`;
}

/** What a listing may show for an article. A sealed article shows its label, never its excerpt,
 * and a description that names a sealed article is not shown at all. */
export function blurb(entry: Doc): string {
	if (entry.data.redacted) return entry.data.redacted.label;
	const description = entry.data.description ?? '';
	return mentionsSealed(description, entry.id) ? '' : description;
}

export function mentionsSealed(text: string, selfId?: string): boolean {
	const others = sealedArticles().filter((s) => s.key !== selfId);
	return referencesIn(text, others, selfId).length > 0 || !!nameRegex(others)?.test(text);
}

export function sortArticles(entries: Doc[]): Doc[] {
	return entries.sort((a, b) => {
		const oa = a.data.sidebar?.order ?? Infinity;
		const ob = b.data.sidebar?.order ?? Infinity;
		return oa !== ob ? oa - ob : a.data.title.localeCompare(b.data.title);
	});
}

export type RedactionRecord = {
	id: string;
	scope: 'article' | 'block' | 'inline';
	article: string;
	title: string;
	url: string;
	label?: string;
	reason?: string;
	source?: string;
	names?: string[];
	/** For a sealed article: the pages whose references to it are sealed automatically. */
	referencedIn?: { title: string; url: string }[];
};

export async function getRedactions(): Promise<RedactionRecord[]> {
	const out: RedactionRecord[] = [];
	const all = sortArticles(await getArticles());
	const sealed = sealedArticles();
	for (const e of all) {
		const slug = e.id.split('/').pop()!;
		if (e.data.redacted) {
			const referencedIn = all
				.filter((o) => o.id !== e.id && referencesIn(o.body ?? '', sealed.filter((s) => s.key === e.id), o.id).length)
				.map((o) => ({ title: o.data.title, url: href(o) }));
			out.push({ id: slug, scope: 'article', article: e.id, title: e.data.title, url: href(e, '#redaction-article'), ...e.data.redacted, referencedIn });
		}
		for (const r of scanRedactions(e.body ?? '', slug)) {
			out.push({
				id: r.id,
				scope: r.block ? 'block' : 'inline',
				article: e.id,
				title: e.data.title,
				url: href(e, `#redaction-${r.id}`),
				label: r.label,
				reason: r.reason,
				source: r.source,
			});
		}
	}
	// The remark plugin also rejects duplicates, but the content loader only logs that error.
	// Throwing here, while the registry page renders, is what fails the build.
	const seen = new Map<string, string>();
	for (const r of out) {
		const prior = seen.get(r.id);
		if (prior) throw new Error(`Duplicate redaction id "${r.id}" in ${r.article} (also in ${prior})`);
		seen.set(r.id, r.article);
	}
	return out;
}
