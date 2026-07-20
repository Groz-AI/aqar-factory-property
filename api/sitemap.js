/* ============================================================
   AQAR FACTORY — sitemap.xml (Vercel serverless function)
   ------------------------------------------------------------
   Served at /sitemap.xml via the rewrite in vercel.json. Lists
   the static pages plus every published project and blog post,
   fetched live from Supabase (same public anon key already used
   in config.js) so it stays correct as content is added/removed
   in the admin panel, with no manual regeneration step.

   The site's own URL is derived from the incoming request's Host
   header rather than hardcoded, so this keeps working unchanged
   once a custom domain (e.g. aqar-factory.com) is pointed at this
   Vercel project — no code edit needed at migration time.
   ============================================================ */

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

async function fetchSlugs(table) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=slug,updated_at&published=eq.true`,
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

function urlEntry(loc, lastmod, priority) {
  return `  <url>\n    <loc>${esc(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <priority>${priority}</priority>\n  </url>`;
}

module.exports = async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const SITE_URL = `https://${host}`;

  const [projects, posts] = await Promise.all([fetchSlugs('projects'), fetchSlugs('blog_posts')]);

  const staticPages = [
    { path: '/', priority: '1.0' },
    { path: '/projects.html', priority: '0.9' },
    { path: '/blog.html', priority: '0.8' },
    { path: '/about.html', priority: '0.6' },
    { path: '/contact.html', priority: '0.6' }
  ];

  const urls = [
    ...staticPages.map(p => urlEntry(SITE_URL + p.path, null, p.priority)),
    ...projects.map(p => urlEntry(`${SITE_URL}/project.html?id=${encodeURIComponent(p.slug)}`, (p.updated_at || '').slice(0, 10) || null, '0.8')),
    ...posts.map(p => urlEntry(`${SITE_URL}/blog-post.html?slug=${encodeURIComponent(p.slug)}`, (p.updated_at || '').slice(0, 10) || null, '0.7'))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(xml);
};
