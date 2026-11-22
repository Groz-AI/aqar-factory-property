#!/usr/bin/env node
// Compares content/data characteristics between the 54 URLs GSC flagged as
// "Crawled - currently not indexed" (Pending or Failed) and the rest of the
// published catalog, looking for a real, measurable pattern rather than
// guessing. Caveat: we don't have a verified "is indexed" list from GSC
// directly - the "rest of catalog" group is a proxy (everything NOT flagged
// in this report), which is imperfect but the best available signal.

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

const NOT_INDEXED_URLS = [
  ['/ar/project/الحي-اللاتيني-العلمين-الجديدة', 'Pending'],
  ['/ar/project/قرية-صدف-الساحل-الشمالي-استوديوهات-وشاليهات-بمقدم-يبدأ-من-125-ألف-جنيه-بالتقسيط-Sadaf-North-Coast-Resort-Studios-Chalets-from-125K-DP', 'Pending'],
  ['/ar/project/كمبوند-مكادي-هايتس-الغردقة-شاليهات-وفيلات-بالتقسيط-من-أوراسكوم-Makadi-Heights-Hurghada-Orascom-Phases', 'Pending'],
  ['/ar/project/قرية-نايا-باي-رأس-الحكمة-Naia-Bay-Ras-El-Hekma-Resort', 'Pending'],
  ['/ar/project/قرية-مار-باي-رأس-الحكمة-Mar-Bay-Ras-El-Hekma-Resort', 'Pending'],
  ['/unit/saada-boutique-villas-for-sale-new-cairo', 'Pending'],
  ['/ar/project/كمبوند-الميرا-أوريا-التجمع-الخامس-شقق-بالتقسيط-بدون-مقدم-حتي-12-سنة-Almira-Aurea-New-Cairo-Compound-Almira-Developments', 'Pending'],
  ['/ar/project/كمبوند-بالنسيا-مدينة-الشروق-Compound-Palencia-El-Shorouk', 'Pending'],
  ['/ar/project/كمبوند-ديبلو-إيست-العاصمة-الإدارية', 'Pending'],
  ['/unit/townhouse-for-sale-in-bleu-vert-new-capital', 'Pending'],
  ['/ar/unit/فيلا-مستقلة-275م-للبيع-استلام-سنتين-بالتقسيط-في-كمبوند-فيا-التجمع-السادس-Standalone-Villa-275m-for-Sale-in-VA-New-Cairo', 'Pending'],
  ['/ar/unit/شقة-غرفتين-121م-للبيع-استلام-فوري-تشطيب-كامل-بالتقسيط-في-الحي-اللاتيني-العلمين-الجديدة-2BR-Apartment-for-Sale-in-Latin-District', 'Pending'],
  ['/ar/unit/فلل-للبيع-في-كمبوند-سعادة-بوتيك-التجمع-السادس', 'Pending'],
  ['/ar/unit/blue-vert-new-capital', 'Pending'],
  ['/ar/unit/تاون-هاوس-3-غرف-نوم-144م-للبيع-3BR-Townhouse-144m-For-Sale', 'Pending'],
  ['/unit/50m-studio-for-sale-in-salt-marina-ras-el-hekma', 'Pending'],
  ['/ar/unit/277-blue-vert-new-capital', 'Pending'],
  ['/ar/unit/ready-townhouse-225m-naia-bay-ras-el-hekma', 'Pending'],
  ['/unit/vienta-sarai-new-cairo-1249', 'Pending'],
  ['/ar/unit/3-lasirena-bay-ras-sedr', 'Pending'],
  ['/unit/120-664-33-2-bedroom-apartment-120m-for-sale-in-westdays-6-october', 'Pending'],
  ['/ar/unit/شاليه-غرفتين-نوم-إطلالة-شمالية-للبيع-في-باوز-الساحل-الشمالي-بتقسيط-10-سنوات-2-Bedroom-North-Chalet-for-Sale-in-Pause-North-Coast', 'Pending'],
  ['/ar/unit/شقة-فندقية-67م-بتشطيب-فخم-للبيع-في-مرحلة-يورك-الجار-البريطاني-الشروق-1-Bedroom-Hotel-Apartment-67m-for-Sale-in-York-AlJar-British-District', 'Pending'],
  ['/ar/unit/شاليه-فندقي-علوي-غرفتين-للبيع-2BR-Chalet-Upper-For-Sale', 'Pending'],
  ['/ar/project/Wadi-Yemm-وادي-يم-Ras-El-Hekma', 'Pending'],
  ['/ar/unit/2-lasirena-bay-ras-sedr', 'Pending'],
  ['/ar/unit/jazeel-residence-obour-2nd-floor-apartment-4-b-205', 'Pending'],
  ['/ar/unit/شقة-160م-استلام-فوري-في-كابيتال-هايتس-1-160sqm-Premium-Apartment-for-Sale-in-Capital-Heights-1', 'Pending'],
  ['/unit/67-1-bedroom-hotel-apartment-67m-for-sale-in-york-aljar-british-district', 'Pending'],
  ['/unit/2br-chalet-upper-for-sale', 'Pending'],
  ['/project/sarai-new-cairo', 'Failed'],
  ['/ar/project/قرية-لاسيرينا-ميني-إيجيبت-العين-السخنة-شاليهات-ودوبليكس-بالتقسيط-حتي-6-سنوات-Lasirena-Mini-Egypt-Sokhna-Resort-Fully-Finished-Beachfront-Chalets', 'Failed'],
  ['/ar/project/كمبوند-ليفين-الشروق-طريق-السويس-بالتقسيط-الطويل-حتي-10-سنوات-Livyn-El-Shorouk-Compound-on-Suez-Road-with-Extended-10-Year-Plan', 'Failed'],
  ['/ar/project/نديت-تاور', 'Failed'],
  ['/ar/project/نوبو-رأس-الحكمة', 'Failed'],
  ['/blog/mountain-view-vs-adagio-new-cairo', 'Failed'],
  ['/project/stage-experience-el-shorouk', 'Failed'],
  ['/unit/130-2-bedroom-apartment-130m-for-sale-in-westdays', 'Failed'],
  ['/unit/125-2br-125sqm-fully-finished-apartment-for-sale-in-york-aljar-british-district', 'Failed'],
  ['/project/sodic-east-new-heliopolis-compound', 'Failed'],
  ['/ar/unit/كبانا-غرفة-للبيع-صف-أول-على-اللاجون-في-سيلفر-ساندس-الساحل-الشمالي-1BR-Cabana-for-Sale-in-Silver-Bay-Silversands', 'Failed'],
  ['/ar/unit/شقة-3-غرف-148م-للبيع-في-كمبوند-ريفر-بارك-العبور-الجديدة-بالتقسيط-3-Bedroom-Apartment-148m-for-Sale-in-River-Park-Residence', 'Failed'],
  ['/unit/150-elaia-new-heliopolis-townhouse', 'Failed'],
  ['/ar/unit/vienta-sarai-new-cairo-1249', 'Failed'],
  ['/blog/new-capital-malls-operation-dream-honest-guide', 'Failed'],
  ['/ar/unit/شقة-3-غرف-162م-للبيع-بقسط-شهري-36-ألف-في-كمبوند-ريفر-بارك-العبور-محور-خط-10-3-Bedroom-Apartment-162m-for-Sale-in-River-Park-El-Obour-with-36K-Monthly-Installments', 'Failed'],
  ['/project/patterns-west-october-mall-dahshur', 'Failed'],
  ['/unit/mu12-administrative-office-for-sale-nedit-tower', 'Failed'],
  ['/unit/2-100-2-elaia-new-heliopolis-2-bedroom-apartment', 'Failed'],
  ['/ar/unit/vienta-sarai-new-cairo', 'Failed'],
  ['/project/elaia-new-heliopolis-by-ajad', 'Failed'],
  ['/project/khan-arabesque-commercial-district-old-cairo-launch', 'Failed'],
  ['/ar/unit/شقة-114م-بخصم-25-للتقسيط-على-10-سنوات-in-هايد-بارك-إيست-التجمع-114sqm-Apartment-with-25-Discount-10-Yrs-Plan-in-Hyde-Park-East', 'Failed'],
  ['/ar/project/ابراج-جيزة-داون-تاون', 'Failed'],
];

