/* ============================================================
   AQAR FACTORY — Arabic text in the first HTML (server side)
   ------------------------------------------------------------
   The static pages are written in English and translated in the
   browser by i18n.js. For a visitor of an /ar/ page that meant the
   first HTML (and a visitor without JavaScript, or a page checker)
   saw English headings and an English <title>.

   This reads the very same dictionary out of i18n.js and applies it
   to the page source before it is sent, so /ar/ pages arrive in
   Arabic. The attributes (data-i18n, data-i18n-html) are left in
   place: i18n.js still runs and leaves already-Arabic text alone.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let DICT = null;

// the dictionary lives in i18n.js (shipped with this function through
// vercel.json "includeFiles"); if that file is not on disk, read it from the site
async function loadDict() {
  if (DICT) return DICT;
  let src = '';
  try { src = fs.readFileSync(path.join(__dirname, '..', 'i18n.js'), 'utf8'); } catch (_) { /* fall back below */ }
  if (!src) {
    const r = await fetch('https://www.aqar-factory.com/i18n.js', { headers: { 'x-mw-static-fetch': '1' } });
    if (!r.ok) throw new Error('i18n.js ' + r.status);
    src = await r.text();
  }
  const start = src.indexOf('const AR = {');
  const end = src.indexOf('\n  };', start);
  if (start < 0 || end < 0) { DICT = {}; return DICT; }
  const literal = src.slice(start + 'const AR = '.length, end + 4);
  DICT = vm.runInNewContext('(' + literal + ')', Object.create(null), { timeout: 1000 });
  return DICT;
}

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// internal links in Arabic pages must stay in /ar/: the pages are written with
// "/" and relative "projects.html" style links, which point at the English
// site from /ar and from the detail pages (they use <base href="/">)
function localizeLinksAr(html) {
  // the language switch carries id="langSwitch" before its href, so it is skipped
  return html.replace(/(<a\s(?:[^>]*?\s)?href=")([^"]*)(")/gi, (m, a, href, c) => {
    if (/id="langSwitch"/.test(a)) return m;
    let to = null;
    if (href === '/') to = '/ar';
    else if (/^\/#/.test(href)) to = '/ar' + href.slice(1);
    else if (/^[a-z-]+\.html([?#].*)?$/i.test(href)) to = '/ar/' + href;
    return to ? a + to + c : m;
  });
}

async function toArabicHtml(html) {
  const AR = await loadDict();
  let out = html.replace('<html lang="en">', '<html lang="ar" dir="rtl">');

  // <tag data-i18n>plain English text</tag>
  out = out.replace(/<([a-z0-9]+)([^>]*?)\sdata-i18n(?=[\s>])([^>]*)>([^<]*)<\/\1>/gi, (m, tag, a, b, text) => {
    const ar = AR[norm(unesc(text))] || AR[unesc(text)];
    return ar ? `<${tag}${a} data-i18n${b}>${esc(ar)}</${tag}>` : m;
  });

  // <tag data-i18n-html="key">English html</tag> (heading / paragraph level only)
  out = out.replace(/<(h[1-6]|p|span|a|button|label|li)([^>]*?)\sdata-i18n-html="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, a, key, b) => {
    const ar = AR[key];
    return ar ? `<${tag}${a} data-i18n-html="${key}"${b}>${ar}</${tag}>` : m;
  });

  // <meta name="description" content="..." data-i18n-content>
  out = out.replace(/<meta\s([^>]*?)data-i18n-content([^>]*)>/gi, (m) => {
    return m.replace(/content="([^"]*)"/, (mm, v) => {
      const ar = AR[norm(unesc(v))] || AR[unesc(v)];
      return ar ? `content="${esc(ar).replace(/"/g, '&quot;')}"` : mm;
    });
  });

  return localizeLinksAr(out);
}

module.exports = { toArabicHtml, localizeLinksAr };
