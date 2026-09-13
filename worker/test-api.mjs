// End-to-end test of the editor Worker against a running `wrangler dev` and a throwaway branch.
// Expects worker/.dev.vars with BRANCH=editor-test and a contributor "Tester" / "test-password-123".
//   node worker/test-api.mjs [http://127.0.0.1:8787]
const API = process.argv[2] || 'http://127.0.0.1:8787';
const PATH = 'src/content/docs/lore/redaction-test.md';
let token = '';
let failed = 0;

async function call(method, path, body, auth = true) {
	const res = await fetch(API + path, {
		method,
		headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4330', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	});
	return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data: await res.json().catch(() => ({})) };
}

function check(name, ok, detail = '') {
	failed += !ok;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${detail}`}`);
}

let r = await call('POST', '/api/login', { name: 'Tester', password: 'wrong-password' }, false);
check('wrong password is refused', r.status === 401, JSON.stringify(r));
r = await call('GET', '/api/file?path=' + PATH, null, false);
check('reading without signing in is refused', r.status === 401, JSON.stringify(r));
r = await call('POST', '/api/login', { name: 'tester', password: 'test-password-123' }, false);
check('right password signs in (name is case-insensitive)', r.status === 200 && r.data.token && r.data.name === 'Tester', JSON.stringify(r));
check('CORS allows the site origin', r.cors === 'http://localhost:4330', r.cors);
token = r.data.token;

const tampered = token.replace(/^(.)/, (c) => (c === 'e' ? 'f' : 'e'));
const saved = token;
token = tampered;
r = await call('GET', '/api/me');
check('a tampered session is refused', r.status === 401, JSON.stringify(r));
token = saved;

r = await call('GET', '/api/file?path=' + PATH);
check('reads an article', r.status === 200 && r.data.content.startsWith('---') && r.data.sha, JSON.stringify(r).slice(0, 200));
const original = r.data;

const edited = original.content.replace('A plain line after the block.', 'A plain line after the block, edited in the browser test.');
r = await call('PUT', '/api/file', { path: PATH, content: edited, sha: original.sha, summary: 'editor API test' });
check('saves an edit as a commit', r.status === 200 && r.data.commit, JSON.stringify(r));
const afterEditSha = r.data.sha;

r = await call('PUT', '/api/file', { path: PATH, content: edited + '\nStale.\n', sha: original.sha });
check('a save from a stale copy is refused (conflict)', r.status === 409, JSON.stringify(r));

for (const [name, content] of [
	['a note to Claude is refused', edited + '\n<!-- @claude: do something -->\n'],
	['a script tag is refused', edited + '\n<script>alert(1)</script>\n'],
	['an event handler attribute is refused', edited + '\n<small onclick="x()">hi</small>\n'],
	['a javascript: link is refused', edited + '\n[x](javascript:alert(1))\n'],
	['broken front matter is refused', edited.replace(/^---\n/, '---\ntitle: [unclosed\n')],
	['a missing title is refused', edited.replace(/^title: .*$/m, 'title: ""')],
]) {
	r = await call('PUT', '/api/file', { path: PATH, content, sha: afterEditSha });
	check(name, r.status === 400, JSON.stringify(r).slice(0, 200));
}
r = await call('PUT', '/api/file', { path: 'astro.config.mjs', content: edited, sha: afterEditSha });
check('writing outside the articles folder is refused', r.status === 400, JSON.stringify(r));
r = await call('PUT', '/api/file', { path: 'src/content/docs/people/../../../../package.json', content: edited });
check('path traversal is refused', r.status === 400, JSON.stringify(r));

r = await call('GET', '/api/history?path=' + PATH);
const versions = r.data.versions || [];
check('history lists versions with author', r.status === 200 && versions[0]?.author === 'Tester' && /by Tester/.test(versions[0]?.message), JSON.stringify(versions.slice(0, 2)));

r = await call('GET', `/api/file?path=${PATH}&ref=${versions[1]?.sha}`);
check('reads an older version', r.status === 200 && r.data.content === original.content, r.status);

r = await call('POST', '/api/restore', { path: PATH, ref: versions[1]?.sha });
check('restores the older version as a new commit', r.status === 200, JSON.stringify(r));
r = await call('GET', '/api/file?path=' + PATH);
check('the article is back to the original text', r.data.content === original.content);

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
r = await call('POST', '/api/image', { filename: 'test-pixel.png', data: png });
check('uploads an image', r.status === 200 && /^\/images\/uploads\/test-pixel-[a-z0-9]+\.png$/.test(r.data.src), JSON.stringify(r));
r = await call('POST', '/api/image', { filename: '../evil.svg', data: png });
check('refuses a bad image name or type', r.status === 400, JSON.stringify(r));

console.log(failed ? `${failed} check(s) failed` : 'editor API behaves');
process.exit(failed ? 1 : 0);
