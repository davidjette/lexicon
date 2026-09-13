import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { mentionsSealed } from './lib/articles';

// Sealed content must not leak through the page description (search results, link previews).
export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const redacted = route.entry.data.redacted;
	let replacement: string | undefined;
	if (redacted) {
		route.toc = undefined; // section headings would leak the sealed content
		replacement = redacted.label;
	} else if (mentionsSealed(route.entry.data.description ?? '', route.id)) {
		replacement = 'An article of the Lexicon.';
	}
	if (replacement === undefined) return;
	for (const tag of route.head) {
		if (tag.tag !== 'meta' || !tag.attrs) continue;
		if (tag.attrs.name === 'description' || tag.attrs.property === 'og:description') {
			tag.attrs.content = replacement;
		}
	}
});
