// Redactions: obliviated content hidden behind a black bar until the reader reveals it.
//
// Authoring (plain .md):
//   inline  :redacted[hidden text]{id="calix-post-skip" label="…" reason="…" source="…"}
//   block   :::redacted{label="…"}
//           hidden paragraphs
//           :::
//   article front matter  redacted: { label, reason, source }
//
// `id` is optional and defaults to `<slug>-<n>`, counting redactions in source order.
// The remark plugin and the Sealed Records registry both number them with scanRedactions below,
// so the two always agree.

// `:redacted` inline or `:::redacted` block; the [content] may hold one level of nested brackets (a link)
const DIRECTIVE = /(^|[^\\:])(:::|:)redacted(?:\[(?:[^[\]]|\[[^\]]*\])*\])?(?:\{([^}]*)\})?/gm;
const FENCE = /^(```|~~~)[\s\S]*?^\1/gm;

export function parseAttributes(src = '') {
	const attrs = {};
	for (const m of src.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
	return attrs;
}

export function slugOf(path) {
	return path.replace(/\\/g, '/').split('/').pop().replace(/\.(md|mdx)$/, '');
}

/** Every redaction directive in a markdown body, in source order, with its resolved id. */
export function scanRedactions(body, slug) {
	const blank = (m) => m.replace(/[^\n]/g, ' ');
	const text = body.replace(FENCE, blank).replace(/`[^`\n]*`/g, blank);
	const out = [];
	let n = 0;
	for (const m of text.matchAll(DIRECTIVE)) {
		n += 1;
		const attrs = parseAttributes(m[3]);
		out.push({ ...attrs, id: attrs.id || `${slug}-${n}`, block: m[2] === ':::' });
	}
	return out;
}
