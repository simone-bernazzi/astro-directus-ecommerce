import type { APIRoute } from 'astro';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const secret = request.headers.get('x-internal-secret');
  if (secret !== import.meta.env.INTERNAL_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const { stdout } = await execFileAsync('node', ['scripts/calculate-kpis.mjs']);
    return new Response(JSON.stringify({ ok: true, output: stdout }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
