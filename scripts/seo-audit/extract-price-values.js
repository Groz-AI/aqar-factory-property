#!/usr/bin/env node
// Dry-run: for every published project/unit missing price_value but holding a
// human-written price string, extract a candidate numeric price_value and
// report it. Does NOT write to the database — read-only preview.

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

// Arabic-Indic digits -> ASCII, so "٢٢٬٨٤٠٬٠٠٠" parses too.
const AR_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
const normalizeDigits = (s) => s.replace(/[٠-٩]/g, (d) => AR_DIGITS[d]);

// Finds the first "real" price-looking number: 5+ digit groups, optionally
// comma/thousand-separated (e.g. 22,840,000 or 22840000), ignoring small
// numbers like "10%" or "5 سنوات" that aren't prices. Any number sitting
// right after "مقدم" (down payment) / "قسط" (installment) is a down-payment
// or monthly-installment figure, not the price - it's rejected even if it's
// the only number in the string, so a downpayment never gets written into
// price_value as if it were the total price.
const DOWNPAYMENT_WORD_RE = /(مقدم|قسط|دفعة|جدية|جديه|EOI)[^\d]{0,15}$/i;
// "سعر المتر" / "سعر متر" = price PER SQUARE METER, not the total price -
// writing that into price_value would be wrong by orders of magnitude, not
// just imprecise (e.g. "price/m2 starts from 18,000" is not "project costs 18,000").
const PER_METER_RE = /متر[^\d]{0,15}$/;
// Rows manually reviewed and excluded: a single "مقدم" (down payment) mention
// covering two clauses joined by "و" ("down payment starts from X for studios
// and Y for chalets") - no real total price appears anywhere in the text, but
// the second clause's number isn't close enough to "مقدم" for DOWNPAYMENT_WORD_RE
// to catch it. Needs a human to supply the actual price.
const MANUAL_EXCLUDE_SLUGS = new Set(['125-sadaf-north-coast-resort-studios-chalets-from-125k-dp']);

function extractPrice(text) {
  const norm = normalizeDigits(text);
  const re = /\d{1,3}(?:[,،]\d{3})+|\d{6,}/g;
  let match;
  while ((match = re.exec(norm))) {
    const digits = match[0].replace(/[,،]/g, '');
    const n = parseInt(digits, 10);
    if (n < 10000) continue; // filter out years, percentages, phone-like fragments
    const before = norm.slice(0, match.index);
    if (DOWNPAYMENT_WORD_RE.test(before)) continue; // this number is a down payment, not the price
    if (PER_METER_RE.test(before)) continue; // this number is a per-sqm rate, not the total price
    return n;
  }
  return null;
}

async function fetchTable(table) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=slug,name,price,price_value&published=eq.true`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  return res.json();
}

(async () => {
  const results = [];
  for (const table of ['projects', 'units']) {
    const rows = await fetchTable(table);
    for (const r of rows) {
      const missing = !r.price_value || r.price_value <= 0;
      if (!missing) continue;
      if (!r.price || !String(r.price).trim()) continue; // no text to recover from
      const candidate = MANUAL_EXCLUDE_SLUGS.has(r.slug) ? null : extractPrice(String(r.price));
      results.push({ table, slug: r.slug, name: r.name, price_text: r.price, candidate_price_value: candidate });
    }
  }

  const ok = results.filter((r) => r.candidate_price_value != null);
  const failed = results.filter((r) => r.candidate_price_value == null);

  console.log(`\n${ok.length} of ${results.length} recoverable rows got a confident extraction.`);
  console.log(`${failed.length} could not be auto-extracted (text price didn't match the expected pattern) — needs a human look.\n`);

  console.log('=== Extracted (preview only, nothing written) ===');
  for (const r of ok) {
    console.log(`[${r.table}] ${r.slug}`);
    console.log(`  price text: ${r.price_text}`);
    console.log(`  -> candidate price_value: ${r.candidate_price_value}`);
    console.log('');
  }

  if (failed.length) {
    console.log('=== Could NOT auto-extract (needs manual entry) ===');
    for (const r of failed) {
      console.log(`[${r.table}] ${r.slug}: "${r.price_text}"`);
    }
  }

  const fs = require('fs');
  const path = require('path');
  const csvPath = path.join(__dirname, 'price-value-extraction-preview.csv');
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['table', 'slug', 'name', 'price_text', 'candidate_price_value', 'status'];
  const lines = [header.join(',')];
  for (const r of results) {
    lines.push([r.table, r.slug, r.name, r.price_text, r.candidate_price_value ?? '', r.candidate_price_value != null ? 'OK' : 'NEEDS_REVIEW'].map(esc).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
  console.log(`\nFull preview CSV written to ${csvPath}`);
})();
