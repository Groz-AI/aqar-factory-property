/* ============================================================
   AQAR FACTORY — market update pages (Vercel serverless function)
   ------------------------------------------------------------
   Serves   /market_update            the list of updates
            /market_update/<slug>     one update
   and the same under /ar/ (see the rewrites in vercel.json).

   The pages are written COMPLETE on the server — text, photos, links,
   canonical, hreflang, Open Graph and JSON-LD are all in the HTML a crawler
   or link-preview bot receives, no JavaScript needed — which is what makes
   them indexable. The shell (header, footer, styles) is the static file
   market-update.html, with two markers filled in here:
       <!--MU_HEAD-->   the page's <title>, meta tags and structured data
       <!--MU_MAIN-->   the page body

   Content comes from the market_updates table, written in the admin portal
   (Market updates). Only published rows are visible (row-level security).
   ============================================================ */

const { setLangSwitch } = require('./_i18n-server.js');

const SUPA_URL = 'https://api.aqar-factory.com';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84';
const SITE = 'https://www.aqar-factory.com';

const TXT = {
  en: {
    searchPh: 'Search by name…', allCities: 'All cities', cityLabel: 'City', noMatch: 'No updates in this city yet', noMatchSub: 'Pick another city or choose All cities.',
    tab: 'Track Your Project', home: 'Home', back: 'All updates', wa: 'Chat on WhatsApp',
    listTitle: 'Track Your Project — Aqar Factory',
    listDesc: 'Market updates and project news from Aqar Factory — photos, details and direct WhatsApp contact with our team.',
    eyebrow: 'Market updates', h1: 'Track Your Project',
    lead: 'The latest news, photos and details on the projects and markets we work in.',
    empty: 'No updates published yet', emptySub: 'Check back soon — we are working on it.',
    notFound: 'Update not found', notFoundSub: 'This page does not exist or is no longer published.',
    photo: 'Photo', viewProject: 'View project'
  },
  ar: {
    searchPh: 'ابحث بالاسم…', allCities: 'كل المدن', cityLabel: 'المدينة', noMatch: 'لا توجد تحديثات في هذه المدينة بعد', noMatchSub: 'اختر مدينة أخرى أو اضغط كل المدن.',
    tab: 'تابع مشروعك', home: 'الرئيسية', back: 'كل التحديثات', wa: 'تواصل عبر واتساب',
    listTitle: 'تابع مشروعك — Aqar Factory',
    listDesc: 'تحديثات السوق وأخبار المشاريع من Aqar Factory — صور وتفاصيل وتواصل مباشر مع فريقنا عبر واتساب.',
    eyebrow: 'تحديثات السوق', h1: 'تابع مشروعك',
    lead: 'آخر الأخبار والصور والتفاصيل عن المشاريع والأسواق التي نعمل فيها.',
    empty: 'لا توجد تحديثات منشورة بعد', emptySub: 'عد قريبًا — نعمل على ذلك.',
    notFound: 'التحديث غير موجود', notFoundSub: 'هذه الصفحة غير موجودة أو لم تعد منشورة.',
    photo: 'صورة', viewProject: 'عرض المشروع'
  }
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// same "unsplash id vs full URL" rule as data.js's window.U()
const imgUrl = (id, w) => !id ? '' : /^https?:\/\//.test(id) ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
// R2 photos are shown resized through /api/img (the originals are 2-3 MB); everything else unchanged.
// Meta images, structured data and the click-to-enlarge links keep the original address.
const shown = (id, w) => { const u = imgUrl(id, w); return /^https:\/\/pub-[a-z0-9]+\.r2\.dev\//.test(u) ? '/api/img?u=' + encodeURIComponent(u) + '&w=' + w : u; };
const stripSlashes = (s) => String(s || '').replace(/^\/+|\/+$/g, '');

async function rest(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
  if (!res.ok) throw new Error('supabase ' + res.status);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('bad response');
  return rows;
}

async function loadTemplate(host) {
  const res = await fetch(`https://${host}/market-update.html`, { headers: { 'x-mw-static-fetch': '1' } });
  if (!res.ok) throw new Error('template ' + res.status);
  return res.text();
}

function fmtDate(iso, ar) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '';
  try { return d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
  catch (_) { return String(iso).slice(0, 10); }
}

// "Label | https://address | Arabic label" per line -> [{label, url}]
function parseLinks(text, ar) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const parts = line.split('|').map(s => s.trim());
    const url = parts[1];
    if (!parts[0] || !url) return;
    if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) return;   // no javascript: and other schemes
    out.push({ label: (ar && parts[2]) ? parts[2] : parts[0], url });
  });
  return out;
}

