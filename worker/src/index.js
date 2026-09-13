// The Lexicon editor: a small Cloudflare Worker that lets named contributors edit articles.
//
// It holds the GitHub token (so browsers never see it), checks each contributor's own password,
// and turns every save into a git commit on davidjette/lexicon with the contributor's name on it.
// GitHub Pages rebuilds the site from that commit. Git is the version history: the history and
// restore endpoints read it back.
//
// Secrets (wrangler secret put): GITHUB_TOKEN, SESSION_SECRET, PASSWORD_PEPPER, CONTRIBUTORS
// Vars (wrangler.toml): REPO, BRANCH, ALLOWED_ORIGINS, SITE_URL
import yaml from 'js-yaml';

const DOCS = /^src\/content\/docs\/(people|places|organizations|history|sessions|items|lore|species)\/[a-z0-9][a-z0-9-]*\.md$/;
const UPLOAD_DIR = 'public/images/uploads';
const MAX_ARTICLE = 400_000;
const MAX_IMAGE = 3_000_000;
const SESSION_DAYS = 30;
// Raw HTML a contributor may use in an article. Everything else is refused, so nobody can put a script on the site.
const ALLOWED_TAGS = new Set(['small', 'br', 'strong', 'em', 'b', 'i', 'sup', 'sub', 'u', 's']);

export default {
	async fetch(request, env) {
		const cors = corsHeaders(request, env);
		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
		try {
			const res = await route(request, env);
			for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
			return res;
		} catch (e) {
			const status = e instanceof HttpError ? e.status : 500;
			const message = e instanceof HttpError ? e.message : 'Something went wrong on the server.';
			if (!(e instanceof HttpError)) console.error(e);
			return json({ error: message }, status, cors);
		}
	},
};

class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

async function route(request, env) {
	const url = new URL(request.url);
	const p = url.pathname.replace(/\/+$/, '');
	if (p === '/api/login' && request.method === 'POST') return login(request, env);

	const who = await authenticate(request, env);
	if (p === '/api/me' && request.method === 'GET') return json({ name: who });
	if (p === '/api/file' && request.method === 'GET') return getFile(env, url.searchParams.get('path'), url.searchParams.get('ref'));
	if (p === '/api/file' && request.method === 'PUT') return saveFile(request, env, who);
	if (p === '/api/history' && request.method === 'GET') return history(env, url.searchParams.get('path'));
	if (p === '/api/restore' && request.method === 'POST') return restore(request, env, who);
	if (p === '/api/image' && request.method === 'POST') return uploadImage(request, env, who);
	throw new HttpError(404, 'Not found.');
}

// ------------------------------------------------------------------ auth
async function login(request, env) {
	const { name, password } = await body(request);
	await new Promise((r) => setTimeout(r, 400)); // slows guessing
	const contributors = JSON.parse(env.CONTRIBUTORS || '[]');
	const person = contributors.find((c) => c.name.toLowerCase() === String(name || '').trim().toLowerCase());
	const hash = await hmacHex(env.PASSWORD_PEPPER, `${String(name || '').trim().toLowerCase()}:${password || ''}`);
	if (!person || !timingSafeEqual(hash, person.hash)) throw new HttpError(401, 'That name and password do not match.');
	const exp = Date.now() + SESSION_DAYS * 864e5;
	const payload = b64url(JSON.stringify({ n: person.name, exp }));
	return json({ token: `${payload}.${await hmacHex(env.SESSION_SECRET, payload)}`, name: person.name });
}

async function authenticate(request, env) {
	const m = (request.headers.get('Authorization') || '').match(/^Bearer ([\w-]+)\.([0-9a-f]+)$/);
	if (!m) throw new HttpError(401, 'Please sign in.');
	if (!timingSafeEqual(await hmacHex(env.SESSION_SECRET, m[1]), m[2])) throw new HttpError(401, 'Please sign in again.');
	const { n, exp } = JSON.parse(unb64url(m[1]));
	if (Date.now() > exp) throw new HttpError(401, 'Your session expired. Please sign in again.');
	// a contributor removed from the list loses access immediately
	const contributors = JSON.parse(env.CONTRIBUTORS || '[]');
	if (!contributors.some((c) => c.name === n)) throw new HttpError(401, 'This account no longer has access.');
	return n;
}

