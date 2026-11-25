/* ============================================================
   AQAR FACTORY — Cloudflare Pages router
   ------------------------------------------------------------
   Every page is built in advance (cf/build.js), so this function only
   picks which file to send: the visitor version or the crawler version,
   a redirect, or — for something created after the last build — the page
   template, which loads the item from the database in the browser.
   It does no rendering, so it stays far below the 10 ms CPU limit.
   Static files (css, js, images, sitemap, admin) never reach it
   (see _routes.json written by the build).
   ============================================================ */
import gen from '../cf/generated.json';
import { isBot, normalizePath, pageKey, oldQueryRedirect } from '../cf/shared.mjs';

const redirect = (url, to, status = 301) => Response.redirect(new URL(to, url.origin).toString(), status);

function html(body, status, extra) {
  const h = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', Vary: 'User-Agent, Sec-Fetch-Mode' });
  if (extra) Object.entries(extra).forEach(([k, v]) => h.set(k, v));
  return new Response(body, { status, headers: h });
}

async function asset(env, url, path) {
  const r = await env.ASSETS.fetch(new URL(path, url.origin).toString());
  return r.status === 200 ? r : null;
}

// is there a published row with this address? (waiting for the database costs no CPU time)
async function exists(table, columns, value) {
  const filter = columns.map(c => `${c}.eq."${value.replace(/["\\]/g, '')}"`).join(',');
  const r = await fetch(`${gen.supabase.url}/rest/v1/${table}?select=id&published=eq.true&or=(${encodeURIComponent(filter)})&limit=1`,
    { headers: { apikey: gen.supabase.key, Authorization: `Bearer ${gen.supabase.key}` } });
  if (!r.ok) throw new Error(table + ' ' + r.status);
  return (await r.json()).length > 0;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);

  if (path.startsWith('/api/')) return next();
  // the stored copies are not addresses of their own
  if (/^\/(_p|_b|_t)(\/|$)/.test(path)) return html(gen.notFound.en, 404, { 'X-Robots-Tag': 'noindex' });

  // the *.pages.dev preview address must not compete with the real domain in search results
  const preview = url.hostname.endsWith('.pages.dev');
  const extra = preview ? { 'X-Robots-Tag': 'noindex, nofollow' } : null;
  // the bare domain goes to www (when the bare domain also points here)
  if (url.hostname === 'aqar-factory.com') return Response.redirect('https://www.aqar-factory.com' + url.pathname + url.search, 301);

  if (path === '/ar/admin' || path.startsWith('/ar/admin/')) return redirect(url, path === '/ar/admin' ? '/admin/login.html' : path.slice(3) + url.search);
  const old = oldQueryRedirect(path, url.searchParams);
  if (old) return redirect(url, old);
  const moved = Object.prototype.hasOwnProperty.call(gen.redirects, path) ? gen.redirects[path] : null;
  if (moved) return redirect(url, moved + (moved.includes('?') ? '' : url.search));

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const ar = path === '/ar' || path.startsWith('/ar/');
  const key = await pageKey(path);
  if (isBot(request.headers)) {
    const b = await asset(env, url, '/_b/' + key);
    if (b) return html(b.body, 200, extra);
  }
  const p = await asset(env, url, '/_p/' + key);
  if (p) return html(p.body, 200, extra);

  // ---- not built yet (created after the last build) ----
  try {
    let m = path.match(/^(?:\/ar)?\/(project|unit|blog)\/([^/]+)$/);
    if (m) {
      const [, kind, slug] = m;
      const found = kind === 'blog' ? await exists('blog_posts', ['slug'], slug)
        : await exists(kind + 's', ['slug', 'slug_ar'], slug);
      if (found) {
        const t = await asset(env, url, '/_t/' + (ar ? 'ar-' : '') + kind);
        if (t) return html(t.body, 200, { 'X-Robots-Tag': 'noindex' });
      }
      return html(ar ? gen.notFound.ar : gen.notFound.en, 404);
    }
    m = path.match(/^(?:\/ar)?\/(city|developer)\/([^/]+)$/);
    if (m) {
      const table = m[1] === 'city' ? 'cities' : 'developers';
      const r = await fetch(`${gen.supabase.url}/rest/v1/${table}?select=name&published=eq.true&slug=eq.${encodeURIComponent(m[2])}&limit=1`,
        { headers: { apikey: gen.supabase.key, Authorization: `Bearer ${gen.supabase.key}` } });
      const rows = r.ok ? await r.json() : [];
      if (rows[0]) return redirect(url, `${ar ? '/ar' : ''}/projects.html?${m[1]}=${encodeURIComponent(rows[0].name)}`, 302);
      return html(ar ? gen.notFound.ar : gen.notFound.en, 404);
    }
    if (/^(?:\/ar)?\/market_update\/[^/]+$/.test(path)) return redirect(url, (ar ? '/ar' : '') + '/market_update', 302);
  } catch (_) {
    return new Response('temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }

  // a plain .html file (Pages itself would answer it with a redirect to the address without .html)
  if (path.endsWith('.html')) {
    const file = await asset(env, url, path.slice(0, -5));
    if (file) return html(file.body, 200, extra);
  }
  const res = await next();
  if (res.status === 404) return html(ar ? gen.notFound.ar : gen.notFound.en, 404);
  return res;
}
