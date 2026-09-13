// Runs wrangler against Dave's PERSONAL Cloudflare login, kept in worker/.wrangler-home so it never
// touches the Innovent Capital login that the other projects use.
//   node worker/wr.mjs login | whoami | deploy | tail | secret put NAME
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const home = join(here, '.wrangler-home');
mkdirSync(home, { recursive: true });

const r = spawnSync('npx', ['--yes', 'wrangler@4', ...process.argv.slice(2)], {
	cwd: here,
	stdio: 'inherit',
	shell: process.platform === 'win32',
	env: { ...process.env, XDG_CONFIG_HOME: home },
});
process.exit(r.status ?? 1);
