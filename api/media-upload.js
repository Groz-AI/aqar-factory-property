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

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

function send(res, status, body) {
  res.status(status).json(body);
}

async function verifyCaller(callerToken) {
  if (!callerToken) return false;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${callerToken}` }
    });
    return r.ok;
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