// [link text](https://…) written in the admin becomes a real link; only
// http(s), mailto, tel and site-relative targets are accepted. Input is already escaped.
const withLinks = (escaped) => escaped.replace(/\[([^\[\]]+)\]\(([^()\s]+)\)/g, (m, label, url) => /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(url)
  ? `<a href="${url}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : ''}>${label}</a>` : m);

const pickLang = (row, k, ar) => (ar && row[k + '_ar']) ? row[k + '_ar'] : (row[k] || '');
const firstChars = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

function headHtml({ title, description, path, ar, image, type, jsonld, noindex }) {
  const enPath = path, arPath = path === '/' ? '/ar' : '/ar' + path;
  const own = SITE + (ar ? arPath : enPath);
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<link rel="canonical" href="${esc(own)}" />`,
    `<link rel="alternate" hreflang="en" href="${esc(SITE + enPath)}" />`,
    `<link rel="alternate" hreflang="ar" href="${esc(SITE + arPath)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(SITE + enPath)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="Aqar Factory" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(own)}" />`,
    `<meta property="og:locale" content="${ar ? 'ar_EG' : 'en_US'}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : ''
  ].filter(Boolean);
  if (jsonld) tags.push(`<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`);
  return tags.join('\n');
}

function breadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url }))
  };
}

