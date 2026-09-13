// The Lexicon editor, in the browser. Talks to the lexicon-editor Worker, which commits to git.
import yaml from 'js-yaml';
import { marked } from 'marked';
import { diffLines } from 'diff';

type Article = { path: string; sha?: string; content: string };
type Version = { sha: string; date: string; author: string; message: string };

const root = document.getElementById('lexicon-editor') as HTMLElement;
if (root) start();

function start() {
const API = root.dataset.api!.replace(/\/$/, '');
const BASE = root.dataset.base!.replace(/\/$/, '');
const KINDS = JSON.parse(root.dataset.kinds!) as Record<string, string>;
const TOKEN_KEY = 'lexicon-editor-token';
const NAME_KEY = 'lexicon-editor-name';

const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
const params = new URLSearchParams(location.search);

function token() {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(API + path, {
		...init,
		headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
	});
	const data = await res.json().catch(() => ({ error: `The editor service answered ${res.status}.` }));
	if (res.status === 401) {
		try {
			localStorage.removeItem(TOKEN_KEY);
		} catch {}
		show('login');
	}
	if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
	return data as T;
}

function show(view: 'login' | 'edit' | 'history' | 'new') {
	for (const v of ['login', 'edit', 'history', 'new']) ($(`[data-view="${v}"]`).hidden = v !== view);
	$('[data-signed-in]').hidden = view === 'login';
	if (view !== 'login') $('[data-who]').textContent = (() => {
		try {
			return localStorage.getItem(NAME_KEY) || '';
		} catch {
			return '';
		}
	})();
}

function status(el: HTMLElement, text: string, kind: 'info' | 'error' | 'ok' = 'info') {
	el.textContent = text;
	el.dataset.kind = kind;
}

// ------------------------------------------------------------------ front matter
function split(content: string) {
	const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { data: {} as Record<string, unknown>, body: content };
	return { data: (yaml.load(m[1]) as Record<string, unknown>) || {}, body: m[2].replace(/^\n/, '') };
}

function join(data: Record<string, unknown>, body: string) {
	const fm = yaml.dump(data, { lineWidth: -1, noRefs: true });
	return `---\n${fm}---\n\n${body.replace(/^\n+/, '')}`;
}

function slugify(s: string) {
	return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ------------------------------------------------------------------ preview
function preview(md: string) {
	const shown = md
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/:::redacted(\{[^}]*\})?\n([\s\S]*?)\n:::/g, (_m, _a, inner) => `<div class="ed-sealed">${marked.parse(inner)}</div>`)
		.replace(/:redacted\[((?:[^[\]]|\[[^\]]*\])*)\](\{[^}]*\})?/g, (_m, inner) => `<span class="ed-sealed">${inner}</span>`)
		.replace(/\]\((\/[^)]*)\)/g, (_m, href) => `](${BASE}${href})`);
	return marked.parse(shown) as string;
}

// ------------------------------------------------------------------ editing
let current: Article | null = null;
let meta: Record<string, unknown> = {};

async function openArticle(path: string) {
	show('edit');
	const note = $('[data-edit-status]');
	status(note, 'Loading…');
	try {
		current = await api<Article>(`/api/file?path=${encodeURIComponent(path)}`);
	} catch (e) {
		status(note, (e as Error).message, 'error');
		return;
	}
	const { data, body } = split(current.content);
	meta = data;
	$<HTMLInputElement>('[name="title"]').value = String(data.title ?? '');
	$<HTMLInputElement>('[name="description"]').value = String(data.description ?? '');
	$<HTMLInputElement>('[name="tags"]').value = Array.isArray(data.tags) ? data.tags.join(', ') : '';
	const image = (data.image as { src?: string } | undefined)?.src ?? '';
	$<HTMLInputElement>('[name="image"]').value = image;
	const rest = { ...data };
	for (const k of ['title', 'description', 'tags', 'image']) delete rest[k];
	$<HTMLTextAreaElement>('[name="advanced"]').value = Object.keys(rest).length ? yaml.dump(rest, { lineWidth: -1 }) : '';
	$<HTMLTextAreaElement>('[name="body"]').value = body;
	$('[data-edit-path]').textContent = path;
	$<HTMLAnchorElement>('[data-view-live]').href = `${BASE}/${path.replace(/^src\/content\/docs\//, '').replace(/\.md$/, '')}/`;
	$<HTMLAnchorElement>('[data-open-history]').href = `?history=${encodeURIComponent(path)}`;
	renderPreview();
	status(note, 'Ready.');
}

