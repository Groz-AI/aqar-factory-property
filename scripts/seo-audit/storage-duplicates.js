#!/usr/bin/env node
// READ-ONLY. Compares every file in Supabase Storage with every file in the
// R2 bucket by content fingerprint (ETag = MD5 + size) so duplicates are found
// even when the file names differ. Also reports which Supabase files are still
// referenced by a database row. Deletes nothing.
//
//   Supabase key:  read from .env.local (SUPABASE_SERVICE_ROLE_KEY)
//   R2 keys:       set in YOUR terminal first (never paste them into chat):
//     PowerShell:  $env:R2_ACCOUNT_ID="..."; $env:R2_BUCKET_NAME="..."; $env:R2_ACCESS_KEY_ID="..."; $env:R2_SECRET_ACCESS_KEY="..."
//   Run:           node scripts/seo-audit/storage-duplicates.js
//   Output:        scripts/seo-audit/storage-duplicates.csv  + summary on screen

const fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const SUPA = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const need = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'].filter((k) => !process.env[k]);
if (!KEY || need.length) { console.error('Missing:', [!KEY && 'SUPABASE_SERVICE_ROLE_KEY (.env.local)', ...need].filter(Boolean).join(', ')); process.exit(1); }

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const norm = (e) => String(e || '').replace(/"/g, '').toLowerCase();
const sh = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function listSupabase() {
  const bres = await fetch(`${SUPA}/storage/v1/bucket`, { headers: sh });
  if (!bres.ok) throw new Error(`Supabase storage unavailable: HTTP ${bres.status} ${(await bres.text()).slice(0, 200)}`);
  const out = [];
  for (const b of await bres.json()) {
    const walk = async (prefix) => {
      for (let offset = 0; ; offset += 1000) {
        const r = await fetch(`${SUPA}/storage/v1/object/list/${b.name}`, { method: 'POST', headers: sh, body: JSON.stringify({ prefix, limit: 1000, offset }) });
        const rows = await r.json();
        if (!Array.isArray(rows)) throw new Error('list failed: ' + JSON.stringify(rows).slice(0, 200));
        for (const o of rows) {
          if (o.id === null) await walk(prefix ? `${prefix}/${o.name}` : o.name);   // folder
          else out.push({ where: 'supabase', bucket: b.name, key: prefix ? `${prefix}/${o.name}` : o.name, size: +(o.metadata && o.metadata.size) || 0, etag: norm(o.metadata && (o.metadata.eTag || o.metadata.etag)) });
        }
        if (rows.length < 1000) break;
      }
    };
    await walk('');
  }
  return out;
}

async function listR2() {
  const s3 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
  const out = []; let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, ContinuationToken: token }));
    for (const o of r.Contents || []) out.push({ where: 'r2', bucket: process.env.R2_BUCKET_NAME, key: o.Key, size: o.Size, etag: norm(o.ETag) });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

// which Supabase files a database row still points at (best effort: needs the API up)
async function referencedPaths() {
  const tables = ['projects', 'units', 'cities', 'developers', 'testimonials', 'blog_posts', 'content_blocks'];
  let text = '';
  for (const t of tables) {
    const r = await fetch(`${SUPA}/rest/v1/${t}?select=*`, { headers: sh });
    if (!r.ok) return null;
    text += JSON.stringify(await r.json());
  }
  return text;
}

(async () => {
  const [sb, r2] = await Promise.all([listSupabase(), listR2()]);
  const dbText = await referencedPaths();
  const r2By = new Map(); for (const o of r2) { const k = o.etag + ':' + o.size; if (!r2By.has(k)) r2By.set(k, []); r2By.get(k).push(o); }

  const rows = [['status', 'supabase_bucket', 'supabase_key', 'size_bytes', 'identical_file_in_r2', 'referenced_by_database']];
  let dup = 0, dupBytes = 0, only = 0, onlyBytes = 0, onlyRef = 0;
  for (const o of sb) {
    const match = o.etag ? r2By.get(o.etag + ':' + o.size) : null;
    const ref = dbText == null ? 'unknown' : (dbText.includes(o.key) ? 'yes' : 'no');
    if (match) { dup++; dupBytes += o.size; } else { only++; onlyBytes += o.size; if (ref === 'yes') onlyRef++; }
    rows.push([match ? 'DUPLICATE (also in R2)' : 'supabase only', o.bucket, o.key, o.size, match ? match[0].key : '', ref]);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  fs.writeFileSync(path.join(__dirname, 'storage-duplicates.csv'), '﻿' + csv);

  const sbTotal = sb.reduce((a, o) => a + o.size, 0), r2Total = r2.reduce((a, o) => a + o.size, 0);
  console.log(`Supabase Storage: ${sb.length} files, ${mb(sbTotal)}`);
  console.log(`R2 bucket:        ${r2.length} files, ${mb(r2Total)}`);
  console.log(`\nIdentical in both (safe-to-remove candidates from Supabase): ${dup} files, ${mb(dupBytes)}`);
  console.log(`Only in Supabase:                                           ${only} files, ${mb(onlyBytes)}` + (dbText == null ? '' : `  (${onlyRef} still referenced by the database - do NOT delete these before copying them to R2)`));
  if (dbText == null) console.log('\n(Database API unavailable, so "referenced_by_database" is "unknown" - check before deleting anything.)');
  console.log('\nFull list: scripts/seo-audit/storage-duplicates.csv');
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
