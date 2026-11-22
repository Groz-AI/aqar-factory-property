// Spot-checks N random pages live: EN + AR, bot and real-browser paths.
const SUPA = 'https://api.aqar-factory.com/rest/v1';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84';
const N = +process.argv[2] || 20;
const ar = (s) => (String(s).match(/[؀-ۿ]/g) || []).length, lat = (s) => (String(s).match(/[A-Za-z]/g) || []).length;
const BOT = { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' };
const BROWSER = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
async function page(url, headers) {
  const r = await fetch(`${url}?_cb=${Math.random().toString(36).slice(2)}`, { headers, redirect: 'follow' });
  const h = await r.text();
  const blocks = [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  const faq = blocks.filter(Boolean).flatMap((j) => j['@graph'] || [j]).filter((n) => n['@type'] === 'FAQPage');
  const visible = [...h.matchAll(/<details class="faq-item"[\s\S]*?<summary[^>]*>([\s\S]*?)(?:<div|<\/summary)/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim());
  return { status: r.status, schema: faq.length ? faq[0].mainEntity : [], faqNodes: faq.length, visible, badJson: blocks.includes(null) };
}
(async () => {
  // expected FAQs come straight from the database (current state, incl. admin edits)
  const rows = async (t) => (await (await fetch(`${SUPA}/${t}?select=id,slug,slug_ar,faqs,faqs_ar&published=eq.true`, { headers: { apikey: KEY } })).json()).map((r) => ({ ...r, table: t }));
  const pool = [...(await rows('projects')), ...(await rows('units'))].filter((p) => (p.faqs || []).length && (p.faqs_ar || []).length).sort(() => Math.random() - 0.5);
  const picks = [...pool.filter((p) => p.table === 'projects').slice(0, N / 2), ...pool.filter((p) => p.table === 'units').slice(0, N / 2)];
  let pass = 0, fail = 0;
  for (const p of picks) {
    const row = p;
    const kind = p.table === 'projects' ? 'project' : 'unit';
    const tests = [
      ['EN bot', `https://www.aqar-factory.com/${kind}/${row.slug}`, BOT, p.faqs],
      ['EN browser', `https://www.aqar-factory.com/${kind}/${row.slug}`, BROWSER, p.faqs],
      ['AR bot', `https://www.aqar-factory.com/ar/${kind}/${encodeURIComponent(row.slug_ar || row.slug)}`, BOT, p.faqs_ar],
      ['AR browser', `https://www.aqar-factory.com/ar/${kind}/${encodeURIComponent(row.slug_ar || row.slug)}`, BROWSER, p.faqs_ar],
    ];
    const res = [];
    for (const [label, url, hdr, exp] of tests) {
      const isAr = label.startsWith('AR');
      let g;
      try { g = await page(url, hdr); } catch (e) { res.push(`${label}: ERROR ${e.message}`); continue; }
      const errs = [];
      if (g.status !== 200) errs.push('HTTP ' + g.status);
      if (g.schema.length !== exp.length) errs.push(`schema ${g.schema.length}/${exp.length}`);
      if (g.faqNodes !== 1) errs.push(`FAQPage nodes ${g.faqNodes}`);
      if (g.visible.length !== exp.length) errs.push(`visible ${g.visible.length}/${exp.length}`);
      if (exp.some((e, i) => !g.schema[i] || g.schema[i].name !== e.q || g.schema[i].acceptedAnswer.text !== e.a.trim())) errs.push('questions/answers differ from database');
      if (exp.some((e, i) => !g.visible[i] || g.visible[i] !== e.q)) errs.push('visible questions differ from database');
      const text = g.schema.map((x) => x.name + x.acceptedAnswer.text).join(' ');
      if (isAr && g.schema.length && ar(g.schema.map((x) => x.name).join(' ')) < 10) errs.push('AR questions not Arabic');
      if (!isAr && ar(text) > 0) errs.push('Arabic text in EN FAQ');
      if (g.badJson) errs.push('invalid JSON-LD');
      res.push(`${label}: ${errs.length ? 'FAIL ' + errs.join(', ') : 'ok'}`);
    }
    const bad = res.filter((r) => !r.endsWith('ok'));
    bad.length ? fail++ : pass++;
    console.log(`${bad.length ? 'FAIL' : 'PASS'}  ${kind.padEnd(7)} ${row.slug.slice(0, 55)}${bad.length ? '\n        ' + bad.join('\n        ') : ''}`);
  }
  console.log(`\n${pass} pages passed all 4 checks, ${fail} failed (of ${picks.length}).`);
})();
