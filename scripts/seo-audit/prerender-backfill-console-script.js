/* ============================================================
   ONE-TIME PRERENDER BACKFILL — run this in the browser console
   while logged into /admin/

   What this does: for every published project, unit, and blog post,
   triggers the SAME "/api/prerender" regenerate call that admin.js
   already fires automatically on every save (admin.js:1924-1940) —
   this just runs it once for everything that predates that feature
   or was never re-saved since.

   After this finishes, every one of those pages will be served to
   real visitors as a genuinely separate, fully-baked HTML document
   per language (correct <html lang>, correct content, correct
   everything) straight from Vercel Blob, instead of falling through
   to the shared CSR template.

   Safe to re-run — regenerate always overwrites (allowOverwrite:true
   in api/prerender.js), so running this twice just re-renders
   everything again, no harm done.
   ============================================================ */
(async function () {
  const sb = window.supabase.createClient(window.SUPA.url, window.SUPA.anonKey, { auth: { storage: window.sessionStorage } });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { console.error('Not logged in as admin — open /admin/ and sign in first, then re-run this.'); return; }
  const callerToken = session.access_token;

  async function fetchAll(table) {
    const { data, error } = await sb.from(table).select('slug,slug_ar').eq('published', true);
    if (error) { console.error('Fetch failed for', table, error); return []; }
    return data || [];
  }

  console.log('Fetching published projects, units, and blog posts...');
  const [projects, units, posts] = await Promise.all([
    fetchAll('projects'), fetchAll('units'), fetchAll('blog_posts')
  ]);

  const items = [
    ...projects.map(r => ({ kind: 'project', slug: r.slug, slugAr: r.slug_ar })),
    ...units.map(r => ({ kind: 'unit', slug: r.slug, slugAr: r.slug_ar })),
    ...posts.map(r => ({ kind: 'blog', slug: r.slug, slugAr: null }))
  ];

  console.log(`Found ${items.length} items (${projects.length} projects, ${units.length} units, ${posts.length} posts).`);
  console.log('Starting backfill — this launches real headless Chrome per item on the server, expect this to take a while (roughly 20-40 minutes). You can leave this tab open and let it run.');

  const results = { ok: [], failed: [] };
  const CONCURRENCY = 3;
  let i = 0;
  let done = 0;

  async function worker() {
    while (i < items.length) {
      const item = items[i++];
      try {
        const res = await fetch('/api/prerender', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'regenerate',
            kind: item.kind,
            slug: item.slug,
            slugAr: item.slugAr || null,
            callerToken
          })
        });
        const json = await res.json().catch(() => ({}));
        done++;
        if (res.ok && json.ok) {
          results.ok.push(item);
          console.log(`[${done}/${items.length}] OK: ${item.kind}/${item.slug}`, json.results);
        } else {
          results.failed.push({ item, error: json });
          console.warn(`[${done}/${items.length}] FAILED: ${item.kind}/${item.slug}`, json);
        }
      } catch (e) {
        done++;
        results.failed.push({ item, error: e.message });
        console.error(`[${done}/${items.length}] ERROR: ${item.kind}/${item.slug}`, e);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log('=== PRERENDER BACKFILL COMPLETE ===');
  console.log(`Succeeded: ${results.ok.length} / ${items.length}`);
  console.log(`Failed: ${results.failed.length}`);
  if (results.failed.length) {
    console.log('Failed items (safe to re-run just this script again to retry everything, or inspect window.__prerenderFailed):');
    console.log(results.failed.map(f => `${f.item.kind}/${f.item.slug}`));
    window.__prerenderFailed = results.failed;
  }
})();
