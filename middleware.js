/* ============================================================
   AQAR FACTORY — bot detection + redirects (Vercel Node.js Middleware)
   ------------------------------------------------------------
   WHY THIS EXISTS: project.html/unit.html/blog-post.html are 100%
   client-rendered — the real per-item title, description AND all
   visible content (about text, price, amenities…) only get written
   in by project.js/unit.js/blog-post.js AFTER the page loads and
   fetches from Supabase. Search engines and bots either can't run
   that JS at all, or can but don't reliably wait for/re-render it in
   time for what actually gets indexed — so relying on it was a real,
   client-reported indexing problem (a hardcoded generic <title>/<meta
   description>/<link rel=canonical> in the raw HTML, identical on
   every project/unit page, was there for Google's first crawl pass
   before JS ever ran — see the AI_BOT_RE comment below for the full
   explanation). Four kinds of bot are handled here:
     1. Link-unfurl bots (WhatsApp, Facebook, Twitter/X, LinkedIn,
        Telegram, Slack, Discord…) — only need title/description/image.
     2. AI crawlers that self-identify with an official bot user
        agent (OpenAI's GPTBot/ChatGPT-User, Anthropic's ClaudeBot,
        Perplexity's PerplexityBot, Google-Extended, etc.) — these
        want the actual page TEXT, not just meta tags, so an AI
        assistant can answer questions about the project/unit/post.
     3. The major search-engine indexers (Googlebot, Bingbot, Yandex) —
        same full-content treatment as group 2, for the reason above.
     4. Consumer chat apps' interactive "fetch this link for me"
        feature (e.g. asking Gemini/ChatGPT about a URL mid-conversation)
        often does NOT use one of the official crawler user agents
        above — it looks like a generic HTTP client. We can't match
        it by name, but we CAN detect it by what's MISSING: every
        real browser automatically attaches Sec-Fetch-Mode (and the
        rest of the Fetch Metadata family) to every request it makes,
        including page navigations — it's baked into the browser's
        network stack, not something a page or a simple server-side
        fetch()/curl-style client sends. A request to one of these
        exact detail-page URLs with NO Sec-Fetch-Mode header at all
        is, in practice, not a browser. This is intentionally a
        broader net than exact-name matching (it also catches unnamed
        bots we've never heard of), which is exactly the point.

   FIX: intercept requests whose User-Agent matches a known bot from
   either list above, OR that are missing the Sec-Fetch-Mode header
   entirely (see group 4 above), and REWRITE (not redirect — the
   visible URL never changes) to api/bot-render.js, which fetches the
   item from Supabase and returns an HTML document with the correct
   <title>, meta description, Open Graph/Twitter tags, AND the actual
   readable content as plain text/HTML in the body. Every real browser
   request (Sec-Fetch-Mode always present) is untouched and gets the
   normal site exactly as before.

   WHY A REWRITE TO A SEPARATE FUNCTION, NOT BUILT INLINE HERE: this
   file used to build and return that HTML directly. Vercel's CDN only
   ever caches a response produced by a real Function or a static
   asset — a Node.js Middleware Response is NEVER cached regardless of
   its own Cache-Control header (confirmed live: identical back-to-back
   bot requests each got a fresh X-Vercel-Id and zero X-Vercel-Cache
   header, while api/sitemap.js's identical setup — a plain Vercel
   Function — shows a real X-Vercel-Cache: HIT with a growing Age). That
   meant every single bot/AI-crawler/preview-bot hit re-ran the full
   Supabase fetch (up to 5 REST calls for a richMode detail page) from
   scratch every time, no matter how recently the exact same URL had
   just been served. Rewriting to api/bot-render.js instead means the
   response Vercel actually caches is a genuine Function response, so a
   page N bots hit inside its cache window now costs ONE Supabase round
   trip, not N. All of the DECISION logic below (who counts as a bot,
   which old URLs redirect where) is unchanged — only the final step,
   building the actual HTML, moved out.

   This file also owns the old-URL -> new-clean-URL redirect (see the
   `oldKind` branch below): project.html?id=/unit.html?id=/blog-post.html?slug=
   now 301-redirect to /project/<slug>, /unit/<slug>, /blog/<slug> (and
   /ar/... variants) for every client, not just bots — it's done here
   rather than in vercel.json's "redirects" because Vercel auto-appends
   the original query string to a redirect destination with no documented
   way to turn that off, which produced a broken double-slug URL.

   REAL VISITORS, NOT JUST BOTS: separately from all of the above, this
   file also checks Vercel Blob for a pre-rendered snapshot of the page
   (written by api/prerender.js, triggered from the admin portal on every
   save) and serves that directly when one exists — so a real visitor's
   very first response already has the content, not just bots/AI. A cache
   miss (brand new item, or the snapshot hasn't been generated yet) falls
   through to today's client-rendered page exactly as before — never a
   broken state. The one exception is api/prerender.js's own headless-
   browser request, which sends a secret bypass header so it always
   captures the true live page instead of re-snapshotting a stale copy
   of itself.
   ============================================================ */