function parseUrl(path) {
  const isAr = path.startsWith('/ar/');
  const rest = isAr ? path.slice(4) : path.slice(1);
  const [kind, ...slugParts] = rest.split('/');
  const table = kind === 'unit' ? 'units' : kind === 'blog' ? 'blog_posts' : 'projects';
  const slug = decodeURIComponent(slugParts.join('/'));
  return { isAr, table, slug };
}

// Each table has a genuinely different schema - no shared column list is
// safe across all three (units has no city/category, blog_posts has no
// slug_ar/price_value, and each names its rich-body-content field
// differently).
const BODY_COLS = { projects: ['about_blocks', 'about_blocks_ar'], units: ['description_blocks', 'description_blocks_ar'], blog_posts: ['blocks', 'blocks_ar'] };
const HAS_SLUG_AR = { projects: true, units: true, blog_posts: false };
const TABLE_COLS = {
  projects: 'id,slug,slug_ar,seo_title,seo_title_ar,seo_description,seo_description_ar,price_value,created_at,city,category,published,name,about_blocks,about_blocks_ar',
  units: 'id,slug,slug_ar,seo_title,seo_title_ar,seo_description,seo_description_ar,price_value,created_at,location,type,published,name,description_blocks,description_blocks_ar',
  blog_posts: 'id,slug,seo_title,seo_title_ar,seo_description,seo_description_ar,created_at,published,title,blocks,blocks_ar',
};

