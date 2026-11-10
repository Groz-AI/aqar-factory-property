/* ============================================================
   AQAR FACTORY — page + data in one response (Vercel function)
   ------------------------------------------------------------
   middleware.js sends real visitors of the home / projects / units /
   cities pages here. The response is the normal static page with the
   lists those pages draw (the same rows /api/list serves) already
   inlined as window.__PRELOAD, just before store.js. store.js uses
   them instead of asking the network, so the cards are drawn as
   soon as the scripts run rather than ~0.3 s later.
   Cached on the CDN for 30 s (then stale-while-revalidate 2 min).
   Any failure answers with the plain static page, which loads its
   own data exactly as before.
   ============================================================ */

const { toArabicHtml } = require('./_i18n-server.js');

const SUPA_URL = 'https://api.aqar-factory.com';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84';

// must stay in step with store.js's LIST_COLS and api/list.js
const COLS = {
  projects: 'id,slug,slug_ar,name,name_ar,category,city,location,country,year,status,tagline,cover,about,developer,developer_id,developer_logo,price,units,floors,area,handover,price_value,area_value,is_rental,lat,lng,gallery,sort_order,published,city_id,unit_types,consultants,is_featured,ready_to_move',
  units: 'id,slug,slug_ar,name,name_ar,type,badge,price,price_value,beds,baths,area,area_value,location,description,cover,gallery,project_id,city_id,lat,lng,sort_order,published,developer_id,developer,is_featured,ready_to_move',
  cities: '*', developers: '*', categories: '*', testimonials: '*'
};

// which lists each page draws from
const PAGE_TABLES = {
  '/': ['projects', 'units', 'cities', 'developers', 'testimonials', 'categories'],
  '/projects.html': ['projects', 'cities', 'developers', 'categories'],
  '/units.html': ['units', 'projects', 'cities', 'categories'],
  '/cities.html': ['cities', 'projects'],
  // no lists: these only need the Arabic text for visitors of /ar/ pages
  '/about.html': [], '/contact.html': [], '/blog.html': []
};

// cards show at most 6 photos and the AI helper reads only the first
// paragraph / first 200 characters, so long fields are cut here (detail
// pages fetch their own full row)
function slimRows(t, rows) {
  if (!Array.isArray(rows)) return rows;
  if (t === 'projects') rows.forEach(r => {
    if (Array.isArray(r.gallery)) r.gallery = r.gallery.slice(0, 6);
    if (Array.isArray(r.about)) r.about = r.about.slice(0, 1).map(s => String(s).slice(0, 300));
  });
  if (t === 'units') rows.forEach(r => {
    if (Array.isArray(r.gallery)) r.gallery = r.gallery.slice(0, 6);
    if (typeof r.description === 'string') r.description = r.description.slice(0, 200);
  });
  return rows;
}

// pages that only show city / developer cards (no intro text) skip the long
// description columns; /projects.html still gets the full rows for its intro
const SLIM_COLS = {
  cities: 'id,slug,name,name_ar,image,size,country,sort_order,published,created_at,updated_at',
  developers: 'id,slug,name,name_ar,logo,sort_order,published,created_at,updated_at'
};

async function fetchTable(t, page) {
  const cols = (page !== '/projects.html' && SLIM_COLS[t]) || COLS[t];
  const r = await fetch(`${SUPA_URL}/rest/v1/${t}?select=${cols}&published=eq.true&order=sort_order.asc`,
    { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return slimRows(t, await r.json());
}

// the home hero title / subtitle are editable in the admin (content block "hero")
async function arabicHero(html) {
  const r = await fetch(`${SUPA_URL}/rest/v1/content_blocks?key=eq.hero&select=value`,
    { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
  if (!r.ok) return html;
  const rows = await r.json();
  const v = rows && rows[0] && rows[0].value;
  if (!v) return html;
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const a = v.titleA_ar || v.titleA, b = v.titleB_ar || v.titleB;
  let out = html;
  if (a || b) out = out.replace(/(<h1 class="hero-title[^"]*">)[\s\S]*?(<\/h1>)/, (m, o, c) => `${o}${esc(a || '')} <span>${esc(b || '')}</span>${c}`);
  if (v.sub_ar) out = out.replace(/(<p class="hero-sub[^"]*">)[\s\S]*?(<\/p>)/, (m, o, c) => `${o}${esc(v.sub_ar)}${c}`);
  return out;
}

module.exports = async function handler(req, res) {
  const page = String((req.query && req.query.page) || '/');
  const tables = PAGE_TABLES[page];
  if (!tables) { res.statusCode = 400; res.end('bad page'); return; }
  const ar = String((req.query && req.query.lang) || '') === 'ar';

  let html = '';
  try {
    // 'x-mw-static-fetch' makes middleware.js serve the raw file instead of
    // rewriting this very request back here
    const staticRes = await fetch(`https://www.aqar-factory.com${page}`, { headers: { 'x-mw-static-fetch': '1' } });
    if (!staticRes.ok) { res.statusCode = staticRes.status; res.end(await staticRes.text()); return; }
    html = await staticRes.text();
  } catch (_) {
    res.statusCode = 502; res.end('<!DOCTYPE html><title>Aqar Factory</title>'); return;
  }

  // Arabic visitors: the page arrives in Arabic (title, headings, text),
  // not English that the browser translates afterwards
  if (ar) {
    try {
      html = await toArabicHtml(html);
      if (page === '/') html = await arabicHero(html);
    } catch (_) { /* keep the English source; i18n.js translates it in the browser */ }
  }

  // canonical + hreflang in the first HTML (i18n.js writes the same values
  // later; this is for anything that reads the raw page)
  if (!/rel="canonical"/.test(html)) {
    const enU = 'https://www.aqar-factory.com' + page;
    const arU = 'https://www.aqar-factory.com' + (page === '/' ? '/ar' : '/ar' + page);
    const own = ar ? arU : enU;
    html = html.replace('</head>', () => `<link rel="canonical" href="${own}">
<link rel="alternate" hreflang="en" href="${enU}">
<link rel="alternate" hreflang="ar" href="${arU}">
<link rel="alternate" hreflang="x-default" href="${enU}">
</head>`);
  }

  let out = html, cache = 'public, max-age=0, s-maxage=10';
  if (!tables.length) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
    res.statusCode = 200;
    res.end(html);
    return;
  }
  try {
    const rows = await Promise.all(tables.map(t => fetchTable(t, page)));
    const data = {}; tables.forEach((t, i) => { if (Array.isArray(rows[i]) && rows[i].length) data[t] = rows[i]; });
    // "<" escaped so no row can close the script tag; the JSON is valid JS
    const json = JSON.stringify(data).split('<').join('\\u003c');
    const tag = '<script>window.__PRELOAD=' + json + ';</script>\n';
    const anchor = '<script src="store.js"></script>';
    if (html.includes(anchor)) { out = html.replace(anchor, () => tag + anchor); cache = 'public, max-age=0, s-maxage=30, stale-while-revalidate=120'; }
  } catch (_) { /* plain static page */ }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.statusCode = 200;
  res.end(out);
};
