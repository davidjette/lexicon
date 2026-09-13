// Data for the front page, computed at build time.
import { execFileSync } from 'node:child_process';
import { getArticles, href, KINDS, mentionsSealed, sortArticles, type Doc, type Kind } from './articles';

export const MIN_WORDS = 600; // an article of the day must be at least this long
const LEAD_CHARS = 420;

export const withBase = (src: string) => (src.startsWith('/') ? import.meta.env.BASE_URL.replace(/\/$/, '') + src : src);

/** Markdown to reading text. */
export function plain(md: string): string {
	return md
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/:{1,3}redacted(\[(?:[^[\]]|\[[^\]]*\])*\])?(\{[^}]*\})?/g, '')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/[*_`#>]/g, '')
		.replace(/\\/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** The article's lead paragraph: the first real paragraph after the stat line, aliases and quotes. */
export function lead(body: string): string {
	for (const para of body.split(/\n\s*\n/)) {
		const s = para.trim();
		if (!s || s.startsWith('#') || s.startsWith('>') || s.startsWith(':::') || /^(-{3,}|\*{3,})$/.test(s)) continue;
		if (s.startsWith('<small>') || /^\*?also known as/i.test(plain(s)) || /^\*\*[^*]+\*\*$/.test(s) || (s.includes('·') && plain(s).length < 320)) continue;
		if (/^[-*] |^\d+\. |^\|/.test(s)) continue;
		return plain(s);
	}
	return '';
}

function clip(text: string, n: number) {
	if (text.length <= n) return text;
	const cut = text.slice(0, n);
	return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—-]$/, '') + '…';
}

export type Feature = { title: string; url: string; kind: string; lead: string; image?: string; alt?: string; words: number };

export async function featureCandidates(): Promise<Feature[]> {
	const all = await getArticles();
	return sortArticles(all)
		.filter((e) => !e.data.redacted && e.data.kind && e.data.kind !== 'sessions')
		.map((e) => ({ e, words: plain(e.body ?? '').split(' ').length, lead: lead(e.body ?? '') }))
		.filter(({ e, words, lead }) => words >= MIN_WORDS && lead.length > 80 && !mentionsSealed(lead + ' ' + (e.body ?? '').slice(0, 1500), e.id))
		.map(({ e, words, lead }) => ({
			title: e.data.title,
			url: href(e),
			kind: KINDS[e.data.kind as Kind],
			lead: clip(lead, LEAD_CHARS),
			image: e.data.image ? withBase(e.data.image.src) : undefined,
			alt: e.data.image?.alt,
			words,
		}));
}

/** Same pick for every reader on a given day. The page script repeats this in the browser. */
export function dayIndex(dateKey: string, n: number): number {
	let h = 2166136261;
	for (const ch of dateKey) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return (h >>> 0) % n;
}

// Tile art for each section. Change freely; any site image path works.
const TILE_ART: Record<Kind, string> = {
	people: '/images/cards/marcus.webp',
	places: '/images/maps/50-sharn-thumb.webp',
	organizations: '/images/cards/war-wizards.webp',
	history: '/images/maps/57-world-map-antiquity-thumb.webp',
	sessions: '/images/site/sharn-ep-18-the-fall-of-esther-crona-1.webp',
	items: '/images/cards/the-lexicon.webp',
	lore: '/images/maps/58-faerun-2nd-edition-infanta-era-thumb.webp',
	species: '/images/cards/metallic-elder-dragons.webp',
};

export async function kindTiles() {
	const all = await getArticles();
	return (Object.keys(KINDS) as Kind[]).map((kind) => ({
		kind,
		label: KINDS[kind],
		count: all.filter((e) => e.data.kind === kind).length,
		url: withBase(`/${kind}/`),
		image: withBase(TILE_ART[kind]),
	}));
}

export async function latestSessions(n = 4) {
	// numbered episodes only (the importer gives them a sidebar order), in play order
	const sessions = sortArticles((await getArticles('sessions')).filter((e) => typeof e.data.sidebar?.order === 'number'));
	return sessions
		.slice(-n)
		.reverse()
		.map((e) => ({ title: e.data.title, url: href(e), lead: clip(lead(e.body ?? ''), 180) }));
}

/** Articles most recently changed in git, newest first, with who changed them. */
export async function recentlyUpdated(n = 8) {
	const all = await getArticles();
	const byPath = new Map<string, Doc>(all.filter((e) => !e.data.redacted).map((e) => [`src/content/docs/${e.id}.md`, e]));
	let log = '';
	try {
		log = execFileSync('git', ['log', '--format=@@%aI|%an|%s', '--name-only', '-n', '300', '--', 'src/content/docs'], { encoding: 'utf8' });
	} catch {
		return [];
	}
	const out: { title: string; url: string; date: string; author: string }[] = [];
	const seen = new Set<string>();
	for (const commit of log.split('@@').slice(1)) {
		const [head, ...files] = commit.split('\n').map((l) => l.trim()).filter(Boolean);
		if (files.length > 15) continue; // bulk maintenance (imports, reformatting), not an edit to an article
		const [date, author] = head.split('|');
		for (const file of files) {
			const e = byPath.get(file);
			if (!e || seen.has(e.id)) continue;
			seen.add(e.id);
			out.push({ title: e.data.title, url: href(e), date: date.slice(0, 10), author });
			if (out.length === n) return out;
		}
	}
	return out;
}
