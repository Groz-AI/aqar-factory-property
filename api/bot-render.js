/* ============================================================
   AQAR FACTORY — bot-served content (Vercel serverless function)
   ------------------------------------------------------------
   middleware.js REWRITES every bot-like request for a detail page or
   one of the static/listing pages here — a rewrite, not a redirect, so
   the URL the bot/crawler sees never changes. All of the bot-vs-real-
   browser DECISION logic (User-Agent/Sec-Fetch-Mode checks, the
   hardcoded RENAMED old-slug map, the old ?id=/?slug= redirects) still
   lives entirely in middleware.js, completely unchanged — this file
   only builds the actual response for a request middleware has ALREADY
   decided is bot-like.

   WHY THIS IS A SEPARATE FUNCTION, NOT INLINE IN MIDDLEWARE: Vercel's
   CDN only ever caches a response produced by a real Function or a
   static asset — a Node.js Middleware Response is NEVER cached
   regardless of what Cache-Control header it sets. Confirmed live: two
   back-to-back identical bot requests when this logic lived directly
   in middleware.js each got a fresh `X-Vercel-Id` and zero
   `X-Vercel-Cache` header, while api/sitemap.js's identical setup (a
   plain Vercel Function) shows real `X-Vercel-Cache: HIT` with a
   growing `Age`. That meant every single bot/AI-crawler/preview-bot hit
   re-ran the full Supabase fetch (up to 5 REST calls for a richMode
   detail page) from scratch, no matter how many times the exact same
   URL had just been served — the s-maxage/stale-while-revalidate
   values in the Cache-Control headers below were pure decoration.
   Middleware rewriting to THIS file instead means the response Vercel
   actually caches is a genuine Function response, so a page N bots hit
   within its s-maxage window now costs ONE Supabase round-trip, not N.
   ============================================================ */

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// same "unsplash id vs. full URL" rule as data.js's window.U()
const img = (id, w = 1200) =>
  !id ? '' : /^https?:\/\//.test(id) ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// rich-text block `text` fields are trusted HTML (bold/italic/links from the
// block editor — see blocks-render.js) — strip tags down to plain text for
// a bot-readable body. No DOM available here, so this is a plain regex
// strip rather than project.js's detached-<div> trick.
const stripHtml = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const blocksToText = (blocks) => (Array.isArray(blocks) ? blocks : []).map(b => b && b.text ? stripHtml(b.text) : '').filter(Boolean).join(' ');