function assemble(): string {
	let rest: Record<string, unknown> = {};
	const adv = $<HTMLTextAreaElement>('[name="advanced"]').value.trim();
	if (adv) {
		const parsed = yaml.load(adv);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The advanced front matter must be name: value lines.');
		rest = parsed as Record<string, unknown>;
	}
	const data: Record<string, unknown> = { title: $<HTMLInputElement>('[name="title"]').value.trim() };
	const description = $<HTMLInputElement>('[name="description"]').value.trim();
	if (description) data.description = description;
	const tags = $<HTMLInputElement>('[name="tags"]').value.split(',').map((t) => t.trim()).filter(Boolean);
	if (tags.length) data.tags = tags;
	const image = $<HTMLInputElement>('[name="image"]').value.trim();
	const oldImage = (meta.image as Record<string, unknown> | undefined) || {};
	if (image) data.image = { ...oldImage, src: image };
	return join({ ...data, ...rest }, $<HTMLTextAreaElement>('[name="body"]').value);
}

function renderPreview() {
	$('[data-preview]').innerHTML = preview($<HTMLTextAreaElement>('[name="body"]').value);
}

async function save() {
	if (!current) return;
	const note = $('[data-edit-status]');
	let content: string;
	try {
		content = assemble();
	} catch (e) {
		status(note, (e as Error).message, 'error');
		return;
	}
	status(note, 'Saving…');
	try {
		const r = await api<{ sha: string }>('/api/file', {
			method: 'PUT',
			body: JSON.stringify({ path: current.path, content, sha: current.sha, summary: $<HTMLInputElement>('[name="summary"]').value.trim() }),
		});
		current = { ...current, sha: r.sha, content };
		$<HTMLInputElement>('[name="summary"]').value = '';
		status(note, 'Saved. The live page updates in about two minutes.', 'ok');
	} catch (e) {
		status(note, (e as Error).message, 'error');
	}
}

function wrap(before: string, after = before, placeholder = 'text') {
	const ta = $<HTMLTextAreaElement>('[name="body"]');
	const { selectionStart: s, selectionEnd: e, value } = ta;
	const sel = value.slice(s, e) || placeholder;
	ta.setRangeText(before + sel + after, s, e, 'end');
	ta.focus();
	renderPreview();
}

// ------------------------------------------------------------------ history
async function openHistory(path: string) {
	show('history');
	const list = $('[data-history-list]');
	const note = $('[data-history-status]');
	$('[data-history-path]').textContent = path;
	$<HTMLAnchorElement>('[data-history-edit]').href = `?path=${encodeURIComponent(path)}`;
	list.innerHTML = '';
	status(note, 'Loading history…');
	try {
		const [{ versions }, now] = await Promise.all([
			api<{ versions: Version[] }>(`/api/history?path=${encodeURIComponent(path)}`),
			api<Article>(`/api/file?path=${encodeURIComponent(path)}`),
		]);
		status(note, `${versions.length} saved versions, newest first.`);
		versions.forEach((v, i) => {
			const li = document.createElement('li');
			const when = new Date(v.date).toLocaleString();
			li.innerHTML = `<div class="ed-version"><strong></strong> <span></span><div class="ed-msg"></div></div>`;
			li.querySelector('strong')!.textContent = when;
			li.querySelector('span')!.textContent = `by ${v.author}`;
			li.querySelector('.ed-msg')!.textContent = v.message;
			const actions = document.createElement('div');
			actions.className = 'ed-actions';
			const diffBtn = button('Compare with current', async () => {
				const old = await api<Article>(`/api/file?path=${encodeURIComponent(path)}&ref=${v.sha}`);
				showDiff(li, old.content, now.content);
			});
			actions.append(diffBtn);
			if (i > 0) {
				actions.append(
					button('Restore this version', async () => {
						if (!confirmInline(li, `Restore the version from ${when}? The current text stays in history.`)) return;
						status(note, 'Restoring…');
						try {
							await api('/api/restore', { method: 'POST', body: JSON.stringify({ path, ref: v.sha }) });
							status(note, 'Restored. The live page updates in about two minutes.', 'ok');
							openHistory(path);
						} catch (e) {
							status(note, (e as Error).message, 'error');
						}
					}),
				);
			}
			li.append(actions);
			list.append(li);
		});
	} catch (e) {
		status(note, (e as Error).message, 'error');
	}
}

