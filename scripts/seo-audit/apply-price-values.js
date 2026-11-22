#!/usr/bin/env node
// Applies the verified price_value fixes from price-value-extraction-preview.csv
// (status === 'OK' rows only) to Supabase, then reads each row back to confirm
// the write actually persisted. Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
// (the anon key has no UPDATE permission on these tables - verified empirically).
//
// Usage: node scripts/seo-audit/apply-price-values.js

const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '..', '.env.local');
  const text = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';

(async () => {
  const env = loadEnvLocal();
  const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local — add it first.');
    process.exit(1);
  }

  const csvPath = path.join(__dirname, 'price-value-extraction-preview.csv');
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const header = rows[0];
  const data = rows.slice(1).filter((r) => r.length === header.length);
  const toApply = data.filter((r) => r[5] === 'OK'); // status column

  console.log(`Applying ${toApply.length} verified price_value fixes...\n`);

  let ok = 0, failed = 0;
  for (const r of toApply) {
    const [table, slug, name, priceText, candidate] = r;
    const priceValue = parseInt(candidate, 10);

    const patchRes = await fetch(`${SUPA_URL}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ price_value: priceValue }),
    });

    if (!patchRes.ok) {
      console.log(`FAILED [${table}] ${slug}: HTTP ${patchRes.status} - ${await patchRes.text()}`);
      failed++;
      continue;
    }

    const body = await patchRes.json();
    if (!body.length) {
      console.log(`FAILED [${table}] ${slug}: no row matched`);
      failed++;
      continue;
    }

    // verify readback
    const checkRes = await fetch(`${SUPA_URL}/rest/v1/${table}?select=price_value&slug=eq.${encodeURIComponent(slug)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const checkBody = await checkRes.json();
    if (checkBody[0] && checkBody[0].price_value === priceValue) {
      console.log(`OK [${table}] ${slug}: price_value = ${priceValue}`);
      ok++;
    } else {
      console.log(`MISMATCH [${table}] ${slug}: expected ${priceValue}, got ${checkBody[0] && checkBody[0].price_value}`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} applied and verified, ${failed} failed.`);
})();
