/* ============================================================
   AQAR FACTORY — bot-only meta prerender (Vercel Edge Middleware)
   ------------------------------------------------------------
   WHY THIS EXISTS: project.html/unit.html/blog-post.html are 100%
   client-rendered — the real per-item <title>/<meta description>
   only get written in by project.js/unit.js/blog-post.js AFTER the
   page loads and fetches from Supabase. Google's indexer runs that
   JS before reading the page, so it sees the correct SEO title —
   already verified live. Link-unfurl bots (WhatsApp, Facebook,
   Twitter/X, LinkedIn, Telegram, Slack, Discord…) do NOT run
   JavaScript at all: they fetch the raw HTML file and stop, so they
   only ever see the generic placeholder baked into the static file
   ("Project — Aqar Factory" / the generic fallback description).
   That's the exact bug reported: a WhatsApp share card showing the
   placeholder instead of the project's real SEO title.

   FIX: intercept ONLY requests whose User-Agent matches a known
   link-unfurl bot, fetch the item straight from Supabase here (this
   runs on Vercel's edge, before any static file is served), and
   return a small HTML document with the correct <title>, meta
   description and Open Graph tags. Every other visitor (real users,
   Googlebot, everything else) is untouched and gets the normal site.
   ============================================================ */

export const config = {
  matcher: [
    '/project.html', '/unit.html', '/blog-post.html',
    '/ar/project.html', '/ar/unit.html', '/ar/blog-post.html'
  ]
};

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

// bots that fetch a URL for a link-preview card and do NOT execute JS —
// this list deliberately excludes Googlebot/Google-InspectionTool, which
// DOES render JS and already gets the correct title/schema (verified live)
const BOT_RE = /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|redditbot|pinterest|skypeuripreview|vkshare|w3c_validator|embedly|quora link preview|showyoubot|outbrain|nuzzel|flipboard|tumblr|bitlybot|iframely|viber|line-poker|kakaotalk/i;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// same "unsplash id vs. full URL" rule as data.js's window.U()
const img = (id, w = 1200) =>
  !id ? '' : /^https?:\/\//.test(id) ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

async function fetchRow(table, slug) {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=*&slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch (_) {
    return null;
  }
}

function metaHTML({ title, description, image, url, type }) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
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
<meta http-equiv="refresh" content="0; url=${esc(url)}">
</head><body><a href="${esc(url)}">${esc(title)}</a></body></html>`;
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_RE.test(ua)) return; // not a link-unfurl bot — serve the normal site unchanged

  const url = new URL(request.url);
  const isAr = url.pathname.startsWith('/ar/');
  const page = isAr ? url.pathname.slice(3) : url.pathname;
  const id = url.searchParams.get('id') || url.searchParams.get('slug');
  if (!id) return;

  const table = page === '/project.html' ? 'projects' : page === '/unit.html' ? 'units' : page === '/blog-post.html' ? 'blog_posts' : null;
  if (!table) return;

  const row = await fetchRow(table, id);
  if (!row) return; // let the page's own "not found" handling take over

  const pick = (en, ar) => (isAr && row[ar]) ? row[ar] : row[en];

  let title, description, image;
  if (table === 'blog_posts') {
    title = pick('seo_title', 'seo_title_ar') || pick('title', 'title_ar');
    description = pick('seo_description', 'seo_description_ar') || pick('excerpt', 'excerpt_ar');
    image = img(row.cover, 1200);
  } else {
    const name = pick('name', 'name_ar') || row.name;
    const customTitle = pick('seo_title', 'seo_title_ar');
    title = customTitle || `${name} — Aqar Factory`;
    description = pick('seo_description', 'seo_description_ar') || row.tagline || pick('description', 'description_ar') || '';
    image = img(row.cover, 1200);
  }
  if (!description) description = table === 'projects'
    ? 'Aqar Factory project detail — gallery, key facts, amenities and location.'
    : table === 'units' ? 'Aqar Factory unit detail — gallery, price, specs and location.'
    : 'Aqar Factory blog — market insight, buying guides and stories from our team.';

  const html = metaHTML({
    title, description, image,
    url: url.toString(),
    type: table === 'blog_posts' ? 'article' : 'website'
  });

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300' }
  });
}
