// Import images into the Lexicon: resize to web WebP, attach them to articles, host the maps.
//
//   node scripts/import_images.mjs            convert + write front matter + rewrite World Anvil map links
//   node scripts/import_images.mjs --dry     report what would happen
//
// Sources (read only):
//   ally cards   Desktop/D&D/Temple Holdings LLC/8 - End of the Infanta/Ally Cards/*.png  (the set uploaded to World Anvil)
//   site images  C:/dev/sharn-campaign/worldanvil/images + image_map.json                  (the campaign Google Site)
//   maps         C:/dev/sharn-campaign/worldanvil/maps_stage + manifest.json               (the 60 approved maps)
// Output: public/images/{cards,site,maps}/, src/data/maps.json, `image`/`gallery` front matter.
// An article whose front matter already has `image` keeps it; re-running is safe.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'src', 'content', 'docs');
const WA = 'C:/dev/sharn-campaign/worldanvil';
const CARDS = 'C:/Users/djett/Desktop/D&D/Temple Holdings LLC/8 - End of the Infanta/Ally Cards';
const OUT = join(ROOT, 'public', 'images');
const DRY = process.argv.includes('--dry');

// card files whose names are not the article's image_card title
const CARD_SLUG = {
	'Lady of Pain': 'the-lady-of-pain',
	'Marcus, Infanta of Death': 'marcus',
	'Obi, Infanta of Order': 'obi',
	'Obi, Infanta of Order (2)': 'obi',
	'The Lexicon': 'the-lexicon',
	'Wainwright St. Cloud': 'wainwright-st-cloud',
	'Zanzibar, King of Punis': 'zanzibar',
	'Kindori actual': 'kindori',
};

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => slugify(s).replace(/^the-/, '');

// ------------------------------------------------------------------ articles
const articles = new Map(); // slug -> { path, kind, title, raw, fm }
for (const kind of readdirSync(DOCS)) {
	const dir = join(DOCS, kind);
	if (!existsSync(dir) || extname(dir)) continue;
	for (const f of readdirSync(dir)) {
		if (!f.endsWith('.md') || f.startsWith('index.')) continue;
		const raw = readFileSync(join(dir, f), 'utf8');
		const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
		const fm = m ? yaml.load(m[1]) || {} : {};
		articles.set(f.slice(0, -3), { path: join(dir, f), kind, title: fm.title || '', raw, fm });
	}
}
const byTitle = new Map([...articles].map(([slug, a]) => [norm(a.title), slug]));
const waCard = new Map();
for (const f of readdirSync(join(WA, 'articles')).filter((f) => f.endsWith('.json'))) {
	const d = JSON.parse(readFileSync(join(WA, 'articles', f), 'utf8'));
	if (d.image_card) waCard.set(d.image_card, d.slug);
}

const attach = new Map(); // slug -> [{src, alt, caption, role}]
const add = (slug, img) => {
	if (!articles.has(slug)) return false;
	if (!attach.has(slug)) attach.set(slug, []);
	attach.get(slug).push(img);
	return true;
};

async function convert(src, dest, width) {
	if (DRY) return;
	mkdirSync(join(dest, '..'), { recursive: true });
	if (existsSync(dest)) return;
	await sharp(src).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest);
}

// ------------------------------------------------------------------ ally cards
const cardFiles = readdirSync(CARDS).filter((f) => f.endsWith('.png')).sort();
const allCards = [];
for (const f of cardFiles) {
	const stem = basename(f, '.png');
	const slug = CARD_SLUG[stem] || waCard.get(stem) || byTitle.get(norm(stem));
	const name = slug ? `${slug}${/\(2\)$/.test(stem) ? '-2' : ''}` : slugify(stem);
	const src = `/images/cards/${name}.webp`;
	await convert(join(CARDS, f), join(OUT, 'cards', `${name}.webp`), 750);
	const img = { src, alt: `Ally card: ${stem.replace(/ \(2\)$/, '')}`, caption: 'Ally card, Arc VIII', role: 'card' };
	allCards.push(img);
	if (!slug || !add(slug, img)) console.log(`card with no article: ${stem}`);
}
add('the-ally-cards', null); // the Ally Cards article carries the whole set as its gallery
attach.set('the-ally-cards', allCards);