// ------------------------------------------------------------------ articles
async function getFile(env, path, ref) {
	checkArticlePath(path);
	const q = ref ? `?ref=${encodeURIComponent(ref)}` : `?ref=${env.BRANCH}`;
	const r = await gh(env, `/contents/${path}${q}`);
	if (r.status === 404) throw new HttpError(404, 'That article does not exist yet.');
	const data = await ok(r);
	return json({ path, sha: data.sha, content: decodeBase64Utf8(data.content) });
}

async function saveFile(request, env, who) {
	const { path, content, sha, summary } = await body(request);
	checkArticlePath(path);
	const meta = validateArticle(content);
	const verb = sha ? 'Edit' : 'Create';
	const note = summary ? `: ${String(summary).slice(0, 120)}` : '';
	const commit = await putContent(env, path, encodeBase64Utf8(content), sha, `${verb} ${meta.title} (by ${who})${note}`, who);
	return json({ ok: true, sha: commit.content.sha, commit: commit.commit.sha });
}

async function history(env, path) {
	checkArticlePath(path);
	const r = await gh(env, `/commits?path=${encodeURIComponent(path)}&sha=${env.BRANCH}&per_page=100`);
	const list = await ok(r);
	return json({
		path,
		versions: list.map((c) => ({
			sha: c.sha,
			date: c.commit.author.date,
			author: c.commit.author.name,
			message: c.commit.message.split('\n')[0],
		})),
	});
}

async function restore(request, env, who) {
	const { path, ref } = await body(request);
	checkArticlePath(path);
	if (!/^[0-9a-f]{7,40}$/.test(String(ref))) throw new HttpError(400, 'Unknown version.');
	const old = await ok(await gh(env, `/contents/${path}?ref=${ref}`));
	const current = await gh(env, `/contents/${path}?ref=${env.BRANCH}`);
	const sha = current.status === 404 ? undefined : (await ok(current)).sha;
	const content = decodeBase64Utf8(old.content);
	const meta = validateArticle(content);
	const commit = await putContent(env, path, encodeBase64Utf8(content), sha, `Restore ${meta.title} to version ${ref.slice(0, 7)} (by ${who})`, who);
	return json({ ok: true, sha: commit.content.sha, commit: commit.commit.sha });
}

