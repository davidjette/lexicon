// Self-test for src/plugins/remark-sealed-refs.mjs: which text gets sealed for a sealed article's
// links and names. Usage: node scripts/test-sealed-refs.mjs
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkSealedRefs from '../src/plugins/remark-sealed-refs.mjs';
import * as sealed from '../src/lib/sealed.mjs';

const SEALED = [{ key: 'people/stonecypher', title: 'Stonecypher', label: 'x', names: ['Stonecypher', 'Chronocypher'] }];

function sealedText(md) {
	const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(md);
	remarkSealedRefs({ sealedOverride: SEALED })(tree, { history: ['src/content/docs/lore/test.md'] });
	const out = [];
	const text = (n) => (n.type === 'text' || n.type === 'html' || n.type === 'inlineCode' ? n.value : (n.children || []).map(text).join(''));
	const walk = (n) => {
		if (n.data?.hProperties?.className?.includes('redacted--ref')) return out.push(text(n));
		(n.children || []).forEach(walk);
	};
	walk(tree);
	return out;
}

const cases = [
	{
		name: 'two sentences, only the second refers',
		md: 'Istus is also called **Lady Cypher**, "the weaver of fate", and is served by the [Cypheric Orcs](/organizations/cypheric-orcs/). **Chronocypher** takes June\'s place as the Watcher.',
		want: ["Chronocypher takes June's place as the Watcher."],
	},
	{
		name: 'a quotation is not split, and its citation goes with it',
		md: 'Marcus supplies a closer view: "Carls III probably died 300 years ago. Her ghost is still as racist as ever." <small>(Arc IV, on a phylactery in Stonecypher\'s trunk.)</small> The next sentence stays.',
		want: ['Marcus supplies a closer view: "Carls III probably died 300 years ago. Her ghost is still as racist as ever." <small>(Arc IV, on a phylactery in Stonecypher\'s trunk.)</small>'],
	},
	{
		name: 'a link to the sealed article',
		md: 'First sentence. She met [her](/people/stonecypher/) at Refuge. Last sentence.',
		want: ['She met her at Refuge.'],
	},
	{
		name: 'a list item naming the alias',
		md: '- **Stonecypher** — with him on the boat.\n- **Other** — not sealed.',
		want: ['Stonecypher — with him on the boat.'],
	},
	{
		name: 'a table row',
		md: '| Who | What |\n|---|---|\n| Stonecypher | rogue |\n| Kara | wizard |',
		want: ['Stonecypher', 'rogue'],
	},
	{
		name: 'a word containing the alias is not a match',
		md: 'The Stonecyphers of old and the Seat of Cypher are unrelated.',
		want: [],
	},
];

let failed = 0;
for (const c of cases) {
	const got = sealedText(c.md);
	const ok = JSON.stringify(got) === JSON.stringify(c.want);
	failed += !ok;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}${ok ? '' : `\n     want ${JSON.stringify(c.want)}\n     got  ${JSON.stringify(got)}`}`);
}
console.log(failed ? `${failed} case(s) failed` : 'sealed references behave');
process.exit(failed ? 1 : 0);
void sealed;
