// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkRedacted from './src/plugins/remark-redacted.mjs';

// Deployed to GitHub Pages as a project site at https://davidjette.github.io/infantaverse/
const BASE = '/infantaverse';

// Astro does not prepend `base` to root-relative links written by hand in
// markdown/MDX content (e.g. `[Calix](/characters/calix/)`). Starlight handles
// its own generated links (sidebar, etc.), but inline content links would 404
// under a project-page base path. This rehype plugin rewrites any root-relative
// <a href="/..."> to include the base, so content links work both in `astro dev`
// (served under the base) and in production. Zero-dependency tree walk.
function rehypeBaseLinks() {
	/** @param {any} node */
	const walk = (node) => {
		if (
			node.tagName === 'a' &&
			node.properties &&
			typeof node.properties.href === 'string'
		) {
			const href = node.properties.href;
			if (
				href.startsWith('/') &&
				!href.startsWith('//') &&
				href !== BASE &&
				!href.startsWith(BASE + '/')
			) {
				node.properties.href = BASE + href;
			}
		}
		if (node.children) node.children.forEach(walk);
	};
	/** @param {any} tree */
	return (tree) => walk(tree);
}

const KINDS = [
	['people', 'People'],
	['places', 'Places'],
	['organizations', 'Organizations'],
	['history', 'History'],
	['sessions', 'Sessions'],
	['items', 'Items'],
	['lore', 'Lore'],
	['species', 'Species & Creatures'],
];

export default defineConfig({
	site: 'https://davidjette.github.io',
	base: BASE,
	markdown: {
		remarkPlugins: [remarkRedacted],
		rehypePlugins: [rehypeBaseLinks],
	},
	integrations: [
		starlight({
			title: 'The Lexicon',
			description: 'The record of a long-running D&D continuity.',
			customCss: ['./src/styles/homebrewery.css'],
			components: { MarkdownContent: './src/components/MarkdownContent.astro' },
			routeMiddleware: './src/routeData.ts',
			// Search (Pagefind) is built in for production builds.
			sidebar: [
				{ label: 'Home', link: '/' },
				...KINDS.map(([directory, label]) => ({ label, collapsed: true, items: [{ autogenerate: { directory } }] })),
				{ label: 'Sealed Records', link: '/sealed-records/' },
			],
		}),
	],
});
