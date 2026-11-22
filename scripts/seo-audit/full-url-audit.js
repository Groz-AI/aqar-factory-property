// Full per-URL SEO audit: every <loc> in the live sitemap, checked as
// Googlebot for status, self-referencing canonical, hreflang correctness,
// noindex absence, and redirect-free delivery. Outputs one CSV row per URL.
const fs = require('fs');
const GBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const ORIGIN = 'https://www.aqar-factory.com';

// only the un-filled DETAIL-page template counts as a defect — "Projects —
// Aqar Factory" etc. are the genuine, correct titles of the listing pages
// themselves, not a placeholder that failed to populate
const GENERIC_TITLES = ['Project — Aqar Factory', 'Unit — Aqar Factory', 'Blog — Aqar Factory'];
// pages that intentionally ship with no static canonical (shared file between
// /page.html and /ar/page.html — see the comment in each of these files)
const NO_CANONICAL_BY_DESIGN = new Set([
  '/', '/ar', '/projects.html', '/ar/projects.html', '/units.html', '/ar/units.html',
  '/blog.html', '/ar/blog.html', '/about.html', '/ar/about.html', '/contact.html', '/ar/contact.html'
]);

function csvEscape(s) {
  s = String(s == null ? '' : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function checkOne(loc) {
  const path = loc.replace(ORIGIN, '');
  const lang = path.startsWith('/ar') ? 'ar' : 'en';
  const row = { url: loc, lang, issues: [] };
  try {
    const r = await fetch(loc, { headers: { 'User-Agent': GBOT }, redirect: 'manual' });
    row.status = r.status;
    if (r.status >= 300 && r.status < 400) {
      row.issues.push('sitemap_url_redirects_should_be_final');
      row.verdict = 'ISSUE';
      row.details = row.issues.join('; ');
      return row;
    }
    if (r.status !== 200) {
      row.issues.push('bad_status_' + r.status);
      row.verdict = 'ISSUE';
      row.details = row.issues.join('; ');
      return row;
    }
    const html = await r.text();
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    row.title = tm ? tm[1].trim() : '';
    // "Blog — Aqar Factory" is the correct real title for the LISTING page
    // (/blog.html) but the unfilled-template symptom on a DETAIL page
    // (/blog/<slug>) — same string, opposite meaning, so gate on path shape
    const isDetailPage = /^\/(ar\/)?(project|unit|blog)\/[^/]/.test(path);
    if (!row.title) row.issues.push('no_title');
    else if (isDetailPage && GENERIC_TITLES.includes(row.title)) row.issues.push('generic_template_title');

    const rm = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
    if (rm && /noindex/i.test(rm[0])) row.issues.push('noindex_present');

    const cm = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
    row.canonical = cm ? cm[1] : '';
    if (!row.canonical) {
      if (!NO_CANONICAL_BY_DESIGN.has(path)) row.issues.push('no_canonical');
    } else if (decodeURIComponent(row.canonical) !== decodeURIComponent(loc)) {
      row.issues.push('canonical_mismatch:' + row.canonical);
    }

    const hreflangs = [...html.matchAll(/<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
      .map(m => ({ lang: m[1], href: m[2] }));
    row.hreflangCount = hreflangs.length;
    const kinds = new Set(hreflangs.map(h => h.lang));
    const isDetailOrStatic = path.match(/^\/(ar\/)?(project|unit|blog)\//) ||
      ['/', '/ar', '/projects.html', '/ar/projects.html', '/units.html', '/ar/units.html',
       '/blog.html', '/ar/blog.html', '/about.html', '/ar/about.html', '/contact.html', '/ar/contact.html'].includes(path);
    if (isDetailOrStatic) {
      if (!kinds.has('en')) row.issues.push('hreflang_missing_en');
      if (!kinds.has('ar')) row.issues.push('hreflang_missing_ar');
      if (!kinds.has('x-default')) row.issues.push('hreflang_missing_xdefault');
    }

    row.verdict = row.issues.length ? 'ISSUE' : 'PASS';
    row.details = row.issues.join('; ');
    return row;
  } catch (e) {
    row.issues.push('fetch_error:' + e.message);
    row.verdict = 'ISSUE';
    row.details = row.issues.join('; ');
    return row;
  }
}

(async () => {
  const smRes = await fetch(ORIGIN + '/sitemap.xml');
  const xml = await smRes.text();
  const locs = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&').trim());
  console.error(`Fetched sitemap: ${locs.length} URLs. Checking each as Googlebot...`);

  const results = new Array(locs.length);
  let i = 0;
  const CONCURRENCY = 6;
  async function worker() {
    while (i < locs.length) {
      const my = i++;
      results[my] = await checkOne(locs[my]);
      if (my % 50 === 0) console.error(`  ...${my}/${locs.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const header = ['url', 'lang', 'status', 'verdict', 'title', 'canonical', 'hreflangCount', 'details'];
  const csvLines = [header.join(',')];
  results.forEach(r => {
    csvLines.push(header.map(k => csvEscape(r[k])).join(','));
  });
  fs.writeFileSync('full-url-audit.csv', csvLines.join('\n'));

  const issues = results.filter(r => r.verdict === 'ISSUE');
  const pass = results.filter(r => r.verdict === 'PASS');
  console.log('\n=== SUMMARY ===');
  console.log('TOTAL URLs checked:', results.length);
  console.log('PASS:', pass.length);
  console.log('ISSUE:', issues.length);
  const byLang = {};
  results.forEach(r => { const k = r.lang + ':' + r.verdict; byLang[k] = (byLang[k] || 0) + 1; });
  console.log('By language:', JSON.stringify(byLang, null, 1));
  const issueTypes = {};
  issues.forEach(r => r.issues.forEach(is => { const key = is.split(':')[0]; issueTypes[key] = (issueTypes[key] || 0) + 1; }));
  console.log('Issue types:', JSON.stringify(issueTypes, null, 1));
  if (issues.length) {
    console.log('\n=== ALL ISSUES ===');
    issues.forEach(r => console.log(`[${r.lang}] ${r.status} ${r.url}\n    ${r.details}`));
  }
  console.log('\nFull CSV written to full-url-audit.csv');
})();
