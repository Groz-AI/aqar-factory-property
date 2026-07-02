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
      name: r.name, category: r.category, city: r.city, location: r.location,
      country: r.country, year: r.year, status: r.status, tagline: r.tagline, cover: r.cover,
      about: r.about || [], amenities: r.amenities || [], developer: r.developer,
      gallery: r.gallery || [], coords: [r.lat || 0, r.lng || 0],
      priceValue: Number(r.price_value) || 0, areaValue: Number(r.area_value) || 0, isRental: !!r.is_rental,
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

  const DEFAULT_CATS = [
    { filter: 'villas', label: 'Villas' }, { filter: 'apartments', label: 'Apartments' },
    { filter: 'duplex', label: 'Duplex Homes' }, { filter: 'townhouses', label: 'Townhouses' },
    { filter: 'studio', label: 'Studio Apartments' }, { filter: 'luxury', label: 'Luxury Villas' },
    { filter: 'retail', label: 'Retail Spaces' }, { filter: 'offices', label: 'Offices' }
  ];

  // ---------- live sync ----------
  // In local mode the "database" is localStorage; when the admin (in another
  // tab) writes a change, mirror it onto any open public page immediately.
  if (!cloud && window.RealteekLocal) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'realteek_db_v1') location.reload();
    });
  }

  window.store = {
    configured,
    getProjects:     () => fetchTable('projects', F.projects || [], mapProject),
    getProperties:   () => fetchTable('properties', F.properties || []),
    getCities:       () => fetchTable('cities', F.cities || []),
    getTestimonials: () => fetchTable('testimonials', F.testimonials || []),
    getDevelopers:   () => fetchTable('developers', F.developers || []),
    getCategories:   () => fetchTable('categories', DEFAULT_CATS),
    getContent
  };
})();