// restore asks twice with an inline prompt instead of a browser dialog
function confirmInline(li: HTMLElement, text: string) {
	if (li.dataset.confirming === 'yes') {
		delete li.dataset.confirming;
		li.querySelector('.ed-confirm')?.remove();
		return true;
	}
	li.dataset.confirming = 'yes';
	const p = document.createElement('p');
	p.className = 'ed-confirm';
	p.textContent = `${text} Press Restore again to confirm.`;
	li.append(p);
	return false;
}

function showDiff(li: HTMLElement, older: string, newer: string) {
	li.querySelector('.ed-diff')?.remove();
	const pre = document.createElement('pre');
	pre.className = 'ed-diff';
	for (const part of diffLines(older, newer)) {
		const span = document.createElement('span');
		span.className = part.added ? 'ed-add' : part.removed ? 'ed-del' : 'ed-same';
		span.textContent = part.added || part.removed ? part.value : collapse(part.value);
		pre.append(span);
	}
	li.append(pre);
}

function collapse(text: string) {
	const lines = text.split('\n');
	return lines.length > 6 ? [...lines.slice(0, 2), `  … ${lines.length - 4} unchanged lines …`, ...lines.slice(-2)].join('\n') : text;
}

function button(label: string, onClick: () => void) {
	const b = document.createElement('button');
	b.type = 'button';
	b.textContent = label;
	b.addEventListener('click', onClick);
	return b;
}

// ------------------------------------------------------------------ new article
async function createArticle() {
	const note = $('[data-new-status]');
	const kind = $<HTMLSelectElement>('[name="new-kind"]').value;
	const title = $<HTMLInputElement>('[name="new-title"]').value.trim();
	const slug = slugify($<HTMLInputElement>('[name="new-slug"]').value || title);
	if (!title || !slug) return status(note, 'Give the article a title.', 'error');
	const path = `src/content/docs/${kind}/${slug}.md`;
	const content = join({ title, description: '', tags: [title], sources: [] }, `${title} is a …\n`);
	status(note, 'Creating…');
	try {
		await api('/api/file', { method: 'PUT', body: JSON.stringify({ path, content, summary: 'new article' }) });
		location.search = `?path=${encodeURIComponent(path)}`;
	} catch (e) {
		status(note, (e as Error).message, 'error');
	}
}

