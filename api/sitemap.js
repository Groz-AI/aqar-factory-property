/* ============================================================
   AQAR FACTORY — sitemap.xml (Vercel serverless function)
   ------------------------------------------------------------
   Served at /sitemap.xml via the rewrite in vercel.json. Lists
   the static pages plus every published project, unit and blog
   post, fetched live from Supabase (same public anon key already
   used in config.js) so it stays correct as content is added/
   removed in the admin panel, with no manual regeneration step.

   Every page is listed twice — once at its normal path and once
   under /ar/... (see the rewrite in vercel.json that serves the
   same file there) — with xhtml:link hreflang annotations tying
   the two together, so Google indexes the Arabic version as real,
   separate content instead of missing it entirely (it has no URL
   of its own otherwise, since the language switch used to be a
   client-only localStorage toggle).

   The site's own URL is derived from the incoming request's Host
   header rather than hardcoded, so this keeps working unchanged
   once a custom domain (e.g. aqar-factory.com) is pointed at this
   Vercel project — no code edit needed at migration time.
   ============================================================ */

const SchemaHelpers = require('../schema-helpers.js');

const SUPA_URL = 'https://api.aqar-factory.com';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84';

async function fetchSlugs(table, select, keyField = 'slug') {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=${select}&published=eq.true`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) throw new Error(table + ' ' + res.status);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(table + ' bad response');
    return rows.filter(r => r && r[keyField]);
  } catch (e) {
    // a failed read must NOT turn into an empty list: that would publish a
    // sitemap with the pages missing. The handler answers 503 instead, so
    // the search engine keeps the sitemap it already has and retries later.
    throw e;
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;');
// strip a stray leading/trailing slash defensively — a bad stored slug
// would otherwise put a broken double-slash URL directly into the sitemap
// Google reads (see store.js's buildUrl() for the fuller explanation)
const stripSlashes = (s) => String(s || '').replace(/^\/+|\/+$/g, '');

// emits the en/ar pair for one logical page, each cross-referencing the
// other via xhtml:link (the standard sitemap hreflang pattern)
function urlPair(SITE_URL, path, lastmod, priority) {
  const enUrl = SITE_URL + path;
  // avoid an unnecessary redirect hop for the homepage: "/ar" + "/" would be
  // "/ar/", which the site's trailingSlash:false config 308s to "/ar"
  const arUrl = SITE_URL + (path === '/' ? '/ar' : '/ar' + path);
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  const alt = (self) => `\n    <xhtml:link rel="alternate" hreflang="en" href="${esc(enUrl)}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${esc(arUrl)}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(enUrl)}"/>`;
  return [
    `  <url>\n    <loc>${esc(enUrl)}</loc>${alt()}${lastmodTag}\n    <priority>${priority}</priority>\n  </url>`,
    `  <url>\n    <loc>${esc(arUrl)}</loc>${alt()}${lastmodTag}\n    <priority>${priority}</priority>\n  </url>`
  ];
}

// same as urlPair(), but for project/unit detail pages the Arabic URL may
// use a DIFFERENT slug (an admin-set slug_ar) than the English one, so
// the en/ar hreflang pair must be built from two separate slugs instead of
// sharing one path. `base` is the clean-path prefix, e.g. "/project"
function urlPairSlugged(SITE_URL, base, enSlug, arSlug, lastmod, priority) {
  const enUrl = `${SITE_URL}${base}/${encodeURIComponent(stripSlashes(enSlug))}`;
  const arUrl = `${SITE_URL}/ar${base}/${encodeURIComponent(stripSlashes(arSlug) || stripSlashes(enSlug))}`;
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  const alt = () => `\n    <xhtml:link rel="alternate" hreflang="en" href="${esc(enUrl)}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${esc(arUrl)}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(enUrl)}"/>`;
  return [
    `  <url>\n    <loc>${esc(enUrl)}</loc>${alt()}${lastmodTag}\n    <priority>${priority}</priority>\n  </url>`,
    `  <url>\n    <loc>${esc(arUrl)}</loc>${alt()}${lastmodTag}\n    <priority>${priority}</priority>\n  </url>`
  ];
}

// sitemap entries for one city / developer landing page. A language is listed
// only if that version is complete; the hreflang pair is written only when
// both languages are listed (the incomplete one is marked noindex by landing.js)
function landingEntries(SITE_URL, kind, ent, projects, priority) {
  const n = SchemaHelpers.entityProjects(kind, ent, projects).length;
  const slug = encodeURIComponent(SchemaHelpers.entityUrlSlug(ent));
  const enOk = SchemaHelpers.landingIndexable(ent, n, false);
  const arOk = SchemaHelpers.landingIndexable(ent, n, true);
  const enUrl = `${SITE_URL}/${kind}/${slug}`;
  const arUrl = `${SITE_URL}/ar/${kind}/${slug}`;
  const alt = (enOk && arOk)
    ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${esc(enUrl)}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${esc(arUrl)}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(enUrl)}"/>`
    : '';
  const out = [];
  if (enOk) out.push(`  <url>\n    <loc>${esc(enUrl)}</loc>${alt}\n    <priority>${priority}</priority>\n  </url>`);
  if (arOk) out.push(`  <url>\n    <loc>${esc(arUrl)}</loc>${alt}\n    <priority>${priority}</priority>\n  </url>`);
  return out;
}

