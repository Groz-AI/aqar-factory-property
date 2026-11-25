/* ============================================================
   AQAR FACTORY — media upload (Cloudflare Pages Function)
   ------------------------------------------------------------
   Same contract as api/media-upload.js (Vercel): a logged-in admin gets a
   short-lived signed address to upload straight to R2, or the list of files.
   Signed with aws4fetch (a few KB) instead of the AWS SDK, to stay within
   the free plan's CPU limit.
   ============================================================ */
import { AwsClient } from 'aws4fetch';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// any logged-in ACTIVE admin (not merely any signed-in database user)
async function verifyCaller(env, token) {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!u.ok) return false;
    const caller = await u.json().catch(() => null);
    if (!caller || !caller.id) return false;
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/admins?user_id=eq.${caller.id}&select=active`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => []);
    return !!(Array.isArray(rows) && rows[0] && rows[0].active);
  } catch (_) {
    return false;
  }
}

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf']);
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const body = await request.json().catch(() => ({}));
  if (!(await verifyCaller(env, body.callerToken))) return json(401, { error: 'unauthorized' });

  const account = env.R2_ACCOUNT_ID, bucket = env.R2_BUCKET_NAME;
  const publicUrl = String(env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!account || !bucket || !publicUrl || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) return json(500, { error: 'not_configured' });
  const r2 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
  const base = `https://${account}.r2.cloudflarestorage.com/${bucket}`;

  if (body.action === 'presign') {
    const contentType = String(body.contentType || 'application/octet-stream');
    // no SVG: it can carry script and every upload is public on the site's own addresses
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) return json(400, { error: 'unsupported_content_type' });
    const ext = (String(body.filename || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const url = new URL(`${base}/${key}`);
    url.searchParams.set('X-Amz-Expires', '300');
    url.searchParams.set('Cache-Control', 'public, max-age=31536000, immutable');
    const signed = await r2.sign(url.toString(), { method: 'PUT', aws: { signQuery: true } });
    return json(200, { uploadUrl: signed.url, publicUrl: `${publicUrl}/${key}`, contentType });
  }

  if (body.action === 'list') {
    try {
      const res = await r2.fetch(`${base}?list-type=2&max-keys=300`);
      if (!res.ok) return json(500, { error: 'list_failed', message: 'R2 ' + res.status });
      const xml = await res.text();
      const files = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => ({
        key: unxml((m[1].match(/<Key>([\s\S]*?)<\/Key>/) || [])[1] || ''),
        at: Date.parse((m[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/) || [])[1] || '') || 0
      })).filter(f => f.key && !f.key.startsWith('_')).sort((a, b) => b.at - a.at)
        .map(f => ({ name: f.key, publicUrl: `${publicUrl}/${f.key}` }));
      return json(200, { files });
    } catch (e) {
      return json(500, { error: 'list_failed', message: (e && e.message) || String(e) });
    }
  }

  return json(400, { error: 'bad_action' });
}
