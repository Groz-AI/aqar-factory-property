# SEO audit scripts

Live checks against **production** (www.aqar-factory.com), all requesting with
Googlebot's user agent so they exercise the same path in `middleware.js` that a
real crawler does. Run these before starting any Search Console validation —
GSC validation takes days to fail, these take minutes.

```bash
cd scripts/seo-audit
node fetch-slugs.js > slugs.json   # snapshot every published slug from Supabase
node check-urls.js                 # every clean /project|/unit|/blog URL, en + ar
node check-old-urls.js             # every old .html?id= URL's full redirect chain
node check-sitemap.js              # every <loc> in the live sitemap
```

Each reports `CLEAN` vs `WITH ISSUES` plus a per-issue breakdown. What they catch:

- **`generic_title`** — the page answered 200 with the bare template title
  (`Project — Aqar Factory`), i.e. a *soft 404*: the slug matches no published
  row. This is the failure mode that repeatedly broke GSC validation.
- **`noindex`** — a `robots` noindex tag reached a crawler.
- **`canonical_mismatch` / `no_canonical`** — canonical pointing somewhere other
  than the URL itself. The 12 static pages intentionally ship no canonical tag
  (they're shared byte-for-byte between `/page.html` and `/ar/page.html`, so any
  hardcoded href is wrong for one language — see the comment in each file).
- **`unexpected_redirect`**, **`bad_status_*`**, double/encoded slashes in slugs.

Two known, intentional non-issues in `check-sitemap.js` output: `no_canonical` on
the 12 static pages (above), and `generic_title` on `blog.html`, whose real title
genuinely is "Blog — Aqar Factory".
