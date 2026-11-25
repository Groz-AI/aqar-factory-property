// Runs one of the existing Vercel (Node style) handlers inside a Cloudflare Pages Function.
export async function runNodeHandler(handler, context) {
  const { request, env } = context;
  // the handlers read their settings from process.env (nodejs_compat provides process)
  Object.entries(env).forEach(([k, v]) => { if (typeof v === 'string') process.env[k] = v; });

  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  headers['x-forwarded-for'] = ip;
  const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();

  return new Promise((resolve) => {
    const out = new Headers();
    const done = (payload) => resolve(new Response(payload == null ? null : payload, { status: res.statusCode, headers: out }));
    const res = {
      statusCode: 200,
      setHeader(k, v) { out.set(k, String(v)); return this; },
      getHeader(k) { return out.get(k); },
      status(c) { this.statusCode = c; return this; },
      json(o) { out.set('Content-Type', 'application/json; charset=utf-8'); done(JSON.stringify(o)); },
      send(b) { done(b); },
      end(b) { done(b); }
    };
    const req = { method: request.method, url: url.pathname + url.search, headers, body, query: Object.fromEntries(url.searchParams), socket: { remoteAddress: ip } };
    Promise.resolve(handler(req, res)).catch((e) => {
      console.error('handler error', e && e.message);
      res.statusCode = 500; res.json({ error: 'server_error' });
    });
  });
}
