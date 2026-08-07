/* ============================================================
   AQAR FACTORY — bot-only content prerender (Vercel Edge Middleware)
   ------------------------------------------------------------
   WHY THIS EXISTS: project.html/unit.html/blog-post.html are 100%
   client-rendered — the real per-item title, description AND all
   visible content (about text, price, amenities…) only get written
   in by project.js/unit.js/blog-post.js AFTER the page loads and
   fetches from Supabase. Google's indexer runs that JS before
   reading the page, so it sees everything correctly (verified
   live). Two other kinds of bot do NOT run JavaScript at all, so
   they only ever saw an almost-empty page (just header/footer
   markup, no real content):
     1. Link-unfurl bots (WhatsApp, Facebook, Twitter/X, LinkedIn,
        Telegram, Slack, Discord…) — only need title/description/image.
     2. AI crawlers that self-identify with an official bot user
        agent (OpenAI's GPTBot/ChatGPT-User, Anthropic's ClaudeBot,
        Perplexity's PerplexityBot, Google-Extended, etc.) — these
        want the actual page TEXT, not just meta tags, so an AI
        assistant can answer questions about the project/unit/post.
     Note: a consumer chat app's interactive "fetch this link for me"
     feature (e.g. asking Gemini/ChatGPT about a URL mid-conversation)
     often does NOT use one of these official crawler user agents —
     that request looks just like a generic HTTP client, which we
     have no reliable way to distinguish from a real visitor. This
     fix covers every bot that identifies itself; it can't cover ones
     that don't.

   FIX: intercept ONLY requests whose User-Agent matches a known bot
   from either list above, fetch the item straight from Supabase
   here (runs on Vercel's edge, before any static file is served),
   and return an HTML document with the correct <title>, meta
   description, Open Graph/Twitter tags, AND the actual readable
   content as plain text/HTML in the body. Every other visitor (real
   users, Googlebot, everything else) is untouched and gets the
   normal site exactly as before.
   ============================================================ */

export const config = {
  matcher: [
    '/project.html', '/unit.html', '/blog-post.html',
    '/ar/project.html', '/ar/unit.html', '/ar/blog-post.html'
  ]
};

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

// group 1: link-unfurl bots (want title/description/image only) —
// excludes Googlebot/Google-InspectionTool, which DOES render JS and
// already gets everything correctly (verified live)
const PREVIEW_BOT_RE = /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|redditbot|pinterest|skypeuripreview|vkshare|w3c_validator|embedly|quora link preview|showyoubot|outbrain|nuzzel|flipboard|tumblr|bitlybot|iframely|viber|line-poker|kakaotalk/i;

// group 2: officially self-identifying AI crawlers/answer engines —
// these get the same response PLUS real page text in the body
const AI_BOT_RE = /gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|google-extended|applebot-extended|bytespider|ccbot|diffbot|amazonbot|youbot|cohere-ai|meta-externalagent|timpibot|imagesiftbot/i;

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

async function fetchRow(table, slug, rich) {
  try {
    const select = rich ? '*' : LEAN_SELECT[table];
    const res = await fetch(
      `${SUPA_URL}/rest/v1/${table}?select=${select}&slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch (_) {
    return null;
  }
}

function pageHTML({ title, description, image, url, type, facts, bodyText }) {
  const factsList = facts.length
    ? `<ul>${facts.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}</ul>` : '';
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
</head><body>
<h1>${esc(title)}</h1>
${image ? `<img src="${esc(image)}" alt="${esc(title)}">` : ''}
${factsList}
<p>${esc(bodyText)}</p>
<p><a href="${esc(url)}">${esc(url)}</a></p>
</body></html>`;
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_RE.test(ua)) return; // not a link-unfurl/AI bot — serve the normal site unchanged
  const richMode = AI_BOT_RE.test(ua); // AI bots get full article text; preview bots get the lean/fast path

  const url = new URL(request.url);
  const isAr = url.pathname.startsWith('/ar/');
  const page = isAr ? url.pathname.slice(3) : url.pathname;
  const id = url.searchParams.get('id') || url.searchParams.get('slug');
  if (!id) return;

  const table = page === '/project.html' ? 'projects' : page === '/unit.html' ? 'units' : page === '/blog-post.html' ? 'blog_posts' : null;
  if (!table) return;

  const row = await fetchRow(table, id, richMode);
  if (!row) return; // let the page's own "not found" handling take over

  const pick = (en, ar) => (isAr && row[ar]) ? row[ar] : row[en];

  let title, description, image, facts = [], bodyText = '';
  if (table === 'blog_posts') {
    title = pick('seo_title', 'seo_title_ar') || pick('title', 'title_ar');
    description = pick('seo_description', 'seo_description_ar') || pick('excerpt', 'excerpt_ar');
    image = img(row.cover, 1200);
    if (row.author_name) facts.push([isAr ? 'الكاتب' : 'Author', row.author_name]);
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
    if (row.category) facts.push([isAr ? 'الفئة' : 'Category', row.category]);
    if (row.status) facts.push([isAr ? 'الحالة' : 'Status', row.status]);
    if (row.price) facts.push([isAr ? 'السعر' : 'Price', row.price]);
    bodyText = richMode
      ? description + ' ' + blocksToText(pick('about_blocks', 'about_blocks_ar'))
        + (row.amenities && row.amenities.length ? ' ' + (isAr ? 'المرافق: ' : 'Amenities: ') + row.amenities.join(', ') : '')
      : description;
  } else {
    const name = pick('name', 'name_ar') || row.name;
    const customTitle = pick('seo_title', 'seo_title_ar');
    title = customTitle || `${name} — Aqar Factory`;
    description = pick('seo_description', 'seo_description_ar')
      || (richMode ? blocksToText(pick('description_blocks', 'description_blocks_ar')) : '')
      || pick('description', 'description_ar') || '';
    image = img(row.cover, 1200);
    if (row.type) facts.push([isAr ? 'النوع' : 'Type', row.type]);
    if (row.price) facts.push([isAr ? 'السعر' : 'Price', row.price]);
    if (row.beds) facts.push([isAr ? 'غرف النوم' : 'Bedrooms', row.beds]);
    if (row.baths) facts.push([isAr ? 'دورات المياه' : 'Bathrooms', row.baths]);
    if (row.area) facts.push([isAr ? 'المساحة' : 'Area', row.area]);
    if (row.location) facts.push([isAr ? 'الموقع' : 'Location', row.location]);
    bodyText = richMode ? description + ' ' + blocksToText(pick('description_blocks', 'description_blocks_ar')) : description;
  }
  description = String(description || '').trim();
  bodyText = String(bodyText || '').trim();
  if (!description) description = table === 'projects'
    ? 'Aqar Factory project detail — gallery, key facts, amenities and location.'
    : table === 'units' ? 'Aqar Factory unit detail — gallery, price, specs and location.'
    : 'Aqar Factory blog — market insight, buying guides and stories from our team.';
  if (!bodyText) bodyText = description;

  const html = pageHTML({
    title, description, image, facts, bodyText,
    url: url.toString(),
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