function hero({ bg, crumbs, eyebrow, h1, lead }) {
  const style = bg ? ` style="--bg:url('${esc(bg)}')"` : '';
  return `<section class="subpage-hero"${style}>
  <div class="container subpage-hero-in">
    <div class="breadcrumb light">${crumbs}</div>
    ${eyebrow ? `<p class="sub-eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1>${esc(h1)}</h1>
    ${lead ? `<p class="sub-lead">${esc(lead)}</p>` : ''}
  </div>
</section>`;
}

function listPage(rows, ar, cities) {
  const L = TXT[ar ? 'ar' : 'en'], pre = ar ? '/ar' : '';
  const cityName = (id) => { const c = cities.find(x => x.id === id); return c ? ((ar && c.name_ar) ? c.name_ar : c.name) : ''; };
  const cards = rows.map(r => {
    const cover = shown((r.photos || [])[0], 800);
    const title = pickLang(r, 'title', ar), sum = pickLang(r, 'summary', ar);
    const city = cityName(r.city_id);
    return `<a class="blog-card mu-card" href="${pre}/market_update/${encodeURIComponent(r.slug)}" data-city="${esc(r.city_id || '')}">
      <div class="blog-card-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
      <div class="blog-card-body">
        <h3>${esc(title)}</h3>
        ${sum ? `<p class="blog-card-excerpt">${esc(sum)}</p>` : ''}
        <div class="blog-card-foot"><span class="mu-city">${esc(city)}</span><span class="blog-card-date">${esc(fmtDate(r.published_at, ar))}</span></div>
      </div>
    </a>`;
  }).join('');
  // only cities that have at least one published update are offered
  const used = [...new Set(rows.map(r => r.city_id).filter(Boolean))]
    .map(id => ({ id, label: cityName(id) })).filter(c => c.label).sort((a, b) => a.label.localeCompare(b.label, ar ? 'ar' : 'en'));
  // a bar of city buttons: "All" plus one per city that has a published update
  const filters = used.length ? `<div class="mu-citybar" role="group" aria-label="${esc(L.cityLabel)}">
    <button type="button" class="mu-chip on" data-city="" aria-pressed="true">${esc(L.allCities)}</button>
    ${used.map(c => `<button type="button" class="mu-chip" data-city="${esc(c.id)}" aria-pressed="false">${esc(c.label)}</button>`).join('')}
  </div>` : '';
  const crumbs = `<a href="${pre || '/'}">${esc(L.home)}</a><span>/</span><b>${esc(L.tab)}</b>`;
  const body = `${hero({ bg: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1700&q=80', crumbs, eyebrow: L.eyebrow, h1: L.h1, lead: L.lead })}
<main class="container">
  ${filters}
  ${rows.length ? `<div class="blog-grid" id="muGrid">${cards}</div>
  <div class="empty-state" id="muNoMatch" hidden><h3>${esc(L.noMatch)}</h3><p>${esc(L.noMatchSub)}</p></div>` : `<div class="empty-state"><h3>${esc(L.empty)}</h3><p>${esc(L.emptySub)}</p></div>`}
</main>`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: L.listTitle, url: SITE + (ar ? '/ar' : '') + '/market_update', inLanguage: ar ? 'ar' : 'en', description: L.listDesc },
      breadcrumbLd([{ name: L.home, url: SITE + (ar ? '/ar' : '/') }, { name: L.tab, url: SITE + (ar ? '/ar' : '') + '/market_update' }])
    ]
  };
  return {
    body,
    head: headHtml({ title: L.listTitle, description: L.listDesc, path: '/market_update', ar, image: imgUrl((rows[0] && rows[0].photos || [])[0], 1200), type: 'website', jsonld: ld })
  };
}

function detailPage(r, ar, city, project) {
  const L = TXT[ar ? 'ar' : 'en'], pre = ar ? '/ar' : '';
  const title = pickLang(r, 'title', ar);
  const description = pickLang(r, 'description', ar);
  const summary = pickLang(r, 'summary', ar);
  const photos = (r.photos || []).filter(Boolean);
  const path = '/market_update/' + encodeURIComponent(r.slug);
  const date = fmtDate(r.published_at, ar);
  const paras = description.replace(/\r/g, '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${withLinks(esc(p)).replace(/\n/g, '<br>')}</p>`).join('');
  const projectBtn = project
    ? `<a class="btn btn-ghost mu-link" href="${pre}/project/${encodeURIComponent((ar && project.slug_ar) || project.slug)}">${esc(L.viewProject)}: ${esc((ar && project.name_ar) || project.name)}</a>` : '';
  const links = parseLinks(r.links, ar).map(l => `<a class="btn btn-ghost mu-link" href="${esc(l.url)}"${/^https?:/i.test(l.url) ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`).join('');
  const waNum = String(r.whatsapp_number || '').replace(/\D/g, '');
  const waText = r.whatsapp_text || '';
  const wa = waNum
    ? `<a class="btn btn-dark mu-wa" href="https://wa.me/${waNum}${waText ? '?text=' + encodeURIComponent(waText) : ''}" target="_blank" rel="noopener">${esc(L.wa)}</a>`
    : `<a class="btn btn-dark mu-wa" data-mu-wa data-text="${esc(waText)}" href="#" target="_blank" rel="noopener" hidden>${esc(L.wa)}</a>`;
  const gallery = photos.length ? `<div class="mu-gallery${photos.length === 1 ? ' one' : ''}">${photos.map((p, i) =>
    `<a class="mu-photo" href="${esc(imgUrl(p, 1800))}"><img src="${esc(shown(p, i === 0 ? 1200 : 700))}" alt="${esc(title)} — ${esc(L.photo)} ${i + 1}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}></a>`).join('')}</div>` : '';
  const crumbs = `<a href="${pre || '/'}">${esc(L.home)}</a><span>/</span><a href="${pre}/market_update">${esc(L.tab)}</a><span>/</span><b>${esc(title)}</b>`;
  const body = `${hero({ bg: shown(photos[0], 1600) || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1700&q=80', crumbs, eyebrow: [city, date].filter(Boolean).join(' · '), h1: title })}
<main class="container mu-wrap">
  <article class="mu-article">
    ${summary ? `<p class="mu-summary">${esc(summary)}</p>` : ''}
    ${gallery}
    ${paras ? `<div class="mu-body">${paras}</div>` : ''}
    <div class="mu-actions">${wa}${projectBtn}${links}</div>
    <p class="mu-back"><a href="${pre}/market_update">${ar ? '→' : '←'} ${esc(L.back)}</a></p>
  </article>
</main>`;
  const metaTitle = (ar ? (r.seo_title_ar || r.seo_title) : r.seo_title) || `${title} — Aqar Factory`;
  const metaDesc = (ar ? (r.seo_description_ar || r.seo_description) : r.seo_description) || firstChars(summary || description.replace(/\[([^\[\]]+)\]\([^()\s]+\)/g, '$1'), 158) || L.listDesc;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article', headline: firstChars(title, 110), description: metaDesc,
        inLanguage: ar ? 'ar' : 'en',
        image: photos.slice(0, 5).map(p => imgUrl(p, 1200)),
        datePublished: r.published_at || undefined, dateModified: r.updated_at || r.published_at || undefined,
        mainEntityOfPage: SITE + pre + path,
        author: { '@type': 'Organization', name: 'Aqar Factory', '@id': SITE + '/#organization' },
        publisher: { '@type': 'Organization', name: 'Aqar Factory', '@id': SITE + '/#organization' }
      },
      breadcrumbLd([
        { name: L.home, url: SITE + (ar ? '/ar' : '/') },
        { name: L.tab, url: SITE + pre + '/market_update' },
        { name: title, url: SITE + pre + path }
      ])
    ]
  };
  return { body, head: headHtml({ title: metaTitle, description: metaDesc, path, ar, image: imgUrl(photos[0], 1200), type: 'article', jsonld: ld }) };
}

