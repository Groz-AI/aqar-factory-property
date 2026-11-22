#!/usr/bin/env node
// Builds the final "needs manual price entry" list: the 22 rows the extractor
// couldn't safely resolve, each tagged with WHY (so whoever fills them in
// knows what to look for), plus both live URLs for quick reference.

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';
const BASE = 'https://www.aqar-factory.com';

function reasonFor(text) {
  if (/سعر\s*المتر|سعر\s*متر/i.test(text)) return 'Only a price-per-sqm rate is mentioned, not a total price';
  if (/(جدية|EOI)/i.test(text) && !/أسعار|إجمالي|صافي|سعر(?!\s*متر)/i.test(text)) return 'Only a booking/EOI deposit fee is mentioned, not the total price';
  if (/مقدم/.test(text) && !/أسعار|إجمالي|صافي|سعر(?!\s*متر)/i.test(text)) return 'Only a down payment is mentioned, not the total price';
  if (/[٠-٩]|[ء-ي]/.test(text) && !/\d/.test(text.replace(/[٠-٩]/g, 'x'))) return 'Price is written in words, not digits';
  if (!text || !text.trim()) return 'Price field is empty';
  return 'No confidently-parseable total price found in the text';
}

async function fetchTable(table, kindPath, hasSlugAr) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=slug,slug_ar,name,name_ar,price,price_value&published=eq.true`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const rows = await res.json();
  return rows.map((r) => ({ ...r, table, kindPath, hasSlugAr }));
}

(async () => {
  const all = [
    ...(await fetchTable('projects', 'project', true)),
    ...(await fetchTable('units', 'unit', true)),
  ];

  const missing = all.filter((r) => !r.price_value || r.price_value <= 0);
  const rows = missing.map((r) => {
    const rawSlug = String(r.slug || '').replace(/^\/+|\/+$/g, '');
    const rawSlugAr = (r.hasSlugAr && r.slug_ar) ? String(r.slug_ar).replace(/^\/+|\/+$/g, '') : rawSlug;
    return {
      table: r.table,
      slug: r.slug,
      name: r.name || '',
      name_ar: r.name_ar || '',
      current_price_text: r.price || '',
      reason: reasonFor(r.price || ''),
      url_en: `${BASE}/${r.kindPath}/${encodeURI(rawSlug)}`,
      url_ar: `${BASE}/ar/${r.kindPath}/${encodeURI(rawSlugAr)}`,
    };
  });

  console.log(`${rows.length} rows still need a human-entered price_value.\n`);
  const byReason = {};
  for (const r of rows) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
  for (const [k, v] of Object.entries(byReason)) console.log(`  ${v}x - ${k}`);

  const fs = require('fs');
  const path = require('path');
  const csvPath = path.join(__dirname, 'needs-review-prices.csv');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['table', 'slug', 'name', 'name_ar', 'current_price_text', 'reason', 'url_en', 'url_ar'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(','));
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
  console.log(`\nWritten to ${csvPath}`);
})();
