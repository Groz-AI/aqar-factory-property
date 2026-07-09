/* ============================================================
   REALTEEK — Local backend (no server required)
   ------------------------------------------------------------
   A drop-in emulation of the small slice of the Supabase client
   that store.js / admin.js / login.html use, backed by the
   browser's localStorage. This makes the admin portal and live
   editing work out of the box, with no cloud setup.

   When you later fill in real Supabase keys in config.js, the app
   automatically switches to the cloud and ignores this file.

   Default admin login (change in the dashboard → Setup):
     email:    admin@realteek.com
     password: admin1234
   ============================================================ */
(function () {
  'use strict';

  const DB_KEY      = 'realteek_db_v1';
  const SESSION_KEY = 'realteek_session_v1';
  const CRED_KEY    = 'realteek_admin_cred_v1';

  const DEFAULT_CRED = { email: 'admin@realteek.com', password: 'admin1234' };

  const uuid = () =>
    (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  // ---------- seed (built from the bundled FALLBACK content) ----------
  function seedDB() {
    const F = window.FALLBACK || {};
    const withMeta = (arr) => (arr || []).map((x, i) => ({
      id: uuid(), sort_order: i, published: true, ...x
    }));

    // cities go first — everything else links to their generated ids
    const cities = withMeta(F.cities);
    const findCity = (text) => {
      const t = String(text || '').toLowerCase();
      return cities.find(c => t === c.name.toLowerCase() || t.includes(c.name.toLowerCase()));
    };

    // projects come in "public" shape → map to DB columns (mirror of admin seeder)
    // city_id links to the matching city above; city stays as a text fallback
    const projects = (F.projects || []).map((p, i) => {
      const city = findCity(p.city);
      return {
        id: uuid(), slug: p.id, name: p.name, category: p.category, city: p.city,
        city_id: city ? city.id : null,
        location: p.location, country: p.country, year: p.year, status: p.status,
        tagline: p.tagline, cover: p.cover, about: p.about || [], amenities: p.amenities || [],
        developer: p.developer, gallery: p.gallery || [],
        price: p.stats && p.stats.price, units: p.stats && p.stats.units,
        floors: p.stats && p.stats.floors, area: p.stats && p.stats.area,
        handover: p.stats && p.stats.handover,
        price_value: p.priceValue || 0, area_value: p.areaValue || 0, is_rental: !!p.isRental,
        lat: p.coords ? p.coords[0] : null, lng: p.coords ? p.coords[1] : null,
        sort_order: i, published: true
      };
    });

    // properties: link to a city by matching their free-text location, when possible
    // (project_id is intentionally left unset — that's an optional link admins add by hand)
    const properties = (F.properties || []).map((x, i) => {
      const city = findCity(x.location);
      return { id: uuid(), sort_order: i, published: true, city_id: city ? city.id : null, ...x };
    });

    // categories that drive the home "Discover Handpicked Homes" filter
    const categories = [
      ['villas', 'Villas'], ['apartments', 'Apartments'], ['duplex', 'Duplex Homes'],
      ['townhouses', 'Townhouses'], ['studio', 'Studio Apartments'], ['luxury', 'Luxury Villas'],
      ['retail', 'Retail Spaces'], ['offices', 'Offices']
    ].map(([filter, label], i) => ({ id: uuid(), filter, label, sort_order: i, published: true }));

    const content = F.content || {};
    const content_blocks = Object.keys(content).map(key => ({ key, value: content[key] }));
    // hero background images default to the bundled city skylines
    if (!content_blocks.find(b => b.key === 'hero')) content_blocks.push({ key: 'hero', value: {} });
    const hero = content_blocks.find(b => b.key === 'hero');
    if (hero && !hero.value.images) {
      hero.value = Object.assign({}, hero.value, {
        images: (F.cities || []).map(c => c.image).filter(Boolean)
      });
    }

    return {
      projects,
      properties,
      cities,
      testimonials: withMeta(F.testimonials),
      developers:   withMeta(F.developers),
      categories,
      content_blocks,
      media: {}
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const fresh = seedDB();
    save(fresh);
    return fresh;
  }
  function save(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); return true; }
    catch (e) { console.warn('Realteek local store is full', e); return false; }
  }

  const tableRows = (db, t) => (db[t] = db[t] || []);

  // ---------- chainable / thenable query builder ----------
  function Query(table) {
    this.table = table;
    this.op = 'select';
    this._filters = [];
    this._order = null;
    this._count = false;
    this._head = false;
    this._payload = null;
    this._conflict = null;
  }
  Query.prototype.select = function (cols, opts) {
    if (this.op === 'select') this.op = 'select';
    if (opts && opts.count) this._count = true;
    if (opts && opts.head) this._head = true;
    return this;
  };
  Query.prototype.eq = function (col, val) { this._filters.push([col, val]); return this; };
  Query.prototype.order = function (col, opts) { this._order = { col, asc: !opts || opts.ascending !== false }; return this; };
  Query.prototype.insert = function (rows) { this.op = 'insert'; this._payload = rows; return this; };
  Query.prototype.update = function (payload) { this.op = 'update'; this._payload = payload; return this; };
  Query.prototype.delete = function () { this.op = 'delete'; return this; };
  Query.prototype.upsert = function (rows, opts) { this.op = 'upsert'; this._payload = rows; this._conflict = opts && opts.onConflict; return this; };

  Query.prototype._match = function (row) { return this._filters.every(([c, v]) => row[c] === v); };

  Query.prototype._run = function () {
    const db = load();
    const t = this.table;
    try {
      if (this.op === 'insert') {
        const rows = Array.isArray(this._payload) ? this._payload : [this._payload];
        const arr = tableRows(db, t);
        const inserted = rows.map(r => {
          const row = Object.assign({ id: uuid() }, r);
          if (row.id == null) row.id = uuid();
          arr.push(row);
          return row;
        });
        save(db);
        return { data: inserted, error: null };
      }
      if (this.op === 'upsert') {
        const rows = Array.isArray(this._payload) ? this._payload : [this._payload];
        const key = this._conflict || 'id';
        const arr = tableRows(db, t);
        rows.forEach(r => {
          const idx = arr.findIndex(x => x[key] === r[key]);
          if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], r);
          else arr.push(Object.assign({ id: uuid() }, r));
        });
        save(db);
        return { data: rows, error: null };
      }
      if (this.op === 'update') {
        const arr = tableRows(db, t);
        let n = 0;
        arr.forEach((row, i) => { if (this._match(row)) { arr[i] = Object.assign({}, row, this._payload); n++; } });
        save(db);
        return { data: null, error: null, count: n };
      }
      if (this.op === 'delete') {
        const arr = tableRows(db, t);
        db[t] = arr.filter(row => !this._match(row));
        save(db);
        return { data: null, error: null };
      }
      // select
      let rows = tableRows(db, t).slice();
      if (this._filters.length) rows = rows.filter(r => this._match(r));
      if (this._order) {
        const { col, asc } = this._order;
        rows.sort((a, b) => {
          const av = a[col] == null ? 0 : a[col], bv = b[col] == null ? 0 : b[col];
          if (av < bv) return asc ? -1 : 1;
          if (av > bv) return asc ? 1 : -1;
          return 0;
        });
      }
      if (this._head) return { data: null, count: rows.length, error: null };
      return { data: rows, count: rows.length, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message || String(e) } };
    }
  };
  // make the builder awaitable
  Query.prototype.then = function (onF, onR) {
    return Promise.resolve().then(() => this._run()).then(onF, onR);
  };

  // ---------- auth ----------
  function getCred() {
    try { const c = JSON.parse(localStorage.getItem(CRED_KEY)); if (c && c.email) return c; } catch (_) {}
    return DEFAULT_CRED;
  }
  // sessionStorage (not localStorage) — the session ends when the tab/browser
  // closes, so every new browser session requires a fresh sign-in
  function getSessionRaw() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (_) { return null; }
  }
  const auth = {
    async getSession() { return { data: { session: getSessionRaw() }, error: null }; },
    async getUser() { const s = getSessionRaw(); return { data: { user: s ? s.user : null }, error: null }; },
    async signInWithPassword({ email, password }) {
      const cred = getCred();
      if ((email || '').trim().toLowerCase() !== cred.email.toLowerCase() || password !== cred.password) {
        return { data: { session: null, user: null }, error: { message: 'Invalid email or password.' } };
      }
      const user = { id: 'local-admin', email: cred.email };
      const session = { user, access_token: 'local', token_type: 'local', created_at: Date.now() };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { data: { session, user }, error: null };
    },
    async signOut() { sessionStorage.removeItem(SESSION_KEY); return { error: null }; }
  };

  // ---------- rpc ----------
  async function rpc(name) {
    if (name === 'is_admin') return { data: !!getSessionRaw(), error: null };
    return { data: null, error: { message: 'Unknown function ' + name } };
  }

  // ---------- storage (images stored inline as resized data URLs) ----------
  function resizeToDataURL(file, maxDim = 1500, quality = 0.82) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (Math.max(width, height) > maxDim) {
            const s = maxDim / Math.max(width, height);
            width = Math.round(width * s); height = Math.round(height * s);
          }
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            const type = /png/i.test(file.type) ? 'image/png' : 'image/jpeg';
            resolve(canvas.toDataURL(type, quality));
          } catch (_) { resolve(reader.result); }
        };
        img.onerror = () => resolve(reader.result);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
  function storageFrom(/* bucket */) {
    return {
      async upload(path, file) {
        const dataURL = await resizeToDataURL(file);
        if (!dataURL) return { data: null, error: { message: 'Could not read file' } };
        const db = load();
        db.media = db.media || {};
        db.media[path] = dataURL;
        const ok = save(db);
        if (!ok) return { data: null, error: { message: 'Local storage is full — delete some images or connect Supabase.' } };
        return { data: { path }, error: null };
      },
      getPublicUrl(path) {
        const db = load();
        return { data: { publicUrl: (db.media && db.media[path]) || path } };
      },
      async remove(paths) {
        const db = load(); db.media = db.media || {};
        (paths || []).forEach(p => delete db.media[p]);
        save(db);
        return { data: null, error: null };
      }
    };
  }

  // ---------- the emulated client ----------
  function makeClient() {
    return {
      __local: true,
      from: (table) => new Query(table),
      auth,
      rpc,
      storage: { from: storageFrom }
    };
  }

  window.RealteekLocal = {
    isLocal: true,
    makeClient,
    defaultCred: DEFAULT_CRED,
    getCred,
    setCred(email, password) {
      localStorage.setItem(CRED_KEY, JSON.stringify({ email, password }));
      // keep the active session's identity in sync so you stay signed in as the new email
      const s = getSessionRaw();
      if (s && s.user) { s.user.email = email; sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
    },
    resetData() { localStorage.removeItem(DB_KEY); },
    _load: load, _save: save
  };
})();
