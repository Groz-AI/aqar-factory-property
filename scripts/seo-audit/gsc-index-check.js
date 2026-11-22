#!/usr/bin/env node
// Checks the LIVE Google index status of every URL in sitemap.xml using the
// Search Console URL Inspection API - the same data as clicking a URL in
// Search Console, not the (often weeks-old) Page indexing report.
//
// One-time setup: a Google Cloud service account with the Search Console API
// enabled, added as a user on the Search Console property, and its JSON key
// saved as .gsc-service-account.json in the project root (gitignored).
//
// Usage:
//   node scripts/seo-audit/gsc-index-check.js            # check everything not checked today
//   node scripts/seo-audit/gsc-index-check.js --fresh    # ignore saved results, re-check all
//   node scripts/seo-audit/gsc-index-check.js --limit 50 # stop after 50 API calls
//
// Results are saved after every URL (gsc-index-results.json), so a run that
// hits the daily quota (2,000 inspections per property) or is interrupted
// picks up where it left off. Final report: gsc-index-report.csv (opens in
// Excel with Arabic intact).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const KEY_FILE = path.join(ROOT, '.gsc-service-account.json');
const RESULTS = path.join(__dirname, 'gsc-index-results.json');
const REPORT = path.join(__dirname, 'gsc-index-report.csv');
const SITEMAP = 'https://www.aqar-factory.com/sitemap.xml';
const PER_MINUTE = 500; // API allows 600/min; stay under it

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx > -1 ? Number(args[limitIdx + 1]) : Infinity;

// ---- auth: service-account JWT -> access token (no googleapis package needed)
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = b64url(crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(key.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Could not get an access token: ' + JSON.stringify(j));
  return j.access_token;
}

// the property can be a Domain property (sc-domain:...) or a URL-prefix one;
// use whichever this service account has been given access to
async function findProperty(token, email) {
  const r = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  const sites = (j.siteEntry || []).map((s) => s.siteUrl);
  const pick = sites.find((s) => /aqar-factory\.com/.test(s));
  if (!pick) throw new Error(`The service account can't see the aqar-factory.com property (it sees: ${JSON.stringify(sites)}). Add ${email} as a user in Search Console > Settings > Users and permissions.`);
  return pick;
}

// plain-language explanation + what to do, per Google's coverage state
const EXPLAIN = {
  'Submitted and indexed': ['Indexed', 'Nothing - it can appear in Google.'],
  'Indexed, not submitted in sitemap': ['Indexed', 'Nothing.'],
  'Crawled - currently not indexed': ['Google read it but chose not to index it (yet)', 'Content quality/uniqueness: more unique text, distinct title. Re-check later - Google often indexes these on a later visit.'],
  'Discovered - currently not indexed': ['Google knows the URL but has not fetched it yet', 'Crawl priority: internal links (fixed Oct 7) and time. Request indexing for important ones.'],
  'URL is unknown to Google': ['Google has never seen this URL', 'Make sure it is in the sitemap and linked; request indexing.'],
  'Duplicate, Google chose different canonical than user': ['Google treats it as a copy of another page', 'Make the page more distinct from the one in google_canonical (text, title).'],
  'Duplicate without user-selected canonical': ['Google sees it as a duplicate', 'Add distinct content; check the canonical tag.'],
  'Alternate page with proper canonical tag': ['Correctly treated as an alternate', 'Nothing.'],
  'Page with redirect': ['URL redirects', 'Nothing if intended - make sure the sitemap lists the final URL.'],
  'Not found (404)': ['Page returns 404', 'Remove from sitemap or restore the page.'],
  'Excluded by ‘noindex’ tag': ['Page tells Google not to index it', 'Remove the noindex tag if it should be indexed.'],
  'Blocked by robots.txt': ['robots.txt blocks it', 'Unblock in robots.txt if it should be indexed.'],
  'Soft 404': ['Google thinks the page is empty/"not found"', 'Add real content.'],
  'Server error (5xx)': ['Google got a server error', 'Check the page/server.'],
};

async function inspect(token, site, url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'en' }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, data: j.inspectionResult || {} };
    const msg = (j.error && j.error.message) || `HTTP ${r.status}`;
    if (r.status === 429 && /quota/i.test(msg) && /day/i.test(msg)) return { ok: false, quota: true, error: msg };
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 5000 * attempt)); continue; }
    return { ok: false, error: msg };
  }
  return { ok: false, error: 'gave up after retries' };
}