module.exports = async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const SITE_URL = `https://${host}`;

  let projects, units, posts, cityRows, devRows;
  try {
    [projects, units, posts, cityRows, devRows] = await Promise.all([
      fetchSlugs('projects', 'slug,slug_ar,updated_at,city,developer,city_id,developer_id'),
      fetchSlugs('units', 'slug,slug_ar,updated_at'),
      fetchSlugs('blog_posts', 'slug,updated_at'),
      fetchSlugs('cities', '*', 'name'),
      fetchSlugs('developers', '*', 'name')
    ]);
    // the site always has projects; an empty result means the read failed quietly
    if (!projects.length) throw new Error('no projects returned');
  } catch (_) {
    res.setHeader('Retry-After', '300');
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).send('Sitemap temporarily unavailable');
    return;
  }

  const staticPages = [
    { path: '/', priority: '1.0' },
    { path: '/projects.html', priority: '0.9' },
    { path: '/units.html', priority: '0.9' },
    { path: '/cities.html', priority: '0.8' },
    { path: '/blog.html', priority: '0.8' },
    { path: '/about.html', priority: '0.6' },
    { path: '/contact.html', priority: '0.6' }
  ];

  const urls = [
    ...staticPages.flatMap(p => urlPair(SITE_URL, p.path, null, p.priority)),
    ...projects.flatMap(p => urlPairSlugged(SITE_URL, '/project', p.slug, p.slug_ar, (p.updated_at || '').slice(0, 10) || null, '0.8')),
    ...units.flatMap(u => urlPairSlugged(SITE_URL, '/unit', u.slug, u.slug_ar, (u.updated_at || '').slice(0, 10) || null, '0.75')),
    // city / developer landing pages: only the language versions that are
    // complete (own text of 300+ characters and 3+ projects) are listed
    ...cityRows.flatMap(c => landingEntries(SITE_URL, 'city', c, projects, '0.7')),
    ...devRows.flatMap(d => landingEntries(SITE_URL, 'developer', d, projects, '0.6')),
    ...posts.flatMap(p => urlPair(SITE_URL, `/blog/${encodeURIComponent(stripSlashes(p.slug))}`, (p.updated_at || '').slice(0, 10) || null, '0.7'))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // search engines re-fetch this on their own schedule, often repeatedly —
  // serving a cached copy for a few minutes cuts that repeat-crawl egress
  // to near zero while an admin edit still shows up within minutes, not
  // instantly; the zero-cache version was querying all 3 tables in full on
  // every single hit, crawler or not
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800');
  res.status(200).send(xml);
};
