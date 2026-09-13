import type { APIRoute } from 'astro';
import { getRedactions } from '../lib/articles';

export const GET: APIRoute = async () =>
	new Response(JSON.stringify({ generated: new Date().toISOString(), redactions: await getRedactions() }, null, 2), {
		headers: { 'Content-Type': 'application/json' },
	});
