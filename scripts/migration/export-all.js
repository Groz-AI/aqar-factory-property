#!/usr/bin/env node
// Full, READ-ONLY export of the old project into backup-export/<date>/ :
//   schema-openapi.json   table + column list as the API exposes it
//   tables/<t>.json       every row of every table
//   auth-users.json       admin user accounts (metadata; password hashes need pg_dump)
//   storage-inventory.json, storage/<bucket>/...  every stored file (phase "files")
//   manifest.json         row counts + SHA-256 fingerprint per table / per file
//
//   node scripts/migration/export-all.js            # tables + auth + file inventory
//   node scripts/migration/export-all.js --files    # also download every stored file
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPA = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY missing in .env.local'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const OUT = path.join(__dirname, '..', '..', 'backup-export', new Date().toISOString().slice(0, 10));
fs.mkdirSync(path.join(OUT, 'tables'), { recursive: true });
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const mb = (b) => (b / 1048576).toFixed(2) + ' MB';
const stable = (rows) => JSON.stringify(rows);   // same order + same serialization on both sides when compared later

async function getJson(url, headers = H) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url.replace(SUPA, '')}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

(async () => {
  const manifest = { exportedAt: new Date().toISOString(), tables: {}, storage: {}, authUsers: null };

  // 1) schema as exposed by the API
  const spec = await getJson(`${SUPA}/rest/v1/`, { ...H, Accept: 'application/openapi+json' });
  fs.writeFileSync(path.join(OUT, 'schema-openapi.json'), JSON.stringify(spec.definitions || spec, null, 1));
  const tables = Object.keys(spec.definitions || {}).filter((t) => !t.startsWith('rpc/'));
  console.log(`tables found: ${tables.length}  (${tables.join(', ')})`);

  // 2) every row of every table, paged, ordered by primary key when there is one
  for (const t of tables) {
    const cols = Object.keys((spec.definitions[t] || {}).properties || {});
    const order = cols.includes('id') ? 'id' : cols.includes('key') ? 'key' : cols[0];
    const rows = [];
    for (let off = 0; ; off += 1000) {
      const page = await getJson(`${SUPA}/rest/v1/${t}?select=*&order=${order}.asc&limit=1000&offset=${off}`);
      rows.push(...page);
      if (page.length < 1000) break;
    }
    const body = stable(rows);
    fs.writeFileSync(path.join(OUT, 'tables', `${t}.json`), body);
    manifest.tables[t] = { rows: rows.length, columns: cols.length, orderBy: order, sha256: sha(body), bytes: Buffer.byteLength(body) };
    console.log(`  ${t.padEnd(24)} ${String(rows.length).padStart(5)} rows  ${cols.length} cols  ${mb(Buffer.byteLength(body))}`);
  }

  // 3) admin accounts (auth API)
  try {
    const users = [];
    for (let p = 1; ; p++) {
      const r = await getJson(`${SUPA}/auth/v1/admin/users?page=${p}&per_page=200`);
      users.push(...(r.users || [])); if (!r.users || r.users.length < 200) break;
    }
    fs.writeFileSync(path.join(OUT, 'auth-users.json'), JSON.stringify(users, null, 1));
    manifest.authUsers = users.length; console.log(`auth users: ${users.length}`);
  } catch (e) { console.log('auth users: could not read -', e.message); }

  // 4) storage inventory (+ optional download)
  let buckets = [];
  try { buckets = await getJson(`${SUPA}/storage/v1/bucket`); } catch (e) { console.log('storage: could not list -', e.message); }
  const inventory = [];
  for (const b of buckets) {
    const walk = async (prefix) => {
      for (let off = 0; ; off += 1000) {
        const r = await fetch(`${SUPA}/storage/v1/object/list/${b.name}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, offset: off }) });
        const rows = await r.json();
        for (const o of rows) {
          if (o.id === null) await walk(prefix ? `${prefix}/${o.name}` : o.name);
          else inventory.push({ bucket: b.name, public: !!b.public, key: prefix ? `${prefix}/${o.name}` : o.name, size: +(o.metadata && o.metadata.size) || 0, mime: o.metadata && o.metadata.mimetype, etag: o.metadata && (o.metadata.eTag || o.metadata.etag) });
        }
        if (rows.length < 1000) break;
      }
    };
    await walk('');
  }
  fs.writeFileSync(path.join(OUT, 'storage-inventory.json'), JSON.stringify(inventory, null, 1));
  for (const b of buckets) {
    const f = inventory.filter((o) => o.bucket === b.name);
    manifest.storage[b.name] = { files: f.length, bytes: f.reduce((a, o) => a + o.size, 0), public: !!b.public };
    console.log(`bucket ${b.name}: ${f.length} files, ${mb(manifest.storage[b.name].bytes)}`);
  }

  if (process.argv.includes('--files')) {
    let n = 0, bad = 0;
    for (const o of inventory) {
      const dest = path.join(OUT, 'storage', o.bucket, ...o.key.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const r = await fetch(`${SUPA}/storage/v1/object/${o.bucket}/${o.key.split('/').map(encodeURIComponent).join('/')}`, { headers: H });
      if (!r.ok) { bad++; console.log('  FAILED', o.bucket, o.key, r.status); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(dest, buf); o.sha256 = sha(buf); o.downloadedBytes = buf.length; n++;
      if (n % 50 === 0) console.log(`  downloaded ${n}/${inventory.length}`);
    }
    fs.writeFileSync(path.join(OUT, 'storage-inventory.json'), JSON.stringify(inventory, null, 1));
    console.log(`files downloaded: ${n}, failed: ${bad}`);
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('\nexport folder:', OUT);
})().catch((e) => { console.error('EXPORT FAILED:', e.message); process.exit(1); });
