// Removes HTML comments from article markdown before it becomes a page.
// Notes to Claude (<!-- @claude: … -->) and any other comment must never reach the published HTML,
// where "view source" would show them.
import { visit, SKIP } from 'unist-util-visit';

const COMMENT = /<!--[\s\S]*?-->/g;

export default function remarkStripComments() {
	return (tree) => {
		visit(tree, 'html', (node, index, parent) => {
			if (!node.value.includes('<!--')) return;
			const rest = node.value.replace(COMMENT, '');
			if (rest.trim() === '' && parent && index !== undefined) {
				parent.children.splice(index, 1);
				return [SKIP, index];
			}
			node.value = rest;
		});
	};
}
