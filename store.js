/* ============================================================
   REALTEEK — public data layer
   store.getX() → live Supabase data when configured, else
   bundled FALLBACK so the site always renders.
   ============================================================ */
(function () {
  const cfg = window.SUPA || {};
  const cloud = window.supabase && cfg.url && !/YOUR_/.test(cfg.url) && cfg.anonKey && !/YOUR_/.test(cfg.anonKey);
  // real Supabase when configured, otherwise the local (localStorage) backend
  const sb = cloud ? window.supabase.createClient(cfg.url, cfg.anonKey)
           : (window.RealteekLocal ? window.RealteekLocal.makeClient() : null);
  const configured = cloud || !!(window.RealteekLocal);
  window.sb = sb;
  window.SUPA_READY = configured;

  const F = window.FALLBACK || {};

  // map a DB project row to the shape pages expect
  function mapProject(r) {
    return {
      id: r.slug || r.id,
      dbId: r.id,          // the real uuid primary key
      cityId: r.city_id || null,
      name: r.name, category: r.category, unitTypes: r.unit_types || [], city: r.city, location: r.location,
      country: r.country, year: r.year, status: r.status, tagline: r.tagline, cover: r.cover,
      about: r.about || [], amenities: r.amenities || [], developer: r.developer, developerLogo: r.developer_logo || '',
      gallery: r.gallery || [], coords: [r.lat || 0, r.lng || 0],
      priceValue: Number(r.price_value) || 0, areaValue: Number(r.area_value) || 0, isRental: !!r.is_rental,
      brochurePdf: r.brochure_pdf || '', consultants: Array.isArray(r.consultants) ? r.consultants : [],
      stats: { price: r.price, units: r.units, floors: r.floors, area: r.area, handover: r.handover }
    };
  }

  async function fetchTable(table, fallback, map) {
    if (!sb) return fallback;
    try {
      const { data, error } = await sb.from(table).select('*').eq('published', true).order('sort_order', { ascending: true });
      if (error || !data || !data.length) return fallback;
      return map ? data.map(map) : data;
    } catch (_) {
      return fallback;
    }
  }

  async function getContent() {
    if (!sb) return F.content || {};
    try {
      const { data, error } = await sb.from('content_blocks').select('key,value');
      if (error || !data || !data.length) return F.content || {};
      const out = { ...(F.content || {}) };
      data.forEach(row => { out[row.key] = row.value; });
      return out;
    } catch (_) {
      return F.content || {};
    }
  }

  // fetch a single content_blocks singleton, merged over its fallback default
  async function getBlock(key, fallback) {
    fallback = fallback || {};
    if (!sb) return fallback;
    try {
      const { data, error } = await sb.from('content_blocks').select('key,value').eq('key', key);
      if (error || !data || !data.length) return fallback;
      return Object.assign({}, fallback, data[0].value || {});
    } catch (_) {
      return fallback;
    }
  }

  const getCompany = () => getBlock('company', (F.content && F.content.company) || {});

  // ---------- inquiries (contact form) ----------
  async function submitInquiry(payload) {
    if (!sb) return { error: { message: 'No backend configured' } };
    try {
      const row = Object.assign({ status: 'new' }, payload || {});
      const { error } = await sb.from('inquiries').insert([row]);
      return { error: error || null };
    } catch (e) {
      return { error: { message: (e && e.message) || String(e) } };
    }
  }

  // ---------- newsletter (footer signup form) ----------
  async function submitNewsletter(email) {
    if (!sb) return { error: { message: 'No backend configured' } };
    try {
      const { error } = await sb.from('newsletter_subscribers').insert([{ email }]);
      return { error: error || null };
    } catch (e) {
      return { error: { message: (e && e.message) || String(e) } };
    }
  }

  // ---------- live sync ----------
  // Local mode: the "database" is localStorage; when the admin (in another
  // tab) writes a change, mirror it onto any open public page immediately.
  if (!cloud && window.RealteekLocal) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'realteek_db_v1') location.reload();
    });
  }

  // Cloud mode: subscribe to Supabase Realtime so an admin edit refreshes any
  // open public page within a moment (requires the tables to be in the
  // supabase_realtime publication — see schema.sql).
  if (cloud && sb && typeof sb.channel === 'function') {
    try {
      const TABLES = ['content_blocks', 'projects', 'cities', 'testimonials', 'developers'];
      let reloadT;
      const ch = sb.channel('realteek-public');
      TABLES.forEach(table => {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          clearTimeout(reloadT);
          reloadT = setTimeout(() => location.reload(), 400);
        });
      });
      ch.subscribe();
    } catch (_) { /* realtime not available — pages still update on next load */ }
  }

  window.store = {
    configured,
    getProjects:     () => fetchTable('projects', F.projects || [], mapProject),
    getCities:       () => fetchTable('cities', F.cities || []),
    getTestimonials: () => fetchTable('testimonials', F.testimonials || []),
    getDevelopers:   () => fetchTable('developers', F.developers || []),
    getContent,
    getCompany,
    submitInquiry,
    submitNewsletter
  };
})();
