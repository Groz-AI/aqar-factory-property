/* ============================================================
   AQAR FACTORY — image resizer (Vercel serverless function)
   ------------------------------------------------------------
   /api/img?u=<R2 image address>&w=<width>

   The project / unit photos are uploaded as-is to Cloudflare R2: 2-3 MB PNG and
   JPEG files, which the cards then showed at ~400 px wide (the home page alone
   pulled ~27 MB of photos). This sends the same picture as a resized WebP
   (usually 30-120 KB). Vercel's CDN keeps each answer for a year, so every
   picture is resized once per width; the originals in R2 are never touched.

   - only addresses on our own R2 public host are accepted (not an open proxy)
   - widths snap to a short list so the cache stays small
   - anything that cannot be resized (animated GIF, SVG, unreadable file, R2
     error) is answered with a redirect to the original, so a picture never breaks
   ============================================================ */
const sharp = require('sharp');

const ALLOWED_HOSTS = new Set(['pub-8984ca4087bd4a4e8908ca76e2fc6828.r2.dev']);
const WIDTHS = [320, 480, 640, 800, 1200, 1600];
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

// keep = a deliberate choice (already small, SVG, GIF): safe to cache for a day; an error is retried after a minute
function toOriginal(res, url, keep) {
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', keep ? 'public, max-age=3600, s-maxage=86400' : 'public, max-age=60, s-maxage=60');
  res.end();
}

module.exports = async function handler(req, res) {
  const q = new URL(req.url, 'https://www.aqar-factory.com').searchParams;
  let url;
  try { url = new URL(q.get('u') || ''); } catch (_) { url = null; }
  if (!url || url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    res.statusCode = 400; res.setHeader('Content-Type', 'text/plain'); res.end('bad image address'); return;
  }
  const want = parseInt(q.get('w'), 10) || 800;
  // the nearest size that is not clearly smaller than asked (900 -> 800, 700 -> 640), so cards
  // are not sent a whole size class bigger than they are drawn
  const width = WIDTHS.find(x => x >= want * 0.88) || WIDTHS[WIDTHS.length - 1];

  try {
    const r = await fetch(url.href, { redirect: 'error', signal: AbortSignal.timeout(9000) });
    if (!r.ok) return toOriginal(res, url.href);
    const declared = Number(r.headers.get('content-length')) || 0;
    if (declared > MAX_INPUT_BYTES) return toOriginal(res, url.href);
    const input = Buffer.from(await r.arrayBuffer());
    if (input.length > MAX_INPUT_BYTES) return toOriginal(res, url.href);

    const meta = await sharp(input, { failOn: 'none' }).metadata();
    if (!meta.format || meta.format === 'svg' || meta.format === 'gif' || (meta.pages || 1) > 1) return toOriginal(res, url.href, true);

    const out = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, alphaQuality: 90 })
      .toBuffer();
    // a tiny original can already be smaller than its WebP: keep it
    if (out.length >= input.length) return toOriginal(res, url.href, true);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', out.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.end(out);
  } catch (_) {
    toOriginal(res, url.href);
  }
};
