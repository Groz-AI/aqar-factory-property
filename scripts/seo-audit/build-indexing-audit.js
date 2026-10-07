#!/usr/bin/env node
// One row per sitemap URL: crawl/link data (before and after the discovery
// fix) joined with the content signals Google weighs when deciding whether
// a crawled page is worth indexing. Output feeds indexing_audit_to_xlsx.py.

const fs = require('fs');
const path = require('path');
const SH = require('../../schema-helpers.js');

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';
const AR = /[؀-ۿ]/;
const THIN_WORDS = 150;

const get = async (t, cols) => (await fetch(`${SUPA_URL}/rest/v1/${t}?select=${cols}&published=eq.true`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })).json();
const words = (blocks) => SH.htmlToLines((Array.isArray(blocks) ? blocks : []).map((b) => (b && b.text) || '').join('\n')).join(' ').split(/\s+/).filter(Boolean).length;
const arShare = (s) => { const letters = (s || '').replace(/[^A-Za-z؀-ۿ]/g, ''); return letters ? (letters.match(/[؀-ۿ]/g) || []).length / letters.length : 0; };

(async () => {
  const before = Object.fromEntries(require('./googlebot-crawl-before.json').map((r) => [r.path, r]));
  const after = require('./googlebot-crawl.json').filter((r) => r.in_sitemap);

  const [projects, units, posts] = await Promise.all([
    get('projects', 'slug,slug_ar,name,name_ar,about_blocks,about_blocks_ar,seo_description,seo_description_ar,price_value'),
    get('units', 'slug,slug_ar,name,name_ar,description_blocks,description_blocks_ar,seo_description,seo_description_ar,price_value,project_id'),
    get('blog_posts', 'slug,title,title_ar,blocks,blocks_ar,seo_description,seo_description_ar'),
  ]);
  const index = {};
  const add = (kind, r, enCol, arCol) => {
    const en = `/${kind}/${r.slug}`;
    const ar = `/ar/${kind}/${(kind !== 'blog' && r.slug_ar) || r.slug}`;
    const enBlocks = r[enCol] || [];
    const arBlocks = (Array.isArray(r[arCol]) && r[arCol].length) ? r[arCol] : enBlocks; // page falls back to EN
    index[en] = { kind, lang: 'en', row: r, blocks: enBlocks, ownLangContent: words(enBlocks) > 0, desc: r.seo_description };
    index[ar] = { kind, lang: 'ar', row: r, blocks: arBlocks, ownLangContent: Array.isArray(r[arCol]) && words(r[arCol]) > 0, desc: r.seo_description_ar || r.seo_description };
  };
  projects.forEach((r) => add('project', r, 'about_blocks', 'about_blocks_ar'));
  units.forEach((r) => add('unit', r, 'description_blocks', 'description_blocks_ar'));
  posts.forEach((r) => add('blog', r, 'blocks', 'blocks_ar'));

  const titleCount = {};
  for (const r of after) if (r.title) titleCount[r.title] = (titleCount[r.title] || 0) + 1;

  const rows = after.map((a) => {
    const b = before[a.path] || {};
    const m = index[a.path];
    const lang = a.path === '/ar' || a.path.startsWith('/ar/') ? 'ar' : 'en';
    const kind = m ? m.kind : 'page';
    const bodyWords = m ? words(m.blocks) : null;
    const share = arShare(a.title);
    const titleWrongLang = lang === 'en' ? share > 0.5 : (a.title && share < 0.2);
    const faq = m ? SH.extractFaq(m.blocks).length : 0;
    const issues = [];
    if (!b.reached_by_links) issues.push('WAS ORPHAN (fixed)');
    else if (b.inbound_links === 1) issues.push('WAS 1 LINK (fixed)');
    if (m && bodyWords < THIN_WORDS) issues.push(`thin content (${bodyWords} words)`);
    if (m && !m.ownLangContent) issues.push(`no ${lang === 'ar' ? 'Arabic' : 'English'} content of its own`);
    if (titleCount[a.title] > 1) issues.push(`duplicate title (${titleCount[a.title]} pages)`);
    if (titleWrongLang) issues.push('title in wrong language');
    if (m && (kind === 'project' || kind === 'unit') && !(m.row.price_value > 0)) issues.push('no price');
    if (m && !(m.desc && String(m.desc).trim())) issues.push('no meta description');
    const contentIssues = issues.filter((x) => !/fixed/.test(x));
    return {
      url: 'https://www.aqar-factory.com' + a.path,
      type: kind, lang,
      name: m ? ((lang === 'ar' && m.row.name_ar) || m.row.name || m.row.title_ar || m.row.title || '') : a.path,
      linked_before: b.reached_by_links ? 'yes' : 'NO',
      inbound_before: b.inbound_links || 0,
      depth_before: b.reached_by_links ? b.depth : '',
      inbound_after: a.inbound_links,
      depth_after: a.depth,
      status: a.status,
      canonical_ok: a.canonical_ok === true ? 'yes' : 'NO',
      title: a.title,
      body_words: bodyWords == null ? '' : bodyWords,
      faq_pairs: faq,
      issues: issues.join('; ') || 'none',
      remaining_content_issues: contentIssues.length,
    };
  });

  fs.writeFileSync(path.join(__dirname, 'indexing-audit.json'), JSON.stringify(rows, null, 1));
  const cnt = (f) => rows.filter(f).length;
  console.log('rows:', rows.length);
  console.log('was orphan:', cnt((r) => r.linked_before === 'NO'), '| was single-link:', cnt((r) => /WAS 1 LINK/.test(r.issues)));
  for (const k of ['thin content', 'no English content', 'no Arabic content', 'duplicate title', 'title in wrong language', 'no price', 'no meta description'])
    console.log(k + ':', cnt((r) => r.issues.includes(k)));
  console.log('no remaining content issue:', cnt((r) => r.remaining_content_issues === 0));
})();
