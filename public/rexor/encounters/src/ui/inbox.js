// "Add to library": Dave and Nico send a character sheet or stat block to the bestiary inbox. The
// Lexicon editor Worker commits it to a private repo; Claude turns it into a library entry later
// (skill: bestiary-inbox) and writes back a state and a note, listed under the form.
// Sign-in is the Lexicon editor's: the same name and password, and the same stored token as /edit/.

const API = 'https://lexicon-editor.djette.workers.dev';
const TOKEN_KEY = 'lexicon-editor-token';
const NAME_KEY = 'lexicon-editor-name';
const MAX_FILES = 5;
const MAX_SIDE = 2400; // pictures of sheets are shrunk to this many pixels on the long side

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
let picked = [];

async function api(path, init = {}) {
  const token = store.get(TOKEN_KEY);
  const res = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).catch(() => { throw new Error('Could not reach the Lexicon service. Check the connection and try again.'); });
  const data = await res.json().catch(() => ({ error: `The Lexicon service answered ${res.status}.` }));
  if (res.status === 401 && path !== '/api/login') { store.set(TOKEN_KEY, null); show(); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

function show() {
  const signedIn = !!store.get(TOKEN_KEY);
  $('inboxLogin').hidden = signedIn;
  $('inboxForm').hidden = !signedIn;
  $('inboxListBox').hidden = !signedIn;
  $('inboxWho').textContent = signedIn ? `Signed in as ${store.get(NAME_KEY) || 'editor'}` : '';
  if (signedIn) refresh();
}

const STATE = { queued: 'Waiting', added: 'Added', 'needs-info': 'Needs info', rejected: 'Not added' };

async function refresh() {
  const list = $('inboxList');
  try {
    const { submissions } = await api('/api/inbox');
    list.replaceChildren(...(submissions.length ? submissions.map((s) => {
      const li = document.createElement('li');
      li.dataset.state = s.state;
      const head = document.createElement('div');
      head.innerHTML = `<b></b> <span class="muted"></span> <span class="state"></span>`;
      head.children[0].textContent = s.name;
      head.children[1].textContent = `${s.kind}${s.campaign ? `, ${s.campaign}` : ''}, by ${s.who}, ${s.date.slice(0, 10)}`;
      head.children[2].textContent = STATE[s.state] || s.state;
      if (s.visibility === 'dm') head.prepend(Object.assign(document.createElement('span'), { className: 'dm-tag', textContent: 'DM' }), ' ');
      li.append(head);
      if (s.note) li.append(Object.assign(document.createElement('div'), { className: 'note', textContent: s.note }));
      return li;
    }) : [Object.assign(document.createElement('li'), { className: 'muted', textContent: 'Nothing sent yet.' })]));
  } catch (e) {
    list.replaceChildren(Object.assign(document.createElement('li'), { className: 'err', textContent: e.message }));
  }
}

function message(text, kind = '') {
  $('inboxMsg').textContent = text;
  $('inboxMsg').dataset.kind = kind;
}

function renderPicked() {
  $('inboxPicked').replaceChildren(...picked.map((f, i) => {
    const li = document.createElement('li');
    li.textContent = `${f.name} (${f.size >= 1e6 ? `${(f.size / 1e6).toFixed(1)} MB` : `${Math.ceil(f.size / 1e3)} KB`}) `;
    const x = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small ghost', textContent: 'Remove' });
    x.onclick = () => { picked.splice(i, 1); renderPicked(); };
    li.append(x);
    return li;
  }));
}

function addFiles(list) {
  for (const f of list) {
    if (!/\.(pdf|png|jpe?g|webp|txt|md|xml)$/i.test(f.name)) { message(`${f.name}: only PDF, PNG, JPG, WebP, text, Markdown and Fight Club XML files.`, 'error'); continue; }
    if (picked.length >= MAX_FILES) { message(`At most ${MAX_FILES} files.`, 'error'); break; }
    picked.push(f);
  }
  renderPicked();
}

const base64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error(`Could not read ${blob.name || 'a file'}.`));
  r.readAsDataURL(blob);
});

// A photo of a sheet is shrunk to MAX_SIDE and sent as JPEG; PDFs, text and small pictures go as they are.
async function prepare(f) {
  if (!/^image\//.test(f.type)) return { filename: f.name, data: await base64(f) };
  const img = await createImageBitmap(f).catch(() => null);
  if (!img || (Math.max(img.width, img.height) <= MAX_SIDE && f.size < 3e6)) return { filename: f.name, data: await base64(f) };
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return { filename: f.name.replace(/\.\w+$/, '.jpg'), data: await base64(blob) };
}

export function openInbox(kind = 'character') {
  const dlg = $('inboxDlg');
  $('inboxForm').elements.kind.value = kind;
  message('');
  show();
  dlg.showModal();
}

export function setupInbox() {
  const dlg = $('inboxDlg');
  for (const b of dlg.querySelectorAll('[data-close]')) b.onclick = () => dlg.close();

  $('inboxLogin').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
      const { token, name } = await api('/api/login', { method: 'POST', body: JSON.stringify({ name: f.name.value, password: f.password.value }) });
      store.set(TOKEN_KEY, token);
      store.set(NAME_KEY, name);
      f.password.value = '';
      show();
    } catch (err) {
      alertIn($('inboxLogin'), err.message);
    }
  };

  const drop = $('inboxDrop');
  drop.onclick = () => $('inboxFiles').click();
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('inboxFiles').click(); } };
  $('inboxFiles').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };

  $('inboxForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    if (!picked.length && !f.notes.value.trim() && !f.link.value.trim()) return message('Add a sheet, a stat block, text or a Lexicon link.', 'error');
    $('inboxSend').disabled = true;
    message('Sending...');
    try {
      const files = [];
      for (const file of picked) files.push(await prepare(file));
      await api('/api/inbox', { method: 'POST', body: JSON.stringify({
        kind: f.kind.value, visibility: f.visibility.value, name: f.name.value, campaign: f.campaign.value,
        link: f.link.value.trim(), notes: f.notes.value, files,
      }) });
      message(`Sent. ${f.name.value} will be read and added; its state shows below.`, 'ok');
      for (const k of ['name', 'link', 'notes']) f[k].value = '';
      picked = [];
      renderPicked();
      refresh();
    } catch (err) {
      message(err.message, 'error');
    } finally {
      $('inboxSend').disabled = false;
    }
  };
}

function alertIn(form, text) {
  let p = form.querySelector('.err');
  if (!p) form.append(p = Object.assign(document.createElement('p'), { className: 'err' }));
  p.textContent = text;
}
