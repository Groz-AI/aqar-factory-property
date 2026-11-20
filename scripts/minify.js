/* ============================================================
   Minify the site's own JS / CSS — runs ONLY on Vercel's build
   (vercel.json "buildCommand"), on Vercel's throw-away checkout. The files in
   the repo stay readable; locally nothing changes (no VERCEL env var → exits).
   Whitespace + syntax only (no renaming of top-level names, which the page
   scripts share as globals). Every file is checked after minifying: if esbuild
   fails or the result is not smaller, the original file is left untouched.
   NOT touched on purpose: api/, middleware.js, schema-helpers.js and i18n.js
   (read by the serverless functions at run time), config.js, fallback.js,
   local-backend.js and admin/.
   ============================================================ */
const fs = require('fs');
const path = require('path');

if (!process.env.VERCEL && !process.argv.includes('--force')) { console.log('minify: not on Vercel, skipped'); process.exit(0); }

let esbuild;
try { esbuild = require('esbuild'); } catch (e) { console.log('minify: esbuild missing, skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const js = ['ai-widget', 'blocks-render', 'blog-post', 'blog', 'branding', 'card-contact', 'cities', 'data', 'market-update',
  'newsletter', 'project', 'projects', 'script', 'smart-search', 'store', 'unit', 'units', 'whatsapp-widget'].map(n => n + '.js');
const css = ['styles.css', 'pages.css'];

let before = 0, after = 0;
for (const f of js.concat(css)) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  try {
    const out = esbuild.transformSync(src, { loader: f.endsWith('.css') ? 'css' : 'js', minify: true, legalComments: 'none', target: 'es2020' }).code;
    if (!out || out.length >= src.length) continue;
    fs.writeFileSync(p, out);
    before += Buffer.byteLength(src); after += Buffer.byteLength(out);
    console.log(`minify: ${f} ${Buffer.byteLength(src)} -> ${Buffer.byteLength(out)}`);
  } catch (e) {
    console.log(`minify: ${f} skipped (${String(e.message).split('\n')[0]})`);
  }
}
console.log(`minify: total ${before} -> ${after} bytes`);
