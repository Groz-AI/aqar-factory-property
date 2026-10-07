#!/usr/bin/env node
// Crawls the live site the way Googlebot does (Googlebot UA, so middleware
// serves api/bot-render.js), starting from the homepage in both languages and
// following every internal <a href>. For every URL it records click depth,
// inbound links, status, response time and canonical, then compares the
// result against every URL in sitemap.xml.
//
// Usage: node scripts/seo-audit/googlebot-crawl.js

const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://www.aqar-factory.com';
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const CONCURRENCY = 4;
const SKIP_EXT = /\.(css|js|png|jpe?g|gif|webp|svg|ico|pdf|xml|txt|json|mp4|woff2?|ttf|jfif)$/i;

// one canonical string per page: decoded path, no query/hash, no trailing slash
function norm(href, base) {
  let u;
  try { u = new URL(href, base); } catch (_) { return null; }
  if (!/^(www\.)?aqar-factory\.com$/i.test(u.hostname)) return null;
  let p = u.pathname;
  try { p = decodeURIComponent(p); } catch (_) { /* keep raw */ }
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (SKIP_EXT.test(p) && !/\.html$/i.test(p)) return null;
  if (/^\/(admin|api)\b/.test(p)) return null;
  if (p === '/index.html') p = '/';
  if (p === '/ar/index.html') p = '/ar';
  return p;
}
const toUrl = (p) => ORIGIN + p.split('/').map((s) => encodeURIComponent(s)).join('/');

async function fetchPage(p) {
  const t0 = Date.now();
  try {
    const r = await fetch(toUrl(p), { headers: { 'User-Agent': UA }, redirect: 'manual' });
    const ms = Date.now() - t0;
    const out = { status: r.status, ms, cache: r.headers.get('x-vercel-cache') || '' };
    if (r.status >= 300 && r.status < 400) out.location = norm(r.headers.get('location') || '', toUrl(p));
    if (r.status === 200) {
      const html = await r.text();
      out.bytes = html.length;
      const base = (html.match(/<base\s+href="([^"]*)"/i) || [])[1];
      const baseUrl = base ? new URL(base, toUrl(p)).href : toUrl(p);
      out.canonical = norm((html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1] || '', baseUrl);
      out.noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);
      out.title = ((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '').trim();
      out.links = [...new Set([...html.matchAll(/<a\s[^>]*href="([^"#][^"]*)"/gi)].map((m) => norm(m[1].replace(/&amp;/g, '&'), baseUrl)).filter(Boolean))];
    }
    return out;
  } catch (e) {
    return { status: 'ERR', ms: Date.now() - t0, error: e.message };
  }
}

(async () => {
  const pages = new Map(); // path -> record
  const inbound = new Map(); // path -> Set(from)
  let frontier = ['/', '/ar'];
  for (const s of frontier) pages.set(s, { depth: 0 });
  let depth = 0;
  while (frontier.length) {
    const next = [];
    let i = 0;
    const worker = async () => {
      while (i < frontier.length) {
        const p = frontier[i++];
        const rec = Object.assign(pages.get(p), await fetchPage(p));
        const outLinks = (rec.links || []).concat(rec.location ? [rec.location] : []);
        for (const l of outLinks) {
          if (!inbound.has(l)) inbound.set(l, new Set());
          if (l !== p) inbound.get(l).add(p);
          if (!pages.has(l)) { pages.set(l, { depth: depth + 1 }); next.push(l); }
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`depth ${depth}: crawled ${frontier.length} pages, found ${next.length} new`);
    frontier = next;
    depth++;
  }

  // sitemap
  const sm = await (await fetch(ORIGIN + '/sitemap.xml', { headers: { 'User-Agent': UA } })).text();
  const sitemap = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1].replace(/&amp;/g, '&'), ORIGIN)).filter(Boolean);

  const rows = [];
  for (const p of new Set([...sitemap, ...pages.keys()])) {
    const r = pages.get(p) || {};
    rows.push({
      path: p,
      in_sitemap: sitemap.includes(p),
      reached_by_links: pages.has(p),
      depth: pages.has(p) ? r.depth : '',
      inbound_links: inbound.has(p) ? inbound.get(p).size : 0,
      status: r.status || '',
      ms: r.ms || '',
      cache: r.cache || '',
      redirect_to: r.location || '',
      canonical: r.canonical || '',
      canonical_ok: r.status === 200 ? r.canonical === p : '',
      noindex: r.noindex || false,
      out_links: (r.links || []).length,
      title: r.title || '',
    });
  }

  // fetch sitemap URLs the crawl never reached, so their status/speed is known too
  const unreached = rows.filter((r) => r.in_sitemap && !r.reached_by_links);
  let k = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (k < unreached.length) {
      const r = unreached[k++];
      const f = await fetchPage(r.path);
      Object.assign(r, { status: f.status, ms: f.ms, cache: f.cache || '', redirect_to: f.location || '', canonical: f.canonical || '', canonical_ok: f.status === 200 ? f.canonical === r.path : '', noindex: f.noindex || false, out_links: (f.links || []).length, title: f.title || '' });
    }
  }));

  fs.writeFileSync(path.join(__dirname, 'googlebot-crawl.json'), JSON.stringify(rows, null, 1));
  console.log(`\nwrote ${rows.length} rows`);
})();
