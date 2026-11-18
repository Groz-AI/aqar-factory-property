/* ============================================================
   AQAR FACTORY — "تابع مشروعك" (Track Your Project)
   ------------------------------------------------------------
   The header button opens a picker with every published project. The
   visitor ticks one or more, leaves a name and a phone/WhatsApp number,
   and each ticked project is written to project_followers (store.js →
   followProjects). Visitors have no accounts, so which projects THIS
   browser follows is remembered in localStorage and shown on a "My
   projects" tab with each project's latest progress checkpoint — the
   checkpoints themselves are edited by the team in the admin portal
   (projects.timeline) and shown on each project's page.

   window.followWidget.open({ preselect: <project uuid> }) lets a project
   page open the same modal with that project already ticked.
   The modal's markup is built on first open, not on page load.
   ============================================================ */
(function () {
  'use strict';

  const t = window.t || ((s) => s);
  const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
  const pick = (o, k, ak) => {
    if (isAr()) { const v = o[ak]; if (Array.isArray(v) ? v.length : v) return v; }
    return o[k];
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const img = (ref, w) => (typeof window.U === 'function' ? window.U(ref, w) : (ref || ''));

  const KEY = 'realteek_followed_projects_v1';
  function readSaved() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.ids)) return { ids: s.ids.filter(Boolean), tokens: (s.tokens && typeof s.tokens === 'object') ? s.tokens : {}, name: s.name || '', phone: s.phone || '' };
    } catch (_) {}
    return { ids: [], tokens: {}, name: '', phone: '' };
  }
  function writeSaved(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }

  // random secret that proves, later, that this browser made a follow (stored with the row,
  // kept here; see supabase/add-unfollow.sql)
  function newToken() {
    const a = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  // digits typed on an Arabic keyboard (٠١٢…) are turned into 0-9 first
  function normPhone(raw) {
    const ascii = String(raw || '').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
    const digits = ascii.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return '';
    return (ascii.trim().startsWith('+') ? '+' : '') + digits;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(isAr() ? 'ar' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const closeSVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const bellSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
  const checkSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-9"/></svg>';
  const arrowSVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let root = null, card, headTitle, tabsEl, bodyEl, footEl;
  let saved = readSaved();
  let view = 'pick';           // 'mine' | 'pick' | 'details' | 'done'
  let query = '';
  let projects = null;         // all published projects (loaded once)
  let projectsPromise = null;
  const selected = new Set();
  let followedNow = [];
  let lastFocus = null;
  let lookupNote = '';         // message shown above the phone form ("no projects for this number")

  function ensureProjects() {
    if (!projectsPromise) {
      projectsPromise = (window.store ? window.store.getProjects() : Promise.resolve([]))
        .then(list => { projects = (list || []).filter(p => p.dbId); return projects; })
        .catch(() => { projects = []; return projects; });
    }
    return projectsPromise;
  }
  const byId = (id) => (projects || []).find(p => p.dbId === id);

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'follow-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', t('Track Your Project'));
    root.innerHTML = `
      <div class="follow-backdrop"></div>
      <div class="follow-card">
        <button type="button" class="follow-close" aria-label="${esc(t('Close'))}">${closeSVG}</button>
        <div class="follow-head">
          <span class="follow-head-ic" aria-hidden="true">${bellSVG}</span>
          <div><b>${esc(t('Track Your Project'))}</b><small>${esc(t('Follow projects and see how construction is progressing'))}</small></div>
        </div>
        <div class="follow-tabs" hidden></div>
        <div class="follow-body"></div>
        <div class="follow-foot" hidden></div>
      </div>`;
    document.body.appendChild(root);
    card = root.querySelector('.follow-card');
    tabsEl = root.querySelector('.follow-tabs');
    bodyEl = root.querySelector('.follow-body');
    footEl = root.querySelector('.follow-foot');
    root.querySelector('.follow-backdrop').addEventListener('click', close);
    root.querySelector('.follow-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
  }

  function open(opts) {
    build();
    saved = readSaved();
    selected.clear();
    query = '';
    followedNow = [];
    const pre = opts && opts.preselect;
    if (pre && !saved.ids.includes(pre)) { selected.add(pre); view = 'pick'; }
    else view = (saved.ids.length || saved.phone) ? 'mine' : 'pick';
    lookupNote = '';
    lastFocus = document.activeElement;
    root.classList.add('open');
    document.body.style.overflow = 'hidden';
    render();
  }
  function close() {
    if (!root) return;
    root.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (_) {} }
  }

  function render() {
    const showTabs = view === 'mine' || view === 'pick' || view === 'lookup';
    tabsEl.hidden = !showTabs;
    if (showTabs) {
      tabsEl.innerHTML = `
        <button type="button" class="follow-tab${view !== 'pick' ? ' on' : ''}" data-tab="mine">${esc(t('My projects'))}${saved.ids.length ? ` (${saved.ids.length})` : ''}</button>
        <button type="button" class="follow-tab${view === 'pick' ? ' on' : ''}" data-tab="pick">${esc(t('Follow a project'))}</button>`;
      tabsEl.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { view = b.dataset.tab; render(); }));
    }
    footEl.hidden = true;
    footEl.innerHTML = '';
    if (view === 'mine') renderMine();
    else if (view === 'lookup') renderLookup();
    else if (view === 'pick') renderPick();
    else if (view === 'details') renderDetails();
    else renderDone();
  }

  // ---------- My projects ----------
  // Ask for a phone number and look up what it follows (works on any device). The
  // number is the identity: with no follows yet, the visitor is sent to the picker,
  // whose next step asks for name + number and makes them a follower.
  function renderLookup() {
    bodyEl.innerHTML = `
      <p class="follow-note">${esc(t('Enter the phone number you follow with to see your projects.'))}</p>
      ${lookupNote ? `<p class="follow-note follow-note-warn">${esc(lookupNote)}</p>` : ''}
      <form id="lookupForm" novalidate>
        <label class="wa-field"><span>${esc(t('Phone / WhatsApp'))}</span><input type="tel" name="phone" inputmode="tel" required autocomplete="tel" value="${esc(saved.phone)}" dir="ltr"></label>
        <p class="follow-error" role="alert" hidden></p>
      </form>`;
    footEl.hidden = false;
    footEl.innerHTML = `
      <button type="button" class="follow-back">${esc(t('Follow a project'))}</button>
      <button type="submit" form="lookupForm" class="follow-primary">${esc(t('Show my projects'))}</button>`;
    footEl.querySelector('.follow-back').addEventListener('click', () => { view = 'pick'; render(); });
    const form = bodyEl.querySelector('#lookupForm');
    const err = bodyEl.querySelector('.follow-error');
    const btn = footEl.querySelector('.follow-primary');
    setTimeout(() => { try { form.phone.focus(); } catch (_) {} }, 120);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const phone = normPhone(form.phone.value);
      if (!phone) { err.textContent = t('Please enter a valid phone number.'); err.hidden = false; return; }
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = t('Loading…');
      const res = await window.store.getFollowedIdsByPhone(phone);
      if (res.error) {
        btn.disabled = false; btn.textContent = label;
        err.textContent = t("Sorry, we couldn't look that up just now. Please try again."); err.hidden = false;
        return;
      }
      applyServerIds(phone, res.ids);
      lookupNote = res.ids.length ? '' : t('No projects are followed with this number yet. Pick a project to follow it.');
      view = res.ids.length ? 'mine' : 'pick';
      render();
    });
  }

  // the server list is the truth for a phone number: keep the per-browser unfollow
  // secrets only for projects that are still followed
  function applyServerIds(phone, ids) {
    const tokens = {};
    ids.forEach(id => { if (saved.tokens && saved.tokens[id]) tokens[id] = saved.tokens[id]; });
    saved = { ids, tokens, name: saved.name, phone };
    writeSaved(saved);
  }

  async function renderMine() {
    if (!saved.phone && !saved.ids.length) { view = 'lookup'; render(); return; }
    bodyEl.innerHTML = `<p class="follow-note">${esc(t('Loading…'))}</p>`;
    if (saved.phone && window.store && window.store.getFollowedIdsByPhone) {
      const res = await window.store.getFollowedIdsByPhone(saved.phone);   // on error keep this browser's own list
      if (view !== 'mine') return;
      if (!res.error) {
        applyServerIds(saved.phone, res.ids);
        const tab = tabsEl.querySelector('[data-tab="mine"]');
        if (tab) tab.textContent = t('My projects') + (saved.ids.length ? ` (${saved.ids.length})` : '');
      }
    }
    const list = await (window.store ? window.store.getFollowedProjects(saved.ids) : Promise.resolve([]));
    if (view !== 'mine') return;
    if (!list.length) {
      bodyEl.innerHTML = `<p class="follow-note">${esc(t('You are not following any project yet.'))}</p>
        <p class="follow-note follow-note-sm"><button type="button" class="follow-linkbtn" data-lookup>${esc(t('Use a different number'))}</button></p>`;
      bodyEl.querySelector('[data-lookup]').addEventListener('click', () => { view = 'lookup'; render(); });
      return;
    }
    const order = new Map(saved.ids.map((id, i) => [id, i]));
    list.sort((a, b) => (order.get(a.dbId) ?? 0) - (order.get(b.dbId) ?? 0));
    bodyEl.innerHTML = '<div class="follow-list">' + list.map(p => {
      const tl = Array.isArray(p.timeline) ? p.timeline : [];
      const last = tl.length ? tl[tl.length - 1] : null;
      const status = last ? (pick(last, 'status', 'status_ar') || pick(last, 'title', 'title_ar') || '') : '';
      const when = last ? fmtDate(last.date) : '';
      const line = last
        ? `<span class="follow-status">${esc(status)}</span>${when ? `<small>${esc(when)}</small>` : ''}`
        : `<small>${esc(t('No updates yet'))}</small>`;
      const canUnfollow = !!(saved.tokens && saved.tokens[p.dbId]);
      return `<div class="follow-item follow-row">
        <a class="follow-item-link" href="${esc(window.buildUrl ? window.buildUrl('project', p) : '#')}">
          <img class="follow-thumb" src="${esc(img(p.cover, 160))}" alt="" width="56" height="56" loading="lazy">
          <span class="follow-item-txt"><b>${esc(pick(p, 'name', 'nameAr'))}</b><span class="follow-line">${line}</span></span>
          <span class="follow-go" aria-hidden="true">${arrowSVG}</span>
        </a>
        ${canUnfollow
          ? `<button type="button" class="follow-unfollow" data-unfollow="${esc(p.dbId)}">${esc(t('Unfollow'))}</button>`
          : ''}
      </div>`;
    }).join('') + '</div>' + (list.some(p => !(saved.tokens && saved.tokens[p.dbId])) ? `<p class="follow-note follow-note-sm">${esc(t('A project without an Unfollow button was followed earlier or from another device. Contact us to stop following it.'))}</p>` : '');
    bodyEl.querySelectorAll('[data-unfollow]').forEach(b => b.addEventListener('click', () => onUnfollow(b)));
    bodyEl.insertAdjacentHTML('beforeend', `<p class="follow-note follow-note-sm"><button type="button" class="follow-linkbtn" data-lookup>${esc(t('Use a different number'))}</button></p>`);
    bodyEl.querySelector('[data-lookup]').addEventListener('click', () => { view = 'lookup'; render(); });
  }

  // two taps: the first arms the button, the second removes the follow
  async function onUnfollow(btn) {
    const id = btn.dataset.unfollow;
    if (!btn.classList.contains('arm')) {
      btn.classList.add('arm');
      btn.textContent = t('Tap again to confirm');
      setTimeout(() => { if (btn.isConnected && !btn.disabled) { btn.classList.remove('arm'); btn.textContent = t('Unfollow'); } }, 4000);
      return;
    }
    btn.disabled = true; btn.textContent = t('Removing…');
    let res;
    try { res = await window.store.unfollowProject(id, saved.tokens && saved.tokens[id]); }
    catch (_) { res = { error: { message: 'network' } }; }
    if (res && res.error) {
      btn.disabled = false; btn.classList.remove('arm'); btn.textContent = t('Unfollow');
      const note = document.createElement('p');
      note.className = 'follow-error';
      note.textContent = t("Couldn't remove that just now. Please try again.");
      btn.closest('.follow-row').after(note);
      setTimeout(() => note.remove(), 5000);
      return;
    }
    const tokens = Object.assign({}, saved.tokens); delete tokens[id];
    saved = { ids: saved.ids.filter(x => x !== id), tokens, name: saved.name, phone: saved.phone };
    writeSaved(saved);
    if (!saved.ids.length) view = 'pick';
    render();
  }

  // ---------- pick projects ----------
  async function renderPick() {
    bodyEl.innerHTML = `
      <p class="follow-note">${esc(t('Choose one or more projects to follow.'))}</p>
      <input type="search" class="follow-search" placeholder="${esc(t('Search projects…'))}" aria-label="${esc(t('Search projects…'))}" value="${esc(query)}">
      <div class="follow-list" id="followList"><p class="follow-note">${esc(t('Loading…'))}</p></div>`;
    const search = bodyEl.querySelector('.follow-search');
    search.addEventListener('input', () => { query = search.value; paintList(); });
    await ensureProjects();
    if (view !== 'pick') return;
    paintList();
    paintPickFoot();
    if (lookupNote) { search.insertAdjacentHTML('beforebegin', `<p class="follow-note follow-note-warn">${esc(lookupNote)}</p>`); lookupNote = ''; }
    if (!selected.size) setTimeout(() => { try { search.focus(); } catch (_) {} }, 120);
  }

  function paintList() {
    const listEl = bodyEl.querySelector('#followList');
    if (!listEl) return;
    const q = query.trim().toLowerCase();
    const rows = (projects || []).filter(p => !q || [p.name, p.nameAr, p.city, p.location].some(v => String(v || '').toLowerCase().includes(q)));
    if (!rows.length) { listEl.innerHTML = `<p class="follow-note">${esc(t('No projects found'))}</p>`; return; }
    listEl.innerHTML = rows.map(p => {
      const done = saved.ids.includes(p.dbId);
      const on = selected.has(p.dbId);
      return `<button type="button" class="follow-item${on ? ' sel' : ''}" data-id="${esc(p.dbId)}" role="checkbox" aria-checked="${on || done}"${done ? ' disabled' : ''}>
        <img class="follow-thumb" src="${esc(img(p.cover, 160))}" alt="" width="56" height="56" loading="lazy">
        <span class="follow-item-txt"><b>${esc(pick(p, 'name', 'nameAr'))}</b><span class="follow-line"><small>${esc(p.city || p.location || '')}</small></span></span>
        ${done ? `<span class="follow-chip">${esc(t('Following'))}</span>` : `<span class="follow-check" aria-hidden="true">${on ? checkSVG : ''}</span>`}
      </button>`;
    }).join('');
    listEl.querySelectorAll('.follow-item:not([disabled])').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      paintList();
      paintPickFoot();
    }));
  }

  function paintPickFoot() {
    footEl.hidden = false;
    footEl.innerHTML = `
      <span class="follow-count">${selected.size} ${esc(t('selected'))}</span>
      <button type="button" class="follow-primary" ${selected.size ? '' : 'disabled'}>${esc(t('Continue'))}</button>`;
    footEl.querySelector('.follow-primary').addEventListener('click', () => { view = 'details'; render(); });
  }

  // ---------- name + phone ----------
  function renderDetails() {
    const chosen = [...selected].map(byId).filter(Boolean);
    bodyEl.innerHTML = `
      <div class="follow-chosen">${chosen.map(p => `<span class="follow-chip-sel">${esc(pick(p, 'name', 'nameAr'))}</span>`).join('')}</div>
      <form id="followForm" novalidate>
        <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
        <label class="wa-field"><span>${esc(t('Your name'))}</span><input type="text" name="name" required autocomplete="name" value="${esc(saved.name)}"></label>
        <label class="wa-field"><span>${esc(t('Phone / WhatsApp'))}</span><input type="tel" name="phone" inputmode="tel" required autocomplete="tel" value="${esc(saved.phone)}" dir="ltr"></label>
        <p class="follow-note">${esc(t('We only use your number to share updates about these projects.'))}</p>
        <p class="follow-error" role="alert" hidden></p>
      </form>`;
    footEl.hidden = false;
    footEl.innerHTML = `
      <button type="button" class="follow-back">${esc(t('Back'))}</button>
      <button type="submit" form="followForm" class="follow-primary">${esc(t('Follow'))} (${chosen.length})</button>`;
    footEl.querySelector('.follow-back').addEventListener('click', () => { view = 'pick'; render(); });

    const form = bodyEl.querySelector('#followForm');
    const err = bodyEl.querySelector('.follow-error');
    const submit = footEl.querySelector('.follow-primary');
    const fail = (msg) => { err.textContent = msg; err.hidden = false; };
    setTimeout(() => { try { form.querySelector(saved.name ? '[name=phone]' : '[name=name]').focus(); } catch (_) {} }, 120);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const name = form.name.value.trim();
      const phone = normPhone(form.phone.value);
      if (!name) return fail(t('Please enter your name.'));
      if (!phone) return fail(t('Please enter a valid phone number.'));
      const ids = [...selected];
      const label = submit.textContent;
      submit.disabled = true; submit.textContent = t('Sending…');
      let res = { error: null };
      const token = newToken();
      if (!form.website.value) {   // a filled honeypot gets a fake success, nothing is written
        try { res = await window.store.followProjects(ids, { name, phone, token }); }
        catch (_) { res = { error: { message: 'network' } }; }
      }
      if (res && res.error) {
        submit.disabled = false; submit.textContent = label;
        return fail(t("Sorry, we couldn't save that just now. Please try again."));
      }
      if (!form.website.value) {
        const tokens = Object.assign({}, saved.tokens);
        (res.added || []).forEach(id => { tokens[id] = token; });
        saved = { ids: [...new Set(saved.ids.concat(ids))], tokens, name, phone };
        writeSaved(saved);
      }
      followedNow = ids;
      selected.clear();
      view = 'done';
      render();
    });
  }

  // ---------- done ----------
  function renderDone() {
    const list = followedNow.map(byId).filter(Boolean);
    bodyEl.innerHTML = `
      <div class="follow-done">
        <span class="follow-done-ic" aria-hidden="true">${checkSVG}</span>
        <b>${esc(t('You are now following these projects'))}</b>
        <div class="follow-list">${list.map(p => `
          <a class="follow-item" href="${esc(window.buildUrl ? window.buildUrl('project', p) : '#')}">
            <img class="follow-thumb" src="${esc(img(p.cover, 160))}" alt="" width="56" height="56" loading="lazy">
            <span class="follow-item-txt"><b>${esc(pick(p, 'name', 'nameAr'))}</b><span class="follow-line"><small>${esc(t('View project'))}</small></span></span>
            <span class="follow-go" aria-hidden="true">${arrowSVG}</span>
          </a>`).join('')}</div>
        <p class="follow-note">${esc(t('Find them anytime under "My projects".'))}</p>
      </div>`;
    footEl.hidden = false;
    footEl.innerHTML = `<button type="button" class="follow-primary follow-wide">${esc(t('Done'))}</button>`;
    footEl.querySelector('.follow-primary').addEventListener('click', close);
  }

  window.followWidget = { open, close };

  // the header button, the phone-drawer item and the footer link all carry data-follow-open
  document.querySelectorAll('[data-follow-open]').forEach(el => el.addEventListener('click', () => {
    const nav = document.getElementById('nav');   // close the phone drawer first
    if (nav) nav.classList.remove('open');
    open();
  }));
})();
