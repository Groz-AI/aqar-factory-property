/* ============================================================
   AQAR FACTORY — cached list endpoint (Vercel serverless function)
   ------------------------------------------------------------
   Serves /api/list?t=<table> : the published rows a listing page
   needs, fetched from the database server and cached on Vercel's
   CDN. Visitors get the JSON from a nearby edge node instead of
   waiting on the database server in another country on every
   page view. Cache: 60 s fresh, then served stale (and refreshed
   in the background) for a day, so admin edits show within about
   a minute and a slow database never blocks a visitor.
   store.js falls back to querying the database directly if this
   endpoint is missing or fails (e.g. local dev).
   ============================================================ */

const SUPA_URL = 'https://api.aqar-factory.com';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84';

// same slim column lists as store.js's LIST_COLS (cards only, no long-form text)
const COLS = {
  projects: 'id,slug,slug_ar,name,name_ar,category,city,location,country,year,status,tagline,cover,about,amenities,developer,developer_id,developer_logo,price,units,floors,area,handover,price_value,area_value,is_rental,lat,lng,gallery,sort_order,published,city_id,unit_types,brochure_pdf,consultants,is_featured,ready_to_move,created_at,updated_at',
  units: 'id,slug,slug_ar,name,name_ar,type,badge,price,price_value,beds,baths,area,area_value,location,description,description_ar,cover,gallery,project_id,city_id,lat,lng,sort_order,published,developer_id,developer,is_featured,ready_to_move,created_at,updated_at',
  cities: '*', developers: '*', categories: '*', testimonials: '*', blog_posts: '*'
};

module.exports = async function handler(req, res) {
  const t = String((req.query && req.query.t) || '');
  if (!Object.prototype.hasOwnProperty.call(COLS, t)) { res.statusCode = 400; res.end('bad table'); return; }
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${t}?select=${COLS[t]}&published=eq.true&order=sort_order.asc`,
      { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400');
    res.statusCode = 200;
    res.end(body);
  } catch (_) {
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 502;
    res.end('upstream error');
  }
};
