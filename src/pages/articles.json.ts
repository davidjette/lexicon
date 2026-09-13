// Machine-readable index of every article, for models and scripts that edit the Lexicon.
import type { APIRoute } from 'astro';
import { getArticles, sortArticles, KINDS, type Kind } from '../lib/articles';

const SITE = 'https://davidjette.github.io';
const RAW = 'https://raw.githubusercontent.com/davidjette/lexicon/main';

export const GET: APIRoute = async () => {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	const articles = sortArticles(await getArticles()).map((e) => {
		const path = `src/content/docs/${e.id}.md`;
		return {
			title: e.data.title,
			kind: e.data.kind,
			section: e.data.kind ? KINDS[e.data.kind as Kind] : undefined,
			path,
			url: `${SITE}${base}/${e.id}/`,
			raw: `${RAW}/${path}`,
			description: e.data.redacted ? e.data.redacted.label : e.data.description,
			sealed: !!e.data.redacted,
			tags: e.data.tags,
			image: e.data.image?.src,
			words: (e.body ?? '').split(/\s+/).filter(Boolean).length,
		};
	});
	return new Response(JSON.stringify({ generated: new Date().toISOString(), count: articles.length, articles }, null, 1), {
		headers: { 'Content-Type': 'application/json' },
	});
};
