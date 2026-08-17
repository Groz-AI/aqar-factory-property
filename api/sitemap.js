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

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

async function fetchSlugs(table, select) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=${select}&published=eq.true`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows.filter(r => r && r.slug) : [];
  } catch (_) {
    return [];
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

module.exports = async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const SITE_URL = `https://${host}`;

  const [projects, units, posts] = await Promise.all([
    fetchSlugs('projects', 'slug,slug_ar,updated_at'),
    fetchSlugs('units', 'slug,slug_ar,updated_at'),
    fetchSlugs('blog_posts', 'slug,updated_at')
  ]);

  const staticPages = [
    { path: '/', priority: '1.0' },
    { path: '/projects.html', priority: '0.9' },
    { path: '/units.html', priority: '0.9' },
    { path: '/blog.html', priority: '0.8' },
    { path: '/about.html', priority: '0.6' },
    { path: '/contact.html', priority: '0.6' }
  ];

  const urls = [
    ...staticPages.flatMap(p => urlPair(SITE_URL, p.path, null, p.priority)),
    ...projects.flatMap(p => urlPairSlugged(SITE_URL, '/project', p.slug, p.slug_ar, (p.updated_at || '').slice(0, 10) || null, '0.8')),
    ...units.flatMap(u => urlPairSlugged(SITE_URL, '/unit', u.slug, u.slug_ar, (u.updated_at || '').slice(0, 10) || null, '0.75')),
    ...posts.flatMap(p => urlPair(SITE_URL, `/blog/${encodeURIComponent(stripSlashes(p.slug))}`, (p.updated_at || '').slice(0, 10) || null, '0.7'))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // no caching at any layer — every request re-queries Supabase directly
  // above, so an add/edit/delete/publish toggle in the admin must show up
  // here immediately, not after a stale copy expires
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.status(200).send(xml);
};
