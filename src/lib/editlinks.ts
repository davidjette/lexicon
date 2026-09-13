import editor from '../data/editor.json';

export const editorOn = !!editor.api;

/** Editor links for a Starlight route. Signing in keeps the query string, so it returns to this article. */
export function editLinks(route: { id: string; entry?: { data?: { kind?: string } } }) {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	const isArticle = !!route.entry?.data?.kind && route.id.includes('/');
	const path = `src/content/docs/${route.id}.md`;
	return {
		isArticle,
		edit: isArticle ? `${base}/edit/?path=${encodeURIComponent(path)}` : `${base}/edit/`,
		history: `${base}/edit/?history=${encodeURIComponent(path)}`,
	};
}
