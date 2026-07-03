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
  const sb = cloud ? window.supabase.createClient(cfg.url, cfg.anonKey)
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
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (kind === 'err' ? ' err' : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.className = 'toast'; }, 2800);
  }

  // ============================================================
  // RESOURCE DEFINITIONS — one entry drives table + form for a table
  // field types: text | textarea | number | bool | select | tags | lines | image | gallery
  // ============================================================
  const RESOURCES = {
    projects: {
      label: 'Projects', singular: 'Project', table: 'projects', icon: 'building',
      columns: [
        { key: 'cover', label: '', type: 'thumb' },
        { key: 'name', label: 'Name', type: 'name', sub: 'tagline' },
        { key: 'category', label: 'Category' },
        { key: 'city', label: 'City' },
        { key: 'status', label: 'Status' },
        { key: 'published', label: 'Status', type: 'pill' }
      ],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, half: true },
        { key: 'slug', label: 'Slug (URL id)', type: 'text', required: true, half: true, hint: 'lowercase, dashes — e.g. azure-residences' },
        { key: 'category', label: 'Category', type: 'select', options: ['Residential', 'Commercial', 'Mixed-use', 'Hospitality', 'Retail', 'Office'], half: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Completed', 'Ongoing', 'Off-plan'], half: true },
        { key: 'city', label: 'City', type: 'text', half: true },
        { key: 'country', label: 'Country', type: 'text', half: true },
        { key: 'location', label: 'Location / address', type: 'text' },
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'developer', label: 'Developer', type: 'text', half: true },
        { key: 'year', label: 'Year', type: 'number', half: true },
        { key: 'cover', label: 'Cover image', type: 'image' },
        { key: 'gallery', label: 'Gallery', type: 'gallery' },
        { key: 'about', label: 'About (one paragraph per line)', type: 'lines' },
        { key: 'amenities', label: 'Amenities', type: 'tags' },
        { key: 'price', label: 'Price (display)', type: 'text', half: true, hint: 'e.g. $3.2M' },
        { key: 'price_value', label: 'Price value (number)', type: 'number', half: true },
        { key: 'area', label: 'Area (display)', type: 'text', half: true },
        { key: 'area_value', label: 'Area value (number)', type: 'number', half: true },
        { key: 'units', label: 'Units', type: 'text', half: true },
        { key: 'floors', label: 'Floors', type: 'text', half: true },
        { key: 'handover', label: 'Handover', type: 'text', half: true },
        { key: 'is_rental', label: 'Rental listing', type: 'bool', half: true },
        { key: 'lat', label: 'Latitude', type: 'number', half: true },
        { key: 'lng', label: 'Longitude', type: 'number', half: true },
        { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
        { key: 'published', label: 'Published', type: 'bool', half: true }
      ]
    },
    properties: {
      label: 'Listings', singular: 'Listing', table: 'properties', icon: 'home',
      columns: [
        { key: 'image', label: '', type: 'thumb' },
        { key: 'name', label: 'Name', type: 'name', sub: 'location' },
        { key: 'price', label: 'Price' },
        { key: 'badge', label: 'Badge' },
        { key: 'published', label: 'Status', type: 'pill' }
      ],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'image', label: 'Cover image', type: 'image' },
        { key: 'images', label: 'Gallery', type: 'gallery' },
        { key: 'price', label: 'Price', type: 'text', half: true },
        { key: 'badge', label: 'Badge', type: 'select', options: ['For Sale', 'For Rent', 'For Lease'], half: true },
        { key: 'categories', label: 'Categories', type: 'tags', hint: 'villas, apartments, offices…' },
        { key: 'beds', label: 'Beds', type: 'number', half: true },
        { key: 'baths', label: 'Baths', type: 'number', half: true },
        { key: 'area', label: 'Area', type: 'text', half: true },
        { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
        { key: 'published', label: 'Published', type: 'bool' }
      ]
    },
    cities: {
      label: 'Cities', singular: 'City', table: 'cities', icon: 'city',
      columns: [
        { key: 'image', label: '', type: 'thumb' },
        { key: 'name', label: 'Name', type: 'name', sub: 'country' },
        { key: 'unit_count', label: 'Units' },
        { key: 'size', label: 'Tile' },
        { key: 'published', label: 'Status', type: 'pill' }
      ],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, half: true },
        { key: 'country', label: 'Country', type: 'text', half: true },
        { key: 'image', label: 'Image', type: 'image' },
        { key: 'unit_count', label: 'Unit count (display)', type: 'text', half: true, hint: 'e.g. 1,240 Units' },
        { key: 'size', label: 'Tile size', type: 'select', options: ['normal', 'wide', 'big'], half: true },
        { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
        { key: 'published', label: 'Published', type: 'bool', half: true }
      ]
    },
    testimonials: {
      label: 'Testimonials', singular: 'Testimonial', table: 'testimonials', icon: 'quote',
      columns: [
        { key: 'avatar', label: '', type: 'thumb' },
        { key: 'name', label: 'Name', type: 'name', sub: 'location' },
        { key: 'quote', label: 'Quote', type: 'truncate' },
        { key: 'rating', label: 'Rating' },
        { key: 'published', label: 'Status', type: 'pill' }
      ],
      fields: [
        { key: 'quote', label: 'Quote', type: 'textarea', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true, half: true },
        { key: 'location', label: 'Location', type: 'text', half: true },
        { key: 'avatar', label: 'Avatar', type: 'image' },
        { key: 'rating', label: 'Rating (1–5)', type: 'number', half: true },
        { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
        { key: 'published', label: 'Published', type: 'bool' }
      ]
    },
    categories: {
      label: 'Categories', singular: 'Category', table: 'categories', icon: 'grid',
      columns: [
        { key: 'label', label: 'Label', type: 'name', sub: 'filter' },
        { key: 'filter', label: 'Filter key' },
        { key: 'published', label: 'Status', type: 'pill' }
      ],
      fields: [
        { key: 'label', label: 'Label', type: 'text', required: true, half: true, hint: 'shown on the chip — e.g. Luxury Villas' },
        { key: 'filter', label: 'Filter key', type: 'text', required: true, half: true, hint: 'lowercase, matches a listing category — e.g. luxury' },
        { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
        { key: 'published', label: 'Published', type: 'bool', half: true }
      ]
    },
    developers: {
      label: 'Developers', singular: 'Developer', table: 'developers', icon: 'users',
      columns: [
        { key: 'logo', label: '', type: 'thumb' },
        { key: 'name', label: 'Name', type: 'name' },
        { key: 'published', label: 'Status', type: 'pill' }
      ],
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'logo', label: 'Logo (optional)', type: 'image', hint: 'leave empty to render the name as a wordmark' },
        { key: 'sort_order', label: 'Sort order', type: 'number', half: true },
        { key: 'published', label: 'Published', type: 'bool', half: true }
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
    $('#viewTitle').textContent = 'Setup required';
    $('#viewSub').textContent = 'Connect Supabase to start managing content';
    $('#content').innerHTML = `
      <div class="notice">
        <h3>Supabase isn’t configured</h3>
        <p>Your public site is running on bundled demo data. To enable the admin and live editing:</p>
        <p style="margin-top:10px">
          1. Create a project at <code>supabase.com</code><br>
          2. Run <code>supabase/schema.sql</code> in the SQL editor<br>
          3. Paste your Project URL + anon key into <code>config.js</code><br>
          4. Add yourself to the <code>admins</code> table, then reload
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

    const menuBtn = $('#menuBtn'), sidebar = $('#sidebar');
    if (window.innerWidth <= 860) menuBtn.style.display = 'grid';
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

    // clicking the account row opens Account & settings
    const userRow = $('.sb-user');
    if (userRow) { userRow.style.cursor = 'pointer'; userRow.title = 'Account & settings'; userRow.addEventListener('click', () => go('settings')); }
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
    else if (view === 'settings') { renderSettings(); pa.style.display = 'none'; }
    else if (RESOURCES[view]) {
      const r = RESOURCES[view];
      $('#primaryAction').querySelector('span').textContent = 'Add ' + r.singular.toLowerCase();
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
  }

  // ============================================================
  // OVERVIEW
  // ============================================================
  function renderOverview() {
    $('#viewTitle').textContent = 'Dashboard';
    $('#viewSub').textContent = 'An overview of your content';
    const cards = Object.keys(RESOURCES).map(key => {
      const r = RESOURCES[key];
      const n = state.cache[key + '_count'] || 0;
      return `<button class="stat-card" data-jump="${key}" style="text-align:left;cursor:pointer;border:1px solid var(--line)">
        <div class="ic">${ICONS[r.icon] || ICONS.building}</div>
        <div class="n">${n}</div><div class="l">${r.label}</div>
      </button>`;
    }).join('');
    $('#content').innerHTML = `<div class="stat-grid">${cards}</div>
      <div class="panel"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">Quick actions</b></div>
        <div style="padding:20px;display:flex;gap:.7rem;flex-wrap:wrap">
          <button class="btn btn-sky btn-sm" data-jump="projects">Manage projects</button>
          <button class="btn btn-ghost btn-sm" data-jump="properties">Manage listings</button>
          <button class="btn btn-ghost btn-sm" data-jump="content">Edit site content</button>
          <button class="btn btn-ghost btn-sm" data-jump="settings">Setup &amp; seed data</button>
        </div></div>`;
    $$('[data-jump]').forEach(b => b.addEventListener('click', () => go(b.dataset.jump)));
  }

  // ============================================================
  // LIST VIEW (table)
  // ============================================================
  async function renderList(view) {
    const r = RESOURCES[view];
    $('#viewTitle').textContent = r.label;
    $('#viewSub').textContent = `Manage your ${r.label.toLowerCase()}`;
    $('#content').innerHTML = `<div class="panel">
      <div class="panel-head">
        <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4-4"/></svg>
          <input type="search" id="tblSearch" placeholder="Search ${r.label.toLowerCase()}…" /></div>
      </div>
      <div id="tblWrap"><div class="empty-row"><span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--sky)"></span></div></div>
    </div>`;

    $('#tblSearch').addEventListener('input', e => { state.query = e.target.value.toLowerCase(); paintRows(view); });

    const { data, error } = await sb.from(r.table).select('*').order('sort_order', { ascending: true });
    if (error) { $('#tblWrap').innerHTML = `<div class="empty-row">Couldn’t load: ${esc(error.message)}</div>`; return; }
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
      $('#tblWrap').innerHTML = `<div class="empty-row">No ${r.label.toLowerCase()} yet. Click “Add ${r.singular.toLowerCase()}” to create one.</div>`;
      return;
    }
    const head = r.columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '<th></th>';
    const body = rows.map(row => {
      const cells = r.columns.map(c => `<td>${cell(c, row)}</td>`).join('');
      return `<tr>${cells}<td><div class="row-actions">
        <button class="icon-btn" data-edit="${row.id}" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="icon-btn del" data-del="${row.id}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
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
      return v ? `<span class="pill on"><i></i>Published</span>` : `<span class="pill off"><i></i>Hidden</span>`;
    }
    if (c.type === 'truncate') {
      const s = String(v || '');
      return esc(s.length > 60 ? s.slice(0, 60) + '…' : s);
    }
    if (Array.isArray(v)) return v.slice(0, 3).map(t => `<span class="tag-mini">${esc(t)}</span>`).join('') + (v.length > 3 ? ` +${v.length - 3}` : '');
    return esc(v);
  }

  // ============================================================
  // FORM (drawer)
  // ============================================================
  let editing = null; // { view, id }
  let uploads = {};   // transient per-form state for arrays/gallery
  let pendingUploads = 0; // in-flight image uploads — block saves until they finish

  function openForm(view, row) {
    const r = RESOURCES[view];
    editing = { view, id: row ? row.id : null };
    uploads = {};
    $('#drawerTitle').textContent = (row ? 'Edit ' : 'New ') + r.singular.toLowerCase();
    const body = $('#drawerBody');
    body.innerHTML = '';

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
      const opts = f.options.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('');
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
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="text" id="${id}" value="${esc(text)}" placeholder="comma, separated, values">${hint}</div>`;
    }
    if (f.type === 'image') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="img-field">
          <img class="img-prev" id="${id}_prev" src="${esc(imgUrl(val, 200))}" alt="">
          <div class="img-controls">
            <input type="text" id="${id}" value="${esc(val || '')}" placeholder="Unsplash id or image URL">
            <div class="upload-row">
              <button type="button" class="btn btn-ghost btn-sm" id="${id}_btn">Upload…</button>
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
    // text / number
    const t = f.type === 'number' ? 'number' : 'text';
    const step = f.type === 'number' ? ' step="any"' : '';
    return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="${t}"${step} id="${id}" value="${esc(val == null ? '' : val)}"${f.required ? ' required' : ''}>${hint}</div>`;
  }

  // ---------- image field wiring ----------
  function wireImage(id, initial) {
    const input = $('#' + id), prev = $('#' + id + '_prev'), btn = $('#' + id + '_btn'), file = $('#' + id + '_file');
    if (!input) return;
    input.addEventListener('input', () => { prev.src = imgUrl(input.value, 200); });
    btn.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      pendingUploads++;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      const url = await uploadFile(file.files[0]);
      pendingUploads--;
      btn.disabled = false; btn.textContent = 'Upload…';
      if (url) { input.value = url; prev.src = url; toast('Image uploaded — remember to Save'); }
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
      ).join('') + `<button type="button" class="add-img" id="${id}_add">+</button>`;
      $('#' + id + '_add').addEventListener('click', () => file.click());
      $$('[data-rm]', wrap).forEach(b => b.addEventListener('click', () => { uploads[key].splice(+b.dataset.rm, 1); paint(); }));
    };
    file.addEventListener('change', async () => {
      const files = Array.from(file.files || []);
      if (!files.length) return;
      pendingUploads++;
      toast('Uploading ' + files.length + ' image(s)…');
      for (const f of files) { const url = await uploadFile(f); if (url) uploads[key].push(url); }
      pendingUploads--;
      file.value = ''; paint(); toast('Gallery updated — remember to Save');
    });
    paint();
  }

  async function uploadFile(f) {
    if (!f) return null;
    // guard: only images, and keep them a sane size
    if (f.type && !/^image\//.test(f.type)) { toast('Please choose an image file', 'err'); return null; }
    if (f.size > 12 * 1024 * 1024) { toast('Image is larger than 12 MB — please pick a smaller one', 'err'); return null; }
    try {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('media').upload(path, f, { cacheControl: '3600', upsert: false, contentType: f.type || undefined });
      if (error) {
        console.error('Image upload failed:', error);
        const m = String(error.message || error.error || '').toLowerCase();
        let msg = error.message || 'Upload failed';
        if (m.includes('bucket not found')) msg = 'Storage bucket "media" is missing. In Supabase → Storage, create a public bucket named "media" (or run supabase/fix-storage-and-admin.sql).';
        else if (m.includes('row-level security') || m.includes('not authorized') || m.includes('violates') || m.includes('permission')) msg = 'Upload blocked — your account is not an admin yet. Add your user to the admins table (see supabase/fix-storage-and-admin.sql).';
        toast(msg, 'err');
        return null;
      }
      const { data } = sb.storage.from('media').getPublicUrl(path);
      if (!data || !data.publicUrl) { toast('Uploaded, but could not resolve the public URL', 'err'); return null; }
      return data.publicUrl;
    } catch (e) {
      console.error('Image upload exception:', e);
      toast('Upload failed: ' + (e.message || e), 'err');
      return null;
    }
  }

  // ---------- collect + save ----------
  function collect(view) {
    const r = RESOURCES[view];
    const out = {};
    for (const f of r.fields) {
      const node = $('#f_' + f.key);
      if (f.type === 'bool') { out[f.key] = node.checked; continue; }
      if (f.type === 'gallery') { out[f.key] = uploads[f.key] || []; continue; }
      let v = node ? node.value : '';
      if (f.type === 'number') { out[f.key] = v === '' ? null : Number(v); continue; }
      if (f.type === 'tags') { out[f.key] = v.split(',').map(s => s.trim()).filter(Boolean); continue; }
      if (f.type === 'lines') { out[f.key] = v.split('\n').map(s => s.trim()).filter(Boolean); continue; }
      out[f.key] = v.trim ? v.trim() : v;
    }
    return out;
  }

  async function saveForm(view) {
    if (pendingUploads > 0) { toast('An image is still uploading — please wait a moment', 'err'); return; }
    const r = RESOURCES[view];
    const payload = collect(view);
    // required check
    for (const f of r.fields) {
      if (f.required && (payload[f.key] == null || payload[f.key] === '')) {
        toast(`“${f.label}” is required`, 'err'); return;
      }
    }
    const save = $('#drawerSave');
    save.disabled = true; save.innerHTML = '<span class="spinner"></span>';

    let res;
    if (editing.id) res = await sb.from(r.table).update(payload).eq('id', editing.id);
    else res = await sb.from(r.table).insert(payload);

    save.disabled = false; save.textContent = 'Save';
    if (res.error) { toast(res.error.message, 'err'); return; }

    closeDrawer();
    toast(editing.id ? 'Saved' : `${r.singular} created`);
    await refreshCounts();
    renderList(view);
  }

  async function removeRow(view, id) {
    const r = RESOURCES[view];
    if (!confirm(`Delete this ${r.singular.toLowerCase()}? This can’t be undone.`)) return;
    const { error } = await sb.from(r.table).delete().eq('id', id);
    if (error) { toast(error.message, 'err'); return; }
    toast(`${r.singular} deleted`);
    await refreshCounts();
    renderList(view);
  }

  function openDrawer() { $('#overlay').classList.add('open'); $('#drawer').classList.add('open'); }
  function closeDrawer() { $('#overlay').classList.remove('open'); $('#drawer').classList.remove('open'); editing = null; }

  // ============================================================
  // SITE CONTENT EDITOR (content_blocks)
  // ============================================================
  const CONTENT_SCHEMA = {
    company: { title: 'Company / Brand', fields: [
      { key: 'name', label: 'Company name' },
      { key: 'logo', label: 'Logo', type: 'image', hint: 'shown in the header & footer — leave empty to use the default mark' },
      { key: 'tagline', label: 'Footer tagline', type: 'textarea' },
      { key: 'email', label: 'Primary email' },
      { key: 'emailSecondary', label: 'Secondary email' },
      { key: 'phone', label: 'Primary phone' },
      { key: 'phoneSecondary', label: 'Secondary phone / WhatsApp' },
      { key: 'address', label: 'Address / HQ (one line per row)', type: 'textarea' },
      { key: 'hours', label: 'Office hours (one line per row)', type: 'textarea' },
      { key: 'instagram', label: 'Instagram URL' },
      { key: 'x', label: 'X (Twitter) URL' },
      { key: 'linkedin', label: 'LinkedIn URL' },
      { key: 'facebook', label: 'Facebook URL' },
      { key: 'copyright', label: 'Copyright line' } ],
      list: 'offices', listAddLabel: 'Add office',
      listFields: [ { key: 'city', label: 'Office name / city' }, { key: 'lines', label: 'Address (one line per row)', type: 'textarea' }, { key: 'phone', label: 'Phone' } ] },
    hero: { title: 'Hero', fields: [
      { key: 'eyebrow', label: 'Eyebrow' }, { key: 'titleA', label: 'Title line 1' },
      { key: 'titleB', label: 'Title line 2' }, { key: 'sub', label: 'Subtext', type: 'textarea' },
      { key: 'images', label: 'Hero background images (slideshow)', type: 'gallery', hint: 'shown behind the hero — cross-fades every few seconds' } ] },
    stats: { title: 'Journey / Stats', fields: [
      { key: 'lead', label: 'Lead paragraph', type: 'textarea' } ], list: 'items',
      listFields: [ { key: 'value', label: 'Value', type: 'number' }, { key: 'suffix', label: 'Suffix' }, { key: 'label', label: 'Label', type: 'textarea' } ] },
    cta: { title: 'Call to action', fields: [
      { key: 'titleA', label: 'Title line 1' }, { key: 'titleB', label: 'Title line 2' },
      { key: 'text', label: 'Text', type: 'textarea' }, { key: 'button', label: 'Button label' } ] }
  };

  async function renderContent() {
    $('#viewTitle').textContent = 'Site content';
    $('#viewSub').textContent = 'Edit hero, stats and call-to-action copy';
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
        html += `<div class="field-hint" style="margin:10px 0 6px">${esc(sch.list)}</div>`;
        html += `<div class="content-list" id="clist_${key}">`;
        items.forEach(it => { html += listItemHTML(key, sch.list, sch.listFields, it); });
        html += `</div>`;
        html += `<button type="button" class="btn btn-ghost btn-sm list-add" data-key="${key}" style="margin:2px 0 8px">+ ${esc(sch.listAddLabel || 'Add row')}</button>`;
      }
      html += `<button class="btn btn-sky btn-sm" data-save-block="${key}" style="margin-top:8px">Save ${esc(sch.title.toLowerCase())}</button>`;
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
      <button type="button" class="icon-btn del list-rm" title="Remove" style="position:absolute;top:8px;right:8px">
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
            <input type="text" id="${id}" value="${esc(v || '')}" placeholder="Unsplash id or image URL">
            <div class="upload-row">
              <button type="button" class="btn btn-ghost btn-sm" id="${id}_btn">Upload…</button>
              <input type="file" id="${id}_file" accept="image/*" style="display:none">
            </div>
          </div>
        </div>${hint}</div>`;
    }
    if (f.type === 'textarea') return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}">${esc(v)}</textarea>${hint}</div>`;
    const t = f.type === 'number' ? 'number' : 'text';
    return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="${t}" id="${id}" value="${esc(v)}">${hint}</div>`;
  }

  async function saveBlock(key) {
    if (pendingUploads > 0) { toast('An image is still uploading — please wait a moment', 'err'); return; }
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
    toast('Content saved');
  }

  // ============================================================
  // SETTINGS / SEEDER
  // ============================================================
  function renderSettings() {
    $('#viewTitle').textContent = 'Setup';
    $('#viewSub').textContent = localMode ? 'Local demo mode — everything saves in this browser' : 'Connection status and starter data';

    if (localMode) {
      const cred = window.RealteekLocal.getCred();
      $('#content').innerHTML = `
        <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">Mode</b></div>
          <div style="padding:20px">
            <p style="margin-bottom:10px">Backend: <span class="pill on"><i></i>Local (this browser)</span></p>
            <p class="field-hint" style="line-height:1.6">All content you create here is saved in this browser's storage and shown live on the public site. Uploaded images are stored inline (resized), so keep them reasonably sized. To publish to the cloud and share across devices, add your Supabase keys in <code>config.js</code> and run <code>supabase/schema.sql</code>.</p>
          </div></div>

        <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">Admin login — email &amp; password</b></div>
          <div style="padding:20px">
            <div class="grid-2">
              <div class="field"><label for="credEmail">Email</label><input type="email" id="credEmail" value="${esc(cred.email)}" autocomplete="off"></div>
              <div class="field"><label for="credPass">Password</label><input type="text" id="credPass" value="${esc(cred.password)}" autocomplete="off"></div>
            </div>
            <button class="btn btn-sky btn-sm" id="credSave">Save changes</button>
            <div class="field-hint" style="margin-top:10px">Takes effect immediately — you'll use these the next time you sign in.</div>
          </div></div>

        <div class="panel"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">Danger zone</b></div>
          <div style="padding:20px">
            <p style="color:var(--ink-soft);margin-bottom:14px;line-height:1.6">Reset all content back to the bundled demo data. This wipes every change you've made in this browser.</p>
            <button class="btn btn-ghost btn-sm" id="resetBtn">Reset demo data</button>
          </div></div>`;
      $('#credSave').addEventListener('click', () => {
        const em = $('#credEmail').value.trim(), pw = $('#credPass').value;
        if (!em || !pw) { toast('Email and password are required', 'err'); return; }
        window.RealteekLocal.setCred(em, pw);
        $('#userEmail').textContent = em;
        $('#userName').textContent = em.split('@')[0] || 'Admin';
        toast('Login updated');
      });
      $('#resetBtn').addEventListener('click', () => {
        if (!confirm('Reset all content to the demo data? This cannot be undone.')) return;
        window.RealteekLocal.resetData();
        toast('Demo data restored');
        setTimeout(() => location.reload(), 600);
      });
      return;
    }

    const ok = configured;
    const email = (state.user && state.user.email) || '';
    $('#content').innerHTML = `
      <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">Connection</b></div>
        <div style="padding:20px">
          <p style="margin-bottom:10px">Supabase: ${ok ? '<span class="pill on"><i></i>Connected</span>' : '<span class="pill off"><i></i>Not configured</span>'}</p>
          <p class="field-hint">Project URL: <code>${esc((cfg.url || '').replace(/^https?:\/\//, '') || '—')}</code></p>
        </div></div>

      <div class="panel" style="margin-bottom:20px"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">Account — email &amp; password</b></div>
        <div style="padding:20px">
          <div class="field"><label for="accEmail">Email</label><input type="email" id="accEmail" value="${esc(email)}"></div>
          <button class="btn btn-ghost btn-sm" id="accEmailSave" style="margin-bottom:18px">Update email</button>
          <div class="field-hint" style="margin:-10px 0 18px">Changing your email sends a confirmation link to the new address.</div>
          <div class="field"><label for="accPass">New password</label><input type="text" id="accPass" placeholder="At least 6 characters"></div>
          <button class="btn btn-sky btn-sm" id="accPassSave">Update password</button>
        </div></div>

      <div class="panel"><div class="panel-head"><b class="bricolage" style="font-size:1.05rem">Starter data</b></div>
        <div style="padding:20px">
          <p style="color:var(--ink-soft);margin-bottom:14px;line-height:1.6">Seed your database with the site’s bundled demo content — projects, listings, cities, testimonials, developers and copy. Tables that already contain rows are skipped, so this is safe to run once.</p>
          <button class="btn btn-sky" id="seedBtn">Import starter data</button>
          <div id="seedLog" class="field-hint" style="margin-top:14px;white-space:pre-line"></div>
        </div></div>`;
    const btn = $('#seedBtn');
    if (btn) btn.addEventListener('click', seedAll);

    const emailBtn = $('#accEmailSave');
    if (emailBtn) emailBtn.addEventListener('click', async () => {
      const v = $('#accEmail').value.trim();
      if (!v) { toast('Email is required', 'err'); return; }
      emailBtn.disabled = true; emailBtn.innerHTML = '<span class="spinner"></span>';
      const { error } = await sb.auth.updateUser({ email: v });
      emailBtn.disabled = false; emailBtn.textContent = 'Update email';
      toast(error ? error.message : 'Confirmation email sent to the new address', error ? 'err' : '');
    });
    const passBtn = $('#accPassSave');
    if (passBtn) passBtn.addEventListener('click', async () => {
      const v = $('#accPass').value;
      if (!v || v.length < 6) { toast('Password must be at least 6 characters', 'err'); return; }
      passBtn.disabled = true; passBtn.innerHTML = '<span class="spinner"></span>';
      const { error } = await sb.auth.updateUser({ password: v });
      passBtn.disabled = false; passBtn.textContent = 'Update password';
      if (!error) $('#accPass').value = '';
      toast(error ? error.message : 'Password updated', error ? 'err' : '');
    });
  }

  async function seedAll() {
    const btn = $('#seedBtn'), log = $('#seedLog');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Importing…';
    const lines = [];
    const note = (s) => { lines.push(s); log.textContent = lines.join('\n'); };

    try {
      // projects (public shape → DB columns)
      await seedTable('projects', (FALLBACK.projects || []).map((p, i) => ({
        slug: p.id, name: p.name, category: p.category, city: p.city, location: p.location,
        country: p.country, year: p.year, status: p.status, tagline: p.tagline, cover: p.cover,
        about: p.about || [], amenities: p.amenities || [], developer: p.developer, gallery: p.gallery || [],
        price: p.stats && p.stats.price, units: p.stats && p.stats.units, floors: p.stats && p.stats.floors,
        area: p.stats && p.stats.area, handover: p.stats && p.stats.handover,
        price_value: p.priceValue || 0, area_value: p.areaValue || 0, is_rental: !!p.isRental,
        lat: p.coords ? p.coords[0] : null, lng: p.coords ? p.coords[1] : null,
        sort_order: i, published: true
      })), 'slug', note);

      await seedTable('properties', (FALLBACK.properties || []).map((x, i) => ({ ...x, sort_order: i, published: true })), null, note);
      await seedTable('cities', (FALLBACK.cities || []).map((x, i) => ({ ...x, sort_order: i, published: true })), null, note);
      await seedTable('testimonials', (FALLBACK.testimonials || []).map((x, i) => ({ ...x, sort_order: i, published: true })), null, note);
      await seedTable('developers', (FALLBACK.developers || []).map((x, i) => ({ ...x, sort_order: i, published: true })), null, note);

      const DEFAULT_CATS = [
        ['villas', 'Villas'], ['apartments', 'Apartments'], ['duplex', 'Duplex Homes'],
        ['townhouses', 'Townhouses'], ['studio', 'Studio Apartments'], ['luxury', 'Luxury Villas'],
        ['retail', 'Retail Spaces'], ['offices', 'Offices']
      ].map(([filter, label], i) => ({ filter, label, sort_order: i, published: true }));
      await seedTable('categories', DEFAULT_CATS, null, note);

      // content blocks
      const content = FALLBACK.content || {};
      const rows = Object.keys(content).map(key => ({ key, value: content[key] }));
      if (rows.length) {
        const { error } = await sb.from('content_blocks').upsert(rows, { onConflict: 'key' });
        note(error ? `content: ${error.message}` : `content: ${rows.length} blocks ✓`);
      }

      note('\nDone. Reloading counts…');
      await refreshCounts();
      toast('Starter data imported');
    } catch (e) {
      note('Error: ' + (e.message || e));
      toast('Import failed', 'err');
    }
    btn.disabled = false; btn.textContent = 'Import starter data';
  }

  async function seedTable(table, rows, conflictKey, note) {
    if (!rows.length) { note(`${table}: nothing to seed`); return; }
    // skip if already populated (unless we can upsert by a natural key)
    if (!conflictKey) {
      const { count } = await sb.from(table).select('id', { count: 'exact', head: true });
      if (count && count > 0) { note(`${table}: ${count} rows exist, skipped`); return; }
      const { error } = await sb.from(table).insert(rows);
      note(error ? `${table}: ${error.message}` : `${table}: ${rows.length} rows ✓`);
    } else {
      const { error } = await sb.from(table).upsert(rows, { onConflict: conflictKey });
      note(error ? `${table}: ${error.message}` : `${table}: ${rows.length} rows ✓`);
    }
  }

  // ============================================================
  // INQUIRIES (contact-form leads)
  // ============================================================
  async function renderInquiries() {
    $('#viewTitle').textContent = 'Inquiries';
    $('#viewSub').textContent = 'Messages submitted through your contact form';
    $('#content').innerHTML = `<div class="panel"><div id="inqWrap"><div class="empty-row"><span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--sky)"></span></div></div></div>`;
    const { data, error } = await sb.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) {
      $('#inqWrap').innerHTML = `<div class="empty-row">Couldn’t load inquiries: ${esc(error.message)}<br><span class="field-hint">If you haven’t yet, run the inquiries section of <code>supabase/schema.sql</code> in your Supabase SQL editor.</span></div>`;
      return;
    }
    state.cache.inquiries = data || [];
    paintInquiries();
  }

  function paintInquiries() {
    const rows = state.cache.inquiries || [];
    if (!rows.length) { $('#inqWrap').innerHTML = `<div class="empty-row">No inquiries yet. Submissions from the contact page will appear here.</div>`; return; }
    const opt = (v, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`;
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
        <td><div class="row-actions"><button class="icon-btn del" data-del="${r.id}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td>
      </tr>`;
    }).join('');
    $('#inqWrap').innerHTML = `<table class="tbl"><thead><tr><th>From</th><th>Contact</th><th>Interest</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
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
    toast('Status updated');
  }

  async function deleteInquiry(id) {
    if (!confirm('Delete this inquiry? This can’t be undone.')) return;
    const { error } = await sb.from('inquiries').delete().eq('id', id);
    if (error) { toast(error.message, 'err'); return; }
    state.cache.inquiries = (state.cache.inquiries || []).filter(x => x.id !== id);
    paintInquiries();
    refreshCounts();
    toast('Inquiry deleted');
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
