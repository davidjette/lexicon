// Turns ::::letters and :::letter{leaf="I"} directives into handwritten letter leaves (styled in homebrewery.css).
// Directives keep raw HTML out of articles, so the browser editor can save them.
import { visit } from 'unist-util-visit';

export default function remarkLetters() {
	return (tree) => {
		visit(tree, 'containerDirective', (node) => {
			if (node.name === 'letters') {
				node.data = { hName: 'div', hProperties: { className: ['elf-letters'] } };
			} else if (node.name === 'letter') {
				if (node.children[0]?.data?.directiveLabel) node.children.shift();
				const leaf = node.attributes?.leaf;
				node.data = {
					hName: 'blockquote',
					hProperties: { className: ['elf-letter'], ...(leaf ? { dataLeaf: `LEAF ${leaf}` } : {}) },
				};
			}
		});
	};
}
