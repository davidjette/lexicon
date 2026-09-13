import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// The Lexicon front matter, layered on Starlight's docs schema. It is shaped to the World Anvil
// import as it stands (scripts/wa_import.py, docs/corpus-report.md) rather than an ideal model.
// The slug is the file name; the folder is the kind.
const lexicon = z.object({
	/** Original World Anvil type, e.g. "person", "building / landmark". */
	type: z.string().optional(),
	/** Normalized kind, which is also the content folder. */
	kind: z.enum(['people', 'places', 'organizations', 'history', 'sessions', 'items', 'lore', 'species']).optional(),
	tags: z.array(z.string()).default([]),
	/** Font Awesome icon name carried over from World Anvil. */
	icon: z.string().optional(),
	/** World Anvil template fields, kept as a flat map (172 distinct keys across types). */
	fields: z.record(z.string(), z.string()).default({}),
	/** Source files this article draws on. */
	sources: z.array(z.string()).default([]),
	/** Set true for a placeholder awaiting source material. */
	needsSource: z.boolean().default(false),
	published: z.string().optional(),
	/** Provenance from World Anvil. */
	wa: z
		.object({
			slug: z.string().optional(),
			uuid: z.string().optional(),
			category: z.string().optional(),
			note: z.string().optional(),
			image_card: z.string().optional(),
		})
		.optional(),
	/** Seals the whole article as obliviated. */
	redacted: z
		.object({
			label: z.string(),
			reason: z.string().optional(),
			source: z.string().optional(),
		})
		.optional(),
});

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({ extend: lexicon }),
	}),
};
