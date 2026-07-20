/* ============================================================
   AQAR FACTORY — robots.txt (Vercel serverless function)
   ------------------------------------------------------------
   Served at /robots.txt via the rewrite in vercel.json. The
   Sitemap line is built from the incoming request's Host header
   so it automatically points at whichever domain is serving the
   site (vercel.app today, aqar-factory.com once that's wired up)
   with no code change needed at migration time.
   ============================================================ */

module.exports = function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: https://${host}/sitemap.xml\n`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(body);
};