// ------------------------------------------------------------------ campaign site images
const siteMap = JSON.parse(readFileSync(join(WA, 'image_map.json'), 'utf8'));
const siteCount = new Map();
for (const e of siteMap) {
	// prefer the article the image depicts; fall back to the page it was published on
	const subject = byTitle.get(norm(e.subject.replace(/^(owner:|subject:)\s*/i, '')));
	const slug = subject || (articles.has(e.slug) ? e.slug : null);
	if (!slug) {
		console.log(`site image with no article: ${e.file} (${e.subject})`);
		continue;
	}
	const n = (siteCount.get(slug) || 0) + 1;
	siteCount.set(slug, n);
	const src = `/images/site/${slug}-${n}.webp`;
	await convert(join(WA, 'images', e.file), join(OUT, 'site', `${slug}-${n}.webp`), 1200);
	add(slug, { src, alt: e.subject, caption: e.subject !== articles.get(slug).title ? e.subject : '', role: e.portrait ? 'portrait' : 'scene' });
}

// ------------------------------------------------------------------ maps
// Maps Dave removed from the site. Re-running the import must not bring them back.
const REMOVED_MAPS = /^Motherstone\s*\W+\s*Map \d$/i; // never used in play (Dave, 2026-09-13)
const manifest = JSON.parse(readFileSync(join(WA, 'maps_stage', 'manifest.json'), 'utf8')).filter((m) => !REMOVED_MAPS.test(m.title.replace(/\s+/g, ' ').trim()));
const maps = [];
for (const m of manifest) {
	const title = m.title.replace(/\s+/g, ' ').trim();
	const id = `${String(m.n).padStart(2, '0')}-${slugify(title)}`;
	const file = join(WA, 'maps_stage', basename(m.file.replace(/\\/g, '/')));
	await convert(file, join(OUT, 'maps', `${id}.webp`), 2600);
	await convert(file, join(OUT, 'maps', `${id}-thumb.webp`), 520);
	const meta = DRY ? {} : await sharp(join(OUT, 'maps', `${id}.webp`)).metadata();
	maps.push({ id, n: m.n, title, src: `/images/maps/${id}.webp`, thumb: `/images/maps/${id}-thumb.webp`, width: meta.width, height: meta.height, wa: m.map_id });
}
if (!DRY) {
	mkdirSync(join(ROOT, 'src', 'data'), { recursive: true });
	writeFileSync(join(ROOT, 'src', 'data', 'maps.json'), JSON.stringify(maps, null, 1) + '\n');
}

// ------------------------------------------------------------------ write front matter, rewrite map links
const mapByWa = new Map(maps.map((m) => [m.wa, m]));
let withImages = 0;
let mapLinks = 0;
for (const [slug, a] of articles) {
	let raw = a.raw;
	const imgs = (attach.get(slug) || []).filter(Boolean);
	if (imgs.length && !a.fm.image) {
		// lead with a portrait or card; scenes follow in the gallery
		const ordered = [...imgs.filter((i) => i.role !== 'scene'), ...imgs.filter((i) => i.role === 'scene')];
		const [lead, ...rest] = slug === 'the-ally-cards' ? [null, ...ordered] : ordered;
		const block = {};
		if (lead) block.image = { src: lead.src, alt: lead.alt, ...(lead.caption ? { caption: lead.caption } : {}) };
		if (rest.length) block.gallery = rest.map((i) => ({ src: i.src, alt: i.alt, ...(i.caption ? { caption: i.caption } : {}) }));
		const text = yaml.dump(block, { lineWidth: -1 });
		raw = raw.replace(/^(---\n[\s\S]*?)\n---\n/, (_m, head) => `${head}\n${text.trimEnd()}\n---\n`);
		withImages += 1;
	}
	raw = raw.replace(/https:\/\/www\.worldanvil\.com\/w\/infantaverse-sydiot\/map\/([0-9a-f-]{36})/g, (whole, id) => {
		const m = mapByWa.get(id);
		if (!m) return whole;
		mapLinks += 1;
		return `/maps/${m.id}/`;
	});
	if (raw !== a.raw && !DRY) writeFileSync(a.path, raw);
}
console.log(`${DRY ? '[dry] ' : ''}cards ${allCards.length}, site images ${siteMap.length}, maps ${maps.length}; articles given images ${withImages}; map links rewritten ${mapLinks}`);
