// Manage who can edit the Lexicon. Passwords are typed here and never stored; the Worker keeps only a
// keyed hash of each one (the key is the PASSWORD_PEPPER secret, which lives only in Cloudflare and in
// worker/.secrets.json on this machine).
//
//   node worker/contributors.mjs add Nico       prompts for Nico's password (or press Enter to generate one)
//   node worker/contributors.mjs remove Nico    revokes Nico immediately
//   node worker/contributors.mjs list
//
// Every change is pushed to the live Worker with `wrangler secret put CONTRIBUTORS`.
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const here = dirname(fileURLToPath(import.meta.url));
const LIST = join(here, '.contributors.json');
const SECRETS = join(here, '.secrets.json');
const WORDS = 'amber anvil arcane ash banner basalt beacon bell blade bramble cairn candle cinder citadel cloak comet copper crown crypt dagger dawn drake ember falcon fang fern flint forge gale garnet glade granite grove harbor hearth hollow horn iron ivory jade lantern ledger lich lotus marble mist moon oak onyx orchid owl pearl pine quill raven reed rune sable sage scroll shard silver slate spire star stone storm sun thorn tide tower vale velvet willow wind wolf wyrm'.split(' ');

const [cmd, ...rest] = process.argv.slice(2);
const name = rest.join(' ').trim();
const list = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : [];

function secrets() {
	if (existsSync(SECRETS)) return JSON.parse(readFileSync(SECRETS, 'utf8'));
	const s = { PASSWORD_PEPPER: randomBytes(32).toString('hex'), SESSION_SECRET: randomBytes(32).toString('hex') };
	writeFileSync(SECRETS, JSON.stringify(s, null, 2));
	return s;
}

function putSecret(key, value) {
	const r = spawnSync(process.execPath, [join(here, 'wr.mjs'), 'secret', 'put', key], { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
	if (r.status !== 0) {
		console.error(`\nCould not update ${key} on Cloudflare. The local list was saved; run this again after \`node worker/wr.mjs login\`.`);
		process.exit(1);
	}
}

function ask(question, hidden) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		if (hidden) rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : '');
		rl.question(question, (answer) => {
			rl.close();
			if (hidden) process.stdout.write('\n');
			resolve(answer);
		});
	});
}

if (cmd === 'list') {
	console.log(list.length ? list.map((c) => `- ${c.name} (added ${c.added})`).join('\n') : 'No contributors yet.');
} else if (cmd === 'add' && name) {
	const s = secrets();
	let password = await ask(`Password for ${name} (Enter to generate one): `, true);
	if (!password) {
		password = Array.from({ length: 4 }, () => WORDS[randomBytes(2).readUInt16BE() % WORDS.length]).join('-');
		console.log(`Generated password for ${name}: ${password}\nGive it to them privately; it is not stored anywhere.`);
	} else if (password.length < 10) {
		console.error('Use at least 10 characters.');
		process.exit(1);
	}
	const hash = createHmac('sha256', s.PASSWORD_PEPPER).update(`${name.toLowerCase()}:${password}`).digest('hex');
	const next = list.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
	next.push({ name, hash, added: new Date().toISOString().slice(0, 10) });
	writeFileSync(LIST, JSON.stringify(next, null, 2));
	putSecret('CONTRIBUTORS', JSON.stringify(next));
	console.log(`${name} can now sign in at the Lexicon editor.`);
} else if (cmd === 'remove' && name) {
	const next = list.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
	if (next.length === list.length) {
		console.error(`${name} is not a contributor.`);
		process.exit(1);
	}
	writeFileSync(LIST, JSON.stringify(next, null, 2));
	putSecret('CONTRIBUTORS', JSON.stringify(next));
	console.log(`${name} no longer has access.`);
} else if (cmd === 'init-secrets') {
	const s = secrets();
	putSecret('PASSWORD_PEPPER', s.PASSWORD_PEPPER);
	putSecret('SESSION_SECRET', s.SESSION_SECRET);
	putSecret('CONTRIBUTORS', JSON.stringify(list));
	console.log('Server secrets set.');
} else {
	console.log('Usage: node worker/contributors.mjs add <name> | remove <name> | list | init-secrets');
}
