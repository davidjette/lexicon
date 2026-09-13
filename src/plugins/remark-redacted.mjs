// Turns :redacted[…]{…} and :::redacted{…} directives into sealed, click-to-reveal elements.
// remark-directive itself is already loaded by Starlight; this plugin only handles the nodes.
import { visit } from 'unist-util-visit';
import { slugOf } from '../lib/redactions.mjs';

const TIP = 'Obliviated. Click to reveal';
const owners = new Map(); // redaction id -> slug, to catch duplicates across the whole site

export default function remarkRedacted() {
	return (tree, file) => {
		const path = file.history?.[0] ?? file.path ?? '';
		const slug = slugOf(path);
		for (const [id, owner] of owners) if (owner === path) owners.delete(id);

		let n = 0;
		visit(tree, (node) => {
			if (node.type !== 'textDirective' && node.type !== 'containerDirective') return;
			if (node.name !== 'redacted') return;
			n += 1;
			const attrs = node.attributes ?? {};
			const id = attrs.id || `${slug}-${n}`;
			const other = owners.get(id);
			if (other !== undefined && other !== path) {
				throw new Error(`Duplicate redaction id "${id}" in ${path} (already used in ${other})`);
			}
			if (other === path) throw new Error(`Duplicate redaction id "${id}" in ${path}`);
			owners.set(id, path);

			const block = node.type === 'containerDirective';
			if (block && node.children[0]?.data?.directiveLabel) node.children.shift();
			const tip = attrs.label ? `Obliviated: ${attrs.label}. Click to reveal` : TIP;
			node.data = {
				hName: block ? 'div' : 'span',
				hProperties: {
					id: `redaction-${id}`,
					className: block ? ['redacted', 'redacted--block'] : ['redacted'],
					role: 'button',
					tabIndex: 0,
					ariaExpanded: 'false',
					ariaLabel: tip,
					title: tip,
					dataRedactionId: id,
					dataPagefindIgnore: '',
				},
			};
		});
	};
}