function notFoundPage(ar) {
  const L = TXT[ar ? 'ar' : 'en'], pre = ar ? '/ar' : '';
  const crumbs = `<a href="${pre || '/'}">${esc(L.home)}</a><span>/</span><a href="${pre}/market_update">${esc(L.tab)}</a>`;
  return {
    body: `${hero({ crumbs, h1: L.notFound, lead: L.notFoundSub })}
<main class="container"><div class="empty-state"><p><a class="btn btn-dark" href="${pre}/market_update">${esc(L.back)}</a></p></div></main>`,
    head: `<title>${esc(L.notFound)} — Aqar Factory</title>\n<meta name="robots" content="noindex, follow" />`
  };
}

module.exports = async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const ar = req.query.lang === 'ar';
  let slug = String(req.query.slug || '');
  try { slug = decodeURIComponent(slug); } catch (_) { /* keep as is */ }
  slug = stripSlashes(slug);

  let template, page, status = 200;
  try {
    template = await loadTemplate(host);
    const cityRows = () => rest('cities?select=id,name,name_ar').catch(() => []);
    if (!slug) {
      const cols = 'slug,title,title_ar,summary,summary_ar,photos,published_at';
      const tail = '&published=eq.true&order=published_at.desc.nullslast,sort_order.desc';
      // city_id exists only after supabase/add-market-updates-city.sql; the page works without it
      const [rows, cities] = await Promise.all([
        rest(`market_updates?select=${cols},city_id${tail}`).catch(() => rest(`market_updates?select=${cols}${tail}`)),
        cityRows()
      ]);
      page = listPage(rows, ar, cities);
    } else {
      const rows = await rest(`market_updates?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`);
      if (rows[0]) {
        let city = '';
        if (rows[0].city_id) {
          const c = (await cityRows()).find(x => x.id === rows[0].city_id);
          if (c) city = (ar && c.name_ar) ? c.name_ar : c.name;
        }
        // linked project (column exists only after supabase/add-market-updates-project.sql)
        let project = null;
        if (rows[0].project_id) {
          project = (await rest(`projects?select=slug,slug_ar,name,name_ar&published=eq.true&id=eq.${encodeURIComponent(rows[0].project_id)}&limit=1`).catch(() => []))[0] || null;
        }
        page = detailPage(rows[0], ar, city, project);
      } else { page = notFoundPage(ar); status = 404; }
    }
  } catch (_) {
    // a failed read must never be cached or indexed as an empty/missing page
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    res.status(503).send('Temporarily unavailable');
    return;
  }

  // the language switch leads to this same page in the other language
  const swPath = '/market_update' + (slug && status === 200 ?'/' + encodeURIComponent(slug) : '');
  const html = setLangSwitch(template, ar, swPath, '/ar' + swPath)
    .replace(/<html lang="en">/, `<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">`)
    .replace('<!--MU_HEAD-->', () => page.head)
    .replace('<!--MU_MAIN-->', () => page.body);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // an admin edit shows up within about a minute; repeat crawls are served from the edge
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' : 'public, max-age=0, s-maxage=30');
  res.status(status).send(html);
};
