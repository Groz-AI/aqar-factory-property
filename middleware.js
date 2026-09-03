/* ============================================================
   AQAR FACTORY — bot-only content prerender (Vercel Edge Middleware)
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
   entirely (see group 4 above). Fetch the item straight from
   Supabase here (runs on Vercel's edge, before any static file is
   served), and return an HTML document with the correct <title>,
   meta description, Open Graph/Twitter tags, AND the actual readable
   content as plain text/HTML in the body. Every real browser request
   (Sec-Fetch-Mode always present) is untouched and gets the normal
   site exactly as before.

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

import { get } from '@vercel/blob';
// on the Node.js Middleware runtime (unlike the Edge default), a bare
// `return;`/`return undefined` does NOT reliably fall through to normal
// request handling — verified live: it served an empty 200 body instead of
// the real page. `next()` is the documented, explicit "continue the chain"
// signal for non-Next.js frameworks on this runtime.
import { next } from '@vercel/functions';

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

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

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

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// same "unsplash id vs. full URL" rule as data.js's window.U()
const img = (id, w = 1200) =>
  !id ? '' : /^https?:\/\//.test(id) ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// rich-text block `text` fields are trusted HTML (bold/italic/links from the
// block editor — see blocks-render.js) — strip tags down to plain text for
// a bot-readable body. No DOM available in the edge runtime, so this is a
// plain regex strip rather than project.js's detached-<div> trick.
const stripHtml = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const blocksToText = (blocks) => (Array.isArray(blocks) ? blocks : []).map(b => b && b.text ? stripHtml(b.text) : '').filter(Boolean).join(' ');

// preview bots (WhatsApp/Facebook/Twitter/…) only ever read title/description/
// image — fetching and regex-stripping the rich-text about/description
// blocks (which can be several thousand words of nested HTML) for those was
// pure wasted latency. AI-content bots still get the full row (select=*) so
// they can read the actual article/about text.
const LEAN_SELECT = {
  projects: 'slug,seo_title,seo_title_ar,seo_description,seo_description_ar,name,name_ar,tagline,cover,developer,location,city,category,status,price',
  units: 'slug,seo_title,seo_title_ar,seo_description,seo_description_ar,name,name_ar,description,description_ar,cover,type,price,beds,baths,area,location',
  blog_posts: 'slug,seo_title,seo_title_ar,seo_description,seo_description_ar,title,title_ar,excerpt,excerpt_ar,cover,author_name'
};

// projects/units can have a custom Arabic slug (slug_ar) used on /ar/ URLs
// instead of the default slug — match either column so a shared /ar/ link
// using the Arabic slug isn't silently missed
const HAS_SLUG_AR = { projects: true, units: true, blog_posts: false };

// Returns the row, or null when the query succeeded and the item genuinely
// isn't there, or LOOKUP_FAILED when we couldn't ask at all. Those last two
// used to be indistinguishable, which is fine when both just fall through to
// the client-rendered page — but the caller now answers "not there" with a
// real 404, and a Supabase hiccup must never be allowed to 404 (and so
// deindex) a page that actually exists.
const LOOKUP_FAILED = Symbol('lookup_failed');

async function fetchRow(table, slug, rich) {
  try {
    const select = rich ? '*' : LEAN_SELECT[table];
    const filter = HAS_SLUG_AR[table]
      ? `or=(slug.eq.${encodeURIComponent(slug)},slug_ar.eq.${encodeURIComponent(slug)})`
      : `slug=eq.${encodeURIComponent(slug)}`;
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=${select}&${filter}&published=eq.true&limit=1`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return LOOKUP_FAILED;
    const rows = await res.json();
    return rows[0] || null;
  } catch (_) {
    return LOOKUP_FAILED;
  }
}

async function fetchById(table, id, select) {
  if (!id) return null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch (_) {
    return null;
  }
}

// admin.js records a project/unit/post's PREVIOUS slug here every time one
// is renamed (see its recordSlugRename()) — this is how an already-indexed
// URL keeps resolving after the admin edits it, without needing a manual
// hardcoded redirect added for every rename
async function fetchRenamedRowId(table, oldSlug) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/slug_redirects?select=row_id&table_name=eq.${table}&old_slug=eq.${encodeURIComponent(oldSlug)}&limit=1`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] ? rows[0].row_id : null;
  } catch (_) {
    return null;
  }
}

// "more from the same developer" — mirrors renderDeveloperPicks() in
// project.js/unit.js, so richMode fetchers see the same recommendations a
// real visitor would scroll down to
async function fetchRelated(table, devId, devName, excludeSlug, limit = 6) {
  if (!devId && !devName) return [];
  try {
    const filter = devId ? `developer_id=eq.${encodeURIComponent(devId)}` : `developer=eq.${encodeURIComponent(devName)}`;
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=slug,slug_ar,name,name_ar&${filter}&published=eq.true&limit=${limit}`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.filter(r => r.slug !== excludeSlug);
  } catch (_) {
    return [];
  }
}

// units-specific version of fetchRelated: a unit frequently has no
// developer_id/developer of its own, inheriting it only via its linked
// project (see the "Part of project" fallback above) — and the SAME is true
// of sibling units, so a plain units.developer_id=eq.X filter misses them.
// Mirrors unit.js's renderDeveloperPicks(), which checks each candidate
// unit's own developer OR its linked project's developer.
async function fetchRelatedUnits(devId, devName, excludeSlug, limit = 6) {
  if (!devId && !devName) return [];
  try {
    const devFilter = devId ? `developer_id=eq.${encodeURIComponent(devId)}` : `developer=eq.${encodeURIComponent(devName)}`;
    const projRes = await fetch(
      `${SUPA_URL}/rest/v1/projects?select=id&${devFilter}&published=eq.true`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    const projIds = projRes.ok ? (await projRes.json()).map(p => p.id) : [];

    const unitDevFilter = devId ? `developer_id.eq.${encodeURIComponent(devId)}` : `developer.eq.${encodeURIComponent(devName)}`;
    const orParts = [unitDevFilter];
    if (projIds.length) orParts.push(`project_id.in.(${projIds.join(',')})`);
    const res = await fetch(
      `${SUPA_URL}/rest/v1/units?select=slug,slug_ar,name,name_ar&or=(${orParts.join(',')})&published=eq.true&limit=${limit}`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.filter(r => r.slug !== excludeSlug);
  } catch (_) {
    return [];
  }
}

// units directly assigned to a project via the unit's own "Linked project"
// picker in the admin — mirrors renderProjectUnits() in project.js
async function fetchUnitsForProject(projectId, limit = 12) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/units?select=slug,slug_ar,name,name_ar&project_id=eq.${encodeURIComponent(projectId)}&published=eq.true&limit=${limit}`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch (_) {
    return [];
  }
}

// looks up a real-visitor pre-rendered snapshot written by api/prerender.js —
// key format must match blobKey() there exactly
async function fetchPrerendered(kindPath, lang, slugForUrl) {
  try {
    const blob = await get(`prerendered/${lang}/${kindPath}/${slugForUrl}.html`, { access: 'private' });
    if (!blob) return null;
    return await streamToText(blob.stream);
  } catch (_) {
    return null;
  }
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

function pageHTML({ title, description, image, url, canonicalUrl, hreflangEn, hreflangAr, type, facts, bodyText, amenities, gallery, consultants, brochurePdf, related, projectUnits }) {
  const factsList = facts.length
    ? `<h2>Key facts</h2><ul>${facts.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}</ul>` : '';
  const amenitiesList = (amenities && amenities.length)
    ? `<h2>Amenities</h2><ul>${amenities.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : '';
  const consultantsList = (consultants && consultants.length)
    ? `<h2>Consultants</h2><ul>${consultants.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : '';
  const brochureLink = brochurePdf ? `<p><a href="${esc(brochurePdf)}">Brochure (PDF)</a></p>` : '';
  const galleryHtml = (gallery && gallery.length)
    ? `<h2>Gallery (${gallery.length} photos)</h2>` + gallery.map((g, i) => `<img src="${esc(g)}" alt="photo ${i + 1}">`).join('')
    : '';
  const projectUnitsHtml = (projectUnits && projectUnits.length)
    ? `<h2>Units in this project</h2><ul>${projectUnits.map(r => `<li><a href="${esc(r.url)}">${esc(r.name)}</a></li>`).join('')}</ul>`
    : '';
  const relatedHtml = (related && related.length)
    ? `<h2>Related, from the same developer</h2><ul>${related.map(r => `<li><a href="${esc(r.url)}">${esc(r.name)}</a></li>`).join('')}</ul>`
    : '';
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonicalUrl)}">
<link rel="alternate" hreflang="en" href="${esc(hreflangEn)}">
<link rel="alternate" hreflang="ar" href="${esc(hreflangAr)}">
<link rel="alternate" hreflang="x-default" href="${esc(hreflangEn)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Aqar Factory">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
</head><body>
<h1>${esc(title)}</h1>
${image ? `<img src="${esc(image)}" alt="${esc(title)}">` : ''}
<p>${esc(bodyText)}</p>
${factsList}
${amenitiesList}
${brochureLink}
${consultantsList}
${galleryHtml}
${projectUnitsHtml}
${relatedHtml}
<p><a href="${esc(url)}">${esc(url)}</a></p>
</body></html>`;
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
  // the header below is this function's OWN internal re-fetch of the static
  // file, not a real request — without checking for it first, that re-fetch
  // would come back through this same matcher and recurse forever
  if (request.headers.get('x-mw-static-fetch') !== '1' && STATIC_HREFLANG_PAGES.has(staticEnPath)) {
    const uaStatic = request.headers.get('user-agent') || '';
    const isNamedBotStatic = BOT_RE.test(uaStatic);
    const looksLikeNonBrowserStatic = !isNamedBotStatic && !request.headers.get('sec-fetch-mode');
    if (isNamedBotStatic || looksLikeNonBrowserStatic) {
      const arPath = staticEnPath === '/' ? '/ar' : '/ar' + staticEnPath;
      const enUrl = `https://www.aqar-factory.com${staticEnPath}`;
      const arUrl = `https://www.aqar-factory.com${arPath}`;
      try {
        const staticRes = await fetch(url.toString(), { headers: { 'x-mw-static-fetch': '1' } });
        if (staticRes.ok) {
          const html = await staticRes.text();
          const tags = `<link rel="alternate" hreflang="en" href="${esc(enUrl)}">\n<link rel="alternate" hreflang="ar" href="${esc(arUrl)}">\n<link rel="alternate" hreflang="x-default" href="${esc(enUrl)}">\n</head>`;
          return new Response(html.replace('</head>', tags), {
            headers: {
              'content-type': 'text/html; charset=utf-8',
              'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800'
            }
          });
        }
      } catch (_) { /* fall through to next() below on any fetch failure */ }
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
  // by the bot-content generation further down
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
  // to the real 404 further down.
  const RENAMED = {
    // wrong kind: these slugs belong to a project, not a unit
    'unit/salt-marina-in-ras-el-hekma': '/project/salt-marina-in-ras-el-hekma',
    'unit/river-park-residence-new-obour': '/project/river-park-residence-new-obour',
    'unit/mirissa-new-obour-compound': '/project/mirissa-new-obour-compound',
    // renamed slugs — kept as a hardcoded backstop for URLs that went stale
    // BEFORE slug_redirects existed (see fetchRenamedRowId() below, which
    // now records and follows every rename automatically going forward, so
    // this map shouldn't need new entries added by hand again)
    'project/citalia-compound-valero-new-obour': '/project/citalia-compound-valero-new-obour-city',
    // aljarbritishdistrictyorkphase was itself already a fixed-forward
    // target that has since been renamed AGAIN — proof this exact class of
    // bug recurs, and the reason slug_redirects exists now instead of
    // another one-off entry
    'project/aljar_british_district_york_phase': '/project/aljar-british-district-el-shorouk-compound-york',
    // a third slug variant for the same project, found via a "different
    // canonical" export — Google had this crawled and indexed directly
    // (not via a redirect), so it isn't simply the underscored form above
    'project/aljarbritishdistrictyorkphase': '/project/aljar-british-district-el-shorouk-compound-york',
    'project/r_five_new_capital': '/project/rfivenewcapital',
    'project/lagonza-residence-santorini-coastal-living-in-obour': '/project/lagonza-residence-compound-el-obour-city',
    // found via a live GSC "Discovered - not indexed" export
    'project/كمبوند-الجار-الشروق-مرحلة-يورك-البريطانية-Aljar-York-Phase': '/project/aljar-british-district-el-shorouk-compound-york',
    'project/مول-اربكو-ساوث-90th-Street-أبو-الهول-التجمع-الخامس-محلات-ومكاتب-بالتقسيط-علي-الشارع-التسعين-Arabco-South-90th-Street-Mall-New-Landmark': '/project/jeel-plaza-arabco-new-cairo-mall',
    // renamed before slug_redirects existed; predates the tracking system
    // (confirmed via a direct query — this row has no slug_redirects entry,
    // unlike renames that happened after today's deploy, which the table
    // already caught automatically on their own)
    'project/apartments-for-sale-jazeel-residence-new-obour': '/project/jazeel-residence-compound-new-obour-city'
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

  const table = kindPath === 'unit' ? 'units' : kindPath === 'blog' ? 'blog_posts' : 'projects';
  const id = slugFromUrl;

  const row = await fetchRow(table, id, richMode);
  // couldn't reach Supabase — fall through to the client-rendered page (which
  // retries the fetch itself) rather than claiming the page doesn't exist
  if (row === LOOKUP_FAILED) return next();
  if (!row) {
    // Before giving up: an Arabic slug typed with spaces used to be stored
    // verbatim, so the same page can be addressed as "…داون تاون" (spaces,
    // which only ever works percent-encoded) or "…داون-تاون" (dashes, the form
    // everyone actually expects and links to). Try the other form and 301 onto
    // whichever one really exists, so a slug being tidied up in the admin can
    // never strand the URL Google already indexed — in either direction.
    const alt = /\s/.test(slugFromUrl) ? slugFromUrl.replace(/\s+/g, '-')
              : slugFromUrl.includes('-') ? slugFromUrl.replace(/-+/g, ' ')
              : null;
    if (alt) {
      const altRow = await fetchRow(table, alt, false);
      if (altRow && altRow !== LOOKUP_FAILED) {
        return Response.redirect(
          new URL(`${isAr ? '/ar' : ''}/${kindPath}/${encodeURIComponent(alt)}`, url.origin), 301);
      }
    }
    // The row this slug used to point at may have been renamed since Google
    // indexed it — look up its stable id and redirect to whatever slug it
    // answers to NOW, so a project renamed twice still resolves through
    // both of its old URLs, not just the first one anyone happened to fix.
    const renamedRowId = await fetchRenamedRowId(table, slugFromUrl);
    if (renamedRowId) {
      const currentRow = await fetchById(table, renamedRowId, 'slug,slug_ar');
      const newSlug = currentRow && ((isAr && currentRow.slug_ar) ? currentRow.slug_ar : currentRow.slug);
      if (newSlug) {
        return Response.redirect(
          new URL(`${isAr ? '/ar' : ''}/${kindPath}/${encodeURIComponent(newSlug)}`, url.origin), 301);
      }
    }

    // No such published row. Falling through to the CSR template here would
    // answer a crawler with HTTP 200 and an empty generic page — a soft 404,
    // which Google keeps in its index and reports as an error rather than
    // dropping cleanly. Answer with a real 404 instead: unambiguous, and it
    // retires stale URLs (deleted/unpublished items, slugs renamed without a
    // RENAMED entry above) by itself, with no per-URL maintenance.
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not found — Aqar Factory</title>` +
      `<meta name="robots" content="noindex"></head><body><h1>Not found</h1>` +
      `<p>This page is no longer available. <a href="https://www.aqar-factory.com${isAr ? '/ar' : ''}/">Go to Aqar Factory</a></p>` +
      `</body></html>`,
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60' } }
    );
  }

  const pick = (en, ar) => (isAr && row[ar]) ? row[ar] : row[en];
  const linkUrl = (slug, slugAr, otherTable) => {
    const p = otherTable === 'units' ? '/unit/' : otherTable === 'blog_posts' ? '/blog/' : '/project/';
    // strip a stray leading/trailing slash defensively — see store.js's
    // buildUrl() for the full explanation (a bad stored slug otherwise
    // produces a double-slash URL that 404s for everyone)
    const s = String((isAr && slugAr) ? slugAr : slug).replace(/^\/+|\/+$/g, '');
    return `https://www.aqar-factory.com${isAr ? '/ar' : ''}${p}${encodeURIComponent(s)}`;
  };

  let title, description, image, facts = [], bodyText = '';
  let amenities = [], gallery = [], consultants = [], brochurePdf = '', related = [], projectUnits = [];
  if (table === 'blog_posts') {
    title = pick('seo_title', 'seo_title_ar') || pick('title', 'title_ar');
    description = pick('seo_description', 'seo_description_ar') || pick('excerpt', 'excerpt_ar');
    image = img(row.cover, 1200);
    if (row.author_name) facts.push([isAr ? 'الكاتب' : 'Author', row.author_name]);
    if (row.published_at) facts.push([isAr ? 'تاريخ النشر' : 'Published', row.published_at]);
    const tags = pick('tags', 'tags_ar') || row.tags;
    if (tags && tags.length) facts.push([isAr ? 'الوسوم' : 'Tags', tags.join(', ')]);
    bodyText = richMode ? description + ' ' + blocksToText(pick('blocks', 'blocks_ar')) : description;
  } else if (table === 'projects') {
    const name = pick('name', 'name_ar') || row.name;
    const customTitle = pick('seo_title', 'seo_title_ar');
    title = customTitle || `${name} — Aqar Factory`;
    description = pick('seo_description', 'seo_description_ar') || row.tagline
      || (richMode ? blocksToText(pick('about_blocks', 'about_blocks_ar')) || (row.about && row.about[0]) : '') || '';
    image = img(row.cover, 1200);
    if (row.developer) facts.push([isAr ? 'المطوّر' : 'Developer', row.developer]);
    if (row.location) facts.push([isAr ? 'الموقع' : 'Location', row.location]);
    if (row.city) facts.push([isAr ? 'المدينة' : 'City', row.city]);
    if (row.country) facts.push([isAr ? 'الدولة' : 'Country', row.country]);
    if (row.category) facts.push([isAr ? 'الفئة' : 'Category', row.category]);
    if (row.status) facts.push([isAr ? 'الحالة' : 'Status', row.status]);
    if (row.year) facts.push([isAr ? 'السنة' : 'Year', row.year]);
    if (row.price) facts.push([isAr ? 'السعر' : 'Price', row.price]);
    if (row.units) facts.push([isAr ? 'عدد الوحدات' : 'Units', row.units]);
    if (row.floors) facts.push([isAr ? 'الطوابق' : 'Floors', row.floors]);
    if (row.area) facts.push([isAr ? 'مساحة الوحدة' : 'Unit size', row.area]);
    if (row.handover) facts.push([isAr ? 'التسليم' : 'Handover', row.handover]);
    if (row.is_rental) facts.push([isAr ? 'إيجار' : 'Rental', isAr ? 'نعم' : 'Yes']);
    if (Array.isArray(row.unit_types) && row.unit_types.length) facts.push([isAr ? 'أنواع الوحدات' : 'Unit types', row.unit_types.join(', ')]);
    bodyText = richMode ? (description + ' ' + blocksToText(pick('about_blocks', 'about_blocks_ar'))).trim() : description;
    if (richMode) {
      amenities = row.amenities || [];
      gallery = (row.gallery || []).map(g => img(g, 800));
      consultants = (Array.isArray(row.consultants) ? row.consultants : []).map(c => c && c.name).filter(Boolean);
      brochurePdf = row.brochure_pdf || '';
      const [relProjects, relUnits, ownUnits] = await Promise.all([
        fetchRelated('projects', row.developer_id, row.developer, row.slug),
        fetchRelatedUnits(row.developer_id, row.developer, null),
        fetchUnitsForProject(row.id)
      ]);
      related = [
        ...relProjects.map(r => ({ name: (isAr && r.name_ar) || r.name, url: linkUrl(r.slug, r.slug_ar, 'projects') })),
        ...relUnits.map(r => ({ name: (isAr && r.name_ar) || r.name, url: linkUrl(r.slug, r.slug_ar, 'units') }))
      ];
      projectUnits = ownUnits.map(r => ({ name: (isAr && r.name_ar) || r.name, url: linkUrl(r.slug, r.slug_ar, 'units') }));
    }
  } else {
    const name = pick('name', 'name_ar') || row.name;
    const customTitle = pick('seo_title', 'seo_title_ar');
    title = customTitle || `${name} — Aqar Factory`;
    description = pick('seo_description', 'seo_description_ar')
      || (richMode ? blocksToText(pick('description_blocks', 'description_blocks_ar')) : '')
      || pick('description', 'description_ar') || '';
    image = img(row.cover, 1200);
    // a unit doesn't always carry its own developer — many are only linked via
    // project_id, with the developer set on the parent project instead (see
    // richMode block below, which fetches the linked project and fills these in)
    let devId = row.developer_id, devName = row.developer;
    if (row.type) facts.push([isAr ? 'النوع' : 'Type', row.type]);
    if (row.badge) facts.push([isAr ? 'الوسم' : 'Badge', row.badge]);
    if (row.price) facts.push([isAr ? 'السعر' : 'Price', row.price]);
    if (row.beds) facts.push([isAr ? 'غرف النوم' : 'Bedrooms', row.beds]);
    if (row.baths) facts.push([isAr ? 'دورات المياه' : 'Bathrooms', row.baths]);
    if (row.area) facts.push([isAr ? 'المساحة' : 'Area', row.area]);
    if (row.location) facts.push([isAr ? 'الموقع' : 'Location', row.location]);
    bodyText = richMode ? (description + ' ' + blocksToText(pick('description_blocks', 'description_blocks_ar'))).trim() : description;
    if (richMode) {
      gallery = (row.gallery || []).map(g => img(g, 800));
      if (row.project_id) {
        const proj = await fetchById('projects', row.project_id, 'slug,slug_ar,name,name_ar,developer,developer_id');
        if (proj) {
          facts.unshift([isAr ? 'جزء من مشروع' : 'Part of project', (isAr && proj.name_ar) || proj.name]);
          if (!devId && !devName) { devId = proj.developer_id; devName = proj.developer; }
        }
      }
      const relUnits = await fetchRelatedUnits(devId, devName, row.slug);
      related = relUnits.map(r => ({ name: (isAr && r.name_ar) || r.name, url: linkUrl(r.slug, r.slug_ar, 'units') }));
    }
    if (devName) facts.unshift([isAr ? 'المطوّر' : 'Developer', devName]);
  }
  description = String(description || '').trim();
  bodyText = String(bodyText || '').trim();
  if (!description) description = table === 'projects'
    ? 'Aqar Factory project detail — gallery, key facts, amenities and location.'
    : table === 'units' ? 'Aqar Factory unit detail — gallery, price, specs and location.'
    : 'Aqar Factory blog — market insight, buying guides and stories from our team.';
  if (!bodyText) bodyText = description;

  // the exact clean-path URL that was requested IS the canonical form (old
  // ?id=/?slug= URLs already 301-redirected before reaching this code) —
  // built explicitly rather than reusing the raw request URL so it's never
  // polluted by an incidental query string
  const canonicalUrl = `https://www.aqar-factory.com${isAr ? '/ar' : ''}/${kindPath}/${encodeURIComponent(slugFromUrl)}`;

  // hreflang alternates — mirrors i18n.js's injectSeoLinks()/setCrossLangSlug(),
  // which only ever runs client-side after the page loads. Googlebot's own
  // rendering is Chromium-based and sends Sec-Fetch-Mode like a real browser,
  // so without this it was reaching this exact bot-served response (built
  // for the raw first crawl pass specifically to avoid depending on any
  // client-side JS) and STILL seeing zero hreflang tags — the canonical was
  // fixed here already, this relationship signal was not. Without it Google
  // has no way to know the /ar/ and non-/ar/ URLs are the same content in
  // two languages rather than unrelated (or duplicate) pages, which plausibly
  // contributes to it picking its own canonical over ours for some of them.
  const rawSlug = String(row.slug || '').replace(/^\/+|\/+$/g, '');
  const rawSlugAr = (HAS_SLUG_AR[table] && row.slug_ar) ? String(row.slug_ar).replace(/^\/+|\/+$/g, '') : rawSlug;
  const hreflangEn = `https://www.aqar-factory.com/${kindPath}/${encodeURIComponent(rawSlug)}`;
  const hreflangAr = `https://www.aqar-factory.com/ar/${kindPath}/${encodeURIComponent(rawSlugAr)}`;

  const html = pageHTML({
    title, description, image, facts, bodyText, amenities, gallery, consultants, brochurePdf, related, projectUnits,
    url: url.toString(), canonicalUrl, hreflangEn, hreflangAr,
    type: table === 'blog_posts' ? 'article' : 'website'
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // fresh for 30s at the edge, then serve last-known copy instantly
      // while quietly refetching in the background — an edit shows up on
      // the very next fetch after that 30s window, but repeat/retry fetches
      // (WhatsApp, testing tools) are near-instant instead of round-tripping
      // to Supabase every single time
      'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120'
    }
  });
}
