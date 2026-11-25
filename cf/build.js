/* ============================================================
   AQAR FACTORY — static build for Cloudflare Pages
   ------------------------------------------------------------
   npm run build:cf   ->   dist/

   Renders every page once, with the same server code Vercel ran on each
   visit (api/*.js), so no page costs any server CPU afterwards:
     dist/_p/<hash>   the visitor version      dist/_b/<hash>  the crawler version
     dist/_t/*        templates for items created after the build
     dist/_img/*      resized WebP copies of the photos (+ manifest.js)
     sitemap.xml, robots.txt, the static files, redirects (cf/generated.json)

   Settings (environment):
     IMAGES=0            skip the photo copies (pages then use the originals)
     IMAGES=40           only the first 40 photos (for a local test)
     IMAGE_MINUTES=6     stop making new copies after this long (the whole build must end within 20 min)
     IMAGE_CACHE_URL     the live site (https://...); copies it already has are taken from there
     PAGES=30            only the first 30 detail pages (for a local test)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const SITE = 'https://www.aqar-factory.com';
const HOST = 'www.aqar-factory.com';
const config = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
const SUPA = config.match(/url:\s*"([^"]+)"/)[1];
const KEY = config.match(/anonKey:\s*"([^"]+)"/)[1];
const R2_RE = /https:\/\/pub-[a-z0-9]+\.r2\.dev\/[^"'\\\s)<>]+/g;
const started = Date.now();
const log = (...a) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s]`, ...a);

/* ---------- network: the site's own files come from this folder, database reads are cached ---------- */
const realFetch = global.fetch;
const memo = new Map();
async function netFetch(url, opts) {
  for (let i = 0; ; i++) {
    try {
      const r = await realFetch(url, { ...opts, signal: AbortSignal.timeout(45000) });
      if (r.status >= 500 && i < 4) throw new Error('status ' + r.status);
      return r;
    } catch (e) {
      if (i >= 4) throw e;
      await new Promise(ok => setTimeout(ok, 800 * (i + 1)));
    }
  }
}
global.fetch = async (input, opts = {}) => {
  const url = String((input && input.url) || input);
  const own = url.match(/^https:\/\/(?:www\.)?aqar-factory\.com(\/[^?#]*)?/);
  if (own && !String(own[1] || '').startsWith('/api/')) {
    const rel = decodeURIComponent(own[1] || '/').replace(/^\/ar(?=\/|$)/, '') || '/';
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file), { status: 200 }) : new Response('not found', { status: 404 });
  }
  if (!url.startsWith(SUPA) || (opts.method && opts.method !== 'GET')) return netFetch(url, opts);
  const id = url + JSON.stringify(opts.headers || {});
  if (!memo.has(id)) {
    memo.set(id, netFetch(url, opts).then(async (r) => ({ status: r.status, headers: [...r.headers], body: Buffer.from(await r.arrayBuffer()) })));
  }
  let saved;
  try { saved = await memo.get(id); } catch (e) { memo.delete(id); throw e; }
  const headers = saved.headers.filter(([k]) => !/^(content-encoding|content-length|transfer-encoding)$/i.test(k));
  return new Response(saved.status === 204 ? null : saved.body, { status: saved.status, headers });
};

async function rows(table, query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await global.fetch(`${SUPA}/rest/v1/${table}?${query}&limit=1000&offset=${from}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
const optional = (p) => p.catch((e) => { log('skipped:', e.message); return []; });

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

/* ---------- run a Vercel handler and collect its answer ---------- */
function invoke(handler, url, query) {
  return new Promise((resolve, reject) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) { headers[k.toLowerCase()] = v; return this; },
      getHeader(k) { return headers[k.toLowerCase()]; },
      status(c) { this.statusCode = c; return this; },
      json(o) { this.end(JSON.stringify(o)); },
      send(b) { this.end(b); },
      end(b) { resolve({ status: this.statusCode, headers, body: b == null ? '' : String(b) }); }
    };
    const req = { method: 'GET', url, query: query || Object.fromEntries(new URL(url, SITE).searchParams), headers: { host: HOST, 'user-agent': 'build' }, socket: {} };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

/* ---------- files ---------- */
function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}
const keyOf = (p) => crypto.createHash('sha1').update(p, 'utf8').digest('hex');
const normalize = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/* ---------- photos: resized copies made once, here ---------- */
const manifest = {};
function wantedSizes(table, key) {
  if (/logo/i.test(key)) return [320];
  if (table === 'cities') return [640, 800];
  if (table === 'market_updates') return [800, 1200, 1600];
  if (table === 'blog_posts' || table === 'content_blocks') return [800, 1600];
  if (/consultant|unit_types|avatar/i.test(key)) return [320, 800];
  return [800, 1600];
}
function collectImages(table, value, key, found) {
  if (typeof value === 'string') {
    for (const u of value.match(R2_RE) || []) {
      if (!found.has(u)) found.set(u, new Set());
      wantedSizes(table, key).forEach(s => found.get(u).add(s));
    }
  } else if (Array.isArray(value)) value.forEach(v => collectImages(table, v, key, found));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => collectImages(table, v, key === 'gallery' ? key : k, found));
}
async function buildImages() {
  const setting = process.env.IMAGES === undefined ? Infinity : Number(process.env.IMAGES);
  const found = new Map();
  for (const table of ['projects', 'units', 'cities', 'developers', 'blog_posts', 'market_updates']) {
    (await optional(rows(table, 'select=*&published=eq.true'))).forEach(r => collectImages(table, r, '', found));
  }
  for (const table of ['content_blocks', 'settings', 'site_settings', 'testimonials']) {
    (await optional(rows(table, 'select=*'))).forEach(r => collectImages(table, r, '', found));
  }
  // the brand logo sits in the page headers
  for (const m of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(R2_RE) || []) { if (!found.has(m)) found.set(m, new Set([800])); }
  const list = [...found.entries()].filter(([u]) => /\.(jpe?g|jfif|png|webp|avif)$/i.test(u)).slice(0, setting);
  log(`photos: ${found.size} found, making copies of ${list.length}`);
  if (!list.length) return;
  const sharp = require('sharp');
  sharp.concurrency(1);
  const cacheDir = path.join(ROOT, 'node_modules', '.cache', 'cf-img');
  fs.mkdirSync(cacheDir, { recursive: true });
  const deadline = Date.now() + Number(process.env.IMAGE_MINUTES || 6) * 60000;
  let made = 0, failed = 0, late = 0, reused = 0;
  // on Cloudflare: take copies from whichever address already serves this build's photos
  const candidates = process.env.IMAGE_CACHE_URL ? [process.env.IMAGE_CACHE_URL]
    : process.env.CF_PAGES ? ['https://aqar-factory.pages.dev', 'https://www.aqar-factory.com'] : [];
  let live = '';
  for (const c of candidates) {
    const base = c.replace(/\/+$/, '');
    try { const r = await realFetch(base + '/_img/manifest.js', { signal: AbortSignal.timeout(15000) }); if (r.status === 200 && (await r.text()).startsWith('window.__IMG=')) { live = base; break; } } catch (_) { /* try the next */ }
  }
  log(live ? `photo copies can be reused from ${live}` : 'no earlier photo copies to reuse');
  // a copy the live site already has is downloaded instead of being made again (much smaller than the original)
  async function fromLive(name, s, file) {
    if (!live) return false;
    try {
      const r = await realFetch(`${live}/_img/${encodeURIComponent(name)}-${s}.webp`, { signal: AbortSignal.timeout(20000) });
      if (r.status !== 200 || !/webp/.test(r.headers.get('content-type') || '')) return false;
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      reused++;
      return true;
    } catch (_) { return false; }
  }
  await pool(list, 8, async ([url, sizes]) => {
    const name = url.split('/').pop();
    const wanted = [...sizes].sort((a, b) => a - b);
    const missing = [];
    for (const s of wanted) {
      const file = path.join(cacheDir, `${name}-${s}.webp`);
      if (!fs.existsSync(file) && !(await fromLive(name, s, file))) missing.push(s);
    }
    const cached = missing.length === 0;
    if (!cached && Date.now() > deadline) { late++; return; }
    try {
      let input = null;
      if (!cached) {
        const r = await netFetch(url, {});
        if (!r.ok) throw new Error('HTTP ' + r.status);
        input = Buffer.from(await r.arrayBuffer());
      }
      const done = [];
      for (const s of wanted) {
        const file = path.join(cacheDir, `${name}-${s}.webp`);
        if (!fs.existsSync(file)) {
          const out = await sharp(input, { failOn: 'none' }).rotate().resize({ width: s, withoutEnlargement: true }).webp({ quality: 78, alphaQuality: 90 }).toBuffer();
          fs.writeFileSync(file, out);
        }
        write(`_img/${name}-${s}.webp`, fs.readFileSync(file));
        done.push(s);
      }
      manifest[name] = done;
      if (++made % 200 === 0) log(`photos ${made}/${list.length}`);
    } catch (e) { failed++; }
  });
  log(`photos: ${made} done (${reused} copies reused from the live site), ${failed} failed, ${late} left for a later build (these show the original)`);
}
// the same choice window.U (data.js) makes in the browser
function shownImage(original, width) {
  const m = original.match(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\/([^?#]+)$/);
  const have = m && manifest[m[1]];
  if (!have) return original;
  return `/_img/${m[1]}-${have.find(s => s >= width * 0.88) || have[have.length - 1]}.webp`;
}
function finishHtml(html) {
  return html
    // server-built addresses of Vercel's resizer -> the copy made above (or the original)
    .replace(/\/api\/img\?u=([^"'&\s)]+)(?:&amp;|&)w=(\d+)/g, (m, u, w) => shownImage(decodeURIComponent(u), Number(w)))
    .replace(/<script src="data\.js"><\/script>/, '<script src="/_img/manifest.js"></script>\n<script src="data.js"></script>')
    // lists inlined at build time are only for the first paint: store.js fetches the current ones
    .replace(/<script src="store\.js"><\/script>/, (m) => (html.includes('window.__PRELOAD=') ? '<script>window.__PRELOAD_STATIC=1;</script>\n' : '') + m);
}

/* ---------- static files ---------- */
async function copyStatic() {
  const esbuild = require('esbuild');
  const asset = /\.(html|js|css|png|jpe?g|ico|svg|webp|txt|webmanifest)$/i;
  const skip = new Set(['middleware.js']);
  const files = fs.readdirSync(ROOT).filter(f => fs.statSync(path.join(ROOT, f)).isFile() && asset.test(f) && !skip.has(f));
  for (const f of fs.readdirSync(path.join(ROOT, 'admin'))) files.push('admin/' + f);
  const minified = new Set(['ai-widget', 'blocks-render', 'blog-post', 'blog', 'branding', 'card-contact', 'cities', 'data', 'developers', 'market-update',
    'newsletter', 'project', 'projects', 'script', 'smart-search', 'store', 'unit', 'units', 'whatsapp-widget'].map(n => n + '.js').concat(['styles.css', 'pages.css']));
  for (const f of files) {
    let data = fs.readFileSync(path.join(ROOT, f));
    if (minified.has(f)) {
      data = (await esbuild.transform(data.toString('utf8'), { loader: f.endsWith('.css') ? 'css' : 'js', minify: true, charset: 'utf8' })).code;
    } else if (f.endsWith('.html') && !f.startsWith('admin/')) data = finishHtml(data.toString('utf8'));
    write(f, data);
    // pages under /ar/ ask for their files with relative addresses (ar/styles.css)
    if (!f.endsWith('.html') && !f.includes('/')) write('ar/' + f, data);
  }
  log(`static files: ${files.length}`);
}

/* ---------- main ---------- */
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const [projects, units, posts, cities, developers] = await Promise.all([
    rows('projects', 'select=slug,slug_ar&published=eq.true'), rows('units', 'select=slug,slug_ar&published=eq.true'),
    rows('blog_posts', 'select=slug&published=eq.true'), rows('cities', 'select=*&published=eq.true'), rows('developers', 'select=*&published=eq.true')
  ]);
  const updates = await optional(rows('market_updates', 'select=slug&published=eq.true'));
  const renames = await optional(rows('slug_redirects', 'select=table_name,old_slug,row_id'));
  // never publish an empty site because the database could not be read
  if (!projects.length || !units.length) throw new Error('the database returned no projects / units — build stopped');
  log(`rows: ${projects.length} projects, ${units.length} units, ${posts.length} posts, ${cities.length} cities, ${developers.length} developers, ${updates.length} updates`);

  await buildImages();
  write('_img/manifest.js', `window.__IMG=${JSON.stringify(manifest)};\n`);
  await copyStatic();

  const api = (n) => require(path.join(ROOT, 'api', n + '.js'));
  const botRender = api('bot-render'), preload = api('preload'), landing = api('landing'), market = api('market-update');
  const SchemaHelpers = require(path.join(ROOT, 'schema-helpers.js'));
  const redirects = {};
  const failures = [];
  let pages = 0;

  const toPath = (location) => {
    const u = new URL(location, SITE);
    return u.pathname + u.search;
  };
  // renders one address and stores it; a redirect answer becomes a redirect rule
  async function page(address, variant, handler, url, query) {
    let r;
    for (let i = 0; i < 3; i++) {
      try { r = await invoke(handler, url, query); } catch (e) { r = { status: 599, body: e.message, headers: {} }; }
      if (r.status < 500) break;
      await new Promise(ok => setTimeout(ok, 1500 * (i + 1)));
    }
    const p = normalize(address);
    if (r.status === 200) {
      const html = finishHtml(r.body);
      for (const v of variant) write(`${v}/${keyOf(p)}.html`, html);
      pages++;
      return html;
    }
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      const to = toPath(r.headers.location);
      if (decodeURIComponent(to.split('?')[0]) !== p) redirects[p] = to;
    } else if (r.status !== 404) failures.push(`${r.status} ${p}`);
    return null;
  }

  // 1. list pages and text pages, English and Arabic
  const staticPages = ['/', '/projects.html', '/units.html', '/cities.html', '/developers.html', '/blog.html', '/about.html', '/contact.html', '/privacy.html', '/terms.html'];
  await pool(staticPages.flatMap(p => [[p, 'en'], [p, 'ar']]), 4, async ([p, lang]) => {
    const address = lang === 'ar' ? (p === '/' ? '/ar' : '/ar' + p) : p;
    const visitor = await page(address, ['_p'], preload, '/api/preload', { page: p, lang: lang === 'ar' ? 'ar' : undefined });
    await page(address, ['_b'], botRender, `/api/bot-render?mode=static&page=${encodeURIComponent(p)}&lang=${lang}`);
    // also as a plain file, in case the router is ever bypassed (Pages "fail open")
    if (visitor) write(p === '/' ? (lang === 'ar' ? 'ar/index.html' : 'index.html') : address.slice(1), visitor);
  });
  log('list and text pages done');

  // 2. project / unit / article pages
  const limit = Number(process.env.PAGES || Infinity);
  const details = [];
  const add = (kind, slug, slugAr) => {
    if (!slug) return;
    const ar = slugAr || slug;
    details.push([kind, slug, 'en'], [kind, ar, 'ar']);
    // the other spelling of the address answers with a redirect: collect it
    if (ar !== slug) details.push([kind, ar, 'en'], [kind, slug, 'ar']);
  };
  projects.slice(0, limit).forEach(r => add('project', r.slug, r.slug_ar));
  units.slice(0, limit).forEach(r => add('unit', r.slug, r.slug_ar));
  posts.slice(0, limit).forEach(r => add('blog', r.slug));
  const kindTable = { projects: 'project', units: 'unit', blog_posts: 'blog' };
  renames.forEach(r => { if (kindTable[r.table_name] && limit === Infinity) details.push([kindTable[r.table_name], r.old_slug, 'en'], [kindTable[r.table_name], r.old_slug, 'ar']); });
  let done = 0;
  await pool(details, 8, async ([kind, slug, lang]) => {
    const address = `${lang === 'ar' ? '/ar' : ''}/${kind}/${slug}`;
    const q = `/api/bot-render?mode=detail&kind=${kind}&slug=${encodeURIComponent(slug)}&lang=${lang}`;
    const html = await page(address, ['_p'], botRender, q + '&shell=1');
    if (html) await page(address, ['_b'], botRender, q + '&rich=1');
    if (++done % 200 === 0) log(`detail pages ${done}/${details.length}`);
  });
  log('project, unit and article pages done');

  // 3. city and developer pages
  const landings = [];
  for (const [kind, list, table] of [['city', cities, 'cities'], ['developer', developers, 'developers']]) {
    list.forEach(e => { const s = SchemaHelpers.entityUrlSlug(e); if (s) landings.push([kind, s]); });
    renames.filter(r => r.table_name === table).forEach(r => landings.push([kind, r.old_slug]));
  }
  await pool(landings.slice(0, limit === Infinity ? Infinity : limit * 2).flatMap(([k, s]) => [[k, s, 'en'], [k, s, 'ar']]), 6, async ([kind, slug, lang]) => {
    await page(`${lang === 'ar' ? '/ar' : ''}/${kind}/${slug}`, ['_p'], landing, '/api/landing', { kind, slug, lang: lang === 'ar' ? 'ar' : undefined });
  });
  log('city and developer pages done');

  // 4. Track Your Project pages
  await pool([''].concat(updates.map(u => u.slug)).flatMap(s => [[s, 'en'], [s, 'ar']]), 4, async ([slug, lang]) => {
    await page(`${lang === 'ar' ? '/ar' : ''}/market_update${slug ? '/' + slug : ''}`, ['_p'], market, '/api/market-update', { slug: slug || undefined, lang: lang === 'ar' ? 'ar' : undefined });
  });
  log('market update pages done');

  // 5. sitemap and robots
  for (const [file, name] of [['sitemap.xml', 'sitemap'], ['robots.txt', 'robots']]) {
    const r = await invoke(api(name), '/' + file, {});
    if (r.status !== 200) throw new Error(`${file}: HTTP ${r.status}`);
    write(file, r.body);
  }

  // 6. templates for things created after this build
  const { toArabicHtml } = require(path.join(ROOT, 'api', '_i18n-server.js'));
  for (const [kind, file] of [['project', 'project.html'], ['unit', 'unit.html'], ['blog', 'blog-post.html']]) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace('<head>', '<head>\n<base href="/">');
    write(`_t/${kind}.html`, finishHtml(src));
    write(`_t/ar-${kind}.html`, finishHtml(await toArabicHtml(src)));
  }

  // 7. redirects: the ones in vercel.json and middleware.js
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  (vercel.redirects || []).filter(r => !r.has && !r.source.includes(':')).forEach(r => { redirects[r.source] = r.destination; });
  const mw = fs.readFileSync(path.join(ROOT, 'middleware.js'), 'utf8');
  const start = mw.indexOf('const RENAMED = {');
  const end = mw.indexOf('\n  };', start);
  if (start < 0 || end < 0) throw new Error('RENAMED list not found in middleware.js');
  const renamed = vm.runInNewContext('(' + mw.slice(start + 'const RENAMED = '.length, end + 4) + ')');
  Object.entries(renamed).forEach(([from, to]) => {
    redirects['/' + from] = encodeURI(to);
    redirects['/ar/' + from] = encodeURI('/ar' + to);
  });

  const notFound = (ar) => `<!DOCTYPE html><html lang="${ar ? 'ar' : 'en'}"${ar ? ' dir="rtl"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${ar ? 'الصفحة غير موجودة' : 'Page not found'}</title></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px"><h1>${ar ? 'الصفحة غير موجودة' : 'Page not found'}</h1><p><a href="${ar ? '/ar' : '/'}">Aqar Factory</a></p></body></html>`;
  write('404.html', notFound(false));
  fs.writeFileSync(path.join(ROOT, 'cf', 'generated.json'), JSON.stringify({ supabase: { url: SUPA, key: KEY }, redirects, notFound: { en: notFound(false), ar: notFound(true) } }));

  write('_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: ['/admin/*', '/_img/*', '/*.css', '/*.js', '/*.png', '/*.jpg', '/*.ico', '/*.svg', '/*.webp', '/*.xml', '/*.txt'] }));
  write('_headers', ['/admin/*', '  X-Robots-Tag: noindex, nofollow', '', '/_img/*.webp', '  Cache-Control: public, max-age=31536000, immutable', ''].join('\n'));

  const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
  const total = count(OUT);
  log(`pages written: ${pages}, redirects: ${Object.keys(redirects).length}, files: ${total}, problems: ${failures.length}`);
  failures.slice(0, 20).forEach(f => console.log('  problem:', f));
  if (total > 20000) throw new Error('more than 20,000 files (Cloudflare Pages free limit)');
  // a few broken pages should not block a publish; many mean something is wrong
  if (failures.length > Math.max(10, pages * 0.02)) throw new Error('too many pages failed — build stopped');
})().catch((e) => { console.error('BUILD FAILED:', e.stack || e.message); process.exit(1); });