function toRow(url, res, checkedAt) {
  const ix = (res.data && res.data.indexStatusResult) || {};
  const coverage = ix.coverageState || (res.ok ? '' : 'ERROR');
  const [meaning, todo] = EXPLAIN[coverage] || ['', ''];
  return {
    url,
    indexed: ix.verdict === 'PASS' ? 'YES' : (res.ok ? 'NO' : '?'),
    coverage_state: coverage || res.error || '',
    meaning: meaning || (res.ok ? '' : res.error),
    what_to_do: todo,
    last_crawled: ix.lastCrawlTime ? ix.lastCrawlTime.slice(0, 10) : 'never',
    crawled_as: ix.crawledAs || '',
    page_fetch: ix.pageFetchState || '',
    robots_txt: ix.robotsTxtState || '',
    indexing_allowed: ix.indexingState || '',
    google_canonical: ix.googleCanonical || '',
    your_canonical: ix.userCanonical || '',
    canonical_mismatch: ix.googleCanonical && ix.userCanonical && ix.googleCanonical !== ix.userCanonical ? 'YES' : '',
    in_sitemap_per_google: (ix.sitemap || []).length ? 'yes' : 'no',
    checked_at: checkedAt,
  };
}

function writeCsv(rows) {
  const cols = Object.keys(rows[0] || { url: '' });
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const body = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
  fs.writeFileSync(REPORT, '﻿' + body, 'utf8'); // BOM so Excel reads Arabic correctly
}

(async () => {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`Missing ${KEY_FILE} - see the setup steps at the top of this file.`);
    process.exit(1);
  }
  const key = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  let token = await accessToken(key);
  let tokenAt = Date.now();
  const site = await findProperty(token, key.client_email);
  console.log(`Property: ${site}  (service account: ${key.client_email})`);

  const sm = await (await fetch(SITEMAP)).text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  console.log(`${urls.length} URLs in the sitemap`);

  const saved = !fresh && fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : {};
  const today = new Date().toISOString().slice(0, 10);
  const todo = urls.filter((u) => !(saved[u] && saved[u].checked_at === today && saved[u].indexed !== '?'));
  console.log(`${urls.length - todo.length} already checked today, ${todo.length} to check\n`);

  let calls = 0;
  const minuteStart = () => Date.now();
  let windowStart = minuteStart();
  let inWindow = 0;
  for (const u of todo) {
    if (calls >= limit) { console.log(`\nStopped at --limit ${limit}.`); break; }
    if (Date.now() - tokenAt > 50 * 60 * 1000) { token = await accessToken(key); tokenAt = Date.now(); }
    if (inWindow >= PER_MINUTE) {
      const wait = 60000 - (Date.now() - windowStart);
      if (wait > 0) await new Promise((s) => setTimeout(s, wait));
      windowStart = Date.now(); inWindow = 0;
    }
    const res = await inspect(token, site, u);
    calls++; inWindow++;
    if (res.quota) { console.log(`\nDaily quota reached after ${calls} checks - run again tomorrow to finish.`); break; }
    saved[u] = toRow(u, res, today);
    fs.writeFileSync(RESULTS, JSON.stringify(saved, null, 1));
    const r = saved[u];
    console.log(`[${calls}/${todo.length}] ${r.indexed.padEnd(3)} ${r.coverage_state.padEnd(40).slice(0, 40)} ${decodeURIComponent(u).replace('https://www.aqar-factory.com', '')}`);
  }

  const rows = urls.map((u) => saved[u]).filter(Boolean);
  rows.sort((a, b) => (a.indexed === b.indexed ? a.coverage_state.localeCompare(b.coverage_state) : a.indexed === 'NO' ? -1 : 1));
  writeCsv(rows);

  const tally = {};
  for (const r of rows) tally[r.coverage_state] = (tally[r.coverage_state] || 0) + 1;
  console.log(`\n=== ${rows.length} of ${urls.length} URLs checked ===`);
  console.log(`Indexed: ${rows.filter((r) => r.indexed === 'YES').length}   Not indexed: ${rows.filter((r) => r.indexed === 'NO').length}   Errors: ${rows.filter((r) => r.indexed === '?').length}`);
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\nFull report: ${REPORT}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