// NOT `import { get } from '@vercel/blob'` — that function doesn't exist in
// this SDK version (confirmed: Object.keys(require('@vercel/blob')) has no
// `get`), so this was always silently throwing inside fetchPrerendered()'s
// own try/catch and returning null unconditionally — meaning no real
// visitor has ever actually received a cached snapshot, regardless of
// whether api/prerender.js successfully wrote one. The store itself is a
// public blob store (see api/prerender.js's put() call), so a snapshot's
// URL is just this fixed base plus its known pathname — no SDK read call
// needed at all, a plain fetch() is the correct fix.
const BLOB_PUBLIC_BASE_URL = process.env.BLOB_PUBLIC_BASE_URL;
// on the Node.js Middleware runtime (unlike the Edge default), a bare
// `return;`/`return undefined` does NOT reliably fall through to normal
// request handling — verified live: it served an empty 200 body instead of
// the real page. `next()` is the documented, explicit "continue the chain"
// signal for non-Next.js frameworks on this runtime.
import { next, rewrite } from '@vercel/functions';

export const config = {
  matcher: [
    // old query-string form — matched so this middleware can 301-redirect
    // it to the new clean path (see the redirect logic below)
    '/project.html', '/unit.html', '/blog-post.html',
    '/ar/project.html', '/ar/unit.html', '/ar/blog-post.html',
    // /index.html serves byte-identical content to /, so both getting
    // indexed is a real duplicate — 301 the explicit filename to the root
    '/index.html', '/ar/index.html',
    // new clean-path form — what every internal link now points to
    '/project/:slug*', '/unit/:slug*', '/blog/:slug*',
    '/ar/project/:slug*', '/ar/unit/:slug*', '/ar/blog/:slug*',
    // static pages — matched so bots can get server-injected hreflang (see
    // the STATIC_HREFLANG_PAGES block below); real browsers pass straight
    // through untouched, same as everywhere else in this file
    '/', '/ar', '/projects.html', '/ar/projects.html', '/units.html', '/ar/units.html',
    '/blog.html', '/ar/blog.html', '/about.html', '/ar/about.html', '/contact.html', '/ar/contact.html'
  ],
  // @vercel/blob's get() pulls in Node-specific modules (net/tls/stream/etc.)
  // that aren't supported on the default Edge runtime — verified via a real
  // deploy failure ("referencing unsupported modules") before switching this
  runtime: 'nodejs'
};

// group 1: link-unfurl bots (want title/description/image only)
const PREVIEW_BOT_RE = /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|redditbot|pinterest|skypeuripreview|vkshare|w3c_validator|embedly|quora link preview|showyoubot|outbrain|nuzzel|flipboard|tumblr|bitlybot|iframely|viber|line-poker|kakaotalk/i;

