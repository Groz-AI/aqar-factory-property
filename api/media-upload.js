/* ============================================================
   AQAR FACTORY — media upload (Vercel serverless function)
   ------------------------------------------------------------
   Replaces Supabase Storage as the home for admin-uploaded images and
   PDFs. Supabase's free-tier egress quota was blown through by the
   volume of real-visitor image traffic (confirmed live in the account's
   own usage dashboard — 565% over the cached-egress quota, while the
   actual database was at 7% of its own limit), which restricted the
   entire Supabase project, not just storage. Cloudflare R2 charges zero
   egress fees, so the same traffic pattern that broke Supabase costs
   nothing here.

   Files are uploaded browser -> R2 directly via a short-lived presigned
   URL, not proxied through this function — a Vercel serverless function
   has a request body size limit well under a photo/PDF, and routing
   file bytes through it would add latency and cost for nothing. This
   function's only job is minting that URL (and listing/naming existing
   files for the admin's "choose existing" picker) after checking the
   caller is a logged-in admin.

   Auth: same pattern as api/prerender.js — any logged-in admin is
   enough (this is a side effect of the admin's own upload action, not
   a sensitive operation in itself, unlike api/admin-users.js).
   ============================================================ */

function send(res, status, body) {
  res.status(status).json(body);
}

// Any logged-in ADMIN is enough here — but this used to only check "is this
// a valid Supabase session at all" (via the anon key), not "is this session
// an active row in `admins`". That meant ANY Supabase user (admin or not —
// the Auth REST API is directly reachable with the public anon key already
// embedded in every page) could mint a presigned upload URL to the R2
// bucket or list every uploaded file. Now resolves the caller's identity via
// the service-role key (same pattern as api/admin-users.js's verifyOwner)
// and requires an active `admins` row, regardless of role.
async function verifyCaller(callerToken) {
  if (!callerToken) return false;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return false; // fail closed, not open
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${callerToken}` }
    });
    if (!userRes.ok) return false;
    const caller = await userRes.json().catch(() => null);
    if (!caller || !caller.id) return false;

    const rowRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?user_id=eq.${caller.id}&select=active`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    if (!rowRes.ok) return false;
    const rows = await rowRes.json().catch(() => []);
    const me = Array.isArray(rows) ? rows[0] : null;
    return !!(me && me.active);
  } catch (_) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const authed = await verifyCaller(body.callerToken);
  if (!authed) return send(res, 401, { error: 'unauthorized' });

  const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!accountId || !bucket || !publicUrl || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return send(res, 500, { error: 'not_configured' });
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });

  if (body.action === 'presign') {
    const filename = String(body.filename || '');
    const contentType = String(body.contentType || 'application/octet-stream');
    // hard allow-list, not just the client's own image/* check (which admin.js
    // already does, but that's trivially bypassable by anyone calling this
    // endpoint directly with the admin's session token, and it explicitly
    // permits image/svg+xml — an SVG can carry a <script> tag that executes if
    // its uploaded URL is ever opened directly, and every uploaded file here
    // is served back with a public, cached-forever URL on the site's own
    // domain). Every real upload site-wide is either a photo or a brochure PDF.
    const ALLOWED_CONTENT_TYPES = new Set([
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
      'application/pdf'
    ]);
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return send(res, 400, { error: 'unsupported_content_type' });
    }
    const ext = (filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    // same naming scheme the old Supabase path used: timestamp + random
    // suffix, so every key is unique and content-addressed enough to cache
    // forever — no admin ever needs to know or type this filename
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        // uploaded filenames are unique and never overwritten, so this is
        // safe to cache forever at every layer (browser, Cloudflare edge)
        CacheControl: 'public, max-age=31536000, immutable'
      }),
      { expiresIn: 300 }
    );

    return send(res, 200, { uploadUrl, publicUrl: `${publicUrl}/${key}`, contentType });
  }

  if (body.action === 'list') {
    try {
      const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 300 }));
      const files = (out.Contents || [])
        .filter(o => o.Key && !o.Key.startsWith('_')) // hide the connectivity-test prefix and any future internal keys
        .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
        .map(o => ({ name: o.Key, publicUrl: `${publicUrl}/${o.Key}` }));
      return send(res, 200, { files });
    } catch (e) {
      return send(res, 500, { error: 'list_failed', message: e && e.message || String(e) });
    }
  }

  return send(res, 400, { error: 'bad_action' });
};
