#!/usr/bin/env node
// Pulls the remaining three open-issue lists fresh from Supabase and writes
// each as its own CSV, ready to be combined into a multi-sheet xlsx.

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';
const BASE = 'https://www.aqar-factory.com';
const fs = require('fs');
const path = require('path');

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function writeCsv(file, header, rows) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(','));
  fs.writeFileSync(path.join(__dirname, file), lines.join('\n'), 'utf8');
  console.log(`${file}: ${rows.length} rows`);
}

function urlsFor(kindPath, slug, slugAr, hasSlugAr) {
  const rawSlug = String(slug || '').replace(/^\/+|\/+$/g, '');
  const rawSlugAr = (hasSlugAr && slugAr) ? String(slugAr).replace(/^\/+|\/+$/g, '') : rawSlug;
  return {
    en: `${BASE}/${kindPath}/${encodeURI(rawSlug)}`,
    ar: `${BASE}/ar/${kindPath}/${encodeURI(rawSlugAr)}`,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  return res.json();
}

(async () => {
  // 1. Missing English body content
  const projects = await fetchJson(`${SUPA_URL}/rest/v1/projects?select=slug,slug_ar,name,name_ar,about_blocks,about_blocks_ar&published=eq.true`);
  const missingContent = projects
    .filter((r) => (!r.about_blocks || r.about_blocks.length === 0) && r.about_blocks_ar && r.about_blocks_ar.length > 0)
    .map((r) => {
      const u = urlsFor('project', r.slug, r.slug_ar, true);
      return { table: 'projects', slug: r.slug, name: r.name, name_ar: r.name_ar, ar_blocks_written: r.about_blocks_ar.length, url_en: u.en, url_ar: u.ar };
    });
  writeCsv('open-issues-missing-content.csv', ['table', 'slug', 'name', 'name_ar', 'ar_blocks_written', 'url_en', 'url_ar'], missingContent);

  // 2. Ambiguous title/description pairs left unresolved by the swap fix
  const AMBIGUOUS_SLUGS = ['hyde-park-one', 'de-joya-4-new-capital', 'adagio-golden-square-new-cairo-compound', 'club-residence-zed-east', 'sodic-westown', 'el-patio-townside'];
  const ambigRows = [];
  for (const table of ['projects']) {
    const rows = await fetchJson(`${SUPA_URL}/rest/v1/${table}?select=slug,slug_ar,name,name_ar,seo_title,seo_title_ar&slug=in.(${AMBIGUOUS_SLUGS.join(',')})`);
    for (const r of rows) {
      const u = urlsFor('project', r.slug, r.slug_ar, true);
      ambigRows.push({ table, slug: r.slug, name: r.name, name_ar: r.name_ar, current_seo_title: r.seo_title, current_seo_title_ar: r.seo_title_ar, url_en: u.en, url_ar: u.ar });
    }
  }
  writeCsv('open-issues-ambiguous-titles.csv', ['table', 'slug', 'name', 'name_ar', 'current_seo_title', 'current_seo_title_ar', 'url_en', 'url_ar'], ambigRows);

  // 3. Stale English slug (Town Ten / Mazaya)
  const staleRows = await fetchJson(`${SUPA_URL}/rest/v1/projects?select=slug,slug_ar,name,name_ar&slug=eq.mazaya-developments-new-obour-compound`);
  const stale = staleRows.map((r) => {
    const u = urlsFor('project', r.slug, r.slug_ar, true);
    return { table: 'projects', slug: r.slug, name: r.name, name_ar: r.name_ar, issue: 'English URL still uses the old developer name (Mazaya); Arabic slug and both name fields already say "Town Ten"', url_en: u.en, url_ar: u.ar };
  });
  writeCsv('open-issues-stale-slug.csv', ['table', 'slug', 'name', 'name_ar', 'issue', 'url_en', 'url_ar'], stale);
})();