// group 2: officially self-identifying AI crawlers/answer engines, AND the
// major search-engine indexers (Google/Bing/Yandex) — these get the same
// response PLUS real page text in the body.
//
// Google/Bing/etc. WERE deliberately excluded here on the assumption that
// "it renders JS, so it'll see the real content eventually" — true, but
// misleading in practice: Google indexes JS-heavy pages in two passes, and
// the FIRST pass reads the raw, un-rendered HTML — which, before this fix,
// had a hardcoded generic <title>/<meta description>/<link rel=canonical>
// identical on every project/unit page (the canonical literally pointed at
// the bare template URL, telling Google "this is a duplicate of a page with
// no real content"). That can make Google skip ever coming back to render
// the JS at all — a real, client-reported symptom: some old, rarely-edited
// projects never got indexed while newer ones did, which tracks with
// Google's crawl-budget-dependent, sometimes very delayed second pass
// rather than any actual defect in those specific projects. Removing the
// exclusion means Google's FIRST pass already sees the correct, real
// content — no reliance on JS-render timing at all.
const AI_BOT_RE = /gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|google-extended|applebot-extended|bytespider|ccbot|diffbot|amazonbot|youbot|cohere-ai|meta-externalagent|timpibot|imagesiftbot|googlebot|google-inspectiontool|googleother|adsbot-google|bingbot|bingpreview|yandexbot/i;

const BOT_RE = new RegExp(PREVIEW_BOT_RE.source + '|' + AI_BOT_RE.source, 'i');

// looks up a real-visitor pre-rendered snapshot written by api/prerender.js —
// path format must match blobKey() there exactly. api/prerender.js writes
// with addRandomSuffix:false, so this URL is fully deterministic — no
// lookup step (list/head) needed, just fetch it directly and treat a 404
// as "no snapshot yet", same as the old code treated a missing blob.
async function fetchPrerendered(kindPath, lang, slugForUrl) {
  if (!BLOB_PUBLIC_BASE_URL) return null;
  try {
    const res = await fetch(`${BLOB_PUBLIC_BASE_URL}/prerendered/${lang}/${kindPath}/${slugForUrl}.html`);
    if (!res.ok) return null;
    return await res.text();
  } catch (_) {
    return null;
  }
}

