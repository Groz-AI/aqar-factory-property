/* ============================================================
   AQAR FACTORY — city / developer landing pages (Vercel function)
   ------------------------------------------------------------
   /city/<slug>, /developer/<slug> and their /ar/ twins (rewrites in
   vercel.json). One real URL per city and per developer, each with
   its own title, description, heading, canonical, hreflang and
   structured data, plus the list of its projects as plain links.

   The body is the normal projects page: the project list, the
   filters and the city / developer text are drawn by projects.js,
   which starts with this city or developer already selected
   (window.__LANDING). The list data is inlined (window.__PRELOAD) so
   there is no wait, exactly as api/preload.js does for the lists.
   Unknown names, or ones without any published project, answer 404.
   ============================================================ */

const SchemaHelpers = require('../schema-helpers.js');
const { toArabicHtml } = require('./_i18n-server.js');

const SITE = 'https://www.aqar-factory.com';
const SUPA_URL = 'https://api.aqar-factory.com';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84';

// same slim columns as api/preload.js
const PROJECT_COLS = 'id,slug,slug_ar,name,name_ar,category,city,location,country,year,status,tagline,cover,about,developer,developer_id,developer_logo,price,units,floors,area,handover,price_value,area_value,is_rental,lat,lng,gallery,sort_order,published,city_id,unit_types,consultants,is_featured,ready_to_move';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// [text](address) links in the admin-written city / developer text -> plain text
const plain = (s) => String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

