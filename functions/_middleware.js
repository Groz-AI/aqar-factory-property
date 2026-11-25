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

// a stored file, or null when there is none. While a new version is going live a read can
// fail for a moment: try once more, and never mistake that failure for "no such page"
async function asset(env, url, path) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await env.ASSETS.fetch(new URL(path, url.origin).toString());
      if (r.status === 200) return r;
      if (r.status < 500) return null;
      throw new Error('stored file ' + r.status);
    } catch (e) {
      if (attempt > 1) throw e;
    }
  }
}

// published rows only (waiting for the database costs no CPU time)
async function rows(query) {
  const r = await fetch(`${gen.supabase.url}/rest/v1/${query}`,
    { headers: { apikey: gen.supabase.key, Authorization: `Bearer ${gen.supabase.key}` } });
  if (!r.ok) throw new Error(query.split('?')[0] + ' ' + r.status);
  return r.json();
}

// is there a published row with this address?
async function exists(table, columns, value) {
  const filter = columns.map(c => `${c}.eq."${value.replace(/["\\]/g, '')}"`).join(',');
  return (await rows(`${table}?select=id&published=eq.true&or=(${encodeURIComponent(filter)})&limit=1`)).length > 0;
}

const unavailable = () => new Response('temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });

export async function onRequest(context) {
  let res;
  try { res = await route(context); } catch (_) { res = unavailable(); }
  // browsers keep using https for this site, as on the previous host
  const out = new Response(res.body, res);
  out.headers.set('Strict-Transport-Security', 'max-age=63072000');
  return out;
}

async function route(context) {
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

  if (path === '/ar/admin' || path.startsWith('/ar/admin/')) return redirect(url, path === '/ar/admin' ? '/admin/login.html' : path.slice(3) + url.search, 308);
  const old = oldQueryRedirect(path, url.searchParams);
  if (old) return redirect(url, old);
  const moved = Object.prototype.hasOwnProperty.call(gen.redirects, path) ? gen.redirects[path] : null;
  if (moved) return redirect(url, moved + (moved.includes('?') ? '' : url.search), gen.permanent.includes(path) ? 308 : 301);
  // one address per page: "/x/" -> "/x" (the leading slashes are collapsed so it stays on this site)
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) return redirect(url, '/' + url.pathname.replace(/^\/+|\/+$/g, '') + url.search, 308);

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const ar = path === '/ar' || path.startsWith('/ar/');
  // the page templates are not addresses of their own
  if (/^(?:\/ar)?\/(project|unit|blog-post|market-update)$/.test(path)) return html(ar ? gen.notFound.ar : gen.notFound.en, 404);
  const key = await pageKey(path);
  if (isBot(request.headers)) {
    const b = await asset(env, url, '/_b/' + key);
    if (b) return html(b.body, 200, extra);
  }
  const p = await asset(env, url, '/_p/' + key);
  if (p) return html(p.body, 200, extra);

  // ---- not built yet (created after the last build) ----
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
    const found = await rows(`${table}?select=name&published=eq.true&slug=eq.${encodeURIComponent(m[2])}&limit=1`);
    if (found[0]) return redirect(url, `${ar ? '/ar' : ''}/projects.html?${m[1]}=${encodeURIComponent(found[0].name)}`, 302);
    return html(ar ? gen.notFound.ar : gen.notFound.en, 404);
  }
  m = path.match(/^(?:\/ar)?\/market_update\/([^/]+)$/);
  if (m) {
    // the database only shows published updates to visitors
    if ((await rows(`market_updates?select=id&slug=eq.${encodeURIComponent(m[1])}&limit=1`)).length) return redirect(url, (ar ? '/ar' : '') + '/market_update', 302);
    return html(ar ? gen.notFound.ar : gen.notFound.en, 404);
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
