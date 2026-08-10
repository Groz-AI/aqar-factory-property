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

  // shared clean-URL builder for project/unit/blog detail links — prefers
  // the item's Arabic slug on /ar/ pages when the admin set one, otherwise
  // reuses the same (English) slug on both languages
  window.buildUrl = function (kind, item) {
    const ar = !!(window.i18n && window.i18n.lang === 'ar');
    const slug = (ar && item.slugAr) ? item.slugAr : item.id;
    const base = kind === 'unit' ? '/unit/' : kind === 'blog' ? '/blog/' : '/project/';
    return (ar ? '/ar' : '') + base + encodeURIComponent(slug);
  };

  // map a DB project row to the shape pages expect
  function mapProject(r) {
    return {
      id: r.slug || r.id,
      slugAr: r.slug_ar || '',
      dbId: r.id,          // the real uuid primary key
      cityId: r.city_id || null,
      name: r.name, nameAr: r.name_ar || '', category: r.category, unitTypes: r.unit_types || [], city: r.city, location: r.location,
      country: r.country, year: r.year, status: r.status, tagline: r.tagline, cover: r.cover,
      about: r.about || [],
      // rich-content blocks for the About section; if a project hasn't been
      // opened in the new block editor yet (about_blocks empty), synthesize
      // one paragraph block per legacy about[] entry so it still renders
      aboutBlocks: (Array.isArray(r.about_blocks) && r.about_blocks.length)
        ? r.about_blocks
        : (r.about || []).map(p => ({ type: 'paragraph', text: p })),
      aboutBlocksAr: Array.isArray(r.about_blocks_ar) ? r.about_blocks_ar : [],
      amenities: r.amenities || [], developer: r.developer, developerId: r.developer_id || null, developerLogo: r.developer_logo || '',
      gallery: r.gallery || [], coords: [r.lat || 0, r.lng || 0],
      priceValue: Number(r.price_value) || 0, areaValue: Number(r.area_value) || 0, isRental: !!r.is_rental,
      brochurePdf: r.brochure_pdf || '', consultants: Array.isArray(r.consultants) ? r.consultants : [],
      stats: { price: r.price, units: r.units, floors: r.floors, area: r.area, handover: r.handover },
      seoTitle: r.seo_title || '', seoTitleAr: r.seo_title_ar || '',
      seoDescription: r.seo_description || '', seoDescriptionAr: r.seo_description_ar || '',
      createdAt: r.created_at || null, updatedAt: r.updated_at || null
    };
  }

  // map a DB unit row to the shape pages expect
  function mapUnit(r) {
    return {
      id: r.slug || r.id,
      slugAr: r.slug_ar || '',
      dbId: r.id,
      projectId: r.project_id || null,
      cityId: r.city_id || null,
      name: r.name, nameAr: r.name_ar || '',
      type: r.type, badge: r.badge,
      price: r.price, priceValue: Number(r.price_value) || 0,
      beds: r.beds || 0, baths: r.baths || 0,
      area: r.area, areaValue: Number(r.area_value) || 0,
      location: r.location,
      description: r.description || '', descriptionAr: r.description_ar || '',
      // rich-content blocks for the description (same editor as projects.aboutBlocks);
      // synthesize one paragraph block from the legacy plain text if a unit
      // hasn't been opened in the block editor yet
      descriptionBlocks: (Array.isArray(r.description_blocks) && r.description_blocks.length)
        ? r.description_blocks
        : (r.description || '').split(/\n+/).map(s => s.trim()).filter(Boolean).map(p => ({ type: 'paragraph', text: p })),
      descriptionBlocksAr: Array.isArray(r.description_blocks_ar) ? r.description_blocks_ar : [],
      cover: r.cover, gallery: r.gallery || [],
      coords: [r.lat || 0, r.lng || 0],
      developer: r.developer || '', developerId: r.developer_id || null,
      seoTitle: r.seo_title || '', seoTitleAr: r.seo_title_ar || '',
      seoDescription: r.seo_description || '', seoDescriptionAr: r.seo_description_ar || '',
      createdAt: r.created_at || null, updatedAt: r.updated_at || null
    };
  }

  // map a DB blog_posts row to the shape pages expect
  function mapBlogPost(r) {
    return {
      id: r.slug || r.id,
      dbId: r.id,
      title: r.title, titleAr: r.title_ar || '',
      excerpt: r.excerpt || '', excerptAr: r.excerpt_ar || '',
      cover: r.cover || '',
      authorName: r.author_name || '', authorAvatar: r.author_avatar || '',
      tags: Array.isArray(r.tags) ? r.tags : [],
      tagsAr: Array.isArray(r.tags_ar) ? r.tags_ar : [],
      blocks: Array.isArray(r.blocks) ? r.blocks : [],
      blocksAr: Array.isArray(r.blocks_ar) ? r.blocks_ar : [],
      publishedAt: r.published_at || r.created_at || null,
      seoTitle: r.seo_title || '', seoTitleAr: r.seo_title_ar || '',
      seoDescription: r.seo_description || '', seoDescriptionAr: r.seo_description_ar || ''
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

  // project categories + unit types are plain text on each project/unit row
  // (matched by name, not a foreign key), so a custom admin-added value has
  // no entry in i18n.js's static dictionary. Fetching this once and handing
  // the Arabic names to i18n.js's t() as a runtime fallback means every
  // existing t(project.category)/t(unit.type) call site across the site
  // picks it up automatically — no per-page changes needed.
  function mapCategory(r) { return { name: r.name, nameAr: r.name_ar || '', kind: r.kind }; }
  async function getCategories() {
    const rows = await fetchTable('categories', F.categories || [], mapCategory);
    const map = window.CATEGORY_NAMES_AR || {};
    (rows || []).forEach(c => { if (c.nameAr) map[c.name] = c.nameAr; });
    window.CATEGORY_NAMES_AR = map;
    return rows;
  }

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
      const TABLES = ['content_blocks', 'projects', 'cities', 'testimonials', 'developers', 'blog_posts', 'units'];
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
    getBlogPosts:    () => fetchTable('blog_posts', F.blogPosts || [], mapBlogPost),
    getUnits:        () => fetchTable('units', F.units || [], mapUnit),
    getCategories,
    getContent,
    getCompany,
    submitInquiry,
    submitNewsletter
  };
})();
