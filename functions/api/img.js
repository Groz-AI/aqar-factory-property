/* ============================================================
   /api/img?u=<R2 photo>&w=<width> — the old resized-photo address
   ------------------------------------------------------------
   The Vercel version of the site resized photos at this address, so
   search engines and saved pages may still ask for it. The copies are
   now made by the build (cf/build.js -> /_img/), so this sends the
   stored copy of the asked size, or the original when there is none.
   Nothing is resized here.
   ============================================================ */
const PHOTO_HOST = 'pub-8984ca4087bd4a4e8908ca76e2fc6828.r2.dev';
const WIDTHS = [320, 480, 640, 800, 1200, 1600];

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  let photo;
  try { photo = new URL(url.searchParams.get('u') || ''); } catch (_) { photo = null; }
  // only our own photo storage: this must not forward to any address it is given
  if (!photo || photo.protocol !== 'https:' || photo.hostname !== PHOTO_HOST) {
    return new Response('bad image address', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }
  const want = parseInt(url.searchParams.get('w'), 10) || 800;
  const first = WIDTHS.findIndex((w) => w >= want * 0.88);
  const name = photo.pathname.split('/').pop();
  // the asked size, or else the next bigger copy that was made
  for (const width of WIDTHS.slice(first < 0 ? WIDTHS.length - 1 : first)) {
    const copy = await env.ASSETS.fetch(new URL(`/_img/${name}-${width}.webp`, url.origin).toString());
    if (copy.status === 200) {
      return new Response(copy.body, { status: 200, headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400' } });
    }
  }
  return new Response(null, { status: 302, headers: { Location: photo.href, 'Cache-Control': 'public, max-age=3600' } });
}
