#!/usr/bin/env node
// The old file storage holds 18 images that projects/units still point at.
//   --upload   copy those files into the R2 bucket (additive; changes nothing live)
//   --rewrite  point the NEW server's rows at the R2 copies (run at switch time,
//              AFTER the final data re-sync, which would otherwise undo it)
// Dry run by default: prints what it would do.
//
// Set in YOUR terminal (never in chat):
//   $env:R2_ACCOUNT_ID=".."; $env:R2_BUCKET_NAME=".."; $env:R2_ACCESS_KEY_ID=".."; $env:R2_SECRET_ACCESS_KEY=".."; $env:R2_PUBLIC_URL="https://pub-....r2.dev"
//   (for --rewrite also)  $env:NEW_URL="https://api.aqar-factory.com"; $env:NEW_KEY="<service role key>"
//   node scripts/migration/move-media-to-r2.js [--upload|--rewrite] [--apply]
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const DIR = path.join(__dirname, '..', '..', 'backup-export', '2026-10-31');
const OLD_BASE = 'https://dwufpgsqblwjgmzoseev.supabase.co/storage/v1/object/public/media/';
const args = process.argv.slice(2), apply = args.includes('--apply');
const mode = args.includes('--rewrite') ? 'rewrite' : args.includes('--upload') ? 'upload' : null;
if (!mode) { console.error('Use --upload or --rewrite (add --apply to really do it).'); process.exit(1); }
const R2_PUBLIC = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
if (!R2_PUBLIC) { console.error('R2_PUBLIC_URL missing'); process.exit(1); }

// every distinct file the exported data points at
const refs = new Set();
const re = new RegExp(OLD_BASE.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '[A-Za-z0-9._%-]+', 'g');
for (const f of fs.readdirSync(path.join(DIR, 'tables'))) for (const m of fs.readFileSync(path.join(DIR, 'tables', f), 'utf8').matchAll(re)) refs.add(m[0]);
const files = [...refs].map((u) => ({ url: u, name: decodeURIComponent(u.slice(OLD_BASE.length)) }));
console.log(`${files.length} distinct files are still referenced in the old storage`);

const MIME = { '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.jfif': 'image/jpeg', '.gif': 'image/gif', '.avif': 'image/avif' };

(async () => {
  if (mode === 'upload') {
    for (const k of ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) if (!process.env[k]) { console.error(k + ' missing'); process.exit(1); }
    const s3 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
    let up = 0, same = 0, clash = 0;
    for (const f of files) {
      const local = path.join(DIR, 'storage', 'media', f.name), body = fs.readFileSync(local);
      let exists = null;
      try { exists = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: f.name })); } catch (_) { /* not there */ }
      if (exists) { if (exists.ContentLength === body.length) { same++; console.log('  already in R2, same size:', f.name); } else { clash++; console.log('  NAME CLASH, different file in R2 - skipped:', f.name); } continue; }
      console.log(`  ${apply ? 'uploading' : 'would upload'}: ${f.name} (${(body.length / 1024).toFixed(0)} KB)`);
      if (apply) { await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: f.name, Body: body, ContentType: MIME[path.extname(f.name).toLowerCase()] || 'application/octet-stream', CacheControl: 'public, max-age=31536000' })); up++; }
    }
    console.log(`\n${apply ? 'uploaded' : 'to upload'}: ${apply ? up : files.length - same - clash}, already there: ${same}, name clashes: ${clash}`);
    if (apply) for (const f of files.slice(0, 3)) { const r = await fetch(`${R2_PUBLIC}/${f.name}`); console.log(`  public check ${f.name}: HTTP ${r.status}`); }
    return;
  }

  // --rewrite: point the new server's rows at R2
  const NEW_URL = (process.env.NEW_URL || '').replace(/\/$/, ''), NEW_KEY = process.env.NEW_KEY || '';
  if (!NEW_URL || !NEW_KEY) { console.error('NEW_URL and NEW_KEY missing'); process.exit(1); }
  const H = { apikey: NEW_KEY, Authorization: `Bearer ${NEW_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  for (const f of files) { const r = await fetch(`${R2_PUBLIC}/${f.name}`, { method: 'HEAD' }); if (!r.ok) { console.error(`R2 does not serve ${f.name} (HTTP ${r.status}) - run --upload --apply first`); process.exit(1); } }
  const swap = (v) => typeof v === 'string' ? v.split(OLD_BASE).join(R2_PUBLIC + '/') : Array.isArray(v) ? v.map(swap) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)])) : v;
  let changed = 0;
  for (const t of ['projects', 'units', 'cities', 'developers', 'testimonials', 'blog_posts', 'content_blocks']) {
    const rows = await (await fetch(`${NEW_URL}/rest/v1/${t}?select=*`, { headers: H })).json();
    for (const row of rows) {
      const patch = {};
      for (const [k, v] of Object.entries(row)) { const n = swap(v); if (JSON.stringify(n) !== JSON.stringify(v)) patch[k] = n; }
      if (!Object.keys(patch).length) continue;
      const key = row.id !== undefined ? `id=eq.${row.id}` : `key=eq.${row.key}`;
      console.log(`  ${apply ? 'rewriting' : 'would rewrite'} ${t} ${row.slug || row.id || row.key}: ${Object.keys(patch).join(', ')}`);
      if (apply) { const r = await fetch(`${NEW_URL}/rest/v1/${t}?${key}`, { method: 'PATCH', headers: H, body: JSON.stringify(patch) }); if (!r.ok) { console.error('  FAILED', r.status, await r.text()); process.exit(1); } }
      changed++;
    }
  }
  console.log(`\n${apply ? 'rewritten' : 'would rewrite'}: ${changed} rows`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
