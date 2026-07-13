/* ============================================================
   REALTEEK ADMIN — dashboard engine
   Auth guard + generic CRUD over Supabase, image uploads to the
   "media" bucket, a site-content editor, and a starter seeder.
   ============================================================ */
(function () {
  'use strict';

  // ---------- config / client ----------
  const cfg = window.SUPA || {};
  const cloud = window.supabase && cfg.url && !/YOUR_/.test(cfg.url) && cfg.anonKey && !/YOUR_/.test(cfg.anonKey);
  const localMode = !cloud && !!window.RealteekLocal;
  // sessionStorage (not localStorage) — admin sessions end when the tab/browser
  // closes, so every new browser session requires a fresh sign-in
  const sb = cloud ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { storage: window.sessionStorage } })
           : (localMode ? window.RealteekLocal.makeClient() : null);
  const configured = cloud || localMode;
  const FALLBACK = window.FALLBACK || {};

  // ---------- tiny dom helpers ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, attrs = {}, html) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'dataset') Object.assign(n.dataset, attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // resolve an image ref (unsplash id OR full url) to a preview url
  const imgUrl = (ref, w = 200) => {
    if (!ref) return '';
    if (/^https?:\/\//.test(ref)) return ref;
    return `https://images.unsplash.com/photo-${ref}?auto=format&fit=crop&w=${w}&q=70`;
  };

  // ---------- toast ----------
  let toastT;
  function toast(msg, kind) {
    const toastEl = $('#toast');
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (kind === 'err' ? ' err' : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
  }

  // ============================================================
  // RESOURCE DEFINITIONS — one entry drives table + form for a table
  // field types: text | textarea | number | bool | select | tags | lines | image | gallery
  // ============================================================
  const RESOURCES = {
    projects: {
      label: t('Projects'), singular: t('Project'), table: 'projects', icon: 'building',
      columns: [
        { key: 'cover', label: '', type: 'thumb' },
        { key: 'name', label: t('Name'), type: 'name', sub: 'tagline' },
        { key: 'category', label: t('Category') },
        { key: 'city', label: t('City') },
        { key: 'status', label: t('Status') },
        { key: 'published', label: t('Status'), type: 'pill' }
      ],
      fields: [
        { key: 'name', label: t('Name'), type: 'text', required: true, half: true },
        { key: 'slug', label: t('Slug (URL id)'), type: 'text', required: true, half: true, hint: t('lowercase, dashes — e.g. azure-residences') },
        { key: 'category', label: t('Category'), type: 'select', options: ['Residential', 'Commercial', 'Mixed-use', 'Hospitality', 'Retail', 'Office'], half: true },
        { key: 'unit_types', label: t('Unit types available'), type: 'tags', hint: t('e.g. Villas, Apartments, Duplex, Townhouses, Studio — powers the hero search and the AI matchmaker') },
        { key: 'status', label: t('Status'), type: 'select', options: ['Completed', 'Ongoing', 'Off-plan'], half: true },
        {
          key: 'city_id', label: t('City'), type: 'select', required: true, half: true,
          options: [{ value: '', label: t('— No linked city —') }],
          hint: t('Add cities under the Cities section first. This also fills the project\'s display city name.')
        },
        { key: 'country', label: t('Country'), type: 'text', half: true },
        { key: 'location', label: t('Location / address'), type: 'text' },
        { key: 'tagline', label: t('Tagline'), type: 'text' },
        { key: 'developer', label: t('Developer'), type: 'text', half: true },
        { key: 'developer_logo', label: t('Developer logo'), type: 'image', half: true, hint: t('Shown on the project card and sidebar') },
        { key: 'year', label: t('Year'), type: 'number', half: true },
        { key: 'cover', label: t('Cover image'), type: 'image' },
        { key: 'gallery', label: t('Gallery'), type: 'gallery' },
        { key: 'about', label: t('About (one paragraph per line)'), type: 'lines' },
        { key: 'amenities', label: t('Amenities'), type: 'tags' },
        { key: 'price', label: t('Price (display)'), type: 'text', half: true, hint: t('e.g. EGP 3.2M') },
        { key: 'price_value', label: t('Price value (number)'), type: 'number', half: true },
        { key: 'area', label: t('Area (display)'), type: 'text', half: true },
        { key: 'area_value', label: t('Area value (number)'), type: 'number', half: true },
        { key: 'units', label: t('Units'), type: 'text', half: true },
        { key: 'floors', label: t('Floors'), type: 'text', half: true },
        { key: 'handover', label: t('Handover'), type: 'text', half: true },
        { key: 'is_rental', label: t('Rental listing'), type: 'bool', half: true },
        { key: 'lat', label: t('Latitude'), type: 'number', half: true },
        { key: 'lng', label: t('Longitude'), type: 'number', half: true },
        { key: 'brochure_pdf', label: t('Brochure (PDF)'), type: 'pdf', hint: t('Shown as a "Download brochure" button on the project page — leave empty to hide it') },
        { key: 'consultants', label: t('Executive Consultants'), type: 'consultants', hint: t('Shown in the project page sidebar — leave empty to hide the section') },
        { key: 'sort_order', label: t('Sort order'), type: 'number', half: true },
        { key: 'published', label: t('Published'), type: 'bool', half: true }
      ]
    },
    cities: {
      label: t('Cities'), singular: t('City'), table: 'cities', icon: 'city',
      columns: [
        { key: 'image', label: '', type: 'thumb' },
        { key: 'name', label: t('Name'), type: 'name', sub: 'country' },
        { key: 'size', label: t('Tile') },
        { key: 'published', label: t('Status'), type: 'pill' }
      ],
      fields: [
        { key: 'name', label: t('Name'), type: 'text', required: true, half: true },
        { key: 'country', label: t('Country'), type: 'text', half: true },
        { key: 'image', label: t('Image'), type: 'image' },
        { key: 'size', label: t('Tile size'), type: 'select', options: ['normal', 'wide', 'big'], half: true, hint: t('controls the tile size in the homepage “By Cities” grid') },
        { key: 'sort_order', label: t('Sort order'), type: 'number', half: true },
        { key: 'published', label: t('Published'), type: 'bool', half: true }
      ]
    },
    testimonials: {
      label: t('Testimonials'), singular: t('Testimonial'), table: 'testimonials', icon: 'quote',
      columns: [
        { key: 'avatar', label: '', type: 'thumb' },
        { key: 'name', label: t('Name'), type: 'name', sub: 'location' },
        { key: 'quote', label: t('Quote'), type: 'truncate' },
        { key: 'rating', label: t('Rating') },
        { key: 'published', label: t('Status'), type: 'pill' }
      ],
      fields: [
        { key: 'quote', label: t('Quote'), type: 'textarea', required: true },
        { key: 'name', label: t('Name'), type: 'text', required: true, half: true },
        { key: 'location', label: t('Location'), type: 'text', half: true },
        { key: 'avatar', label: t('Avatar'), type: 'image' },
        { key: 'rating', label: t('Rating (1–5)'), type: 'number', half: true },
        { key: 'sort_order', label: t('Sort order'), type: 'number', half: true },
        { key: 'published', label: t('Published'), type: 'bool' }
      ]
    },
    developers: {
      label: t('Developers'), singular: t('Developer'), table: 'developers', icon: 'users',
      columns: [
        { key: 'logo', label: '', type: 'thumb' },
        { key: 'name', label: t('Name'), type: 'name' },
        { key: 'published', label: t('Status'), type: 'pill' }
      ],
      fields: [
        { key: 'name', label: t('Name'), type: 'text', required: true },
        { key: 'logo', label: t('Logo (optional)'), type: 'image', hint: t('leave empty to render the name as a wordmark') },
        { key: 'sort_order', label: t('Sort order'), type: 'number', half: true },
        { key: 'published', label: t('Published'), type: 'bool', half: true }
      ]
    }
  };

  // ============================================================
  // STATE
  // ============================================================
  const state = { view: 'overview', user: null, cache: {}, query: '' };

  // ============================================================
  // AUTH GUARD
  // ============================================================
  async function boot() {
    if (!configured) { renderUnconfigured(); return; }

    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.replace('login.html'); return; }

    const { data: isAdmin, error } = await sb.rpc('is_admin');
    if (error || !isAdmin) { await sb.auth.signOut(); location.replace('login.html'); return; }

    state.user = session.user;
    const email = session.user.email || '';
    $('#userEmail').textContent = email;
    $('#userName').textContent = email.split('@')[0] || 'Admin';
    $('#userAv').textContent = (email[0] || 'A').toUpperCase();

    wireChrome();
    await refreshCounts();
    go('overview');
  }

  // shown only when keys are missing — the public site still works on fallback
  function renderUnconfigured() {
    wireChrome();
    $('#viewTitle').textContent = t('Setup required');
    $('#viewSub').textContent = t('Connect Supabase to start managing content');
    $('#content').innerHTML = `
      <div class="notice">
        <h3>${t('Supabase isn’t configured')}</h3>
        <p>${t('Your public site is running on bundled demo data. To enable the admin and live editing:')}</p>
        <p style="margin-top:10px">
          1. ${t('Create a project at')} <code>supabase.com</code><br>
          2. ${t('Run')} <code>supabase/schema.sql</code> ${t('in the SQL editor')}<br>
          3. ${t('Paste your Project URL + anon key into')} <code>config.js</code><br>
          4. ${t('Add yourself to the')} <code>admins</code> ${t('table, then reload')}
        </p>
      </div>`;
    $$('.sb-link').forEach(b => { if (b.dataset.view !== 'settings') b.style.display = 'none'; });
  }

  // ============================================================
  // CHROME (sidebar nav, logout, drawer, mobile)
  // ============================================================
  function wireChrome() {
    $$('.sb-link').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.view)));
    $('#logoutBtn').addEventListener('click', async () => {
      if (sb) await sb.auth.signOut();
      location.replace('login.html');
    });
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#drawerCancel').addEventListener('click', closeDrawer);
    $('#overlay').addEventListener('click', closeDrawer);
    $('#primaryAction').addEventListener('click', () => { if (RESOURCES[state.view]) openForm(state.view, null); });

    // visibility is handled by CSS (@media in admin.css) so it stays correct
    // if the window is resized after load, not just at initial page load
    const menuBtn = $('#menuBtn'), sidebar = $('#sidebar');
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

    // clicking the account row opens Account & settings
    const userRow = $('.sb-user');
    if (userRow) { userRow.style.cursor = 'pointer'; userRow.title = t('Account & settings'); userRow.addEventListener('click', () => go('settings')); }
  }

  function go(view) {
    state.view = view;
    state.query = '';
    $$('.sb-link').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#sidebar').classList.remove('open');
    const pa = $('#primaryAction');

    if (view === 'overview') { renderOverview(); pa.style.display = 'none'; }
    else if (view === 'content') { renderContent(); pa.style.display = 'none'; }
    else if (view === 'inquiries') { renderInquiries(); pa.style.display = 'none'; }
    else if (view === 'newsletter') { renderNewsletter(); pa.style.display = 'none'; }
    else if (view === 'settings') { renderSettings(); pa.style.display = 'none'; }
    else if (RESOURCES[view]) {
      const r = RESOURCES[view];
      $('#primaryAction').querySelector('span').textContent = t('Add') + ' ' + r.singular.toLowerCase();
      pa.style.display = 'inline-flex';
      renderList(view);
    }
  }

  // ============================================================
  // COUNTS (sidebar badges + overview)
  // ============================================================
  async function refreshCounts() {
    await Promise.all(Object.keys(RESOURCES).map(async key => {
      const { count } = await sb.from(RESOURCES[key].table).select('id', { count: 'exact', head: true });
      const n = count || 0;
      const badge = $(`.badge[data-count="${key}"]`);
      if (badge) badge.textContent = n;
      state.cache[key + '_count'] = n;
    }));
    // inquiries: badge shows the number of unread ("new") leads
    try {
      const { count } = await sb.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new');
      const badge = $('.badge[data-count="inquiries"]');
      if (badge) badge.textContent = count || 0;
    } catch (_) { /* inquiries table may not exist yet */ }
    // newsletter: badge shows total subscriber count
    try {
      const { count } = await sb.from('newsletter_subscribers').select('id', { count: 'exact', head: true });
      const badge = $('.badge[data-count="newsletter"]');
      if (badge) badge.textContent = count || 0;
    } catch (_) { /* table may not exist yet */ }
  }

  // ============================================================
  // OVERVIEW
  // ============================================================
  function renderOverview() {
    $('#viewTitle').textContent = t('Dashboard');
    $('#viewSub').textContent = t('An overview of your content');
    const cards = Object.keys(RESOURCES).map(key => {
      const r = RESOURCES[key];
      const n = state.cache[key + '_count'] || 0;
      return `<button class="stat-card" data-jump="${key}" style="text-align:left;cursor:pointer;border:1px solid var(--line)">
        <div class="ic">${ICONS[r.icon] || ICONS.building}</div>
        <div class="n">${n}</div><div class="l">${r.label}</div>
      </button>`;
    }).join('');
    $('#content').innerHTML = `<div class="stat-grid">${cards}</div>
      <div class="panel"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Quick actions')}</b></div>
        <div style="padding:20px;display:flex;gap:.7rem;flex-wrap:wrap">
          <button class="btn btn-sky btn-sm" data-jump="projects">${t('Manage projects')}</button>
          <button class="btn btn-ghost btn-sm" data-jump="content">${t('Edit site content')}</button>
          <button class="btn btn-ghost btn-sm" data-jump="settings">${t('Setup & seed data')}</button>
        </div></div>`;
    $$('[data-jump]').forEach(b => b.addEventListener('click', () => go(b.dataset.jump)));
  }

  // ============================================================
  // LIST VIEW (table)
  // ============================================================
  async function renderList(view) {
    const r = RESOURCES[view];
    $('#viewTitle').textContent = r.label;
    $('#viewSub').textContent = `${t('Manage your')} ${r.label.toLowerCase()}`;
    $('#content').innerHTML = `<div class="panel">
      <div class="panel-head">
        <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4-4"/></svg>
          <input type="search" id="tblSearch" placeholder="${esc(t('Search'))} ${esc(r.label.toLowerCase())}…" /></div>
      </div>
      <div id="tblWrap"><div class="empty-row"><span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--sky)"></span></div></div>
    </div>`;

    $('#tblSearch').addEventListener('input', e => { state.query = e.target.value.toLowerCase(); paintRows(view); });

    const { data, error } = await sb.from(r.table).select('*').order('sort_order', { ascending: true });
    if (error) { $('#tblWrap').innerHTML = `<div class="empty-row">${t('Couldn’t load:')} ${esc(error.message)}</div>`; return; }
    state.cache[view] = data || [];
    paintRows(view);
  }

  function paintRows(view) {
    const r = RESOURCES[view];
    let rows = state.cache[view] || [];
    if (state.query) {
      rows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(state.query));
    }
    if (!rows.length) {
      $('#tblWrap').innerHTML = `<div class="empty-row">${t('No')} ${r.label.toLowerCase()} ${t('yet. Click')} “${t('Add')} ${r.singular.toLowerCase()}” ${t('to create one.')}</div>`;
      return;
    }
    const head = r.columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '<th></th>';
    const body = rows.map(row => {
      const cells = r.columns.map(c => `<td>${cell(c, row)}</td>`).join('');
      return `<tr>${cells}<td><div class="row-actions">
        <button class="icon-btn" data-edit="${row.id}" title="${esc(t('Edit'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon-btn del" data-del="${row.id}" title="${esc(t('Delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div></td></tr>`;
    }).join('');
    $('#tblWrap').innerHTML = `<table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

    $$('[data-edit]').forEach(b => b.addEventListener('click', () => {
      openForm(view, rows.find(x => x.id === b.dataset.edit));
    }));
    $$('[data-del]').forEach(b => b.addEventListener('click', () => removeRow(view, b.dataset.del)));
  }

  function cell(c, row) {
    const v = row[c.key];
    if (c.type === 'thumb') {
      const u = imgUrl(v, 120);
      return u ? `<img class="thumb" src="${esc(u)}" alt="" loading="lazy">` : `<div class="thumb"></div>`;
    }
    if (c.type === 'name') {
      const sub = c.sub && row[c.sub] ? `<div style="color:var(--ink-soft);font-size:.82rem">${esc(row[c.sub])}</div>` : '';
      return `<div class="name">${esc(v)}</div>${sub}`;
    }
    if (c.type === 'pill') {
      return v ? `<span class="pill on"><i></i>${t('Published')}</span>` : `<span class="pill off"><i></i>${t('Hidden')}</span>`;
    }
    if (c.type === 'truncate') {
      const s = String(v || '');
      return esc(s.length > 60 ? s.slice(0, 60) + '…' : s);
    }
    if (Array.isArray(v)) return v.slice(0, 3).map(tag => `<span class="tag-mini">${esc(tag)}</span>`).join('') + (v.length > 3 ? ` +${v.length - 3}` : '');
    return esc(v);
  }

  // ============================================================
  // FORM (drawer)
  // ============================================================
  let editing = null; // { view, id }
  let uploads = {};   // transient per-form state for arrays/gallery
  let pendingUploads = 0; // in-flight image uploads — block saves until they finish
  let dynamicCitiesList = [];   // { id, name } — cached whenever a City picker is populated

  async function openForm(view, row) {
    const r = RESOURCES[view];
    editing = { view, id: row ? row.id : null };
    uploads = {};
    $('#drawerTitle').textContent = (row ? t('Edit') : t('New')) + ' ' + r.singular.toLowerCase();
    const body = $('#drawerBody');
    body.innerHTML = '';

    // Projects link to a City — populate that dropdown from the live table
    // right before rendering the form.
    if (view === 'projects') {
      const { data } = await sb.from('cities').select('id,name').order('name', { ascending: true }).then(res => res, () => ({ data: [] }));
      dynamicCitiesList = data || [];
      const cityField = r.fields.find(f => f.key === 'city_id');
      if (cityField) {
        cityField.options = [{ value: '', label: '— No linked city —' }]
          .concat(dynamicCitiesList.map(c => ({ value: c.id, label: c.name })));
      }
    }

    let buf = [];
    const flush = () => { if (buf.length) { body.appendChild(el('div', { class: 'grid-2' }, buf.join(''))); buf = []; } };

    r.fields.forEach(f => {
      const html = fieldHTML(f, row ? row[f.key] : undefined);
      if (f.half) buf.push(html);
      else { flush(); body.insertAdjacentHTML('beforeend', html); }
    });
    flush();

    // post-render wiring (images, galleries)
    r.fields.forEach(f => {
      if (f.type === 'image') wireImage('f_' + f.key, row ? row[f.key] : '');
      if (f.type === 'gallery') wireGallery('f_' + f.key, f.key, (row && row[f.key]) || []);
      if (f.type === 'pdf') wirePdf('f_' + f.key, row ? row[f.key] : '');
      if (f.type === 'consultants') wireConsultants('f_' + f.key, f.key, (row && row[f.key]) || []);
    });

    $('#drawerSave').onclick = () => saveForm(view);
    openDrawer();
  }

  function fieldHTML(f, val) {
    const id = 'f_' + f.key;
    const hint = f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : '';
    if (f.type === 'bool') {
      return `<div class="field"><label class="switch"><input type="checkbox" id="${id}" ${val ? 'checked' : ''}><span class="track"></span>${esc(f.label)}</label>${hint}</div>`;
    }
    if (f.type === 'select') {
      // options may be plain strings ("For Sale") or {value,label} pairs
      // (e.g. linking to a project by slug while showing its name)
      const optVal = o => (o && typeof o === 'object') ? o.value : o;
      const optLabel = o => (o && typeof o === 'object') ? o.label : o;
      // if the saved value predates a later options change (e.g. an old badge
      // value no longer offered), keep it as a selected extra option instead
      // of silently swapping it to the first option on next save
      const known = f.options.some(o => optVal(o) === val);
      const legacy = (val != null && val !== '' && !known) ? `<option value="${esc(val)}" selected>${esc(val)}</option>` : '';
      const opts = legacy + f.options.map(o =>
        `<option value="${esc(optVal(o))}" ${optVal(o) === val ? 'selected' : ''}>${esc(t(optLabel(o)))}</option>`
      ).join('');
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}">${opts}</select>${hint}</div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}">${esc(val || '')}</textarea>${hint}</div>`;
    }
    if (f.type === 'lines') {
      const text = Array.isArray(val) ? val.join('\n') : (val || '');
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" style="min-height:120px">${esc(text)}</textarea>${hint}</div>`;
    }
    if (f.type === 'tags') {
      const text = Array.isArray(val) ? val.join(', ') : (val || '');
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="text" id="${id}" value="${esc(text)}" placeholder="${esc(t('comma, separated, values'))}">${hint}</div>`;
    }
    if (f.type === 'image') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="img-field">
          <img class="img-prev" id="${id}_prev" src="${esc(imgUrl(val, 200))}" alt="">
          <div class="img-controls">
            <input type="text" id="${id}" value="${esc(val || '')}" placeholder="${esc(t('Unsplash id or image URL'))}">
            <div class="upload-row">
              <button type="button" class="btn btn-ghost btn-sm" id="${id}_btn">${t('Upload…')}</button>
              <button type="button" class="btn btn-ghost btn-sm" id="${id}_pick">${t('Choose existing…')}</button>
              <input type="file" id="${id}_file" accept="image/*" style="display:none">
            </div>
          </div>
        </div>${hint}</div>`;
    }
    if (f.type === 'gallery') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="gallery-edit" id="${id}_wrap"></div>
        <input type="file" id="${id}_file" accept="image/*" multiple style="display:none">
        ${hint}</div>`;
    }
    if (f.type === 'pdf') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="img-field">
          <div class="pdf-prev" id="${id}_prev">${val ? `<a href="${esc(val)}" target="_blank" rel="noopener">${t('View current PDF')}</a>` : t('No file uploaded')}</div>
          <div class="img-controls">
            <input type="text" id="${id}" value="${esc(val || '')}" placeholder="${esc(t('PDF URL'))}">
            <div class="upload-row">
              <button type="button" class="btn btn-ghost btn-sm" id="${id}_btn">${t('Upload…')}</button>
              <button type="button" class="btn btn-ghost btn-sm" id="${id}_pick">${t('Choose existing…')}</button>
              <input type="file" id="${id}_file" accept="application/pdf" style="display:none">
            </div>
          </div>
        </div>${hint}</div>`;
    }
    if (f.type === 'consultants') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="consultants-edit" id="${id}_wrap"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="${id}_add" style="margin-top:8px">+ ${t('Add consultant')}</button>
        <input type="file" id="${id}_file" accept="image/*" style="display:none">
        ${hint}</div>`;
    }
    // text / number
    const inputType = f.type === 'number' ? 'number' : 'text';
    const step = f.type === 'number' ? ' step="any"' : '';
    return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="${inputType}"${step} id="${id}" value="${esc(val == null ? '' : val)}"${f.required ? ' required' : ''}>${hint}</div>`;
  }

  // ---------- image field wiring ----------
  function wireImage(id, initial) {
    const input = $('#' + id), prev = $('#' + id + '_prev'), btn = $('#' + id + '_btn'), pick = $('#' + id + '_pick'), file = $('#' + id + '_file');
    if (!input) return;
    input.addEventListener('input', () => { prev.src = imgUrl(input.value, 200); });
    btn.addEventListener('click', () => file.click());
    if (pick) pick.addEventListener('click', () => openMediaPicker('image', (url) => { input.value = url; prev.src = url; toast(t('Image selected — remember to Save')); }));
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      pendingUploads++;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      const url = await uploadFile(file.files[0]);
      pendingUploads--;
      btn.disabled = false; btn.textContent = t('Upload…');
      if (url) { input.value = url; prev.src = url; toast(t('Image uploaded — remember to Save')); }
    });
  }

  // ---------- gallery field wiring ----------
  function wireGallery(id, stateKey, initial) {
    uploads[stateKey] = Array.isArray(initial) ? initial.slice() : [];
    const key = stateKey;
    const wrap = $('#' + id + '_wrap'), file = $('#' + id + '_file');
    if (!wrap) return;
    const paint = () => {
      wrap.innerHTML = uploads[key].map((ref, i) =>
        `<div class="g-item"><img src="${esc(imgUrl(ref, 200))}" alt=""><button type="button" data-rm="${i}">×</button></div>`
      ).join('')
        + `<button type="button" class="add-img" id="${id}_add" title="${esc(t('Upload new'))}">+</button>`
        + `<button type="button" class="add-img add-img-pick" id="${id}_pick" title="${esc(t('Choose an existing file'))}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
             ${t('Choose')}
           </button>`;
      $('#' + id + '_add').addEventListener('click', () => file.click());
      $('#' + id + '_pick').addEventListener('click', () => openMediaPicker('image', (url) => { uploads[key].push(url); paint(); }));
      $$('[data-rm]', wrap).forEach(b => b.addEventListener('click', () => { uploads[key].splice(+b.dataset.rm, 1); paint(); }));
    };
    file.addEventListener('change', async () => {
      const files = Array.from(file.files || []);
      if (!files.length) return;
      pendingUploads++;
      toast(t('Uploading') + ' ' + files.length + ' ' + t('image(s)…'));
      for (const f of files) { const url = await uploadFile(f); if (url) uploads[key].push(url); }
      pendingUploads--;
      file.value = ''; paint(); toast(t('Gallery updated — remember to Save'));
    });
    paint();
  }

  // ---------- PDF field wiring ----------
  function wirePdf(id, initial) {
    const input = $('#' + id), prev = $('#' + id + '_prev'), btn = $('#' + id + '_btn'), pick = $('#' + id + '_pick'), file = $('#' + id + '_file');
    if (!input) return;
    const updatePrev = (url) => { prev.innerHTML = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${t('View current PDF')}</a>` : t('No file uploaded'); };
    input.addEventListener('input', () => updatePrev(input.value));
    btn.addEventListener('click', () => file.click());
    if (pick) pick.addEventListener('click', () => openMediaPicker('pdf', (url) => { input.value = url; updatePrev(url); toast(t('PDF selected — remember to Save')); }));
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      pendingUploads++;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      const url = await uploadFile(file.files[0], 'pdf');
      pendingUploads--;
      btn.disabled = false; btn.textContent = t('Upload…');
      if (url) { input.value = url; updatePrev(url); toast(t('PDF uploaded — remember to Save')); }
    });
  }

  // ---------- executive consultants field wiring (repeatable name + logo rows) ----------
  function wireConsultants(id, stateKey, initial) {
    uploads[stateKey] = Array.isArray(initial) ? initial.map(c => ({ name: (c && c.name) || '', logo: (c && c.logo) || '' })) : [];
    const key = stateKey;
    const wrap = $('#' + id + '_wrap'), addBtn = $('#' + id + '_add'), file = $('#' + id + '_file');
    if (!wrap) return;
    let uploadTarget = null;
    const paint = () => {
      wrap.innerHTML = uploads[key].map((c, i) => `
        <div class="consultant-row" data-i="${i}">
          <img class="consultant-logo-prev" src="${esc(imgUrl(c.logo, 100))}" alt="" title="${esc(t('Click to choose an existing logo'))}" data-cpick="${i}">
          <input type="text" placeholder="${esc(t('Consultant name'))}" value="${esc(c.name)}" data-cname="${i}">
          <button type="button" class="btn btn-ghost btn-sm" data-clogo="${i}">${t('Upload…')}</button>
          <button type="button" class="icon-btn del" data-crm="${i}" title="${esc(t('Remove'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>`).join('');
      $$('[data-cname]', wrap).forEach(inp => inp.addEventListener('input', () => { uploads[key][+inp.dataset.cname].name = inp.value; }));
      $$('[data-clogo]', wrap).forEach(b => b.addEventListener('click', () => { uploadTarget = +b.dataset.clogo; file.click(); }));
      $$('[data-cpick]', wrap).forEach(img => img.addEventListener('click', () => {
        const i = +img.dataset.cpick;
        openMediaPicker('image', (url) => { uploads[key][i].logo = url; paint(); });
      }));
      $$('[data-crm]', wrap).forEach(b => b.addEventListener('click', () => { uploads[key].splice(+b.dataset.crm, 1); paint(); }));
    };
    addBtn.addEventListener('click', () => { uploads[key].push({ name: '', logo: '' }); paint(); });
    file.addEventListener('change', async () => {
      if (!file.files[0] || uploadTarget == null) return;
      pendingUploads++;
      const url = await uploadFile(file.files[0], 'image');
      pendingUploads--;
      file.value = '';
      if (url) { uploads[key][uploadTarget].logo = url; paint(); toast(t('Logo uploaded — remember to Save')); }
    });
    paint();
  }

  // guards any promise against hanging forever — a stalled/dropped upload
  // connection would otherwise leave pendingUploads stuck above zero and
  // permanently block Save with no way to recover short of reloading
  function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function uploadFile(f, kind) {
    kind = kind || 'image';
    if (!f) return null;
    // guard: right file type, and keep it a sane size
    if (kind === 'image' && f.type && !/^image\//.test(f.type)) { toast(t('Please choose an image file'), 'err'); return null; }
    if (kind === 'pdf' && f.type && f.type !== 'application/pdf') { toast(t('Please choose a PDF file'), 'err'); return null; }
    const maxMB = kind === 'pdf' ? 50 : 12;
    if (f.size > maxMB * 1024 * 1024) { toast(`${t('File is larger than')} ${maxMB} MB — ${t('please pick a smaller one')}`, 'err'); return null; }
    try {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await withTimeout(
        sb.storage.from('media').upload(path, f, { cacheControl: '3600', upsert: false, contentType: f.type || undefined }),
        120000,
        t('Upload timed out — the file may be too large for your connection, or the storage bucket may have a lower size limit than this form allows.')
      );
      if (error) {
        console.error('Upload failed:', error);
        const m = String(error.message || error.error || '').toLowerCase();
        let msg = error.message || t('Upload failed');
        if (m.includes('bucket not found')) msg = t('Storage bucket "media" is missing. In Supabase → Storage, create a public bucket named "media" (or run supabase/fix-storage-and-admin.sql).');
        else if (m.includes('row-level security') || m.includes('not authorized') || m.includes('violates') || m.includes('permission')) msg = t('Upload blocked — your account is not an admin yet. Add your user to the admins table (see supabase/fix-storage-and-admin.sql).');
        toast(msg, 'err');
        return null;
      }
      const { data } = sb.storage.from('media').getPublicUrl(path);
      if (!data || !data.publicUrl) { toast(t('Uploaded, but could not resolve the public URL'), 'err'); return null; }
      return data.publicUrl;
    } catch (e) {
      console.error('Upload exception:', e);
      toast(t('Upload failed:') + ' ' + (e.message || e), 'err');
      return null;
    }
  }

  // ---------- media picker — reuse an already-uploaded file instead of re-uploading it ----------
  let mp = null; // lazily-created { overlay, grid, search }
  function ensureMediaPicker() {
    if (mp) return mp;
    const el = document.createElement('div');
    el.className = 'mp-overlay';
    el.innerHTML = `
      <div class="mp-modal">
        <div class="mp-head"><b class="bricolage">${t('Choose an existing file')}</b><button type="button" class="icon-btn" id="mpClose">×</button></div>
        <div class="mp-search"><input type="search" id="mpSearch" placeholder="${esc(t('Search filenames…'))}"></div>
        <div class="mp-grid" id="mpGrid"></div>
      </div>`;
    document.body.appendChild(el);
    const close = () => el.classList.remove('open');
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('#mpClose').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    mp = { overlay: el, grid: el.querySelector('#mpGrid'), search: el.querySelector('#mpSearch'), close };
    return mp;
  }

  async function openMediaPicker(kind, onSelect) {
    const els = ensureMediaPicker();
    els.overlay.classList.add('open');
    els.search.value = '';
    els.grid.innerHTML = `<div class="empty-row"><span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--sky)"></span></div>`;

    const { data, error } = await sb.storage.from('media').list('', { limit: 300, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) { els.grid.innerHTML = `<div class="empty-row">${t('Couldn’t load files:')} ${esc(error.message)}</div>`; return; }

    const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
    const files = (data || []).filter(f => f.name && !f.name.startsWith('.')).filter(f => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      return kind === 'pdf' ? ext === 'pdf' : imgExts.includes(ext);
    });

    const paintList = (list) => {
      if (!list.length) { els.grid.innerHTML = `<div class="empty-row">${(kind === 'pdf' ? t('No PDFs uploaded yet — upload one first, then it\'ll show up here to reuse.') : t('No images uploaded yet — upload one first, then it\'ll show up here to reuse.'))}</div>`; return; }
      els.grid.innerHTML = list.map(f => {
        const url = sb.storage.from('media').getPublicUrl(f.name).data.publicUrl;
        if (kind === 'pdf') {
          return `<button type="button" class="mp-item mp-pdf" data-url="${esc(url)}" title="${esc(f.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>
            <span>${esc(f.name.length > 22 ? f.name.slice(0, 19) + '…' : f.name)}</span>
          </button>`;
        }
        return `<button type="button" class="mp-item" data-url="${esc(url)}" title="${esc(f.name)}"><img src="${esc(url)}" alt="" loading="lazy"></button>`;
      }).join('');
      $$('.mp-item', els.grid).forEach(b => b.addEventListener('click', () => { onSelect(b.dataset.url); els.close(); }));
    };
    paintList(files);
    els.search.oninput = () => {
      const q = els.search.value.trim().toLowerCase();
      paintList(!q ? files : files.filter(f => f.name.toLowerCase().includes(q)));
    };
  }

  // ---------- collect + save ----------
  function collect(view) {
    const r = RESOURCES[view];
    const out = {};
    for (const f of r.fields) {
      const node = $('#f_' + f.key);
      if (f.type === 'bool') { out[f.key] = node.checked; continue; }
      if (f.type === 'gallery') { out[f.key] = uploads[f.key] || []; continue; }
      if (f.type === 'consultants') { out[f.key] = (uploads[f.key] || []).filter(c => c.name || c.logo); continue; }
      let v = node ? node.value : '';
      if (f.type === 'number') { out[f.key] = v === '' ? null : Number(v); continue; }
      // an empty selection on a reference field (city/project) means "unlinked" —
      // save it as null, not an empty string (uuid columns reject "")
      if (f.type === 'select' && (f.key === 'city_id' || f.key === 'project_id')) { out[f.key] = v === '' ? null : v; continue; }
      if (f.type === 'tags') { out[f.key] = v.split(',').map(s => s.trim()).filter(Boolean); continue; }
      if (f.type === 'lines') { out[f.key] = v.split('\n').map(s => s.trim()).filter(Boolean); continue; }
      out[f.key] = v.trim ? v.trim() : v;
    }
    return out;
  }

  async function saveForm(view) {
    if (pendingUploads > 0) { toast(t('An image is still uploading — please wait a moment'), 'err'); return; }
    const r = RESOURCES[view];
    const payload = collect(view);
    // required check
    for (const f of r.fields) {
      if (f.required && (payload[f.key] == null || payload[f.key] === '')) {
        toast(`“${f.label}” ${t('is required')}`, 'err'); return;
      }
    }
    // keep the legacy display "city" text column in sync with the picked city,
    // so anything still reading project.city (list views, filters) stays correct
    if (view === 'projects' && 'city_id' in payload) {
      const picked = dynamicCitiesList.find(c => c.id === payload.city_id);
      payload.city = picked ? picked.name : '';
    }
    const save = $('#drawerSave');
    save.disabled = true; save.innerHTML = '<span class="spinner"></span>';

    let res;
    if (editing.id) res = await sb.from(r.table).update(payload).eq('id', editing.id);
    else res = await sb.from(r.table).insert(payload);

    save.disabled = false; save.textContent = t('Save');
    if (res.error) { toast(res.error.message, 'err'); return; }

    closeDrawer();
    toast(editing.id ? t('Saved') : `${r.singular} ${t('created')}`);
    await refreshCounts();
    renderList(view);
  }

  // deleting a City doesn't fail if projects link to it (the FK is
  // ON DELETE SET NULL) — warn first so that unlinking isn't a silent surprise
  async function linkedChildrenWarning(view, id) {
    if (view === 'cities') {
      const { count } = await sb.from('projects').select('id', { count: 'exact', head: true }).eq('city_id', id);
      return count > 0 ? `\n\n${count} ${t('project(s) are linked to this city — they\'ll be kept, just unlinked from it.')}` : '';
    }
    return '';
  }

  async function removeRow(view, id) {
    const r = RESOURCES[view];
    const warning = await linkedChildrenWarning(view, id);
    if (!confirm(`${t('Delete this')} ${r.singular.toLowerCase()}? ${t('This can’t be undone.')}${warning}`)) return;
    const { error } = await sb.from(r.table).delete().eq('id', id);
    if (error) { toast(error.message, 'err'); return; }
    toast(`${r.singular} ${t('deleted')}`);
    await refreshCounts();
    renderList(view);
  }

  function openDrawer() { $('#overlay').classList.add('open'); $('#drawer').classList.add('open'); }
  function closeDrawer() { $('#overlay').classList.remove('open'); $('#drawer').classList.remove('open'); editing = null; }

  // ============================================================
  // SITE CONTENT EDITOR (content_blocks)
  // ============================================================
  const CONTENT_SCHEMA = {
    company: { title: t('Company / Brand'), fields: [
      { key: 'name', label: t('Company name') },
      { key: 'logo', label: t('Logo'), type: 'image', hint: t('shown in the header & footer — leave empty to use the default mark') },
      { key: 'tagline', label: t('Footer tagline'), type: 'textarea' },
      { key: 'email', label: t('Primary email') },
      { key: 'emailSecondary', label: t('Secondary email') },
      { key: 'phone', label: t('Primary phone') },
      { key: 'phoneSecondary', label: t('Secondary phone / WhatsApp') },
      { key: 'address', label: t('Address / HQ (one line per row)'), type: 'textarea' },
      { key: 'hours', label: t('Office hours (one line per row)'), type: 'textarea' },
      { key: 'instagram', label: t('Instagram URL') },
      { key: 'x', label: t('X (Twitter) URL') },
      { key: 'linkedin', label: t('LinkedIn URL') },
      { key: 'facebook', label: t('Facebook URL') },
      { key: 'copyright', label: t('Copyright line') } ],
      list: 'offices', listAddLabel: t('Add office'),
      listFields: [ { key: 'city', label: t('Office name / city') }, { key: 'lines', label: t('Address (one line per row)'), type: 'textarea' }, { key: 'phone', label: t('Phone') } ] },
    hero: { title: t('Hero'), fields: [
      { key: 'eyebrow', label: t('Eyebrow') }, { key: 'titleA', label: t('Title line 1') },
      { key: 'titleB', label: t('Title line 2') }, { key: 'sub', label: t('Subtext'), type: 'textarea' },
      { key: 'images', label: t('Hero background images (slideshow)'), type: 'gallery', hint: t('shown behind the hero — cross-fades every few seconds') } ] },
    stats: { title: t('Journey / Stats'), fields: [
      { key: 'lead', label: t('Lead paragraph'), type: 'textarea' } ], list: 'items',
      listFields: [ { key: 'value', label: t('Value'), type: 'number' }, { key: 'suffix', label: t('Suffix') }, { key: 'label', label: t('Label'), type: 'textarea' } ] },
    cta: { title: t('Call to action'), fields: [
      { key: 'titleA', label: t('Title line 1') }, { key: 'titleB', label: t('Title line 2') },
      { key: 'text', label: t('Text'), type: 'textarea' }, { key: 'button', label: t('Button label') } ] }
  };

  async function renderContent() {
    $('#viewTitle').textContent = t('Site content');
    $('#viewSub').textContent = t('Edit hero, stats and call-to-action copy');
    $('#content').innerHTML = `<div class="empty-row"><span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--sky)"></span></div>`;

    const { data } = await sb.from('content_blocks').select('key,value');
    const blocks = {};
    (data || []).forEach(r => blocks[r.key] = r.value);
    // merge fallback defaults for any missing block
    const fb = FALLBACK.content || {};
    Object.keys(CONTENT_SCHEMA).forEach(k => { if (!blocks[k]) blocks[k] = fb[k] || {}; });
    state.cache.content = blocks;

    let html = '';
    for (const key in CONTENT_SCHEMA) {
      const sch = CONTENT_SCHEMA[key], val = blocks[key] || {};
      html += `<div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${sch.title}</b></div><div style="padding:20px">`;
      sch.fields.forEach(f => {
        const v = val[f.key] == null ? '' : val[f.key];
        html += contentField(key, f, v);
      });
      if (sch.list) {
        const items = Array.isArray(val[sch.list]) ? val[sch.list] : [];
        html += `<div class="field-hint" style="margin:10px 0 6px">${esc(t(sch.list))}</div>`;
        html += `<div class="content-list" id="clist_${key}">`;
        items.forEach(it => { html += listItemHTML(key, sch.list, sch.listFields, it); });
        html += `</div>`;
        html += `<button type="button" class="btn btn-ghost btn-sm list-add" data-key="${key}" style="margin:2px 0 8px">+ ${esc(sch.listAddLabel || t('Add row'))}</button>`;
      }
      html += `<button class="btn btn-sky btn-sm" data-save-block="${key}" style="margin-top:8px">${t('Save')} ${esc(sch.title.toLowerCase())}</button>`;
      html += `</div></div>`;
    }
    $('#content').innerHTML = html;
    // wire any image / gallery fields in the content blocks
    for (const key in CONTENT_SCHEMA) {
      const val = blocks[key] || {};
      CONTENT_SCHEMA[key].fields.forEach(f => {
        const id = 'c_' + key + '__' + f.key;
        if (f.type === 'image') wireImage(id, val[f.key] || '');
        if (f.type === 'gallery') wireGallery(id, id, Array.isArray(val[f.key]) ? val[f.key] : []);
      });
    }
    // wire dynamic list rows (add / remove)
    $$('.content-list-item').forEach(wireListItem);
    $$('.list-add').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.key, sch = CONTENT_SCHEMA[key];
      const container = $('#clist_' + key);
      if (!container) return;
      const holder = el('div');
      holder.innerHTML = listItemHTML(key, sch.list, sch.listFields, {});
      const node = holder.firstElementChild;
      container.appendChild(node);
      wireListItem(node);
    }));
    $$('[data-save-block]').forEach(b => b.addEventListener('click', () => saveBlock(b.dataset.saveBlock)));
  }

  // monotonic id so add/removed list rows keep unique field ids
  let listSeq = 0;
  function listItemHTML(key, list, listFields, item) {
    const idx = listSeq++;
    item = item || {};
    const inner = listFields.map(f => contentField(key + '__' + list + '__' + idx, f, item[f.key] == null ? '' : item[f.key])).join('');
    return `<div class="content-list-item" data-idx="${idx}" style="position:relative;border:1px solid var(--line);border-radius:10px;padding:12px 12px 12px;margin-bottom:10px">
      <button type="button" class="icon-btn del list-rm" title="${esc(t('Remove'))}" style="position:absolute;top:8px;right:8px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
      <div class="grid-2">${inner}</div>
    </div>`;
  }
  function wireListItem(node) {
    const rm = node.querySelector('.list-rm');
    if (rm) rm.addEventListener('click', () => node.remove());
  }

  function contentField(prefix, f, v) {
    const id = 'c_' + prefix + '__' + f.key;
    const hint = f.hint ? `<div class="field-hint">${esc(f.hint)}</div>` : '';
    if (f.type === 'gallery') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="gallery-edit" id="${id}_wrap"></div>
        <input type="file" id="${id}_file" accept="image/*" multiple style="display:none">${hint}</div>`;
    }
    if (f.type === 'image') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="img-field">
          <img class="img-prev" id="${id}_prev" src="${esc(imgUrl(v, 200))}" alt="">
          <div class="img-controls">
            <input type="text" id="${id}" value="${esc(v || '')}" placeholder="${esc(t('Unsplash id or image URL'))}">
            <div class="upload-row">
              <button type="button" class="btn btn-ghost btn-sm" id="${id}_btn">${t('Upload…')}</button>
              <input type="file" id="${id}_file" accept="image/*" style="display:none">
            </div>
          </div>
        </div>${hint}</div>`;
    }
    if (f.type === 'textarea') return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}">${esc(v)}</textarea>${hint}</div>`;
    const inputType = f.type === 'number' ? 'number' : 'text';
    return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="${inputType}" id="${id}" value="${esc(v)}">${hint}</div>`;
  }

  async function saveBlock(key) {
    if (pendingUploads > 0) { toast(t('An image is still uploading — please wait a moment'), 'err'); return; }
    const sch = CONTENT_SCHEMA[key];
    const value = {};
    sch.fields.forEach(f => {
      const id = 'c_' + key + '__' + f.key;
      if (f.type === 'gallery') { value[f.key] = uploads[id] || []; return; }
      const node = $('#' + id);
      if (!node) return;
      value[f.key] = f.type === 'number' ? Number(node.value) : node.value;
    });
    if (sch.list) {
      const container = $('#clist_' + key);
      const items = [];
      if (container) {
        $$('.content-list-item', container).forEach(node => {
          const idx = node.dataset.idx;
          const o = {};
          sch.listFields.forEach(f => {
            const n = $('#c_' + key + '__' + sch.list + '__' + idx + '__' + f.key);
            if (n) o[f.key] = f.type === 'number' ? Number(n.value) : n.value;
          });
          if (Object.values(o).some(v => v !== '' && v != null)) items.push(o);
        });
      }
      value[sch.list] = items;
    }
    const { error } = await sb.from('content_blocks').upsert({ key, value }, { onConflict: 'key' });
    if (error) { toast(error.message, 'err'); return; }
    state.cache.content[key] = value;
    toast(t('Content saved'));
  }

  // ============================================================
  // SETTINGS / SEEDER
  // ============================================================
  function renderSettings() {
    $('#viewTitle').textContent = t('Setup');
    $('#viewSub').textContent = localMode ? t('Local demo mode — everything saves in this browser') : t('Connection status and starter data');

    if (localMode) {
      const cred = window.RealteekLocal.getCred();
      $('#content').innerHTML = `
        <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Mode')}</b></div>
          <div style="padding:20px">
            <p style="margin-bottom:10px">${t('Backend:')} <span class="pill on"><i></i>${t('Local (this browser)')}</span></p>
            <p class="field-hint" style="line-height:1.6">${t("All content you create here is saved in this browser's storage and shown live on the public site. Uploaded images are stored inline (resized), so keep them reasonably sized. To publish to the cloud and share across devices, add your Supabase keys in")} <code>config.js</code> ${t('and run')} <code>supabase/schema.sql</code>.</p>
          </div></div>

        <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Admin login — email & password')}</b></div>
          <div style="padding:20px">
            <div class="grid-2">
              <div class="field"><label for="credEmail">${t('Email')}</label><input type="email" id="credEmail" value="${esc(cred.email)}" autocomplete="off"></div>
              <div class="field"><label for="credPass">${t('Password')}</label><input type="text" id="credPass" value="${esc(cred.password)}" autocomplete="off"></div>
            </div>
            <button class="btn btn-sky btn-sm" id="credSave">${t('Save changes')}</button>
            <div class="field-hint" style="margin-top:10px">${t("Takes effect immediately — you'll use these the next time you sign in.")}</div>
          </div></div>

        <div class="panel"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Danger zone')}</b></div>
          <div style="padding:20px">
            <p style="color:var(--ink-soft);margin-bottom:14px;line-height:1.6">${t("Reset all content back to the bundled demo data. This wipes every change you've made in this browser.")}</p>
            <button class="btn btn-ghost btn-sm" id="resetBtn">${t('Reset demo data')}</button>
          </div></div>`;
      $('#credSave').addEventListener('click', () => {
        const em = $('#credEmail').value.trim(), pw = $('#credPass').value;
        if (!em || !pw) { toast(t('Email and password are required'), 'err'); return; }
        window.RealteekLocal.setCred(em, pw);
        $('#userEmail').textContent = em;
        $('#userName').textContent = em.split('@')[0] || t('Admin');
        toast(t('Login updated'));
      });
      $('#resetBtn').addEventListener('click', () => {
        if (!confirm(t('Reset all content to the demo data? This cannot be undone.'))) return;
        window.RealteekLocal.resetData();
        toast(t('Demo data restored'));
        setTimeout(() => location.reload(), 600);
      });
      return;
    }

    const ok = configured;
    const email = (state.user && state.user.email) || '';
    $('#content').innerHTML = `
      <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Connection')}</b></div>
        <div style="padding:20px">
          <p style="margin-bottom:10px">Supabase: ${ok ? `<span class="pill on"><i></i>${t('Connected')}</span>` : `<span class="pill off"><i></i>${t('Not configured')}</span>`}</p>
          <p class="field-hint">${t('Project URL:')} <code>${esc((cfg.url || '').replace(/^https?:\/\//, '') || '—')}</code></p>
        </div></div>

      <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Account — email & password')}</b></div>
        <div style="padding:20px">
          <div class="field"><label for="accEmail">${t('Email')}</label><input type="email" id="accEmail" value="${esc(email)}"></div>
          <button class="btn btn-ghost btn-sm" id="accEmailSave" style="margin-bottom:18px">${t('Update email')}</button>
          <div class="field-hint" style="margin:-10px 0 18px">${t('Changing your email sends a confirmation link to the new address.')}</div>
          <div class="field"><label for="accPass">${t('New password')}</label><input type="text" id="accPass" placeholder="${esc(t('At least 6 characters'))}"></div>
          <button class="btn btn-sky btn-sm" id="accPassSave">${t('Update password')}</button>
        </div></div>

      <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Starter data')}</b></div>
        <div style="padding:20px">
          <p style="color:var(--ink-soft);margin-bottom:14px;line-height:1.6">${t('Seed your database with the site’s bundled demo content — projects, listings, cities, testimonials, developers and copy. Tables that already contain rows are skipped, so this is safe to run once.')}</p>
          <button class="btn btn-sky" id="seedBtn">${t('Import starter data')}</button>
          <div id="seedLog" class="field-hint" style="margin-top:14px;white-space:pre-line"></div>
        </div></div>

      <div class="panel"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">${t('Currency')}</b></div>
        <div style="padding:20px">
          <p style="color:var(--ink-soft);margin-bottom:14px;line-height:1.6">${t('Some project/listing prices were saved with a "$" before EGP became the site\'s only currency. This rewrites any price still starting with "$" to start with "EGP" instead, leaving the rest of the value untouched. Safe to run more than once — already-converted prices are left alone.')}</p>
          <button class="btn btn-sky" id="egpBtn">${t('Convert existing prices to EGP')}</button>
          <div id="egpLog" class="field-hint" style="margin-top:14px;white-space:pre-line"></div>
        </div></div>`;
    const btn = $('#seedBtn');
    if (btn) btn.addEventListener('click', seedAll);
    const egpBtn = $('#egpBtn');
    if (egpBtn) egpBtn.addEventListener('click', convertPricesToEGP);

    const emailBtn = $('#accEmailSave');
    if (emailBtn) emailBtn.addEventListener('click', async () => {
      const v = $('#accEmail').value.trim();
      if (!v) { toast(t('Email is required'), 'err'); return; }
      emailBtn.disabled = true; emailBtn.innerHTML = '<span class="spinner"></span>';
      const { error } = await sb.auth.updateUser({ email: v });
      emailBtn.disabled = false; emailBtn.textContent = t('Update email');
      toast(error ? error.message : t('Confirmation email sent to the new address'), error ? 'err' : '');
    });
    const passBtn = $('#accPassSave');
    if (passBtn) passBtn.addEventListener('click', async () => {
      const v = $('#accPass').value;
      if (!v || v.length < 6) { toast(t('Password must be at least 6 characters'), 'err'); return; }
      passBtn.disabled = true; passBtn.innerHTML = '<span class="spinner"></span>';
      const { error } = await sb.auth.updateUser({ password: v });
      passBtn.disabled = false; passBtn.textContent = t('Update password');
      if (!error) $('#accPass').value = '';
      toast(error ? error.message : t('Password updated'), error ? 'err' : '');
    });
  }

  async function seedAll() {
    const btn = $('#seedBtn'), log = $('#seedLog');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + t('Importing…');
    const lines = [];
    const note = (s) => { lines.push(s); log.textContent = lines.join('\n'); };

    try {
      // projects (public shape → DB columns)
      await seedTable('projects', (FALLBACK.projects || []).map((p, i) => ({
        slug: p.id, name: p.name, category: p.category, unit_types: p.unitTypes || [], city: p.city, location: p.location,
        country: p.country, year: p.year, status: p.status, tagline: p.tagline, cover: p.cover,
        about: p.about || [], amenities: p.amenities || [], developer: p.developer, gallery: p.gallery || [],
        price: p.stats && p.stats.price, units: p.stats && p.stats.units, floors: p.stats && p.stats.floors,
        area: p.stats && p.stats.area, handover: p.stats && p.stats.handover,
        price_value: p.priceValue || 0, area_value: p.areaValue || 0, is_rental: !!p.isRental,
        lat: p.coords ? p.coords[0] : null, lng: p.coords ? p.coords[1] : null,
        sort_order: i, published: true
      })), 'slug', note);

      await seedTable('cities', (FALLBACK.cities || []).map((x, i) => ({ ...x, sort_order: i, published: true })), null, note);
      await seedTable('testimonials', (FALLBACK.testimonials || []).map((x, i) => ({ ...x, sort_order: i, published: true })), null, note);
      await seedTable('developers', (FALLBACK.developers || []).map((x, i) => ({ ...x, sort_order: i, published: true })), null, note);

      // content blocks
      const content = FALLBACK.content || {};
      const rows = Object.keys(content).map(key => ({ key, value: content[key] }));
      if (rows.length) {
        const { error } = await sb.from('content_blocks').upsert(rows, { onConflict: 'key' });
        note(error ? `content: ${error.message}` : `content: ${rows.length} blocks ✓`);
      }

      await backfillCityLinks(note);

      note('\n' + t('Done. Reloading counts…'));
      await refreshCounts();
      toast(t('Starter data imported'));
    } catch (e) {
      note(t('Error:') + ' ' + (e.message || e));
      toast(t('Import failed'), 'err');
    }
    btn.disabled = false; btn.textContent = t('Import starter data');
  }

  // one-time cleanup for content saved back when prices were shown in "$" —
  // rewrites only the leading "$" to "EGP ", leaving the rest of the value
  // (the number, /mo suffix, etc.) exactly as the admin entered it
  async function convertPricesToEGP() {
    const btn = $('#egpBtn'), log = $('#egpLog');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + t('Converting…');
    const lines = [];
    const note = (s) => { lines.push(s); log.textContent = lines.join('\n'); };

    try {
      const { data, error } = await sb.from('projects').select('id,price');
      if (error) {
        note(`projects: ${error.message}`);
      } else {
        const toFix = (data || []).filter(row => typeof row.price === 'string' && row.price.trim().startsWith('$'));
        if (!toFix.length) { note('projects: ' + t('nothing to convert')); }
        else {
          let ok = 0, fail = 0;
          for (const row of toFix) {
            const price = row.price.replace(/^\s*\$/, 'EGP ');
            const { error: upErr } = await sb.from('projects').update({ price }).eq('id', row.id);
            if (upErr) fail++; else ok++;
          }
          note(`projects: ${ok} ${t('price(s) converted')}${fail ? `, ${fail} ${t('failed')}` : ''}`);
        }
      }
      note('\n' + t('Done.'));
      toast(t('Prices converted to EGP'));
    } catch (e) {
      note(t('Error:') + ' ' + (e.message || e));
      toast(t('Conversion failed'), 'err');
    }
    btn.disabled = false; btn.textContent = t('Convert existing prices to EGP');
  }

  // links any project that still has a free-text city (no city_id yet) to a
  // matching row in the Cities table — runs right after seeding so demo
  // data is fully relational immediately, without needing to re-run schema.sql
  async function backfillCityLinks(note) {
    const { data: cities } = await sb.from('cities').select('id,name');
    if (!cities || !cities.length) return;
    const findCity = (text) => {
      const txt = String(text || '').toLowerCase();
      return cities.find(c => txt === c.name.toLowerCase() || txt.includes(c.name.toLowerCase()));
    };

    const { data: projects } = await sb.from('projects').select('id,city,city_id');
    let projLinked = 0;
    for (const p of (projects || [])) {
      if (p.city_id) continue;
      const c = findCity(p.city);
      if (c) { await sb.from('projects').update({ city_id: c.id }).eq('id', p.id); projLinked++; }
    }
    note(`${t('city links:')} ${projLinked} ${t('project(s)')} ✓`);
  }

  async function seedTable(table, rows, conflictKey, note) {
    if (!rows.length) { note(`${table}: ${t('nothing to seed')}`); return; }
    if (!conflictKey) {
      // no natural key to de-dupe by — skip entirely if the table already has any rows
      const { count } = await sb.from(table).select('id', { count: 'exact', head: true });
      if (count && count > 0) { note(`${table}: ${count} ${t('rows exist, skipped')}`); return; }
      const { error } = await sb.from(table).insert(rows);
      note(error ? `${table}: ${error.message}` : `${table}: ${rows.length} ${t('rows')} ✓`);
      return;
    }
    // has a natural key (e.g. slug) — only insert rows that don't already exist.
    // Never upsert here: an upsert would silently overwrite any live edits an
    // admin made to a project that happens to share a slug with the demo data.
    const { data: existing } = await sb.from(table).select(conflictKey);
    const have = new Set((existing || []).map(row => row[conflictKey]));
    const fresh = rows.filter(row => !have.has(row[conflictKey]));
    if (!fresh.length) { note(`${table}: ${rows.length} ${t('rows already exist, skipped')}`); return; }
    const { error } = await sb.from(table).insert(fresh);
    const skipped = rows.length - fresh.length;
    note(error ? `${table}: ${error.message}` : `${table}: ${fresh.length} ${t('new row(s)')} ✓${skipped ? ` (${skipped} ${t('already existed, skipped')})` : ''}`);
  }

  // ============================================================
  // INQUIRIES (contact-form leads)
  // ============================================================
  async function renderInquiries() {
    $('#viewTitle').textContent = t('Inquiries');
    $('#viewSub').textContent = t('Messages submitted through your contact form');
    $('#content').innerHTML = `<div class="panel"><div id="inqWrap"><div class="empty-row"><span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--sky)"></span></div></div></div>`;
    const { data, error } = await sb.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) {
      $('#inqWrap').innerHTML = `<div class="empty-row">${t('Couldn’t load inquiries:')} ${esc(error.message)}<br><span class="field-hint">${t('If you haven’t yet, run the inquiries section of')} <code>supabase/schema.sql</code> ${t('in your Supabase SQL editor.')}</span></div>`;
      return;
    }
    state.cache.inquiries = data || [];
    paintInquiries();
  }

  const INQUIRY_STATUS_LABEL = { new: t('New'), read: t('Read'), handled: t('Handled') };
  function paintInquiries() {
    const rows = state.cache.inquiries || [];
    if (!rows.length) { $('#inqWrap').innerHTML = `<div class="empty-row">${t('No inquiries yet. Submissions from the contact page will appear here.')}</div>`; return; }
    const opt = (v, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${INQUIRY_STATUS_LABEL[v] || v}</option>`;
    const body = rows.map(r => {
      const name = esc([r.first, r.last].filter(Boolean).join(' ') || '—');
      const when = r.created_at ? new Date(r.created_at).toLocaleString() : '';
      const msg = String(r.message || '');
      return `<tr${r.status === 'new' ? ' class="inq-new"' : ''}>
        <td><div class="name">${name}</div><div style="color:var(--ink-soft);font-size:.8rem">${esc(when)}</div></td>
        <td>${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''}${r.phone ? `<div style="color:var(--ink-soft);font-size:.8rem">${esc(r.phone)}</div>` : ''}</td>
        <td>${esc(r.interest || '')}${r.budget ? `<div style="color:var(--ink-soft);font-size:.8rem">${esc(r.budget)}</div>` : ''}</td>
        <td style="max-width:340px;white-space:normal">${esc(msg.length > 180 ? msg.slice(0, 180) + '…' : msg)}</td>
        <td><select class="inq-status" data-id="${r.id}">${opt('new', r.status)}${opt('read', r.status)}${opt('handled', r.status)}</select></td>
        <td><div class="row-actions"><button class="icon-btn del" data-del="${r.id}" title="${esc(t('Delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td>
      </tr>`;
    }).join('');
    $('#inqWrap').innerHTML = `<table class="tbl"><thead><tr><th>${t('From')}</th><th>${t('Contact')}</th><th>${t('Interest')}</th><th>${t('Message')}</th><th>${t('Status')}</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
    $$('.inq-status').forEach(s => s.addEventListener('change', () => updateInquiry(s.dataset.id, s.value)));
    $$('[data-del]', $('#inqWrap')).forEach(b => b.addEventListener('click', () => deleteInquiry(b.dataset.del)));
  }

  async function updateInquiry(id, status) {
    const { error } = await sb.from('inquiries').update({ status }).eq('id', id);
    if (error) { toast(error.message, 'err'); return; }
    const row = (state.cache.inquiries || []).find(x => x.id === id);
    if (row) row.status = status;
    paintInquiries();
    refreshCounts();
    toast(t('Status updated'));
  }

  async function deleteInquiry(id) {
    if (!confirm(t('Delete this inquiry? This can’t be undone.'))) return;
    const { error } = await sb.from('inquiries').delete().eq('id', id);
    if (error) { toast(error.message, 'err'); return; }
    state.cache.inquiries = (state.cache.inquiries || []).filter(x => x.id !== id);
    paintInquiries();
    refreshCounts();
    toast(t('Inquiry deleted'));
  }

  // ============================================================
  // NEWSLETTER (footer signup-form subscribers)
  // ============================================================
  async function renderNewsletter() {
    $('#viewTitle').textContent = t('Newsletter');
    $('#viewSub').textContent = t('Emails collected from the footer signup form');
    $('#content').innerHTML = `<div class="panel">
      <div class="panel-head"><button class="btn btn-ghost btn-sm" id="copyEmailsBtn">${t('Copy all emails')}</button></div>
      <div id="nlWrap"><div class="empty-row"><span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--sky)"></span></div></div>
    </div>`;
    const { data, error } = await sb.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
    if (error) {
      $('#nlWrap').innerHTML = `<div class="empty-row">${t('Couldn’t load subscribers:')} ${esc(error.message)}<br><span class="field-hint">${t('If you haven’t yet, run the newsletter section of')} <code>supabase/schema.sql</code> ${t('in your Supabase SQL editor.')}</span></div>`;
      return;
    }
    state.cache.newsletter = data || [];
    paintNewsletter();
    $('#copyEmailsBtn').addEventListener('click', () => {
      const emails = (state.cache.newsletter || []).map(r => r.email).join(', ');
      if (!emails) { toast(t('No subscribers yet'), 'err'); return; }
      navigator.clipboard.writeText(emails).then(
        () => toast(t('Emails copied to clipboard')),
        () => toast(t('Could not copy — select and copy manually'), 'err')
      );
    });
  }

  function paintNewsletter() {
    const rows = state.cache.newsletter || [];
    if (!rows.length) { $('#nlWrap').innerHTML = `<div class="empty-row">${t("No subscribers yet. Signups from any page's footer will appear here.")}</div>`; return; }
    const body = rows.map(r => {
      const when = r.created_at ? new Date(r.created_at).toLocaleString() : '';
      return `<tr>
        <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
        <td style="color:var(--ink-soft);font-size:.85rem">${esc(when)}</td>
        <td><div class="row-actions"><button class="icon-btn del" data-del="${r.id}" title="${esc(t('Delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td>
      </tr>`;
    }).join('');
    $('#nlWrap').innerHTML = `<table class="tbl"><thead><tr><th>${t('Email')}</th><th>${t('Subscribed')}</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
    $$('[data-del]', $('#nlWrap')).forEach(b => b.addEventListener('click', () => deleteSubscriber(b.dataset.del)));
  }

  async function deleteSubscriber(id) {
    if (!confirm(t('Remove this subscriber? This can’t be undone.'))) return;
    const { error } = await sb.from('newsletter_subscribers').delete().eq('id', id);
    if (error) { toast(error.message, 'err'); return; }
    state.cache.newsletter = (state.cache.newsletter || []).filter(x => x.id !== id);
    paintNewsletter();
    refreshCounts();
    toast(t('Subscriber removed'));
  }

  // ---------- icons ----------
  const ICONS = {
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    city: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l5-3v16"/><path d="M14 21V11l5 3v7"/></svg>',
    quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
  };

  // go!
  document.addEventListener('DOMContentLoaded', boot);
})();