async function uploadImage(request, env, who) {
	const { filename, data } = await body(request);
	const m = String(filename || '').toLowerCase().match(/^([a-z0-9][a-z0-9-]{0,60})\.(png|jpe?g|webp|gif)$/);
	if (!m) throw new HttpError(400, 'Name the image with letters, numbers and dashes, ending in .png, .jpg, .webp or .gif.');
	const bytes = Math.floor((String(data || '').length * 3) / 4);
	if (!data || bytes > MAX_IMAGE) throw new HttpError(400, 'Images must be under 3 MB.');
	const path = `${UPLOAD_DIR}/${m[1]}-${Date.now().toString(36)}.${m[2]}`;
	await putContent(env, path, data, undefined, `Upload image ${path.split('/').pop()} (by ${who})`, who);
	return json({ ok: true, src: '/' + path.replace(/^public\//, '') });
}

function checkArticlePath(path) {
	if (!DOCS.test(String(path || ''))) throw new HttpError(400, 'Articles live at src/content/docs/<kind>/<slug>.md.');
}

/** The same rules the site build and QA enforce, so a contributor cannot break the deploy or the site. */
function validateArticle(content) {
	if (typeof content !== 'string' || !content.length) throw new HttpError(400, 'The article is empty.');
	if (content.length > MAX_ARTICLE) throw new HttpError(400, 'The article is too long to save.');
	const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) throw new HttpError(400, 'The article must start with front matter between --- lines.');
	let data;
	try {
		data = yaml.load(m[1]) || {};
	} catch (e) {
		throw new HttpError(400, `The front matter is not valid: ${e.reason || e.message}`);
	}
	const problems = [];
	if (typeof data.title !== 'string' || !data.title.trim()) problems.push('it needs a title');
	if (data.description !== undefined && typeof data.description !== 'string') problems.push('the description must be text');
	if (data.tags !== undefined && !(Array.isArray(data.tags) && data.tags.every((t) => typeof t === 'string'))) problems.push('tags must be a list of words');
	if (data.fields !== undefined && !(data.fields && typeof data.fields === 'object' && !Array.isArray(data.fields) && Object.values(data.fields).every((v) => typeof v === 'string'))) problems.push('fields must be name: text pairs');
	if (data.sources !== undefined && !Array.isArray(data.sources)) problems.push('sources must be a list');
	if (problems.length) throw new HttpError(400, `The article cannot be saved: ${problems.join('; ')}.`);

	const bodyText = m[2];
	if (/@claude/i.test(content)) {
		throw new HttpError(400, 'Notes to Claude cannot be saved from the editor, because this site is public. Send the note to Dave instead.');
	}
	for (const t of bodyText.matchAll(/<\/?([a-zA-Z][\w-]*)\b[^>]*>/g)) {
		if (!ALLOWED_TAGS.has(t[1].toLowerCase())) throw new HttpError(400, `HTML <${t[1]}> is not allowed in articles.`);
		if (/\son\w+\s*=|javascript:|style\s*=/i.test(t[0])) throw new HttpError(400, 'HTML attributes are not allowed in articles.');
	}
	if (/\]\(\s*javascript:/i.test(bodyText)) throw new HttpError(400, 'That link is not allowed.');
	return data;
}

// ------------------------------------------------------------------ GitHub
async function putContent(env, path, base64, sha, message, who) {
	const r = await gh(env, `/contents/${path}`, {
		method: 'PUT',
		body: JSON.stringify({
			message,
			content: base64,
			branch: env.BRANCH,
			...(sha ? { sha } : {}),
			author: { name: who, email: `${slug(who)}@contributors.lexicon` },
		}),
	});
	if (r.status === 409 || r.status === 422) {
		const detail = await r.text();
		if (/sha/i.test(detail)) throw new HttpError(409, 'Someone else saved this article after you opened it. Copy your changes, reload, and apply them again.');
		throw new HttpError(409, sha ? 'The article changed on the server. Reload and try again.' : 'An article with that name already exists.');
	}
	return ok(r);
}

function gh(env, path, init = {}) {
	return fetch(`https://api.github.com/repos/${env.REPO}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${env.GITHUB_TOKEN}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'lexicon-editor',
			'X-GitHub-Api-Version': '2022-11-28',
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
		},
	});
}

async function ok(r) {
	if (!r.ok) {
		console.error('GitHub', r.status, await r.text());
		throw new HttpError(502, `GitHub refused the request (${r.status}).`);
	}
	return r.json();
}

// ------------------------------------------------------------------ helpers
function corsHeaders(request, env) {
	const origin = request.headers.get('Origin') || '';
	const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
	return allowed.includes(origin)
		? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', Vary: 'Origin' }
		: { Vary: 'Origin' };
}

function json(data, status = 200, headers = {}) {
	return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

async function body(request) {
	try {
		return await request.json();
	} catch {
		throw new HttpError(400, 'The request was not valid JSON.');
	}
}

async function hmacHex(secret, message) {
	if (!secret) throw new Error('server secret missing');
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

function b64url(s) {
	return btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s) {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function encodeBase64Utf8(s) {
	const bytes = new TextEncoder().encode(s);
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}

function decodeBase64Utf8(b64) {
	const bin = atob(String(b64).replace(/\s/g, ''));
	return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function slug(s) {
	return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contributor';
}
