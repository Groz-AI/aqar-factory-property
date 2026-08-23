const fs = require('fs');
const GBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const GENERIC_TITLES = [
  'Project — Aqar Factory', 'Unit — Aqar Factory', 'Blog — Aqar Factory',
  'Project not found — Aqar Factory', 'Unit not found — Aqar Factory'
];

(async () => {
  const sm = await fetch('https://www.aqar-factory.com/sitemap.xml', { headers: { 'User-Agent': GBOT } });
  const xml = await sm.text();
  console.log('sitemap status:', sm.status, 'bytes:', xml.length);
  const locs = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&').trim());
  console.log('total <loc> entries:', locs.length);

  // structural checks on the sitemap itself
  const dupes = locs.filter((l, i) => locs.indexOf(l) !== i);
  const doubleSlash = locs.filter(l => /(?<!:)\/\//.test(l.replace('https://', '')));
  const encodedSlash = locs.filter(l => /%2F/i.test(l));
  console.log('duplicate locs:', [...new Set(dupes)].length);
  console.log('double-slash locs:', doubleSlash.length, doubleSlash.slice(0, 5));
  console.log('encoded-slash locs:', encodedSlash.length, encodedSlash.slice(0, 5));

  // live-check every sitemap URL
  const results = [];
  let i = 0;
  const CONC = 6;
  async function worker() {
    while (i < locs.length) {
      const my = i++;
      const url = locs[my];
      const rec = { url, issues: [] };
      try {
        const r = await fetch(url, { headers: { 'User-Agent': GBOT }, redirect: 'manual' });
        rec.status = r.status;
        if (r.status >= 300 && r.status < 400) {
          rec.location = r.headers.get('location');
          rec.issues.push('sitemap_url_redirects');
        } else if (r.status !== 200) {
          rec.issues.push('bad_status_' + r.status);
        } else {
          const html = await r.text();
          const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          rec.title = tm ? tm[1].trim() : null;
          const rm = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
          if (rm && /noindex/i.test(rm[0])) rec.issues.push('noindex');
          if (!rec.title) rec.issues.push('no_title');
          else if (GENERIC_TITLES.includes(rec.title)) rec.issues.push('generic_title');
          const cm = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i);
          rec.canonical = cm ? (cm[0].match(/href=["']([^"']+)["']/) || [])[1] : null;
          if (!rec.canonical) rec.issues.push('no_canonical');
        }
      } catch (e) { rec.issues.push('fetch_error:' + e.message); }
      results[my] = rec;
      if (my % 50 === 0) process.stderr.write(`  ...${my}/${locs.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync('results-sitemap.json', JSON.stringify(results, null, 1));
  const bad = results.filter(r => r.issues.length);
  console.log('\nSITEMAP URLS CHECKED:', results.length, '| CLEAN:', results.length - bad.length, '| ISSUES:', bad.length);
  const byIssue = {};
  bad.forEach(r => r.issues.forEach(is => { byIssue[is] = (byIssue[is] || 0) + 1; }));
  console.log('ISSUE BREAKDOWN:', JSON.stringify(byIssue, null, 1));
  bad.slice(0, 25).forEach(r => {
    console.log(`\n [${r.issues.join(',')}] ${r.url}`);
    if (r.location) console.log(`   -> ${r.location}`);
    if (r.title) console.log(`   title: ${r.title.slice(0, 80)}`);
    if (r.canonical) console.log(`   canon: ${r.canonical}`);
  });
})();
