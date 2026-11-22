#!/usr/bin/env node
// Audits every published project, unit and blog post for missing or
// wrong-language seo_title / seo_title_ar (and seo_description / seo_description_ar).
// "Missing" = empty/null. "Wrong-language" = the field is non-empty but its
// content is in the other language (e.g. Arabic text sitting in the English
// seo_title column) - this is the swap bug found manually on 2026-09-18.
//
// Usage: node scripts/seo-audit/check-seo-titles.js [--all]
//   --all   include unpublished rows too (default: published only, i.e. live pages)

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

const BASE = 'https://www.aqar-factory.com';
const ARABIC_RE = /[؀-ۿ]/;
const onlyIncludesLatinLike = (s) => !!s && !ARABIC_RE.test(s);

const TABLES = {
  projects: { kindPath: 'project', hasSlugAr: true, nameField: 'name', nameArField: 'name_ar' },
  units: { kindPath: 'unit', hasSlugAr: true, nameField: 'name', nameArField: 'name_ar' },
  blog_posts: { kindPath: 'blog', hasSlugAr: false, nameField: 'title', nameArField: 'title_ar' },
};

async function fetchAll(table, includeUnpublished) {
  const { hasSlugAr, nameField, nameArField } = TABLES[table];
  const cols = ['id', 'slug', hasSlugAr ? 'slug_ar' : null, 'seo_title', 'seo_title_ar', 'seo_description', 'seo_description_ar', nameField, nameArField]
    .filter((v, i, a) => v && a.indexOf(v) === i) // drop nulls, dedupe
    .join(',');
  const pub = includeUnpublished ? '' : '&published=eq.true';
  const url = `${SUPA_URL}/rest/v1/${table}?select=${cols}${pub}&order=slug.asc`;
  const res = await fetch(url, { headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` } });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} - ${await res.text()}`);
  return res.json();
}

function classify(enVal, arVal) {
  const enEmpty = !enVal || !String(enVal).trim();
  const arEmpty = !arVal || !String(arVal).trim();
  const issues = [];
  if (enEmpty && arEmpty) issues.push('MISSING_BOTH');
  else {
    if (enEmpty) issues.push('MISSING_EN');
    if (arEmpty) issues.push('MISSING_AR');
  }
  // wrong-language checks only make sense when the field is actually populated
  if (!enEmpty && ARABIC_RE.test(enVal)) issues.push('EN_FIELD_HAS_ARABIC');
  if (!arEmpty && onlyIncludesLatinLike(arVal)) issues.push('AR_FIELD_LOOKS_ENGLISH_ONLY');
  return issues;
}

function urlsFor(table, row) {
  const { kindPath, hasSlugAr } = TABLES[table];
  const rawSlug = String(row.slug || '').replace(/^\/+|\/+$/g, '');
  const rawSlugAr = (hasSlugAr && row.slug_ar) ? String(row.slug_ar).replace(/^\/+|\/+$/g, '') : rawSlug;
  return {
    en: `${BASE}/${kindPath}/${encodeURI(rawSlug)}`,
    ar: `${BASE}/ar/${kindPath}/${encodeURI(rawSlugAr)}`,
  };
}

(async () => {
  const includeUnpublished = process.argv.includes('--all');
  const rows = [];

  for (const table of Object.keys(TABLES)) {
    const data = await fetchAll(table, includeUnpublished);
    const { nameField, nameArField } = TABLES[table];
    for (const r of data) {
      const titleIssues = classify(r.seo_title, r.seo_title_ar);
      const descIssues = classify(r.seo_description, r.seo_description_ar);
      if (titleIssues.length === 0 && descIssues.length === 0) continue; // clean row, skip
      const { en, ar } = urlsFor(table, r);
      rows.push({
        table,
        slug: r.slug,
        name: r[nameField] || '',
        name_ar: r[nameArField] || '',
        url_en: en,
        url_ar: ar,
        seo_title: r.seo_title || '',
        seo_title_ar: r.seo_title_ar || '',
        title_issues: titleIssues.join('|'),
        seo_description: (r.seo_description || '').slice(0, 60),
        seo_description_ar: (r.seo_description_ar || '').slice(0, 60),
        desc_issues: descIssues.join('|'),
      });
    }
  }

  // console report
  console.log(`\nChecked all published rows across projects, units, blog_posts.`);
  console.log(`Found ${rows.length} pages with a title and/or description issue.\n`);

  const byIssue = {};
  for (const r of rows) {
    for (const i of [...r.title_issues.split('|'), ...r.desc_issues.split('|')].filter(Boolean)) {
      byIssue[i] = (byIssue[i] || 0) + 1;
    }
  }
  console.log('Issue breakdown:');
  for (const [k, v] of Object.entries(byIssue)) console.log(`  ${k}: ${v}`);
  console.log('');

  for (const r of rows) {
    console.log(`[${r.table}] ${r.slug}`);
    if (r.title_issues) {
      console.log(`  TITLE ISSUE: ${r.title_issues}`);
      console.log(`    seo_title:    ${JSON.stringify(r.seo_title)}`);
      console.log(`    seo_title_ar: ${JSON.stringify(r.seo_title_ar)}`);
    }
    if (r.desc_issues) {
      console.log(`  DESC ISSUE: ${r.desc_issues}`);
      console.log(`    seo_description:    ${JSON.stringify(r.seo_description)}`);
      console.log(`    seo_description_ar: ${JSON.stringify(r.seo_description_ar)}`);
    }
    console.log(`  EN: ${r.url_en}`);
    console.log(`  AR: ${r.url_ar}`);
    console.log('');
  }

  // CSV export
  const fs = require('fs');
  const path = require('path');
  const csvPath = path.join(__dirname, 'seo-title-audit.csv');
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['table', 'slug', 'name', 'name_ar', 'url_en', 'url_ar', 'title_issues', 'seo_title', 'seo_title_ar', 'desc_issues', 'seo_description', 'seo_description_ar'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map((h) => esc(r[h] ?? '')).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
  console.log(`Full CSV written to ${csvPath}`);
})().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
