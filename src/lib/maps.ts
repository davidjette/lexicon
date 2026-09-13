import maps from '../data/maps.json';
import { getArticles, href, type Doc } from './articles';

export type MapEntry = (typeof maps)[number];
export const MAPS: MapEntry[] = maps;

export const withBase = (src: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + src;

/** Articles that link to a map. */
export async function articlesLinking(map: MapEntry): Promise<{ title: string; url: string }[]> {
	const all: Doc[] = await getArticles();
	return all
		.filter((e) => !e.data.redacted && (e.body ?? '').includes(`/maps/${map.id}/`))
		.map((e) => ({ title: e.data.title, url: href(e) }))
		.sort((a, b) => a.title.localeCompare(b.title));
}
