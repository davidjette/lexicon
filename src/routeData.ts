import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// A whole-article redaction must not leak through the page description (search results, link previews).
export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const redacted = route.entry.data.redacted;
	if (!redacted) return;
	route.toc = undefined; // section headings would leak the sealed content
	for (const tag of route.head) {
		if (tag.tag !== 'meta' || !tag.attrs) continue;
		if (tag.attrs.name === 'description' || tag.attrs.property === 'og:description') {
			tag.attrs.content = redacted.label;
		}
	}
});