// preview bots (WhatsApp/Facebook/Twitter/…) only ever read title/description/
// image — fetching and regex-stripping the rich-text about/description
// blocks (which can be several thousand words of nested HTML) for those was
// pure wasted latency. AI-content bots still get the full row (select=*) so
// they can read the actual article/about text.
// slug_ar must be selected even in lean mode — the canonical-redirect check
// further down (HAS_SLUG_AR branch) reads row.slug_ar regardless of richMode,
// and its absence used to make every /ar/ preview-bot request (WhatsApp/
// Facebook/…) for a project/unit that HAS a distinct slug_ar silently redirect
// its own correct Arabic-slug URL onto the English slug under /ar/.
const LEAN_SELECT = {
  projects: 'slug,slug_ar,seo_title,seo_title_ar,seo_description,seo_description_ar,name,name_ar,tagline,cover,developer,location,city,category,status,price',
  units: 'slug,slug_ar,seo_title,seo_title_ar,seo_description,seo_description_ar,name,name_ar,description,description_ar,cover,type,price,beds,baths,area,location',
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

// mirrors fetchRelated()'s query shape above — the listing pages render
// every card entirely client-side, so bots need the same real <a> links
// injected server-side
async function fetchListingRows(table, extraSelect, limit = 60) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=${extraSelect}&published=eq.true&order=sort_order.asc&limit=${limit}`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch (_) {
    return [];
  }
}

// replaces everything INSIDE a <div id="X">...</div>, however deeply
// nested its current content is (the homepage's containers hold real
// nested markup — demo project cards, each with their own inner divs —
// not the flat empty <div id="X"></div> the other listing pages have, so
// a plain regex would grab the first nested </div> instead of the real
// closing tag). Depth-counts forward from the opening tag to find the
// TRUE matching close, then splices the replacement between them.
function replaceContainerContents(html, containerId, innerHtml) {
  const openMarker = `id="${containerId}"`;
  const idIdx = html.indexOf(openMarker);
  if (idIdx === -1) return html;
  const tagEnd = html.indexOf('>', idIdx);
  if (tagEnd === -1) return html;
  let depth = 1;
  let i = tagEnd + 1;
  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) return html; // malformed — leave untouched rather than corrupt it
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      i = nextClose + 6;
      if (depth === 0) {
        return html.slice(0, tagEnd + 1) + innerHtml + html.slice(nextClose);
      }
    }
  }
  return html;
}

// one entry per listing page: which table backs it, the id of the (empty,
// client-filled) container div in the static HTML to inject real <a> links
// into, and how to turn one DB row into a {slug, name, sub} triple for the
// current language — sub is just a one-line bit of real substance (price/
// location/excerpt) so this doesn't read as a bare, spammy link list
const detailHref = (kindPath) => (slug, ar) => `${ar ? '/ar' : ''}/${kindPath}/${encodeURIComponent(String(slug).replace(/^\/+|\/+$/g, ''))}`;
const LISTING_INJECT = {
  '/projects.html': [{
    table: 'projects', containerId: 'projectsGrid',
    select: 'slug,slug_ar,name,name_ar,tagline,location',
    href: detailHref('project'),
    row: (r, ar) => ({
      slug: (ar && r.slug_ar) || r.slug,
      name: (ar && r.name_ar) || r.name,
      sub: r.tagline || r.location || ''
    })
  }],
  '/units.html': [{
    table: 'units', containerId: 'unitsGrid',
    select: 'slug,slug_ar,name,name_ar,location,price',
    href: detailHref('unit'),
    row: (r, ar) => ({
      slug: (ar && r.slug_ar) || r.slug,
      name: (ar && r.name_ar) || r.name,
      sub: [r.location, r.price].filter(Boolean).join(' — ')
    })
  }],
  '/blog.html': [{
    table: 'blog_posts', containerId: 'blogGrid',
    select: 'slug,title,title_ar,excerpt,excerpt_ar',
    href: detailHref('blog'),
    // blog_posts has no slug_ar (HAS_SLUG_AR.blog_posts is false elsewhere
    // in this file too) — the AR page reuses the same EN slug
    row: (r, ar) => ({
      slug: r.slug,
      name: (ar && r.title_ar) || r.title,
      sub: (ar ? r.excerpt_ar : r.excerpt) || r.excerpt || ''
    })
  }],
  '/': [
    {
      table: 'projects', containerId: 'projectList', limit: 4,
      select: 'slug,slug_ar,name,name_ar,tagline,location',
      href: detailHref('project'),
      row: (r, ar) => ({
        slug: (ar && r.slug_ar) || r.slug,
        name: (ar && r.name_ar) || r.name,
        sub: r.tagline || r.location || ''
      })
    },
    {
      // links to the filtered listing, not a detail page — same URL
      // scheme as the real <a href> fix shipped for these cards
      // (script.js's renderCities())
      table: 'cities', containerId: 'cityGrid', limit: 20,
      select: 'name,country',
      href: (name, ar) => `${ar ? '/ar' : ''}/projects.html?city=${encodeURIComponent(name)}`,
      row: (r) => ({ slug: r.name, name: r.name, sub: r.country || '' })
    }
  ]
};

function pageHTML({ title, description, image, url, canonicalUrl, hreflangEn, hreflangAr, type, facts, bodyText, amenities, gallery, consultants, brochurePdf, related, projectUnits, isAr }) {
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
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}"><head>
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

function sendHtml(res, status, html, cacheControl) {
  res.status(status);
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (cacheControl) res.setHeader('cache-control', cacheControl);
  res.send(html);
}

function redirect301(res, location) {
  // a rewrite doesn't change the visible URL, but the FUNCTION we were
  // rewritten to can still answer with a real redirect — it reaches the
  // client exactly as if middleware had issued it directly. A short cache
  // is safe here (matches the previous inline behaviour) and cuts repeat
  // Supabase lookups for a URL a crawler keeps re-testing.
  res.status(301);
  res.setHeader('location', location);
  res.setHeader('cache-control', 'public, max-age=0, s-maxage=60');
  res.end();
}

async function handleStatic(req, res, params) {
  const page = params.get('page') || '/';
  const isAr = params.get('lang') === 'ar';
  const arPath = page === '/' ? '/ar' : '/ar' + page;
  const enUrl = `https://www.aqar-factory.com${page}`;
  const arUrl = `https://www.aqar-factory.com${arPath}`;

  try {
    // 'x-mw-static-fetch' tells middleware.js not to rewrite THIS request
    // back to this very function — without it, this self-fetch (missing
    // Sec-Fetch-Mode, since it's a server-to-server fetch) would look
    // bot-like to middleware and recurse.
    const staticRes = await fetch(`https://www.aqar-factory.com${page}`, { headers: { 'x-mw-static-fetch': '1' } });
    if (!staticRes.ok) {
      return sendHtml(res, staticRes.status, await staticRes.text().catch(() => ''), null);
    }
    let html = await staticRes.text();
    // every static page's source hardcodes <html lang="en">, corrected to
    // the real language only by i18n.js client-side — which never runs for
    // a bot reading this raw response
    if (isAr) html = html.replace('<html lang="en">', '<html lang="ar" dir="rtl">');

    for (const cfg of (LISTING_INJECT[page] || [])) {
      const rows = await fetchListingRows(cfg.table, cfg.select, cfg.limit || 60);
      const items = rows.map(r => cfg.row(r, isAr)).filter(x => x.slug && x.name);
      const listHtml = `<ul>${items.map(x =>
        `<li><a href="${esc(cfg.href(x.slug, isAr))}">${esc(x.name)}</a>${x.sub ? ' — ' + esc(x.sub) : ''}</li>`
      ).join('')}</ul>`;
      html = replaceContainerContents(html, cfg.containerId, listHtml);
    }

    // self-canonical, stripped of any query string (city/cat filters on
    // projects.html/units.html are 100% client-side — this bot-served
    // response is byte-identical no matter what's in the query string)
    const canonicalTag = `<link rel="canonical" href="${esc(isAr ? arUrl : enUrl)}">\n`;
    const tags = `${canonicalTag}<link rel="alternate" hreflang="en" href="${esc(enUrl)}">\n<link rel="alternate" hreflang="ar" href="${esc(arUrl)}">\n<link rel="alternate" hreflang="x-default" href="${esc(enUrl)}">\n</head>`;
    sendHtml(res, 200, html.replace('</head>', tags), 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800');
  } catch (_) {
    // best-effort: never answer a bot with a hard error over a caching
    // refactor — fetch and hand back the plain static file unmodified
    try {
      const fallback = await fetch(`https://www.aqar-factory.com${page}`, { headers: { 'x-mw-static-fetch': '1' } });
      sendHtml(res, 200, await fallback.text(), null);
    } catch (__) {
      sendHtml(res, 502, '<!DOCTYPE html><title>Aqar Factory</title>', null);
    }
  }
}

async function handleDetail(req, res, params) {
  const kindPath = params.get('kind'); // 'project' | 'unit' | 'blog'
  const slugFromUrl = params.get('slug') || '';
  const isAr = params.get('lang') === 'ar';
  const richMode = params.get('rich') === '1';

  const table = kindPath === 'unit' ? 'units' : kindPath === 'blog' ? 'blog_posts' : 'projects';

  const row = await fetchRow(table, slugFromUrl, richMode);
  // couldn't reach Supabase — this function only exists to build cacheable
  // bot content, so on a genuine outage the safest answer is a short-lived
  // 404 rather than guessing; Google retries a 5xx-adjacent state on its
  // own schedule without deindexing, same intent as the original design
  if (row === LOOKUP_FAILED) {
    return sendHtml(res, 503, '<!DOCTYPE html><title>Aqar Factory</title><p>Temporarily unavailable.</p>', 'public, max-age=0, s-maxage=10');
  }
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
        return redirect301(res, `${isAr ? '/ar' : ''}/${kindPath}/${encodeURIComponent(alt)}`);
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
        return redirect301(res, `${isAr ? '/ar' : ''}/${kindPath}/${encodeURIComponent(newSlug)}`);
      }
    }

    // No such published row. Falling through to the CSR template here would
    // answer a crawler with HTTP 200 and an empty generic page — a soft 404,
    // which Google keeps in its index and reports as an error rather than
    // dropping cleanly. Answer with a real 404 instead.
    return sendHtml(res, 404,
      `<!DOCTYPE html><html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Not found — Aqar Factory</title>` +
      `<meta name="robots" content="noindex"></head><body><h1>Not found</h1>` +
      `<p>This page is no longer available. <a href="https://www.aqar-factory.com${isAr ? '/ar' : ''}/">Go to Aqar Factory</a></p>` +
      `</body></html>`,
      'public, max-age=0, s-maxage=60');
  }

  // fetchRow() matches slug OR slug_ar on purpose — a project with NO custom
  // Arabic slug must still resolve under /ar/ via its one shared slug. But
  // that same OR-match means a project that DOES have a distinct slug_ar was
  // ALSO reachable via its English slug under /ar/, and via its Arabic slug
  // under the plain English path — two accidental duplicates of the correct
  // page, each self-declaring its own (wrong) canonical. Redirect either
  // accidental combination onto whichever URL is actually correct for the
  // requested language before anything else gets built.
  if (HAS_SLUG_AR[table]) {
    const properSlug = String((isAr && row.slug_ar) ? row.slug_ar : row.slug).replace(/^\/+|\/+$/g, '');
    if (properSlug && properSlug !== slugFromUrl) {
      return redirect301(res, `${isAr ? '/ar' : ''}/${kindPath}/${encodeURIComponent(properSlug)}`);
    }
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
  // ?id=/?slug= URLs already 301-redirected before reaching this code)
  const canonicalUrl = `https://www.aqar-factory.com${isAr ? '/ar' : ''}/${kindPath}/${encodeURIComponent(slugFromUrl)}`;

  // hreflang alternates — mirrors i18n.js's injectSeoLinks()/setCrossLangSlug(),
  // which only ever runs client-side after the page loads.
  const rawSlug = String(row.slug || '').replace(/^\/+|\/+$/g, '');
  const rawSlugAr = (HAS_SLUG_AR[table] && row.slug_ar) ? String(row.slug_ar).replace(/^\/+|\/+$/g, '') : rawSlug;
  const hreflangEn = `https://www.aqar-factory.com/${kindPath}/${encodeURIComponent(rawSlug)}`;
  const hreflangAr = `https://www.aqar-factory.com/ar/${kindPath}/${encodeURIComponent(rawSlugAr)}`;

  const html = pageHTML({
    title, description, image, facts, bodyText, amenities, gallery, consultants, brochurePdf, related, projectUnits,
    url: canonicalUrl, canonicalUrl, hreflangEn, hreflangAr, isAr,
    type: table === 'blog_posts' ? 'article' : 'website'
  });

  // fresh for 30s at the edge, then serve last-known copy instantly while
  // quietly refetching in the background — an edit shows up on the very
  // next fetch after that 30s window, but repeat hits (crawlers, WhatsApp,
  // testing tools) inside it are now a real CDN cache hit, not a fresh
  // Supabase round-trip
  sendHtml(res, 200, html, 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
}

module.exports = async function handler(req, res) {
  const params = new URL(req.url, 'https://internal').searchParams;
  const mode = params.get('mode');
  if (mode === 'static') return handleStatic(req, res, params);
  if (mode === 'detail') return handleDetail(req, res, params);
  res.status(400).json({ error: 'bad_mode' });
};
