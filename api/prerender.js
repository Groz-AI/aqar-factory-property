/* ============================================================
   AQAR FACTORY — prerender snapshot (Vercel serverless function)
   ------------------------------------------------------------
   Headless-renders a single project/unit/blog-post detail page — the
   real, live, client-rendered page, exactly what every visitor's
   browser already produces via project.js/unit.js/blog-post.js — and
   stores the fully-populated HTML in Vercel Blob, keyed by kind +
   language + slug. middleware.js checks this cache on every real-
   visitor request to the clean-path URLs; a hit means content is
   present in the very first response instead of appearing a moment
   later via a client-side Supabase fetch.

   Triggered by admin/admin.js after every save/delete of a project/
   unit/blog post (fire-and-forget — a failure here never blocks the
   save; it just means that one item stays on the slower CSR path
   until the next successful regenerate call).

   Auth: requires a valid Supabase session token (any logged-in
   admin) — this is an expensive endpoint (launches headless Chrome)
   and must not be callable by an anonymous visitor.

   The `x-prerender-bypass` header sent to the page we're snapshotting
   is a server-to-server secret (PRERENDER_BYPASS_SECRET) that never
   reaches the browser — it tells middleware.js "don't serve me the
   cached snapshot you already have, give me the true live CSR page,"
   so a regenerate never just re-captures a stale copy of itself.
   ============================================================ */

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

const SITE_ORIGIN = 'https://www.aqar-factory.com';
const KIND_PATH = { project: 'project', unit: 'unit', blog: 'blog' };

function send(res, status, body) {
  res.status(status).json(body);
}

// any logged-in admin is enough here (this is a side effect of an
// already-authorized save/delete, not a sensitive operation in itself —
// unlike api/admin-users.js, which manages OTHER users' accounts and
// requires the Owner role)
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

function blobKey(kindPath, lang, slugForUrl) {
  return `prerendered/${lang}/${kindPath}/${slugForUrl}.html`;
}

async function renderOne(browser, url, bypassSecret) {
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'x-prerender-bypass': bypassSecret });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('[data-prerendered-ready]', { timeout: 15000 });
    return await page.content();
  } finally {
    await page.close();
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const { action, kind, slug, slugAr, callerToken } = body;
  const kindPath = KIND_PATH[kind];
  if (!kindPath) return send(res, 400, { error: 'bad_kind' });
  if (!slug) return send(res, 400, { error: 'missing_slug' });

  const authed = await verifyCaller(callerToken);
  if (!authed) return send(res, 401, { error: 'unauthorized' });

  const { put, del } = require('@vercel/blob');

  if (action === 'invalidate') {
    // also clear the "no slugAr" fallback key, in case it was cached
    // under that before a custom Arabic slug was ever set
    const keys = [blobKey(kindPath, 'en', slug), blobKey(kindPath, 'ar', slug)];
    if (slugAr) keys.push(blobKey(kindPath, 'ar', slugAr));
    try { await del(keys); } catch (_) { /* best-effort */ }
    return send(res, 200, { ok: true });
  }

  if (action !== 'regenerate') return send(res, 400, { error: 'bad_action' });

  const bypassSecret = process.env.PRERENDER_BYPASS_SECRET;
  if (!bypassSecret) return send(res, 500, { error: 'not_configured' });

  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');

  const targets = [
    { lang: 'en', slugForUrl: slug, path: `/${kindPath}/${encodeURIComponent(slug)}` },
    { lang: 'ar', slugForUrl: slugAr || slug, path: `/ar/${kindPath}/${encodeURIComponent(slugAr || slug)}` }
  ];

  let browser;
  const results = {};
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    for (const t of targets) {
      try {
        const html = await renderOne(browser, SITE_ORIGIN + t.path, bypassSecret);
        await put(blobKey(kindPath, t.lang, t.slugForUrl), html, {
          access: 'private',
          contentType: 'text/html; charset=utf-8',
          allowOverwrite: true
        });
        results[t.lang] = 'ok';
      } catch (e) {
        results[t.lang] = 'error: ' + (e && e.message || String(e));
      }
    }
  } catch (e) {
    return send(res, 500, { error: 'render_failed', message: e && e.message || String(e) });
  } finally {
    if (browser) { try { await browser.close(); } catch (_) { /* ignore */ } }
  }

  send(res, 200, { ok: true, results });
};
