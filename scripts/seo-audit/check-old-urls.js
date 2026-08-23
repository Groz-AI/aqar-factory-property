const d = require('./slugs.json');
const fs = require('fs');

const GBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const ORIGIN = 'https://www.aqar-factory.com';
const strip = (s) => String(s || '').replace(/^\/+|\/+$/g, '');
const GENERIC_TITLES = [
  'Project — Aqar Factory', 'Unit — Aqar Factory', 'Blog — Aqar Factory',
  'Project not found — Aqar Factory', 'Unit not found — Aqar Factory'
];

// Reproduce the OLD url shapes Google still has indexed. Includes the
// "dirty" leading-slash variant, which is exactly what broke validation.
const targets = [];
function add(file, kind, slug, lang, note) {
  const base = lang === 'ar' ? `${ORIGIN}/ar/${file}` : `${ORIGIN}/${file}`;
  const param = file === 'blog-post.html' ? 'slug' : 'id';
  targets.push({ kind, lang, note, url: `${base}?${param}=${encodeURIComponent(slug)}` });
}
for (const p of d.projects) {
  add('project.html', 'project', strip(p.slug), 'en', 'clean');
  add('project.html', 'project', '/' + strip(p.slug), 'en', 'leading-slash');
  const ar = strip(p.slug_ar) || strip(p.slug);
  add('project.html', 'project', ar, 'ar', 'clean');
}
for (const u of d.units) {
  add('unit.html', 'unit', strip(u.slug), 'en', 'clean');
  add('unit.html', 'unit', '/' + strip(u.slug), 'en', 'leading-slash');
  const ar = strip(u.slug_ar) || strip(u.slug);
  add('unit.html', 'unit', ar, 'ar', 'clean');
}
for (const b of d.posts) {
  add('blog-post.html', 'blog', strip(b.slug), 'en', 'clean');
  add('blog-post.html', 'blog', strip(b.slug), 'ar', 'clean');
}

async function follow(startUrl) {
  const rec = { url: startUrl, hops: [], issues: [] };
  let cur = startUrl;
  for (let n = 0; n < 6; n++) {
    const r = await fetch(cur, { headers: { 'User-Agent': GBOT }, redirect: 'manual' });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      rec.hops.push(`${r.status} -> ${loc}`);
      if (!loc) { rec.issues.push('redirect_no_location'); return rec; }
      cur = new URL(loc, cur).toString();
      continue;
    }
    rec.finalUrl = cur;
    rec.status = r.status;
    if (r.status !== 200) { rec.issues.push('bad_status_' + r.status); return rec; }
    const html = await r.text();
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    rec.title = tm ? tm[1].trim() : null;
    const rm = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
    if (rm && /noindex/i.test(rm[0])) rec.issues.push('noindex');
    if (!rec.title) rec.issues.push('no_title');
    else if (GENERIC_TITLES.includes(rec.title)) rec.issues.push('generic_title');
    if (rec.hops.length === 0) rec.issues.push('no_redirect_happened');
    if (/%2F/i.test(cur)) rec.issues.push('encoded_slash_in_final_url');
    return rec;
  }
  rec.issues.push('too_many_redirects');
  return rec;
}

(async () => {
  const results = [];
  const CONC = 6;
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const my = i++;
      const t = targets[my];
      const r = await follow(t.url);
      results[my] = { ...t, ...r };
      if (my % 40 === 0) process.stderr.write(`  ...${my}/${targets.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync('results-old.json', JSON.stringify(results, null, 1));
  const bad = results.filter(r => r.issues.length);
  console.log('TOTAL OLD-FORMAT URLS CHECKED:', results.length);
  console.log('CLEAN:', results.length - bad.length);
  console.log('WITH ISSUES:', bad.length);
  const byIssue = {};
  bad.forEach(r => r.issues.forEach(is => { byIssue[is] = (byIssue[is] || 0) + 1; }));
  console.log('\nISSUE BREAKDOWN:', JSON.stringify(byIssue, null, 1));
  bad.slice(0, 30).forEach(r => {
    console.log(`\n [${r.issues.join(',')}] (${r.note}) ${r.url}`);
    console.log(`   hops: ${r.hops.join(' | ')}`);
    console.log(`   title: ${(r.title || '(none)').slice(0, 90)}`);
  });
  // sanity: show a couple of good leading-slash examples
  const ls = results.filter(r => r.note === 'leading-slash' && !r.issues.length).slice(0, 2);
  console.log('\nSAMPLE OK leading-slash redirects:');
  ls.forEach(r => console.log(`  ${r.url}\n    hops: ${r.hops.join(' | ')}\n    title: ${(r.title||'').slice(0,70)}`));
})();
