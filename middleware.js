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
     3. Consumer chat apps' interactive "fetch this link for me"
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
   entirely (see group 3 above). Fetch the item straight from
   Supabase here (runs on Vercel's edge, before any static file is
   served), and return an HTML document with the correct <title>,
   meta description, Open Graph/Twitter tags, AND the actual readable
   content as plain text/HTML in the body. Every real browser request
   (Sec-Fetch-Mode always present) is untouched and gets the normal
   site exactly as before.
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

// projects/units can have a custom Arabic slug (slug_ar) used on /ar/ URLs
// instead of the default slug — match either column so a shared /ar/ link
// using the Arabic slug isn't silently missed
const HAS_SLUG_AR = { projects: true, units: true, blog_posts: false };

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
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch (_) {
    return null;
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

function pageHTML({ title, description, image, url, type, facts, bodyText, amenities, gallery, consultants, brochurePdf, related }) {
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
  const relatedHtml = (related && related.length)
    ? `<h2>Related, from the same developer</h2><ul>${related.map(r => `<li><a href="${esc(r.url)}">${esc(r.name)}</a></li>`).join('')}</ul>`
    : '';
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
<p>${esc(bodyText)}</p>
${factsList}
${amenitiesList}
${brochureLink}
${consultantsList}
${galleryHtml}
${relatedHtml}
<p><a href="${esc(url)}">${esc(url)}</a></p>
</body></html>`;
}

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  const isNamedBot = BOT_RE.test(ua);
  // every real browser attaches Sec-Fetch-Mode to every request automatically;
  // a simple server-side fetcher (curl, a chat app's link-reader, an unnamed
  // bot) generally doesn't. Missing it entirely — on a request that isn't
  // even a named bot — is our signal for "not a browser".
  const looksLikeNonBrowser = !isNamedBot && !request.headers.get('sec-fetch-mode');
  if (!isNamedBot && !looksLikeNonBrowser) return; // real browser — serve the normal site unchanged
  // AI bots and unidentified non-browser clients both get full article text
  // (the latter is exactly the case we're adding this for — a chat app
  // fetching the link wants the same real content a named AI crawler gets);
  // named preview bots (WhatsApp/Facebook/…) get the lean/fast title+meta path
  const richMode = AI_BOT_RE.test(ua) || looksLikeNonBrowser;

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
  const linkUrl = (slug, slugAr, otherTable) => {
    const p = otherTable === 'units' ? '/unit.html' : otherTable === 'blog_posts' ? '/blog-post.html' : '/project.html';
    const s = (isAr && slugAr) ? slugAr : slug;
    return `https://www.aqar-factory.com${isAr ? '/ar' : ''}${p}?id=${encodeURIComponent(s)}`;
  };

  let title, description, image, facts = [], bodyText = '';
  let amenities = [], gallery = [], consultants = [], brochurePdf = '', related = [];
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
      const [relProjects, relUnits] = await Promise.all([
        fetchRelated('projects', row.developer_id, row.developer, row.slug),
        fetchRelated('units', row.developer_id, row.developer, null)
      ]);
      related = [
        ...relProjects.map(r => ({ name: (isAr && r.name_ar) || r.name, url: linkUrl(r.slug, r.slug_ar, 'projects') })),
        ...relUnits.map(r => ({ name: (isAr && r.name_ar) || r.name, url: linkUrl(r.slug, r.slug_ar, 'units') }))
      ];
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
      const relUnits = await fetchRelated('units', devId, devName, row.slug);
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

  const html = pageHTML({
    title, description, image, facts, bodyText, amenities, gallery, consultants, brochurePdf, related,
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
