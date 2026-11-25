/* ============================================================
   /api/publish — asks Cloudflare to build the site again
   ------------------------------------------------------------
   Used by the admin (admin/publish.js) so that saved changes reach the
   pre-built pages. Only a signed-in active admin may call it. The build
   address (CF_DEPLOY_HOOK, a secret in the Pages settings) stays here.
   ============================================================ */
import { verifyCaller } from './media-upload.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const body = (await request.json().catch(() => null)) || {};
  if (!(await verifyCaller(env, body.callerToken))) return json(401, { error: 'unauthorized' });
  if (!/^https:\/\//.test(env.CF_DEPLOY_HOOK || '')) return json(500, { error: 'not_configured' });
  try {
    const r = await fetch(env.CF_DEPLOY_HOOK, { method: 'POST' });
    if (!r.ok) return json(502, { error: 'build_refused', status: r.status });
  } catch (_) {
    return json(502, { error: 'build_unreachable' });
  }
  return json(200, { ok: true });
}
