// Seals every sentence, table row or heading that refers to a sealed (obliviated) article, either by
// linking to it or by naming it with one of the aliases listed under its `redacted.names`.
// The reference is blacked out like any other redaction and revealed with a click.
// Self-test: node scripts/test-sealed-refs.mjs
import { visit, SKIP } from 'unist-util-visit';
import { sealedArticles, hrefKey, nameRegex } from '../lib/sealed.mjs';

const TIP = 'Obliviated. Click to reveal';
// a sentence ends at . ! or ?, optionally followed by closing quotes or brackets, then whitespace
// (which may be the end of a text node, when the next sentence opens on bold text or a link)
const BOUNDARY = /(?<=[.!?]["'”’)\]]*)\s+(?=\S|$)/g;

export default function remarkSealedRefs(options = {}) {
	return (tree, file) => {
		const sealed = options.sealedOverride ?? sealedArticles();
		if (!sealed.length) return;
		const path = String(file.history?.[0] ?? file.path ?? '').replace(/\\/g, '/');
		const self = path.match(/src\/content\/docs\/(.+)\.mdx?$/)?.[1];
		if (sealed.some((s) => s.key === self)) return; // the sealed article itself is sealed whole
		const keys = new Set(sealed.map((s) => s.key).filter((k) => k !== self));
		const names = nameRegex(sealed.filter((s) => s.key !== self));
		let n = 0;

		const refers = (node) => {
			if (isRedaction(node)) return false; // already hidden
			if (node.type === 'link' && keys.has(hrefKey(node.url))) return true;
			if ((node.type === 'text' || node.type === 'html') && names?.test(node.value)) return true;
			return Array.isArray(node.children) && node.children.some(refers);
		};

		const seal = (children) => {
			n += 1;
			return {
				type: 'textDirective',
				name: 'redacted',
				attributes: {},
				children,
				data: {
					hName: 'span',
					hProperties: {
						id: `redaction-ref-${n}`,
						className: ['redacted', 'redacted--ref'],
						role: 'button',
						tabIndex: 0,
						ariaExpanded: 'false',
						ariaLabel: TIP,
						title: TIP,
						dataRedactionId: `ref-${n}`,
						dataPagefindIgnore: '',
					},
				},
			};
		};

		visit(tree, (node) => {
			if (isRedaction(node)) return SKIP;
			if (node.type === 'heading' || node.type === 'tableRow') {
				if (!refers(node)) return SKIP;
				if (node.type === 'heading') node.children = [seal(node.children)];
				else for (const cell of node.children) cell.children = [seal(cell.children)];
				return SKIP;
			}
			if (node.type === 'paragraph') {
				if (!refers(node)) return SKIP;
				node.children = sealSentences(node.children, refers, seal);
				return SKIP;
			}
		});
	};
}

function isRedaction(node) {
	return (node.type === 'textDirective' || node.type === 'containerDirective') && node.name === 'redacted';
}

function plainText(node) {
	if (node.type === 'text' || node.type === 'inlineCode') return node.value;
	return (node.children || []).map(plainText).join('');
}

/** Quote state after reading `s`: straight quotes toggle, curly quotes open and close. */
function advance(inQuote, s) {
	for (const ch of s) {
		if (ch === '“') inQuote = true;
		else if (ch === '”') inQuote = false;
		else if (ch === '"') inQuote = !inQuote;
	}
	return inQuote;
}

/** Split a paragraph's inline content into sentences and wrap the ones that refer to a sealed article. */
function sealSentences(children, refers, seal) {
	// atoms: indivisible runs of inline nodes; `ends` marks a sentence end after the atom
	const atoms = [];
	let inQuote = false;
	for (let i = 0; i < children.length; i++) {
		const node = children[i];
		if (node.type === 'text') {
			let last = 0; // start of the text not yet emitted
			let scanned = 0; // how far the quote state has been read
			for (const m of node.value.matchAll(BOUNDARY)) {
				inQuote = advance(inQuote, node.value.slice(scanned, m.index));
				scanned = m.index;
				if (inQuote) continue; // a full stop inside a quotation does not end the sentence
				const piece = node.value.slice(last, m.index);
				if (piece) atoms.push({ nodes: [{ type: 'text', value: piece }], ends: true });
				atoms.push({ nodes: [{ type: 'text', value: m[0] }], space: true });
				last = scanned = m.index + m[0].length;
			}
			inQuote = advance(inQuote, node.value.slice(scanned));
			if (last < node.value.length) atoms.push({ nodes: [{ type: 'text', value: node.value.slice(last) }] });
			continue;
		}
		// raw inline HTML such as <small>…</small> stays whole, or the wrapper would split the tag pair
		const open = node.type === 'html' && node.value.match(/^<([a-z]+)[^>]*>$/i);
		if (open) {
			const close = children.findIndex((c, k) => k > i && c.type === 'html' && c.value.toLowerCase() === `</${open[1].toLowerCase()}>`);
			if (close !== -1) {
				atoms.push({ nodes: children.slice(i, close + 1), citation: open[1].toLowerCase() === 'small' });
				i = close;
				continue;
			}
		}
		inQuote = advance(inQuote, plainText(node));
		atoms.push({ nodes: [node] });
	}

	// a sentence ending just before a <small> citation keeps that citation
	for (let i = 0; i < atoms.length; i++) {
		if (atoms[i].ends && atoms[i + 1]?.space && atoms[i + 2]?.citation) {
			atoms[i].ends = false;
			atoms[i + 1].space = false;
			atoms[i + 2].ends = true;
		}
	}

	const out = [];
	let sentence = [];
	const flush = () => {
		if (!sentence.length) return;
		const nodes = sentence.flatMap((a) => a.nodes);
		sentence = [];
		if (!nodes.some(refers)) return out.push(...nodes);
		// keep leading and trailing whitespace outside the black bar
		const first = nodes[0];
		if (first.type === 'text' && /^\s/.test(first.value)) {
			const lead = first.value.match(/^\s+/)[0];
			out.push({ type: 'text', value: lead });
			nodes[0] = { type: 'text', value: first.value.slice(lead.length) };
		}
		out.push(seal(nodes));
	};
	for (const atom of atoms) {
		if (atom.space) {
			flush();
			out.push(...atom.nodes);
			continue;
		}
		sentence.push(atom);
		if (atom.ends) flush();
	}
	flush();
	return out;
}
