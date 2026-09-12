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

const SITE_ORIGIN = 'https://www.aqar-factory.com';
const KIND_PATH = { project: 'project', unit: 'unit', blog: 'blog' };

function send(res, status, body) {
  res.status(status).json(body);
}

// any logged-in ADMIN is enough here (this is a side effect of an
// already-authorized save/delete, not a sensitive operation in itself —
// unlike api/admin-users.js, which manages OTHER users' accounts and
// requires the Owner role). This used to only check "is this a valid
// Supabase session at all" (via the anon key), not "is this session an
// active row in `admins`" — meaning ANY signed-up Supabase user, admin or
// not, could trigger an expensive headless-Chrome render or invalidate any
// published page's cached snapshot. Now resolves the caller's identity via
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

function blobKey(kindPath, lang, slugForUrl) {
  return `prerendered/${lang}/${kindPath}/${slugForUrl}.html`;
}

async function renderOne(browser, url, bypassSecret) {
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'x-prerender-bypass': bypassSecret });
    // NOT 'networkidle0': every page opens a persistent Supabase Realtime
    // WebSocket (store.js) that never closes, so "0 active connections" can
    // never be true here — that made every single render time out at 20s,
    // 100% failure, regardless of the page. The real readiness signal is
    // the explicit waitForSelector below (set by the page's own JS only
    // once content has actually finished populating), so goto just needs
    // to get the initial document parsed.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
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

  const { action, kind, callerToken } = body;
  const kindPath = KIND_PATH[kind];
  if (!kindPath) return send(res, 400, { error: 'bad_kind' });
  if (!body.slug) return send(res, 400, { error: 'missing_slug' });
  // strip a stray leading/trailing slash defensively — a bad slug would
  // otherwise produce a broken double-slash path to snapshot AND a blob key
  // that middleware.js's clean-slug lookup could never actually match (see
  // store.js's buildUrl() for the fuller explanation of the root issue)
  const stripSlashes = (s) => String(s || '').replace(/^\/+|\/+$/g, '');
  const slug = stripSlashes(body.slug);
  const slugAr = stripSlashes(body.slugAr);

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

  // chromium-min fetches a complete, correctly-packed Chromium binary from a
  // remote URL at cold start instead of relying on Vercel's build-time file
  // tracing to bundle every file the compressed binary needs — the plain
  // @sparticuz/chromium package failed live with "libnss3.so: cannot open
  // shared object file", a known class of incomplete-bundle issue on Vercel.
  //
  // That same "libnss3.so" error resurfaced on the previously-pinned
  // 131.0.1 build: this is a well-documented, recurring class of failure
  // (see Sparticuz/chromium#254) caused by AWS/Vercel periodically updating
  // the underlying Lambda base image in a way that breaks whatever NSS
  // libraries an older chromium build was packed against — not something
  // this project's own code can control, only keep pace with by staying on
  // a current chromium-min release. Bumped to the latest as of writing
  // (152.0.0; keep package.json's version and this URL in lockstep on any
  // future bump — they must match exactly, unlike puppeteer-core's `^`
  // range, since chromium-min's own version IS the pack filename below).
  //
  // puppeteer-core is capped below 25.0.0 deliberately: v25 switched to
  // "type":"module" with no usable CJS entry point. Confirmed via actual
  // Vercel runtime logs (`vercel logs`, not just local testing) that the
  // REAL crash here is @sparticuz/chromium-min itself, not puppeteer-core:
  // 152.0.0's build/index.js is "type":"module" too (Node throws
  // ERR_REQUIRE_ESM on require(), as a raw platform 500 with no detail —
  // this handler's own try/catch never even gets entered). Node's own
  // error message says exactly what to do instead: a dynamic import(),
  // which works for both CJS and ESM targets, so this survives chromium-min
  // going full-ESM on some future version too, not just this one.
  // Newer chromium-min releases also split the pack by CPU architecture
  // (previously one arch-less file) — Vercel's default function
  // architecture is x64, hence "-pack.x64.tar" here.
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const puppeteer = require('puppeteer-core');
  const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v152.0.0/chromium-v152.0.0-pack.x64.tar';

  const targets = [
    { lang: 'en', slugForUrl: slug, path: `/${kindPath}/${encodeURIComponent(slug)}` },
    { lang: 'ar', slugForUrl: slugAr || slug, path: `/ar/${kindPath}/${encodeURIComponent(slugAr || slug)}` }
  ];

  let browser;
  const results = {};
  try {
    browser = await puppeteer.launch({
      // chromium-min 152.x removed the standalone `headless` property (was
      // always undefined here as of the version bump above, confirmed via
      // a local test) — headless mode is now baked into `args` itself as
      // a --headless='shell' flag, so there's nothing to pass separately
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL)
    });

    for (const t of targets) {
      try {
        const html = await renderOne(browser, SITE_ORIGIN + t.path, bypassSecret);
        // this SDK version's PutCommandOptions only accepts access:'public'
        // (confirmed in node_modules/@vercel/blob's own .d.ts — 'private'
        // was never a real option, it just silently never worked); pairing
        // that with addRandomSuffix:false is what actually gives this a
        // fixed, overwritable, predictable URL per pathname — 'allowOverwrite'
        // isn't a real option in this version either, it was dead all along
        await put(blobKey(kindPath, t.lang, t.slugForUrl), html, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'text/html; charset=utf-8'
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
