#!/usr/bin/env node
// Writes the hand-authored about_blocks (English) content from
// english-content-data.js into the matching projects, then reads each one
// back to confirm the write actually persisted.
//
// Usage:
//   node scripts/seo-audit/apply-english-content.js            # dry run
//   node scripts/seo-audit/apply-english-content.js --apply    # write + verify

const fs = require('fs');
const path = require('path');
const CONTENT = require('./english-content-data.js');

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';

function loadEnvLocal() {
  const text = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const slugs = Object.keys(CONTENT);
  console.log(`${slugs.length} projects have English content ready to write.\n`);

  // Guard: refuse to overwrite a project that already has English content
  // (e.g. if it was filled in since the last audit) - only write where
  // about_blocks is still genuinely empty.
  const KEY = apply ? loadEnvLocal().SUPABASE_SERVICE_ROLE_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';
  if (apply && !KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    process.exit(1);
  }

  const res = await fetch(`${SUPA_URL}/rest/v1/projects?select=slug,about_blocks&slug=in.(${slugs.join(',')})`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const rows = await res.json();
  const byslug = Object.fromEntries(rows.map((r) => [r.slug, r]));

  const toWrite = [];
  for (const slug of slugs) {
    const row = byslug[slug];
    if (!row) { console.log(`SKIP ${slug}: not found`); continue; }
    if (row.about_blocks && row.about_blocks.length > 0) { console.log(`SKIP ${slug}: already has ${row.about_blocks.length} English blocks now, not overwriting`); continue; }
    toWrite.push(slug);
  }

  console.log(`\n${toWrite.length} confirmed still empty, safe to write:`);
  for (const s of toWrite) console.log(' -', s);

  if (!apply) {
    console.log('\nDry run only - nothing written. Re-run with --apply to write.');
    return;
  }

  let ok = 0, failed = 0;
  for (const slug of toWrite) {
    const blocks = CONTENT[slug];
    const patchRes = await fetch(`${SUPA_URL}/rest/v1/projects?slug=eq.${slug}`, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ about_blocks: blocks }),
    });
    if (!patchRes.ok) { console.log(`FAILED ${slug}: HTTP ${patchRes.status} - ${await patchRes.text()}`); failed++; continue; }

    const checkRes = await fetch(`${SUPA_URL}/rest/v1/projects?select=about_blocks&slug=eq.${slug}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    const checkBody = await checkRes.json();
    const written = checkBody[0] && checkBody[0].about_blocks;
    if (written && written.length === blocks.length) {
      console.log(`OK ${slug}: ${written.length} blocks written`);
      ok++;
    } else {
      console.log(`MISMATCH ${slug}: expected ${blocks.length} blocks, got ${written ? written.length : 'none'}`);
      failed++;
    }
  }
  console.log(`\nDone. ${ok} applied and verified, ${failed} failed.`);
})();