async function rest(table, select) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${select}&published=eq.true&order=sort_order.asc`,
    { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
  if (!r.ok) throw new Error(table + ' ' + r.status);
  return r.json();
}

function notFound(res, ar) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  res.end(`<!DOCTYPE html><html lang="${ar ? 'ar' : 'en'}"${ar ? ' dir="rtl"' : ''}><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${ar ? 'الصفحة غير موجودة' : 'Page not found'}</title></head><body><p>${ar ? 'هذه الصفحة غير متاحة.' : 'This page is not available.'} <a href="${SITE}${ar ? '/ar' : '/'}">Aqar Factory</a></p></body></html>`);
}

module.exports = async function handler(req, res) {
  const q = req.query || {};
  const kind = q.kind === 'developer' ? 'developer' : 'city';
  const slug = String(q.slug || '').trim();
  const ar = String(q.lang || '') === 'ar';
  if (!slug) return notFound(res, ar);

  let cities, developers, projects, categories, html;
  try {
    [cities, developers, projects, categories] = await Promise.all([
      rest('cities', '*'), rest('developers', '*'), rest('projects', PROJECT_COLS), rest('categories', '*')
    ]);
    const staticRes = await fetch(`${SITE}/projects.html`, { headers: { 'x-mw-static-fetch': '1' } });
    if (!staticRes.ok) throw new Error('static ' + staticRes.status);
    html = await staticRes.text();
  } catch (_) {
    res.statusCode = 502; res.setHeader('Cache-Control', 'no-store'); res.end('temporarily unavailable'); return;
  }

  const list = kind === 'city' ? cities : developers;
  // the stored slug first; rows without one (before the slug column exists)
  // answer to the slug derived from their name
  let ent = list.find(e => e && e.slug && e.slug === slug) || list.find(e => e && !e.slug && e.name && SchemaHelpers.entitySlug(e.name) === slug);
  if (!ent) {
    // a slug this city / developer used to have: send the visitor (and Google) to the current address
    try {
      const table = kind === 'city' ? 'cities' : 'developers';
      const r = await fetch(`${SUPA_URL}/rest/v1/slug_redirects?select=row_id&table_name=eq.${table}&old_slug=eq.${encodeURIComponent(slug)}`,
        { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
      const rows = r.ok ? await r.json() : [];
      const moved = rows[0] && list.find(e => e.id === rows[0].row_id);
      if (moved) {
        res.statusCode = 301;
        res.setHeader('Location', `${SITE}${ar ? '/ar' : ''}/${kind}/${encodeURIComponent(SchemaHelpers.entityUrlSlug(moved))}`);
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
        res.end();
        return;
      }
    } catch (_) { /* fall through to 404 */ }
  }
  const mine = ent ? SchemaHelpers.entityProjects(kind, ent, projects) : [];
  if (!ent || !mine.length) return notFound(res, ar);

  const slugNow = SchemaHelpers.entityUrlSlug(ent);
  const name = (ar && ent.name_ar) || ent.name;
  const own = `${SITE}${ar ? '/ar' : ''}/${kind}/${encodeURIComponent(slugNow)}`;
  const enUrl = `${SITE}/${kind}/${encodeURIComponent(slugNow)}`;
  const arUrl = `${SITE}/ar/${kind}/${encodeURIComponent(slugNow)}`;
  const n = mine.length;
  // offered to Google only when it has its own text (300+ characters) and 3+ projects, per language
  const indexableEn = SchemaHelpers.landingIndexable(ent, n, false);
  const indexableAr = SchemaHelpers.landingIndexable(ent, n, true);
  const indexable = ar ? indexableAr : indexableEn;

  // text written in the admin (page title / heading / search description) wins
  // over the standard wording; empty fields keep the standard wording
  const custom = (en, arKey) => String((ar ? ent[arKey] : ent[en]) || '').trim();
  const title = custom('seo_title', 'seo_title_ar') || (kind === 'city'
    ? (ar ? `مشاريع عقارية في ${name} | Aqar Factory` : `Real Estate Projects in ${name} | Aqar Factory`)
    : (ar ? `مشاريع ${name} | Aqar Factory` : `${name} Projects | Aqar Factory`));
  const customH1 = custom('seo_h1', 'seo_h1_ar');
  const h1Html = customH1 ? esc(customH1) : (kind === 'city'
    ? (ar ? `مشاريع في <em>${esc(name)}</em>` : `Projects in <em>${esc(name)}</em>`)
    : (ar ? `مشاريع <em>${esc(name)}</em>` : `<em>${esc(name)}</em> Projects`));
  const intro = clip(plain(ar ? (ent.description_ar || '') : (ent.description || '')), 155);
  const generic = kind === 'city'
    ? (ar ? `تصفح ${n} مشروعاً عقارياً في ${name}: الأسعار وخطط السداد والمطورون على Aqar Factory.`
          : `Browse ${n} real estate project${n === 1 ? '' : 's'} in ${name}: prices, payment plans and developers on Aqar Factory.`)
    : (ar ? `تصفح ${n} مشروعاً من مشاريع ${name}: الأسعار وخطط السداد والمواقع على Aqar Factory.`
          : `Browse ${n} project${n === 1 ? '' : 's'} by ${name}: prices, payment plans and locations on Aqar Factory.`);
  const customDesc = custom('seo_description', 'seo_description_ar');
  const description = customDesc || (intro.length >= 60 ? intro : generic);

  const projName = (p) => (ar && p.name_ar) || p.name;
  const projPath = (p) => `${ar ? '/ar' : ''}/project/${encodeURIComponent((ar && p.slug_ar) || p.slug)}`;

  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description, url: own, inLanguage: ar ? 'ar' : 'en',
      mainEntity: { '@type': 'ItemList', numberOfItems: n,
        itemListElement: mine.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + projPath(p), name: projName(p) })) } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: ar ? 'الرئيسية' : 'Home', item: SITE + (ar ? '/ar' : '/') },
      { '@type': 'ListItem', position: 2, name: ar ? 'المشاريع' : 'Projects', item: `${SITE}${ar ? '/ar' : ''}/projects.html` },
      { '@type': 'ListItem', position: 3, name, item: own } ] }
  ] };

  try { if (ar) html = await toArabicHtml(html); } catch (_) { /* keep English; i18n.js translates it */ }

  // hreflang only when BOTH language versions are offered to Google
  const alternates = (indexableEn && indexableAr)
    ? `<link rel="alternate" hreflang="en" href="${esc(enUrl)}">\n<link rel="alternate" hreflang="ar" href="${esc(arUrl)}">\n<link rel="alternate" hreflang="x-default" href="${esc(enUrl)}">\n`
    : '';
  const head =
    `<link rel="canonical" href="${esc(own)}">\n` + alternates +
    (indexable ? '' : `<meta name="robots" content="noindex,follow">\n`) +
    `<meta property="og:type" content="website">\n<meta property="og:site_name" content="Aqar Factory">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(description)}">\n<meta property="og:url" content="${esc(own)}">\n` +
    `<script type="application/ld+json" id="ldJson">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>\n</head>`;

  // the page's own relative file links (store.js, styles…) must keep resolving from the site root
  let page = html
    .replace(/<head>/, '<head>\n<base href="/">')
    .replace(/<title[^>]*>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${esc(description)}">`)
    .replace('</head>', () => head);
  // heading: the name is already in the HTML (data-i18n-html is dropped so
  // i18n.js leaves this heading alone)
  page = page.replace(/<h1 data-i18n-html="projects.hero.title">[\s\S]*?<\/h1>/, () => `<h1>${h1Html}</h1>`);
  // breadcrumb: Home / Projects / <name>
  page = page.replace(/<b data-i18n>(Projects|المشاريع)<\/b>/, (m, t) => `<a href="/projects.html" data-i18n>${t}</a><span>/</span><b>${esc(name)}</b>`);
  // the project links as plain HTML for anything that does not run scripts;
  // projects.js replaces the grid's content as soon as it draws the cards
  const links = `<ul style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">${mine.map(p => `<li><a href="${esc(projPath(p))}">${esc(projName(p))}</a></li>`).join('')}</ul>`;
  page = page.replace(/(<div class="projects-grid" id="projectsGrid">)/, (m) => m + links);

  const json = JSON.stringify({ projects, cities, developers, categories }).split('<').join('\\u003c');
  const landing = JSON.stringify({ kind, name: ent.name }).split('<').join('\\u003c');
  const tag = `<script>window.__LANDING=${landing};window.__PRELOAD=${json};</script>\n`;
  const anchor = '<script src="store.js"></script>';
  if (page.includes(anchor)) page = page.replace(anchor, () => tag + anchor);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  res.end(page);
};
