const fs = require('fs');
const GBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const GENERIC = ['Project — Aqar Factory', 'Unit — Aqar Factory', 'Blog — Aqar Factory',
  'Project not found — Aqar Factory', 'Unit not found — Aqar Factory'];

const inputFile = process.argv[2] || 'gsc-noindex-export.txt';
const urls = fs.readFileSync(inputFile, 'utf8').trim().split(/\r?\n/).filter(Boolean);

async function follow(startUrl) {
  const rec = { hops: [], issues: [] };
  let cur = startUrl;
  for (let n = 0; n < 6; n++) {
    const r = await fetch(cur, { headers: { 'User-Agent': GBOT }, redirect: 'manual' });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      rec.hops.push(`${r.status}`);
      if (!loc) { rec.issues.push('redirect_no_location'); return rec; }
      cur = new URL(loc, cur).toString();
      continue;
    }
    rec.finalUrl = cur;
    rec.status = r.status;
    if (r.status !== 200) { rec.issues.push('final_status_' + r.status); return rec; }
    const html = await r.text();
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    rec.title = tm ? tm[1].trim() : null;
    const rm = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
    if (rm && /noindex/i.test(rm[0])) rec.issues.push('STILL_NOINDEX');
    if (!rec.title) rec.issues.push('no_title');
    else if (GENERIC.includes(rec.title)) rec.issues.push('GENERIC_TITLE_soft_404');
    return rec;
  }
  rec.issues.push('too_many_redirects');
  return rec;
}

(async () => {
  const results = [];
  let i = 0;
  const CONC = 5;
  async function worker() {
    while (i < urls.length) {
      const my = i++;
      results[my] = { url: urls[my], ...(await follow(urls[my])) };
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));

  const healthy = results.filter(r => !r.issues.length);
  const broken = results.filter(r => r.issues.length);
  console.log('TOTAL FROM GSC EXPORT:', results.length);
  console.log('HEALTHY (redirects to a real, indexable page):', healthy.length);
  console.log('BROKEN:', broken.length);
  console.log('\n=== ALL 35, WITH FULL DETAIL ===');
  results.forEach((r, idx) => {
    const flag = r.issues.length ? '  <<< PROBLEM: ' + r.issues.join(',') : '  OK';
    console.log(`${idx + 1}. ${r.url}`);
    console.log(`   hops: ${r.hops.join(' -> ') || '(none, direct)'} -> final ${r.status}${flag}`);
    if (r.title) console.log(`   title: ${r.title.slice(0, 70)}`);
  });
})();
