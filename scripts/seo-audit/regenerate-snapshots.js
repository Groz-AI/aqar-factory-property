#!/usr/bin/env node
// Local equivalent of api/prerender.js's "regenerate" action: headless-renders
// the live page (with the bypass header so middleware serves the true CSR page,
// not the stale snapshot) and overwrites the Vercel Blob snapshot under the
// exact same key middleware.js reads. Needed because snapshots only refresh on
// an admin-panel save - direct database edits and code deploys never touch them.
//
// Usage:
//   node scripts/seo-audit/regenerate-snapshots.js --only project:tawny-hyde-park-october
//   node scripts/seo-audit/regenerate-snapshots.js --all

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { put } = require('@vercel/blob');

const SITE_ORIGIN = 'https://www.aqar-factory.com';
const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const blobKey = (kindPath, lang, slug) => `prerendered/${lang}/${kindPath}/${slug}.html`;
const strip = (s) => String(s || '').replace(/^\/+|\/+$/g, '');

async function listItems() {
  const get = async (table, cols) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${cols}&published=eq.true`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    return r.json();
  };
  const [projects, units, posts] = await Promise.all([get('projects', 'slug,slug_ar'), get('units', 'slug,slug_ar'), get('blog_posts', 'slug')]);
  return [
    ...projects.map((r) => ({ kind: 'project', slug: strip(r.slug), slugAr: strip(r.slug_ar) })),
    ...units.map((r) => ({ kind: 'unit', slug: strip(r.slug), slugAr: strip(r.slug_ar) })),
    ...posts.map((r) => ({ kind: 'blog', slug: strip(r.slug), slugAr: '' })),
  ];
}

async function renderOne(browser, url, bypass, lang) {
  const page = await browser.newPage();
  try {
    await page.setExtraHTTPHeaders({ 'x-prerender-bypass': bypass });
    // same fix as api/prerender.js: without a stored preference, i18n.js's
    // Arabic-by-default redirect turns every English render into the Arabic page
    await page.evaluateOnNewDocument((l) => {
      try { localStorage.setItem('realteek_public_lang', l); } catch (_) { /* ignore */ }
    }, lang);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-prerendered-ready]', { timeout: 20000 });
    return await page.content();
  } finally {
    await page.close();
  }
}

(async () => {
  const env = loadEnv();
  const bypass = env.PRERENDER_BYPASS_SECRET;
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!bypass || !token) { console.error('Missing PRERENDER_BYPASS_SECRET or BLOB_READ_WRITE_TOKEN in .env.local'); process.exit(1); }

  let items = await listItems();
  const onlyIdx = process.argv.indexOf('--only');
  if (onlyIdx > -1) {
    const [kind, slug] = process.argv[onlyIdx + 1].split(':');
    items = items.filter((i) => i.kind === kind && i.slug === slug);
  } else if (!process.argv.includes('--all')) {
    console.error('Pass --only kind:slug or --all'); process.exit(1);
  }
  console.log(`${items.length} item(s) to regenerate (x2 languages).`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const failed = [];
  let n = 0;
  try {
    for (const it of items) {
      n++;
      const targets = [
        { lang: 'en', slugForUrl: it.slug, p: `/${it.kind}/${encodeURIComponent(it.slug)}` },
        { lang: 'ar', slugForUrl: it.slugAr || it.slug, p: `/ar/${it.kind}/${encodeURIComponent(it.slugAr || it.slug)}` },
      ];
      const res = {};
      for (const t of targets) {
        try {
          const html = await renderOne(browser, SITE_ORIGIN + t.p, bypass, t.lang);
          if (!html.includes('@graph')) throw new Error('rendered page has no @graph JSON-LD - not caching it');
          const htmlLang = ((html.match(/<html[^>]*\blang="([a-z]+)"/i) || [])[1] || '').toLowerCase();
          if (htmlLang !== t.lang) throw new Error(`rendered page is lang="${htmlLang}", expected "${t.lang}" - not caching it`);
          await put(blobKey(it.kind, t.lang, t.slugForUrl), html, { access: 'public', addRandomSuffix: false, contentType: 'text/html; charset=utf-8', token });
          res[t.lang] = 'ok';
        } catch (e) {
          res[t.lang] = 'ERR ' + (e.message || e);
          failed.push(`${it.kind}/${it.slug} [${t.lang}]: ${e.message || e}`);
        }
      }
      console.log(`[${n}/${items.length}] ${it.kind}/${it.slug}`, res);
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone. ${failed.length} failure(s).`);
  for (const f of failed) console.log('  -', f);
})();
