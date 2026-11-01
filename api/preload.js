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

const SUPA_URL = 'https://api.aqar-factory.com';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84';

// must stay in step with store.js's LIST_COLS and api/list.js
const COLS = {
  projects: 'id,slug,slug_ar,name,name_ar,category,city,location,country,year,status,tagline,cover,about,amenities,developer,developer_id,developer_logo,price,units,floors,area,handover,price_value,area_value,is_rental,lat,lng,gallery,sort_order,published,city_id,unit_types,brochure_pdf,consultants,is_featured,ready_to_move,created_at,updated_at',
  units: 'id,slug,slug_ar,name,name_ar,type,badge,price,price_value,beds,baths,area,area_value,location,description,description_ar,cover,gallery,project_id,city_id,lat,lng,sort_order,published,developer_id,developer,is_featured,ready_to_move,created_at,updated_at',
  cities: '*', developers: '*', categories: '*', testimonials: '*'
};

// which lists each page draws from
const PAGE_TABLES = {
  '/': ['projects', 'units', 'cities', 'developers', 'testimonials', 'categories'],
  '/projects.html': ['projects', 'cities', 'developers', 'categories'],
  '/units.html': ['units', 'projects', 'cities', 'categories'],
  '/cities.html': ['cities', 'projects']
};

async function fetchTable(t) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${t}?select=${COLS[t]}&published=eq.true&order=sort_order.asc`,
    { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return r.json();
}

module.exports = async function handler(req, res) {
  const page = String((req.query && req.query.page) || '/');
  const tables = PAGE_TABLES[page];
  if (!tables) { res.statusCode = 400; res.end('bad page'); return; }

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

  let out = html, cache = 'public, max-age=0, s-maxage=10';
  try {
    const rows = await Promise.all(tables.map(fetchTable));
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