export default async function middleware(request) {
  const url = new URL(request.url);

  // Home + the 5 static listing/info pages get zero hreflang on Google's raw
  // first pass, same root cause as the fix already shipped for project/unit/
  // blog detail pages: i18n.js's injectSeoLinks() only ever runs client-side,
  // and Googlebot's renderer sends Sec-Fetch-Mode like a real browser so it
  // was reaching these pages as a "real visitor" and getting nothing but the
  // bare static file. Bots get the same static HTML with hreflang injected;
  // real browsers pass straight through, untouched, exactly as before.
  // Uses its own isAr check (not the one below) because "/ar" with no
  // trailing slash — the real, trailingSlash:false form of the Arabic
  // homepage — doesn't match startsWith('/ar/').
  const STATIC_HREFLANG_PAGES = new Set(['/', '/projects.html', '/units.html', '/blog.html', '/about.html', '/contact.html']);
  const staticIsAr = url.pathname === '/ar' || url.pathname.startsWith('/ar/');
  const staticEnPath = staticIsAr ? (url.pathname === '/ar' ? '/' : url.pathname.slice(3)) : url.pathname;
  // the header below is api/bot-render.js's OWN internal re-fetch of this
  // same static file (it needs the raw source to inject content into) — not
  // a real request — without checking for it first, that re-fetch would come
  // back through this same matcher and get rewritten right back to itself
  if (request.headers.get('x-mw-static-fetch') !== '1' && STATIC_HREFLANG_PAGES.has(staticEnPath)) {
    const uaStatic = request.headers.get('user-agent') || '';
    const isNamedBotStatic = BOT_RE.test(uaStatic);
    const looksLikeNonBrowserStatic = !isNamedBotStatic && !request.headers.get('sec-fetch-mode');
    if (isNamedBotStatic || looksLikeNonBrowserStatic) {
      const qs = new URLSearchParams({ mode: 'static', page: staticEnPath, lang: staticIsAr ? 'ar' : 'en' });
      return rewrite(new URL(`/api/bot-render?${qs.toString()}`, url.origin));
    }
    return next();
  }

  const isAr = url.pathname.startsWith('/ar/');
  const page = isAr ? url.pathname.slice(3) : url.pathname;

  // OLD query-string form (/project.html?id=…) -> always 301-redirect to the
  // new clean path, for every client (bot or real browser) — one canonical
  // URL going forward, and this transfers the SEO value already earned by
  // the old, already-indexed URLs. Built directly here (not via vercel.json
  // "redirects") because Vercel's redirects auto-append the original query
  // string to the destination with no documented way to suppress it, which
  // produced a broken double-slug URL (verified live before switching to
  // this approach); this middleware also runs before vercel.json's routing
  // is applied, so there's no ordering issue doing it here instead.
  // /index.html and / are the same bytes — collapse to the root form so only
  // one of the two can ever be indexed (Google was already flagging this pair
  // as a duplicate and picking its own canonical)
  if (page === '/index.html') {
    return Response.redirect(new URL(isAr ? '/ar' : '/', url.origin), 301);
  }

  const oldKind = page === '/project.html' ? 'project' : page === '/unit.html' ? 'unit' : page === '/blog-post.html' ? 'blog' : null;
  if (oldKind) {
    // The bare template with no id at all (/project.html, or ?id= empty) is a
    // real URL Google has crawled — and answering it with the unfilled
    // template was a 200 carrying the generic "Project — Aqar Factory" title,
    // i.e. the exact soft-404 the client's original SEO report screenshotted.
    // Send it to the corresponding listing page instead: useful for a person
    // who lands there, and it folds the stray template URL into a real page
    // rather than leaving an empty duplicate in the index.
    const LISTING = { project: '/projects.html', unit: '/units.html', blog: '/blog.html' };
    const rawOldId = url.searchParams.get('id') || url.searchParams.get('slug');
    if (!rawOldId) {
      return Response.redirect(new URL((isAr ? '/ar' : '') + LISTING[oldKind], url.origin), 301);
    }
    // a stray leading/trailing slash can be baked into an already-indexed old
    // URL from before admin.js started sanitizing slugs on save (see store.js's
    // buildUrl() for the fuller history) — without stripping it here too, the
    // redirect target still carries the slash and never matches the since-
    // corrected database row, so the page 404s forever even after the data fix
    const oldId = rawOldId.replace(/^\/+|\/+$/g, '');
    // an id of nothing but slashes is the same empty-template case as above
    if (!oldId) {
      return Response.redirect(new URL((isAr ? '/ar' : '') + LISTING[oldKind], url.origin), 301);
    }
    const newPath = `${isAr ? '/ar' : ''}/${oldKind}/${encodeURIComponent(oldId)}`;
    return Response.redirect(new URL(newPath, url.origin), 301);
  }

  // NEW clean-path form (/project/slug, /ar/unit/slug, …) — parsed once,
  // used both by the pre-rendered-cache check below (real visitors) and
  // by the bot-content rewrite further down
  const m = page.match(/^\/(project|unit|blog)\/([^/]+)\/?$/);
  if (!m) return next();
  const kindPath = m[1]; // 'project' | 'unit' | 'blog'
  const slugFromUrl = decodeURIComponent(m[2]);

  // A handful of URLs Google indexed years ago no longer match any row: the
  // item was either renamed (its slug edited in the admin) or filed under the
  // wrong kind (a /unit/ URL for what is actually a project). Left alone they
  // 200 with the empty template — a "soft 404", the worst signal to give a
  // crawler. Each entry below was verified against live Supabase data to
  // resolve to EXACTLY ONE row, so the 301 can't send anyone to the wrong
  // listing; genuinely-deleted slugs are deliberately absent and fall through
  // to the real 404 in api/bot-render.js.
  const RENAMED = {
    // wrong kind: these slugs belong to a project, not a unit
    // (target is the project's CURRENT slug, not the first-redirect one it
    // used to point at — see the 2-hop-chain note further down)
    'unit/salt-marina-in-ras-el-hekma': '/project/salt-marina-ras-el-hekma-resort',
    'unit/river-park-residence-new-obour': '/project/river-park-residence-new-obour',
    // resolves a previously-ambiguous stale slug (matched 2 live units) —
    // this one is a near-exact substring of the 133m unit's current slug
    // ("...apartment-latin-district-new-alamein" vs "...apartment-for-sale-
    // in-latin-district-new-alamein-133m"), unlike the 121m unit's slug,
    // which drops "new-alamein" entirely
    'unit/ready-to-move-2br-apartment-latin-district-new-alamein': '/unit/ready-to-move-2br-apartment-for-sale-in-latin-district-new-alamein-133m',
    'unit/mirissa-new-obour-compound': '/project/mirissa-new-obour-compound',
    // renamed slugs — kept as a hardcoded backstop for URLs that went stale
    // BEFORE slug_redirects existed (see api/bot-render.js's fetchRenamedRowId(),
    // which now records and follows every rename automatically going forward,
    // so this map shouldn't need new entries added by hand again)
    'project/citalia-compound-valero-new-obour': '/project/citalia-compound-valero-new-obour-city',
    // aljarbritishdistrictyorkphase was itself already a fixed-forward
    // target that has since been renamed AGAIN — proof this exact class of
    // bug recurs, and the reason slug_redirects exists now instead of
    // another one-off entry. Target below is the project's CURRENT slug
    // (aljar-british-district-el-shorouk-compound-york was itself found live
    // to be a second stale hop, redirecting again via slug_redirects — fixed
    // to point straight at the final destination so this is one 301, not two)
    'project/aljar_british_district_york_phase': '/project/aljar-british-district-el-shorouk',
    // a third slug variant for the same project, found via a "different
    // canonical" export — Google had this crawled and indexed directly
    // (not via a redirect), so it isn't simply the underscored form above
    'project/aljarbritishdistrictyorkphase': '/project/aljar-british-district-el-shorouk',
    'project/r_five_new_capital': '/project/rfivenewcapital',
    'project/lagonza-residence-santorini-coastal-living-in-obour': '/project/lagonza-residence-compound-el-obour-city',
    // found via a live GSC "Discovered - not indexed" export — same current
    // slug as the two entries above, for the same reason
    'project/كمبوند-الجار-الشروق-مرحلة-يورك-البريطانية-Aljar-York-Phase': '/project/aljar-british-district-el-shorouk',
    'project/مول-اربكو-ساوث-90th-Street-أبو-الهول-التجمع-الخامس-محلات-ومكاتب-بالتقسيط-علي-الشارع-التسعين-Arabco-South-90th-Street-Mall-New-Landmark': '/project/jeel-plaza-arabco-new-cairo-mall',
    // renamed before slug_redirects existed; predates the tracking system
    // (confirmed via a direct query — this row has no slug_redirects entry,
    // unlike renames that happened after today's deploy, which the table
    // already caught automatically on their own)
    'project/apartments-for-sale-jazeel-residence-new-obour': '/project/jazeel-residence-compound-new-obour-city',
    // found via a live GSC "different canonical" export — old AR slug had
    // both a typo (كمبورد vs كمبوند) and the wrong area name (الشروق/Shorouk
    // vs العبور/Obour). The fixed-AR-slug target above was itself confirmed
    // live to be a second stale hop (that AR slug has since changed too) —
    // pointing straight at the project's current EN slug instead, both to
    // fix the chain and to sidestep the AR-slug-under-EN-path canonical
    // redirect this would otherwise trigger a second time
    'project/كمبورد-تاون-تن-الشروق-الجديدة-Town-Ten-New-Obour-Compound': '/project/mazaya-developments-new-obour-compound',
    // found via a live GSC "Crawled - currently not indexed" export — all
    // 6 below are genuinely stale slugs (renamed rows, predating
    // slug_redirects), confirmed 404 live before this fix
    // old AR slug had a tatweel character (ـ) in "لـ" that the current
    // slug (after Arabic Unicode folding) no longer has
    'project/كمبوند-دي-جويا-4-العاصمة-الإدارية-شقق-وفيلات-للبيع-بمقدم-120-ألف-وتقسيط-لـ-12-سنة-De-Joya-4-New-Capital-Apartments-from-120K-DP': '/project/كمبوند-دي-جويا-4-العاصمة-الإدارية-شقق-وفيلات-للبيع-بمقدم-120-ألف-وتقسيط-ل-12-سنة-De-Joya-4-New-Capital-Apartments-from-120K-DP',
    // targets below point at the unit's current EN slug rather than its AR
    // slug (both originally pointed at the AR slug under this non-/ar/ path,
    // which live-tested as a 2-hop chain: fetchRow matches slug OR slug_ar,
    // so the request lands on the row fine, but the HAS_SLUG_AR canonical
    // check then immediately 301s again onto the EN slug anyway — pointing
    // straight at the EN slug here skips that second hop entirely)
    'unit/1br-cabana-silver-bay-silversands': '/unit/1br-cabana-for-sale-in-silver-bay-silversands-north-coast',
    'unit/the-c-north-coast': '/unit/the-c-north-coast-chalet-95m',
    'unit/126m-apartment-for-sale-in-mayan-el-shorouk': '/unit/3-bedroom-fully-finished-apartment-for-sale-in-mayan-el-shorouk-126m',
    'project/mayan-el-shorouk-compound-apartments-for-sale': '/project/mayan-el-shorouk-city-compound-apartments',
    // same AR-slug-under-EN-path chain as the two entries above — pointing
    // straight at the current EN slug
    'unit/mirissa-new-obour-apartment-117m': '/unit/2-bedroom-apartment-for-sale-in-mirissa-new-obour-117m',
    // this unit has no distinct AR slug, so the AR-path target is just its
    // (unchanged) EN slug
    'unit/apartment-for-sale-jazeel-obour-4b005': '/unit/jazeel-residence-obour-2nd-floor-apartment-4-b-205',
    // this was a genuine DUPLICATE row (not a rename) — the admin created
    // this unit twice with a data-entry mistake (area typed as 118m² instead
    // of the correct 148m²), then created a fresh, correct row instead of
    // fixing the mistake in place. The old, wrong row was deleted from the
    // admin, so slug_redirects never saw it (that only tracks slug edits on
    // a row that still exists, not a delete) — redirecting straight to the
    // surviving, correct unit
    'unit/the-river-park-residence-new-obour': '/unit/3-bedroom-apartment-for-sale-in-river-park-residence-new-obour-148m',
    // same AR-slug-under-EN-path chain as the entries above — the AR-slug
    // target was itself confirmed live to redirect a second time onto the
    // current EN slug, so pointing straight at that EN slug instead
    'unit/شقة-3-غرف-148م-للبيع-في-كمبوند-ريفر-بارك-العبور-الجديدة': '/unit/3-bedroom-apartment-for-sale-in-river-park-residence-new-obour-148m'
  };
  const renamedTo = RENAMED[`${kindPath}/${slugFromUrl}`];
  if (renamedTo) {
    return Response.redirect(new URL((isAr ? '/ar' : '') + renamedTo, url.origin), 301);
  }

  const ua = request.headers.get('user-agent') || '';
  const isNamedBot = BOT_RE.test(ua);
  // every real browser attaches Sec-Fetch-Mode to every request automatically;
  // a simple server-side fetcher (curl, a chat app's link-reader, an unnamed
  // bot) generally doesn't. Missing it entirely — on a request that isn't
  // even a named bot — is our signal for "not a browser".
  const looksLikeNonBrowser = !isNamedBot && !request.headers.get('sec-fetch-mode');
  const isRealBrowser = !isNamedBot && !looksLikeNonBrowser;

  if (isRealBrowser) {
    const bypassSecret = process.env.PRERENDER_BYPASS_SECRET;
    const isPrerenderRequest = bypassSecret && request.headers.get('x-prerender-bypass') === bypassSecret;
    if (!isPrerenderRequest) {
      const cached = await fetchPrerendered(kindPath, isAr ? 'ar' : 'en', slugFromUrl);
      if (cached) {
        return new Response(cached, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            // short edge cache on top of the Blob CDN's own caching — an
            // admin edit's regenerate call overwrites the blob directly,
            // so this is just extra headroom, not the source of freshness
            'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
          }
        });
      }
    }
    return next(); // no cached snapshot yet (or this IS the snapshotter) — normal CSR shell, exactly as before
  }

  // AI bots and unidentified non-browser clients both get full article text
  // (the latter is exactly the case we're adding this for — a chat app
  // fetching the link wants the same real content a named AI crawler gets);
  // named preview bots (WhatsApp/Facebook/…) get the lean/fast title+meta path
  const richMode = AI_BOT_RE.test(ua) || looksLikeNonBrowser;

  const qs = new URLSearchParams({ mode: 'detail', kind: kindPath, slug: slugFromUrl, lang: isAr ? 'ar' : 'en', rich: richMode ? '1' : '0' });
  return rewrite(new URL(`/api/bot-render?${qs.toString()}`, url.origin));
}
