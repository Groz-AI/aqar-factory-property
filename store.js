/* ============================================================
   REALTEEK — public data layer
   store.getX() → live Supabase data when configured, else
   bundled FALLBACK so the site always renders.
   ============================================================ */
(function () {
  const cfg = window.SUPA || {};
  const supaConfigured = !!(cfg.url && !/YOUR_/.test(cfg.url) && cfg.anonKey && !/YOUR_/.test(cfg.anonKey));
  const cloud = !!(window.supabase && supaConfigured);
  // real Supabase when configured, otherwise the local (localStorage) backend —
  // but ONLY fall back to the local mock when Supabase was never configured in
  // the first place (genuine local/demo mode). If real credentials ARE set but
  // the supabase-js CDN script simply failed to load this one time (ad-blocker,
  // network hiccup, a blocked CDN — all things this exact team hit while testing
  // this very site from a filtered network), `window.supabase` is missing even
  // though the real backend is the intended one. Treating that the same as
  // local-demo-mode used to silently swap every visitor to a small hardcoded
  // 8-project demo catalog and make the contact form / newsletter signup
  // insert into that visitor's own browser storage while reporting success —
  // a real lead vanishing with no error shown to them or to the business.
  // Leaving `sb` null here instead makes every store.js call fall through to
  // its own existing "not configured" branch: reads still show the bundled
  // fallback content (unchanged), but writes correctly report a real error.
  const sb = cloud ? window.supabase.createClient(cfg.url, cfg.anonKey)
           : (!supaConfigured && window.RealteekLocal) ? window.RealteekLocal.makeClient() : null;
  const configured = cloud || (!supaConfigured && !!window.RealteekLocal);
  window.sb = sb;
  window.SUPA_READY = configured;

  // fallback.js (the bundled demo/offline dataset, ~129 KB) is no longer a
  // static <script> tag on every page — it's only ever read here, in a
  // failure branch, so it's fetched on demand the first time one is hit and
  // cached as a promise (a second failure on the same page reuses it instead
  // of injecting the script twice).
  let fallbackPromise = null;
  function ensureFallback() {
    if (window.FALLBACK) return Promise.resolve(window.FALLBACK);
    if (!fallbackPromise) {
      fallbackPromise = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'fallback.js';
        s.onload = () => resolve(window.FALLBACK || {});
        s.onerror = () => resolve({});
        document.head.appendChild(s);
      });
    }
    return fallbackPromise;
  }
  const getF = () => window.FALLBACK || {};

  // shared clean-URL builder for project/unit/blog detail links — prefers
  // the item's Arabic slug on /ar/ pages when the admin set one, otherwise
  // reuses the same (English) slug on both languages. Strips any stray
  // leading/trailing slash from the slug itself (admin.js now sanitizes on
  // save so this shouldn't happen going forward, but a bad value here would
  // otherwise produce a double-slash URL that 404s for everyone — defense
  // in depth against older data or any other path a slug could arrive by).
  window.buildUrl = function (kind, item) {
    const ar = !!(window.i18n && window.i18n.lang === 'ar');
    const slug = String((ar && item.slugAr) ? item.slugAr : item.id).replace(/^\/+|\/+$/g, '');
    const base = kind === 'unit' ? '/unit/' : kind === 'blog' ? '/blog/' : '/project/';
    return (ar ? '/ar' : '') + base + encodeURIComponent(slug);
  };

  // Some admin-entered texts hold both languages as "English | Arabic" (either
  // order). Cards show only the side that matches the page language.
  window.biText = function (s) {
    if (typeof s !== 'string' || s.indexOf(' | ') < 0) return s;
    const parts = s.split(' | ').map(x => x.trim()).filter(Boolean);
    if (parts.length !== 2) return s;
    const hasAr = x => /[؀-ۿ]/.test(x);
    if (hasAr(parts[0]) === hasAr(parts[1])) return s;
    const arPart = hasAr(parts[0]) ? parts[0] : parts[1], enPart = hasAr(parts[0]) ? parts[1] : parts[0];
    return (window.i18n && window.i18n.lang === 'ar') ? arPart : enPart;
  };
  // city names in project / unit rows are plain English text; the Arabic name
  // lives on the cities row (name_ar) — pages register those, cityText() uses them
  const cityArMap = {};
  window.registerCities = function (rows) {
    (rows || []).forEach(c => { if (c && c.name && c.name_ar) cityArMap[c.name] = c.name_ar; });
  };
  window.cityText = function (n) {
    const v = window.biText(n);
    return (window.i18n && window.i18n.lang === 'ar' && cityArMap[v]) || v;
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
      faqs: Array.isArray(r.faqs) ? r.faqs : [], faqsAr: Array.isArray(r.faqs_ar) ? r.faqs_ar : [],
      amenities: r.amenities || [], developer: r.developer, developerId: r.developer_id || null, developerLogo: r.developer_logo || '',
      gallery: r.gallery || [], coords: [r.lat || 0, r.lng || 0],
      priceValue: Number(r.price_value) || 0, areaValue: Number(r.area_value) || 0, isRental: !!r.is_rental,
      brochurePdf: r.brochure_pdf || '', consultants: Array.isArray(r.consultants) ? r.consultants : [],
      stats: { price: r.price, units: r.units, floors: r.floors, area: r.area, handover: r.handover },
      seoTitle: r.seo_title || '', seoTitleAr: r.seo_title_ar || '',
      seoDescription: r.seo_description || '', seoDescriptionAr: r.seo_description_ar || '',
      isFeatured: !!r.is_featured, readyToMove: !!r.ready_to_move,
      // construction-progress checkpoints (admin-edited), oldest first —
      // { title, title_ar, status, status_ar, date, desc, desc_ar, photos[] }
      timeline: Array.isArray(r.timeline) ? r.timeline : [],
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
      faqs: Array.isArray(r.faqs) ? r.faqs : [], faqsAr: Array.isArray(r.faqs_ar) ? r.faqs_ar : [],
      cover: r.cover, gallery: r.gallery || [],
      coords: [r.lat || 0, r.lng || 0],
      developer: r.developer || '', developerId: r.developer_id || null,
      seoTitle: r.seo_title || '', seoTitleAr: r.seo_title_ar || '',
      seoDescription: r.seo_description || '', seoDescriptionAr: r.seo_description_ar || '',
      isFeatured: !!r.is_featured, readyToMove: !!r.ready_to_move,
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

  // Listing pages only need what a CARD shows. Pulling select('*') used to
  // download every project's long-form about blocks, FAQs and SEO text on every
  // page view (~5 MB); the detail pages still fetch the full row (fetchOne).
  const LIST_COLS = {
    projects: 'id,slug,slug_ar,name,name_ar,category,city,location,country,year,status,tagline,cover,about,developer,developer_id,developer_logo,price,units,floors,area,handover,price_value,area_value,is_rental,lat,lng,gallery,sort_order,published,city_id,unit_types,consultants,is_featured,ready_to_move',
    units: 'id,slug,slug_ar,name,name_ar,type,badge,price,price_value,beds,baths,area,area_value,location,description,cover,gallery,project_id,city_id,lat,lng,sort_order,published,developer_id,developer,is_featured,ready_to_move'
  };

  // Short per-tab cache so moving between pages doesn't re-download the same
  // lists. 60 s keeps admin edits showing up quickly.
  const CACHE_MS = 60000;
  function cacheGet(table) {
    try {
      const c = JSON.parse(sessionStorage.getItem('rt_list_' + table) || 'null');
      if (c && Date.now() - c.t < CACHE_MS && Array.isArray(c.d) && c.d.length) return c.d;
    } catch (_) {}
    return null;
  }
  function cacheSet(table, rows) {
    try { sessionStorage.setItem('rt_list_' + table, JSON.stringify({ t: Date.now(), d: rows })); } catch (_) {}
  }

  // the complete published list: tab cache → CDN copy → database; null if none worked
  async function fetchFullRows(table) {
    const cached = cacheGet(table);
    if (cached) return cached;
    // straight from the database (there is no server function in front of it)
    try {
      const { data, error } = await sb.from(table).select(LIST_COLS[table] || '*').eq('published', true).order('sort_order', { ascending: true });
      if (error || !data || !data.length) return null;
      cacheSet(table, data);
      return data;
    } catch (_) {
      return null;
    }
  }

  // api/preload.js may send a list as "partial" (window.__PRELOAD_PARTIAL): rows
  // the page draws are whole, the rest carry only a few facts. quick:true asks
  // for exactly those rows (first paint); anything else gets the complete list,
  // fetched once and shared.
  const fullMemo = {};
  async function fetchTable(table, fallbackKey, map, quick) {
    async function fallback() {
      await ensureFallback();
      const d = getF()[fallbackKey] || [];
      return map ? d.map(map) : d;
    }
    if (!sb) return fallback();
    // rows the server already put in the page (api/preload.js)
    const pre = window.__PRELOAD && window.__PRELOAD[table];
    if (Array.isArray(pre) && pre.length) {
      const partial = !!(window.__PRELOAD_PARTIAL && window.__PRELOAD_PARTIAL[table]);
      // a page built ahead of time (__PRELOAD_STATIC) paints from its inlined rows (quick), and anything
      // that asks for the real list gets the current one from the database
      const stale = !!window.__PRELOAD_STATIC;
      if ((!partial && !stale) || quick) return map ? pre.map(map) : pre;
      if (!fullMemo[table]) fullMemo[table] = fetchFullRows(table);
      const rows = await fullMemo[table];
      // could not load the complete list: the partial rows are still real data
      return map ? (rows || pre).map(map) : (rows || pre);
    }
    const rows = await fetchFullRows(table);
    if (!rows) return fallback();
    return map ? rows.map(map) : rows;
  }

  // fetches a single row by its (English or Arabic) slug instead of
  // downloading the whole table just to find one match client-side — a
  // detail page's primary content only ever needs the one row. Two narrow
  // .eq() queries run in parallel (rather than one .or() filter) so this
  // also works unmodified against local-backend.js's mock query builder,
  // which doesn't implement .or()/.maybeSingle(). Falls back to a plain
  // array search over the bundled fallback data (already in public shape,
  // same as fetchTable's fallback branch above) when no backend is configured.
  async function fetchOne(table, slug, fallbackKey, map) {
    if (!sb) {
      await ensureFallback();
      const d = getF()[fallbackKey] || [];
      return d.find(r => r.id === slug || r.slugAr === slug) || null;
    }
    try {
      const [bySlug, bySlugAr] = await Promise.all([
        sb.from(table).select('*').eq('published', true).eq('slug', slug).limit(1),
        sb.from(table).select('*').eq('published', true).eq('slug_ar', slug).limit(1)
      ]);
      const row = (bySlug.data && bySlug.data[0]) || (bySlugAr.data && bySlugAr.data[0]);
      return row ? map(row) : null;
    } catch (_) {
      return null;
    }
  }

  // content_blocks is tiny (a handful of singleton rows) but gets asked for by
  // several independent widgets on the SAME page — branding.js (header logo),
  // card-contact.js, whatsapp-widget.js, and the page's own script all want
  // the company profile, and each used to trigger its own fresh fetch. This
  // cache is just a module-level promise: it resets naturally on every real
  // page load (a fresh store.js instance runs each time), so nothing gets
  // staler than before — it only stops the SAME page from re-fetching the
  // SAME row four times over.
  let contentPromise = null;
  async function getContent() {
    if (!sb) { await ensureFallback(); return getF().content || {}; }
    if (!contentPromise) {
      contentPromise = (async () => {
        try {
          const { data, error } = await sb.from('content_blocks').select('key,value');
          if (error || !data || !data.length) { await ensureFallback(); return getF().content || {}; }
          const out = { ...(getF().content || {}) };
          data.forEach(row => { out[row.key] = row.value; });
          return out;
        } catch (_) {
          await ensureFallback();
          return getF().content || {};
        }
      })();
    }
    return contentPromise;
  }

  // derived from getContent()'s cached fetch rather than its own query — every
  // caller wanting just the company profile now shares that one fetch instead
  // of adding another
  async function getCompany() {
    const content = await getContent();
    const fc = getF().content;
    return Object.assign({}, (fc && fc.company) || {}, content.company || {});
  }

  // project categories + unit types are plain text on each project/unit row
  // (matched by name, not a foreign key), so a custom admin-added value has
  // no entry in i18n.js's static dictionary. Fetching this once and handing
  // the Arabic names to i18n.js's t() as a runtime fallback means every
  // existing t(project.category)/t(unit.type) call site across the site
  // picks it up automatically — no per-page changes needed.
  function mapCategory(r) { return { name: r.name, nameAr: r.name_ar || '', kind: r.kind }; }
  async function getCategories() {
    const rows = await fetchTable('categories', 'categories', mapCategory);
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

  // ---------- follow a project ("تابع مشروعك") ----------
  // One row per followed project. Visitors have no accounts, so the table is
  // insert-only for them (see schema.sql); a project already followed with
  // the same phone hits the unique key, which is treated as success so the
  // visitor never learns whether a number was already registered.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validProjectId = (id) => (cloud ? UUID_RE.test(String(id || '')) : !!id);

  // `who.token` is a random secret the browser keeps; it is stored with each row so
  // that unfollowProject() can later prove ownership (see supabase/add-unfollow.sql).
  // Returns the ids that were newly followed (`added`) and the ones that were already
  // followed with this number, e.g. from another browser (`existing`) — only `added`
  // can be unfollowed from this browser.
  async function followProjects(projectDbIds, who) {
    if (!sb) return { error: { message: 'No backend configured' } };
    const ids = [...new Set(projectDbIds || [])].filter(validProjectId);
    const name = String((who && who.name) || '').trim();
    const phone = String((who && who.phone) || '').trim();
    const token = String((who && who.token) || '');
    if (!ids.length) return { error: { message: 'No valid project selected' } };
    if (!name || !phone) return { error: { message: 'Name and phone are required' } };
    const isDup = (e) => e && (e.code === '23505' || /duplicate|unique/i.test(e.message || ''));
    // before supabase/add-unfollow.sql has been run the column does not exist yet;
    // following must keep working then (just without a way to unfollow)
    const noColumn = (e) => e && /unfollow_token/i.test(e.message || '');
    try {
      const results = await Promise.all(ids.map(async pid => {
        const row = { project_id: pid, name, phone };
        if (token) row.unfollow_token = token;
        let r = await sb.from('project_followers').insert([row]);
        if (r && noColumn(r.error)) { delete row.unfollow_token; r = await sb.from('project_followers').insert([row]); r.noToken = true; }
        return r;
      }));
      const failed = results.map(r => r && r.error).filter(e => e && !isDup(e));
      const added = ids.filter((_, i) => !results[i].error && !results[i].noToken);
      const existing = ids.filter((_, i) => isDup(results[i].error));
      return { error: failed[0] || null, ids, added, existing };
    } catch (e) {
      return { error: { message: (e && e.message) || String(e) } };
    }
  }

  // Remove one follow, proving ownership with the secret kept in this browser. A follow
  // that is already gone counts as success (the visitor wanted it gone).
  async function unfollowProject(projectDbId, token) {
    if (!sb) return { error: { message: 'No backend configured' } };
    if (!validProjectId(projectDbId) || !token) return { error: { message: 'Missing details' } };
    try {
      if (cloud) {
        const { error } = await sb.rpc('unfollow_project', { p_project_id: projectDbId, p_token: token });
        return { error: error || null };
      }
      // local demo mode has no database functions: delete the matching row directly
      const { error } = await sb.from('project_followers').delete().eq('project_id', projectDbId).eq('unfollow_token', token);
      return { error: error || null };
    } catch (e) {
      return { error: { message: (e && e.message) || String(e) } };
    }
  }

  // Which projects does this phone number follow? Returns { ids } or { error }.
  // Cloud: the my_followed_projects() function (ids only; see add-follow-lookup.sql).
  async function getFollowedIdsByPhone(phone) {
    if (!sb) return { error: { message: 'No backend configured' } };
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 8) return { ids: [] };
    try {
      if (cloud) {
        const { data, error } = await sb.rpc('my_followed_projects', { p_phone: phone });
        if (error) return { error };
        return { ids: [...new Set((data || []).map(r => r.project_id).filter(Boolean))] };
      }
      const { data, error } = await sb.from('project_followers').select('project_id,phone');
      if (error) return { error };
      const tail = (s) => String(s || '').replace(/\D/g, '').slice(-10);
      return { ids: [...new Set((data || []).filter(r => tail(r.phone) === tail(phone)).map(r => r.project_id))] };
    } catch (e) {
      return { error: { message: (e && e.message) || String(e) } };
    }
  }

  // full rows (incl. the timeline) for just the projects a visitor follows —
  // the list endpoints stay slim, so this is its own small query
  async function getFollowedProjects(dbIds) {
    const ids = [...new Set(dbIds || [])].filter(validProjectId);
    if (!sb || !ids.length) return [];
    try {
      const { data, error } = await sb.from('projects')
        .select('id,slug,slug_ar,name,name_ar,cover,city,timeline')
        .eq('published', true).in('id', ids);
      return error || !data ? [] : data.map(mapProject);
    } catch (_) {
      return [];
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

  // makes `el` read "<prefix><developer name>" with the name linking to that
  // developer's page (/developer/<slug>); leaves the plain text when it has none
  window.linkDeveloper = async function (el, devId, devName, prefix) {
    if (!el || (!devId && !devName)) return;
    try {
      const devs = await window.store.getDevelopers();
      const d = (devs || []).find(x => devId ? x.id === devId : x.name === devName);
      const S = window.SchemaHelpers;
      const slug = d && S && S.entityUrlSlug ? S.entityUrlSlug(d) : '';
      if (!slug) return;
      const ar = !!(window.i18n && window.i18n.lang === 'ar');
      const a = document.createElement('a');
      a.href = (ar ? '/ar' : '') + '/developer/' + encodeURIComponent(slug);
      a.textContent = (ar && d.name_ar) || devName || d.name;
      el.textContent = prefix || '';
      el.appendChild(a);
    } catch (_) { /* keep the plain text */ }
  };

  window.store = {
    configured,
    getProjects:     (o) => fetchTable('projects', 'projects', mapProject, !!(o && o.quick)),
    getCities:       () => fetchTable('cities', 'cities'),
    getTestimonials: () => fetchTable('testimonials', 'testimonials'),
    getDevelopers:   () => fetchTable('developers', 'developers'),
    getBlogPosts:    () => fetchTable('blog_posts', 'blogPosts', mapBlogPost),
    getUnits:        (o) => fetchTable('units', 'units', mapUnit, !!(o && o.quick)),
    getProjectBySlug: (slug) => fetchOne('projects', slug, 'projects', mapProject),
    getUnitBySlug:    (slug) => fetchOne('units', slug, 'units', mapUnit),
    getCategories,
    getContent,
    getCompany,
    submitInquiry,
    submitNewsletter,
    followProjects,
    unfollowProject,
    getFollowedIdsByPhone,
    getFollowedProjects
  };
})();