// ------------------------------------------------------------------ wiring
$('[data-login]').addEventListener('submit', async (e) => {
	e.preventDefault();
	const note = $('[data-login-status]');
	status(note, 'Signing in…');
	const name = $<HTMLInputElement>('[name="name"]').value;
	const password = $<HTMLInputElement>('[name="password"]').value;
	try {
		const r = await api<{ token: string; name: string }>('/api/login', { method: 'POST', body: JSON.stringify({ name, password }) });
		try {
			localStorage.setItem(TOKEN_KEY, r.token);
			localStorage.setItem(NAME_KEY, r.name);
		} catch {}
		$<HTMLInputElement>('[name="password"]').value = '';
		route();
	} catch (err) {
		status(note, (err as Error).message, 'error');
	}
});
$('[data-sign-out]').addEventListener('click', () => {
	try {
		localStorage.removeItem(TOKEN_KEY);
	} catch {}
	show('login');
});
$('[data-save]').addEventListener('click', save);
$('[data-create]').addEventListener('click', createArticle);
$('[name="body"]').addEventListener('input', renderPreview);
$('[name="new-title"]').addEventListener('input', () => {
	$<HTMLInputElement>('[name="new-slug"]').placeholder = slugify($<HTMLInputElement>('[name="new-title"]').value);
});
root.querySelectorAll<HTMLButtonElement>('[data-wrap]').forEach((b) =>
	b.addEventListener('click', () => {
		const [before, after, placeholder] = JSON.parse(b.dataset.wrap!);
		wrap(before, after, placeholder);
	}),
);
function article(title: string) {
	const opt = [...root.querySelectorAll<HTMLOptionElement>('#ed-articles option')].find((o) => o.value.toLowerCase() === title.trim().toLowerCase());
	return opt ? { title: opt.value, path: opt.dataset.path!, link: opt.dataset.link! } : null;
}
$('[data-pick]').addEventListener('submit', (e) => {
	e.preventDefault();
	const a = article($<HTMLInputElement>('[name="pick"]').value);
	if (a) location.search = `?path=${encodeURIComponent(a.path)}`;
});
$('[data-insert-link]').addEventListener('click', () => {
	const input = $<HTMLInputElement>('[name="link-to"]');
	const a = article(input.value);
	if (!a) return status($('[data-edit-status]'), 'Pick an article title from the list to link to it.', 'error');
	const ta = $<HTMLTextAreaElement>('[name="body"]');
	const label = ta.value.slice(ta.selectionStart, ta.selectionEnd) || a.title;
	ta.setRangeText(`[${label}](${a.link})`, ta.selectionStart, ta.selectionEnd, 'end');
	input.value = '';
	ta.focus();
	renderPreview();
});
$('[data-upload]').addEventListener('click', async () => {
	const note = $('[data-edit-status]');
	const file = $<HTMLInputElement>('[name="upload"]').files?.[0];
	if (!file) return status(note, 'Choose an image file first.', 'error');
	if (file.size > 3_000_000) return status(note, 'Images must be under 3 MB.', 'error');
	status(note, 'Uploading…');
	const data = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(',')[1]);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
	const ext = (file.name.split('.').pop() || 'png').toLowerCase();
	const name = `${slugify(file.name.replace(/\.[^.]+$/, '')) || 'image'}.${ext}`;
	try {
		const r = await api<{ src: string }>('/api/image', { method: 'POST', body: JSON.stringify({ filename: name, data }) });
		const imageField = $<HTMLInputElement>('[name="image"]');
		if (!imageField.value) {
			imageField.value = r.src;
			status(note, `Uploaded and set as the article image (${r.src}). Save to keep it. It appears on the site after the next rebuild.`, 'ok');
		} else {
			const ta = $<HTMLTextAreaElement>('[name="body"]');
			ta.setRangeText(`\n![${file.name}](${r.src})\n`, ta.selectionStart, ta.selectionEnd, 'end');
			renderPreview();
			status(note, `Uploaded and inserted into the text (${r.src}). Save to keep it.`, 'ok');
		}
	} catch (e) {
		status(note, (e as Error).message, 'error');
	}
});
$<HTMLSelectElement>('[name="new-kind"]').innerHTML = Object.entries(KINDS)
	.map(([k, label]) => `<option value="${k}">${label}</option>`)
	.join('');

function route() {
	if (!token()) return show('login');
	const path = params.get('path');
	const hist = params.get('history');
	if (hist) return openHistory(hist);
	if (path) return openArticle(path);
	show('new');
}
route();
}
