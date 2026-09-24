#!/usr/bin/env node
// Writes the business JSON-LD block (id="siteSchema") into the static pages
// real browsers and schema validators receive as-is. Built from the live
// content_blocks 'company' row via schema-helpers.js, so it matches what
// api/bot-render.js serves crawlers. Re-run after the company's address,
// phone, hours or social links change in the admin panel.
//
// Usage: node scripts/seo-audit/sync-static-schema.js

const fs = require('fs');
const path = require('path');
const SH = require('../../schema-helpers.js');

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';
const ROOT = path.join(__dirname, '..', '..');

// same file serves both /page and /ar/page, so the page-type node carries
// no language-specific url/name - api/bot-render.js adds those for crawlers
const PAGES = {
  'index.html': null,
  'about.html': 'AboutPage',
  'contact.html': 'ContactPage',
  'projects.html': 'CollectionPage',
  'units.html': 'CollectionPage',
  'blog.html': 'CollectionPage',
};

(async () => {
  const r = await fetch(`${SUPA_URL}/rest/v1/content_blocks?select=value&key=eq.company&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const company = ((await r.json())[0] || {}).value || {};
  if (!company.phone && !company.address) { console.error('Company row looks empty - refusing to write.'); process.exit(1); }

  for (const [file, pageType] of Object.entries(PAGES)) {
    const graph = [SH.companyNode(company), SH.websiteNode()];
    if (pageType) graph.push({ '@type': pageType, isPartOf: { '@id': SH.WEBSITE_ID }, about: { '@id': SH.ORG_ID } });
    const block = `<script type="application/ld+json" id="siteSchema">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;

    const p = path.join(ROOT, file);
    let html = fs.readFileSync(p, 'utf8');
    const existing = /<script type="application\/ld\+json" id="siteSchema">[\s\S]*?<\/script>/;
    if (existing.test(html)) html = html.replace(existing, block);
    else if (html.includes('</head>')) html = html.replace('</head>', block + '\n</head>');
    else { console.error(`${file}: no </head> found, skipped`); continue; }
    fs.writeFileSync(p, html, 'utf8');
    console.log(`${file}: ${graph.map((n) => JSON.stringify(n['@type'])).join(', ')}`);
  }
})();
