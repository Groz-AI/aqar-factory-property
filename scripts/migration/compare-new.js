#!/usr/bin/env node
// READ-ONLY. Compares the NEW server with the saved export of the old project:
//   1. structure: same tables, same columns, same types
//   2. data: for every table, every row and every value
// Exact checksum match is reported first; if only the formatting differs
// (e.g. timestamp text) the values are compared again in canonical form.
//
// Run in YOUR terminal (keys never go in chat):
//   PowerShell:  $env:NEW_URL="https://api.aqar-factory.com"; $env:NEW_KEY="<service role key from the server>"
//   node scripts/migration/compare-new.js [export-folder-date]      e.g. 2026-10-31
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NEW_URL = (process.env.NEW_URL || '').replace(/\/$/, '');
const NEW_KEY = process.env.NEW_KEY || '';
if (!NEW_URL || !NEW_KEY) { console.error('Set NEW_URL and NEW_KEY first (see the header of this file).'); process.exit(1); }
const dir = path.join(__dirname, '..', '..', 'backup-export', process.argv[2] || '2026-10-31');
const H = { apikey: NEW_KEY, Authorization: `Bearer ${NEW_KEY}` };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// the newer API labels the same Postgres types differently (integer -> int32, bigint -> int64)
const FMT = { integer: 'int32', int4: 'int32', bigint: 'int64', int8: 'int64', smallint: 'int16', int2: 'int16' };
const fmt = (c) => { const f = c.format || c.type || ''; return FMT[f] || f; };

const ISO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  if (typeof v === 'string' && ISO.test(v)) { const t = Date.parse(v.replace(' ', 'T')); if (!Number.isNaN(t)) return new Date(t).toISOString(); }
  return v;
}

async function get(url, extra = {}) {
  const r = await fetch(url, { headers: { ...H, ...extra } });
  if (!r.ok) throw new Error(`${r.status} ${url.replace(NEW_URL, '')}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const oldDefs = JSON.parse(fs.readFileSync(path.join(dir, 'schema-openapi.json'), 'utf8'));
  const spec = await get(`${NEW_URL}/rest/v1/`, { Accept: 'application/openapi+json' });
  const newDefs = spec.definitions || {};
  let problems = 0;

  // ---- 1. structure
  console.log('STRUCTURE');
  const oldT = Object.keys(oldDefs).filter((t) => !t.startsWith('rpc/')).sort(), newT = Object.keys(newDefs).filter((t) => !t.startsWith('rpc/')).sort();
  const missing = oldT.filter((t) => !newT.includes(t)), extra = newT.filter((t) => !oldT.includes(t));
  console.log(`  tables: old ${oldT.length}, new ${newT.length}` + (missing.length ? `  MISSING: ${missing}` : '') + (extra.length ? `  EXTRA: ${extra}` : ''));
  problems += missing.length;
  for (const t of oldT.filter((x) => newT.includes(x))) {
    const a = oldDefs[t].properties || {}, b = newDefs[t].properties || {};
    const diffs = [];
    for (const c of Object.keys(a)) {
      if (!b[c]) diffs.push(`column ${c} missing`);
      else if (fmt(a[c]) !== fmt(b[c])) diffs.push(`column ${c}: ${a[c].format || a[c].type} -> ${b[c].format || b[c].type}`);
    }
    for (const c of Object.keys(b)) if (!a[c]) diffs.push(`column ${c} is new`);
    const reqOld = (oldDefs[t].required || []).slice().sort().join(), reqNew = (newDefs[t].required || []).slice().sort().join();
    if (reqOld !== reqNew) diffs.push(`required columns differ`);
    console.log(`  ${t.padEnd(24)} ${Object.keys(a).length} columns  ${diffs.length ? 'DIFFERENT: ' + diffs.join('; ') : 'identical'}`);
    problems += diffs.length;
  }

  // ---- 2. data
  console.log('\nDATA');
  for (const t of Object.keys(manifest.tables)) {
    const m = manifest.tables[t];
    const rows = [];
    for (let off = 0; ; off += 1000) {
      const page = await get(`${NEW_URL}/rest/v1/${t}?select=*&order=${m.orderBy}.asc&limit=1000&offset=${off}`);
      rows.push(...page); if (page.length < 1000) break;
    }
    const body = JSON.stringify(rows);
    if (rows.length !== m.rows) { console.log(`  ${t.padEnd(24)} ROWS DIFFER: old ${m.rows}, new ${rows.length}`); problems++; continue; }
    if (sha(body) === m.sha256) { console.log(`  ${t.padEnd(24)} ${String(rows.length).padStart(5)} rows  IDENTICAL (exact checksum)`); continue; }
    const oldRows = JSON.parse(fs.readFileSync(path.join(dir, 'tables', `${t}.json`), 'utf8'));
    const diffs = [];
    for (let i = 0; i < oldRows.length; i++) {
      const a = canon(oldRows[i]), b = canon(rows[i]);
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(`row ${oldRows[i][m.orderBy]} / ${k}`);
    }
    if (!diffs.length) console.log(`  ${t.padEnd(24)} ${String(rows.length).padStart(5)} rows  IDENTICAL (same values; only text formatting differs, e.g. timestamps)`);
    else { console.log(`  ${t.padEnd(24)} ${diffs.length} DIFFERENT VALUES, first: ${diffs.slice(0, 6).join(', ')}`); problems += diffs.length; }
  }

  console.log(`\nRESULT: ${problems === 0 ? 'NO DIFFERENCES FOUND - the new server holds the same structure and data.' : problems + ' difference(s) found - do not switch yet.'}`);
  process.exit(problems ? 2 : 0);
})().catch((e) => { console.error('COMPARE FAILED:', e.message); process.exit(1); });