function colsFor(table) {
  return TABLE_COLS[table];
}

async function findRow(table, slug, isAr) {
  const col = (isAr && HAS_SLUG_AR[table]) ? 'slug_ar' : 'slug';
  const cols = colsFor(table);
  let res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${encodeURIComponent(slug)}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  let rows = await res.json();
  if (Array.isArray(rows) && rows.length) return rows[0];
  if (!Array.isArray(rows)) console.error(`  [findRow error] ${table}/${slug}:`, JSON.stringify(rows).slice(0, 200));
  // an /ar/ URL with no distinct slug_ar (e.g. a Latin-only slug used as-is
  // on both languages) resolves via the plain `slug` column, same as
  // bot-render.js's rawSlugAr-falls-back-to-rawSlug behavior
  if (isAr && col === 'slug_ar') {
    const res2 = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${cols}&slug=eq.${encodeURIComponent(slug)}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    const rows2 = await res2.json();
    if (Array.isArray(rows2) && rows2.length) return rows2[0];
  }
  // fall back through slug_redirects, same as bot-render.js does for renamed slugs
  const redirRes = await fetch(`${SUPA_URL}/rest/v1/slug_redirects?select=row_id&table_name=eq.${table}&old_slug=eq.${encodeURIComponent(slug)}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const redir = await redirRes.json();
  if (!Array.isArray(redir) || !redir.length) return null;
  res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${cols}&id=eq.${redir[0].row_id}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  rows = await res.json();
  return (Array.isArray(rows) && rows[0]) || null;
}

function features(r, table) {
  const [bodyEn, bodyAr] = BODY_COLS[table];
  return {
    id: r.id,
    slug: r.slug,
    about_en: (r[bodyEn] || []).length,
    about_ar: (r[bodyAr] || []).length,
    has_seo_title: !!(r.seo_title && r.seo_title.trim()),
    has_seo_title_ar: !!(r.seo_title_ar && r.seo_title_ar.trim()),
    has_seo_desc: !!(r.seo_description && r.seo_description.trim()),
    has_seo_desc_ar: !!(r.seo_description_ar && r.seo_description_ar.trim()),
    has_price_value: !!(r.price_value && r.price_value > 0),
    created_at: r.created_at,
    table,
    city: table === 'projects' ? (r.city || '(none)') : '(n/a - units/blog have no city field)',
    category: table === 'units' ? (r.type || '(n/a)') : (r.category || '(none)'),
  };
}

(async () => {
  const flagged = [];
  const notFound = [];
  for (const [path, status] of NOT_INDEXED_URLS) {
    const { isAr, table, slug } = parseUrl(path);
    const row = await findRow(table, slug, isAr);
    if (!row) { notFound.push(path); continue; }
    flagged.push({ ...features(row, table), table, status, url: path });
  }

  console.log(`Matched ${flagged.length} of ${NOT_INDEXED_URLS.length} not-indexed URLs to DB rows.`);
  if (notFound.length) {
    console.log(`Could not match ${notFound.length}:`);
    for (const p of notFound) console.log('  -', p);
  }

  // dedupe (some rows appear twice - both EN and AR URL flagged for the same project/unit)
  const flaggedIds = new Set(flagged.map((f) => f.table + ':' + f.id));
  console.log(`\n${flaggedIds.size} unique projects/units among the flagged URLs (some appear as both EN and AR).\n`);

  // control group: everything else, published
  const control = [];
  for (const table of ['projects', 'units', 'blog_posts']) {
    const cols = colsFor(table);
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${cols}&published=eq.true`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) { console.error(`  [control error] ${table}:`, JSON.stringify(rows).slice(0, 200)); continue; }
    for (const r of rows) {
      if (flaggedIds.has(table + ':' + r.id)) continue;
      control.push({ ...features(r, table), table });
    }
  }
  console.log(`Control group (rest of published catalog): ${control.length} rows.\n`);

  function avg(arr, key) { return arr.length ? (arr.reduce((s, r) => s + r[key], 0) / arr.length) : 0; }
  function pct(arr, key) { return arr.length ? (100 * arr.filter((r) => r[key]).length / arr.length).toFixed(0) : 0; }
  function avgAgeDays(arr) {
    const now = Date.now();
    const ages = arr.map((r) => (now - new Date(r.created_at).getTime()) / 86400000);
    return ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(0) : 0;
  }

  const uniqueFlagged = [...new Map(flagged.map((f) => [f.table + ':' + f.id, f])).values()];

  console.log('=== Comparison: flagged (not indexed) vs control (rest of catalog) ===\n');
  console.log('Metric                         | Not-indexed | Rest of catalog');
  console.log('-------------------------------|-------------|----------------');
  console.log(`Avg English about_blocks count | ${avg(uniqueFlagged, 'about_en').toFixed(1).padEnd(11)} | ${avg(control, 'about_en').toFixed(1)}`);
  console.log(`Avg Arabic about_blocks count   | ${avg(uniqueFlagged, 'about_ar').toFixed(1).padEnd(11)} | ${avg(control, 'about_ar').toFixed(1)}`);
  console.log(`% with seo_title filled        | ${(pct(uniqueFlagged, 'has_seo_title') + '%').padEnd(11)} | ${pct(control, 'has_seo_title')}%`);
  console.log(`% with seo_description filled  | ${(pct(uniqueFlagged, 'has_seo_desc') + '%').padEnd(11)} | ${pct(control, 'has_seo_desc')}%`);
  console.log(`% with price_value filled      | ${(pct(uniqueFlagged, 'has_price_value') + '%').padEnd(11)} | ${pct(control, 'has_price_value')}%`);
  console.log(`Avg age (days since created)   | ${avgAgeDays(uniqueFlagged).padEnd(11)} | ${avgAgeDays(control)}`);
  console.log('');

  // city/category distribution
  function dist(arr, key) {
    const d = {};
    for (const r of arr) d[r[key] || '(none)'] = (d[r[key] || '(none)'] || 0) + 1;
    return d;
  }

  function tableRate(arr) {
    const total = arr.length;
    const counts = dist(arr, 'table');
    const out = {};
    for (const [k, v] of Object.entries(counts)) out[k] = `${v} (${(100 * v / total).toFixed(0)}%)`;
    return out;
  }
  console.log('Table-type mix - not-indexed:', tableRate(uniqueFlagged));
  console.log('Table-type mix - rest of catalog:', tableRate(control));
  console.log('');
  console.log('Category distribution (not-indexed):', dist(uniqueFlagged, 'category'));
  console.log('Category distribution (rest of catalog):', dist(control, 'category'));
  console.log('');
  console.log('City distribution (not-indexed, projects only):', dist(uniqueFlagged.filter((r) => r.table === 'projects'), 'city'));
  console.log('City distribution (rest of catalog, projects only):', dist(control.filter((r) => r.table === 'projects'), 'city'));

  const fs = require('fs');
  fs.writeFileSync(require('path').join(__dirname, 'indexed-vs-notindexed-raw.json'), JSON.stringify({ flagged: uniqueFlagged, controlSummary: { count: control.length } }, null, 2));
})();
