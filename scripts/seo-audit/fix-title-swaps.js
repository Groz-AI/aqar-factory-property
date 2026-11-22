#!/usr/bin/env node
// Dry-run (default) / apply (--apply) fix for the EN/AR seo_title and
// seo_description swap bug found in the full-site audit
// (seo-title-audit.csv). Four possible actions per field pair:
//
//   SWAP           - both sides non-empty but crossed (EN has Arabic text,
//                    AR has English text) -> swap the two values.
//   MOVE_EN_TO_AR  - EN field wrongly holds Arabic text, AR field is empty
//                    -> move the value into the AR field, clear EN (falls
//                    back to the project/unit's English `name`, per
//                    bot-render.js's pick() and admin.js's own hint text).
//   MOVE_AR_TO_EN  - AR field wrongly holds English-only text, EN field is
//                    empty -> move the value into the EN field, clear AR
//                    (falls back to the EN value on AR pages, per pick()).
//   SKIP           - genuinely no data to move (both empty, or ambiguous) -
//                    left untouched, needs a human to write real copy.
//
// Usage:
//   node scripts/seo-audit/fix-title-swaps.js            # dry run, no writes
//   node scripts/seo-audit/fix-title-swaps.js --apply     # apply + verify

const fs = require('fs');
const path = require('path');

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

const ARABIC_RE = /[؀-ۿ]/;
const isEmpty = (v) => !v || !String(v).trim();
const hasArabic = (v) => ARABIC_RE.test(v || '');
const looksEnglishOnly = (v) => !isEmpty(v) && !ARABIC_RE.test(v);

function classify(enVal, arVal) {
  const enEmpty = isEmpty(enVal);
  const arEmpty = isEmpty(arVal);
  const enHasArabic = !enEmpty && hasArabic(enVal);
  const arIsEnglishOnly = !arEmpty && looksEnglishOnly(arVal);

  if (enHasArabic && arIsEnglishOnly) return { action: 'SWAP', new_en: arVal, new_ar: enVal };
  if (enHasArabic && arEmpty) return { action: 'MOVE_EN_TO_AR', new_en: null, new_ar: enVal };
  if (enEmpty && arIsEnglishOnly) return { action: 'MOVE_AR_TO_EN', new_en: arVal, new_ar: null };
  return { action: 'SKIP', new_en: enVal, new_ar: arVal };
}

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

const TABLES = ['projects', 'units', 'blog_posts'];

async function fetchTable(table, key) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=id,slug,seo_title,seo_title_ar,seo_description,seo_description_ar&published=eq.true`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return res.json();
}

(async () => {
  const apply = process.argv.includes('--apply');
  const env = apply ? loadEnvLocal() : {};
  const key = apply ? env.SUPABASE_SERVICE_ROLE_KEY : ANON_KEY;
  if (apply && !key) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    process.exit(1);
  }

  const plan = [];
  for (const table of TABLES) {
    const rows = await fetchTable(table, key);
    for (const r of rows) {
      const titleFix = classify(r.seo_title, r.seo_title_ar);
      const descFix = classify(r.seo_description, r.seo_description_ar);
      if (titleFix.action === 'SKIP' && descFix.action === 'SKIP') continue;
      plan.push({ table, id: r.id, slug: r.slug, titleFix, descFix, before: r });
    }
  }

  console.log(`${plan.length} rows have a title and/or description fix to apply.\n`);
  const counts = {};
  for (const p of plan) {
    for (const f of [p.titleFix, p.descFix]) counts[f.action] = (counts[f.action] || 0) + 1;
  }
  console.log('Actions:', counts, '\n');

  for (const p of plan) {
    console.log(`[${p.table}] ${p.slug}`);
    if (p.titleFix.action !== 'SKIP') {
      console.log(`  TITLE ${p.titleFix.action}`);
      console.log(`    before: EN="${p.before.seo_title}" | AR="${p.before.seo_title_ar}"`);
      console.log(`    after:  EN="${p.titleFix.new_en ?? '(cleared, falls back to name)'}" | AR="${p.titleFix.new_ar ?? '(cleared, falls back to EN)'}"`);
    }
    if (p.descFix.action !== 'SKIP') {
      console.log(`  DESC ${p.descFix.action}`);
      console.log(`    before: EN="${(p.before.seo_description || '').slice(0, 60)}..." | AR="${(p.before.seo_description_ar || '').slice(0, 60)}..."`);
    }
    console.log('');
  }

  if (!apply) {
    console.log('Dry run only - nothing written. Re-run with --apply to write these changes.');
    return;
  }

  let ok = 0, failed = 0;
  for (const p of plan) {
    const patch = {};
    if (p.titleFix.action !== 'SKIP') {
      patch.seo_title = p.titleFix.new_en;
      patch.seo_title_ar = p.titleFix.new_ar;
    }
    if (p.descFix.action !== 'SKIP') {
      patch.seo_description = p.descFix.new_en;
      patch.seo_description_ar = p.descFix.new_ar;
    }
    const res = await fetch(`${SUPA_URL}/rest/v1/${p.table}?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      console.log(`FAILED [${p.table}] ${p.slug}: HTTP ${res.status}`);
      failed++;
      continue;
    }
    const body = await res.json();
    const row = body[0];
    const titleOk = p.titleFix.action === 'SKIP' || (row.seo_title === patch.seo_title && row.seo_title_ar === patch.seo_title_ar);
    const descOk = p.descFix.action === 'SKIP' || (row.seo_description === patch.seo_description && row.seo_description_ar === patch.seo_description_ar);
    if (titleOk && descOk) {
      console.log(`OK [${p.table}] ${p.slug}`);
      ok++;
    } else {
      console.log(`MISMATCH [${p.table}] ${p.slug}`);
      failed++;
    }
  }
  console.log(`\nDone. ${ok} applied and verified, ${failed} failed.`);
})();
