/* ============================================================
   AQAR FACTORY ADMIN — publishing changes to the live site
   ------------------------------------------------------------
   The public pages are built in advance, so a change made here reaches
   them with the next build. This asks for that build by itself a few
   minutes after the last change, or right away with "Publish now".
   The free Cloudflare plan allows 500 builds a month, so automatic
   builds are spaced out; anything left over still goes out with the
   scheduled build every 6 hours.
   ============================================================ */
(function () {
  'use strict';

  // tables whose rows appear on public pages (not inquiries, subscribers, users, logs)
  const CONTENT = /\/rest\/v1\/(projects|units|cities|categories|testimonials|developers|blog_posts|market_updates|content_blocks|slug_redirects)(\?|$)/;
  const QUIET_MS = 3 * 60000;   // wait until editing pauses, so several changes go out together
  const GAP_MS = 30 * 60000;    // automatic builds at most this often
  const BUILD_MS = 4 * 60000;   // a build takes about this long
  const RETRY_MS = 5 * 60000;   // after a failed request
  const KEY = 'aqar_publish';

  // { changedAt, askedAt, failedAt }: shared by all tabs and kept after the tab is closed
  let memory = {};
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || memory; } catch (_) { return memory; } };
  function write(patch) {
    memory = Object.assign({}, read(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (_) { /* private mode: this tab only */ }
    return memory;
  }

  let client = null, say = null, token = '', busy = false;
  const tr = (s) => (window.t ? window.t(s) : s);
  const mayAsk = (s, now) => !!s.changedAt && now - (s.askedAt || 0) >= GAP_MS && now - (s.failedAt || 0) >= RETRY_MS;

  // wraps the database client's fetch: a successful write to public content is noted
  function track(fetchImpl) {
    return async function (input, init) {
      const response = await fetchImpl(input, init);
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      const url = String((input && input.url) || input);
      if (response.ok && /^(POST|PATCH|PUT|DELETE)$/.test(method) && CONTENT.test(url)) { write({ changedAt: Date.now() }); paint(); }
      return response;
    };
  }

  async function refreshToken() {
    try {
      const { data } = await client.auth.getSession();
      token = (data && data.session && data.session.access_token) || '';
    } catch (_) { /* keep the last one */ }
  }

  const request = (keepalive) => fetch('/api/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callerToken: token }), keepalive
  });

  async function publish(byButton) {
    if (busy) return;
    const now = Date.now(), s = read();
    // nothing saved since a build asked a moment ago: a second one would add nothing
    if (byButton && s.askedAt && now - s.askedAt < BUILD_MS && !s.changedAt) {
      say(tr('Publishing was already requested — please wait a few minutes'));
      return;
    }
    busy = true;
    const previous = s.askedAt || 0;
    write({ askedAt: now }); // claimed first, so a second tab does not ask too
    paint();
    let error = '';
    try {
      await refreshToken();
      const r = await request(false);
      if (!r.ok) error = (await r.json().catch(() => ({}))).error || 'failed';
    } catch (_) { error = 'failed'; }
    if (error) write({ askedAt: previous, failedAt: Date.now() });
    // a change saved while the request was on its way still waits for the next build
    else write({ changedAt: read().changedAt > now ? read().changedAt : 0, failedAt: 0 });
    busy = false;
    paint();
    if (byButton) {
      if (!error) say(tr('Publishing started — the site updates in about 5 minutes'));
      else if (error === 'not_configured') say(tr('Publishing is not set up yet'), 'err');
      else if (error === 'unauthorized') say(tr('Please sign in again to publish'), 'err');
      else say(tr('Could not start publishing — please try again'), 'err');
    }
  }

  function paint() {
    const button = document.getElementById('publishBtn'), note = document.getElementById('publishNote');
    if (!button || !note) return;
    const s = read();
    button.disabled = busy;
    note.textContent = s.changedAt ? tr('Changes waiting to be published')
      : (s.askedAt && Date.now() - s.askedAt < BUILD_MS ? tr('Publishing — the site updates in about 5 minutes') : '');
  }

  async function tick() {
    await refreshToken();
    const s = read(), now = Date.now();
    if (mayAsk(s, now) && now - s.changedAt >= QUIET_MS) await publish(false);
    else paint();
  }

  // before signing out: send what is waiting while the session is still valid
  async function flush() {
    if (client && mayAsk(read(), Date.now())) await publish(false);
  }

  function start(supabaseClient, notify) {
    client = supabaseClient;
    say = notify;
    const button = document.getElementById('publishBtn');
    if (button) { button.style.display = ''; button.addEventListener('click', () => publish(true)); }
    window.addEventListener('storage', (e) => { if (e.key === KEY) paint(); });
    // leaving right after an edit: don't wait for the quiet period
    window.addEventListener('pagehide', () => {
      const now = Date.now();
      if (busy || !token || !mayAsk(read(), now)) return;
      write({ askedAt: now, changedAt: 0 });
      request(true).catch(() => {});
    });
    tick();
    setInterval(tick, 30000);
  }

  window.AdminPublish = { track, start, flush };
})();
