const d = require('./slugs.json');
const fs = require('fs');

const GBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const ORIGIN = 'https://www.aqar-factory.com';
const strip = (s) => String(s || '').replace(/^\/+|\/+$/g, '');

// generic template titles that mean "the real content never got filled in"
const GENERIC_TITLES = [
  'Project — Aqar Factory', 'Unit — Aqar Factory', 'Blog — Aqar Factory',
  'Project not found — Aqar Factory', 'Unit not found — Aqar Factory'
];

const targets = [];
for (const p of d.projects) {
  targets.push({ kind: 'project', lang: 'en', slug: strip(p.slug), name: p.name, url: `${ORIGIN}/project/${encodeURIComponent(strip(p.slug))}` });
  const ar = strip(p.slug_ar) || strip(p.slug);
  targets.push({ kind: 'project', lang: 'ar', slug: ar, name: p.name, url: `${ORIGIN}/ar/project/${encodeURIComponent(ar)}` });
}
for (const u of d.units) {
  targets.push({ kind: 'unit', lang: 'en', slug: strip(u.slug), name: u.name, url: `${ORIGIN}/unit/${encodeURIComponent(strip(u.slug))}` });
  const ar = strip(u.slug_ar) || strip(u.slug);
  targets.push({ kind: 'unit', lang: 'ar', slug: ar, name: u.name, url: `${ORIGIN}/ar/unit/${encodeURIComponent(ar)}` });
}
for (const b of d.posts) {
  targets.push({ kind: 'blog', lang: 'en', slug: strip(b.slug), name: b.title, url: `${ORIGIN}/blog/${encodeURIComponent(strip(b.slug))}` });
  targets.push({ kind: 'blog', lang: 'ar', slug: strip(b.slug), name: b.title, url: `${ORIGIN}/ar/blog/${encodeURIComponent(strip(b.slug))}` });
}

async function check(t) {
  const rec = { ...t, issues: [] };
  try {
    const r = await fetch(t.url, { headers: { 'User-Agent': GBOT }, redirect: 'manual' });
    rec.status = r.status;
    if (r.status >= 300 && r.status < 400) {
      rec.location = r.headers.get('location');
      rec.issues.push('unexpected_redirect');
      return rec;
    }
    if (r.status !== 200) { rec.issues.push('bad_status_' + r.status); return rec; }
    const html = await r.text();
    rec.len = html.length;
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    rec.title = tm ? tm[1].trim() : null;
    const rm = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
    rec.robots = rm ? rm[0] : null;
    const cm = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i);
    rec.canonical = cm ? (cm[0].match(/href=["']([^"']+)["']/) || [])[1] : null;

    if (!rec.title) rec.issues.push('no_title');
    else if (GENERIC_TITLES.includes(rec.title)) rec.issues.push('generic_title');
    if (rec.robots && /noindex/i.test(rec.robots)) rec.issues.push('noindex');
    if (!rec.canonical) rec.issues.push('no_canonical');
    else if (decodeURIComponent(rec.canonical) !== decodeURIComponent(t.url)) rec.issues.push('canonical_mismatch');
  } catch (e) {
    rec.issues.push('fetch_error:' + (e && e.message));
  }
  return rec;
}

(async () => {
  const results = [];
  const CONC = 6;
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const my = i++;
      results[my] = await check(targets[my]);
      if (my % 25 === 0) process.stderr.write(`  ...${my}/${targets.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync('results.json', JSON.stringify(results, null, 1));
  const bad = results.filter(r => r.issues.length);
  console.log('TOTAL CHECKED:', results.length);
  console.log('CLEAN:', results.length - bad.length);
  console.log('WITH ISSUES:', bad.length);
  const byIssue = {};
  bad.forEach(r => r.issues.forEach(is => { byIssue[is] = (byIssue[is] || 0) + 1; }));
  console.log('\nISSUE BREAKDOWN:', JSON.stringify(byIssue, null, 1));
  console.log('\nFIRST 40 PROBLEM URLS:');
  bad.slice(0, 40).forEach(r => {
    console.log(` [${r.issues.join(',')}] ${r.url}`);
    if (r.title) console.log(`     title: ${r.title.slice(0, 90)}`);
    if (r.canonical) console.log(`     canon: ${r.canonical}`);
    if (r.location) console.log(`     ->loc: ${r.location}`);
  });
})();
