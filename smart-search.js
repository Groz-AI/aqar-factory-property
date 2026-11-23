/* ============================================================
   AQAR FACTORY — unified smart search (homepage hero)
   ------------------------------------------------------------
   Searches Projects, Units and Developers together — no tab
   needed first. A developer's name (English or Arabic) also finds the
   projects and units it owns.
   Text search + city apply immediately; "Advanced"
   expands a richer filter panel (type, price range, area range,
   bedrooms, sort) that live-narrows the same combined results grid.
   Relies on globals from script.js (IMG, cycleGalleries, t,
   initCustomSelect) and window.cardContact / window.formatPrice
   from card-contact.js — all loaded before this file.
   ============================================================ */
(function () {
  'use strict';

  const form = document.getElementById('searchBar');
  if (!form) return; // this module only runs on the homepage

  const t = window.t || ((s) => s);
  const searchInput = document.getElementById('smartSearchInput');
  const advToggleBtn = document.getElementById('advToggleBtn');
  const advPanel = document.getElementById('advPanel');
  const kindChipsEl = document.getElementById('kindChips');
  const typeChipsEl = document.getElementById('advTypeChips');
  const bedsChipsEl = document.getElementById('bedsChips');
  const advSort = document.getElementById('advSort');
  const advReset = document.getElementById('advReset');
  const priceSliderEl = document.getElementById('priceSlider');
  const areaSliderEl = document.getElementById('areaSlider');
  const resultsWrap = document.getElementById('smartResults');
  const resultsGrid = document.getElementById('smartResultsGrid');
  const resultsCount = document.getElementById('smartResultsCount');
  const resultsClear = document.getElementById('smartResultsClear');

  let COMBINED = [];
  let DEVS = []; // developer cards: shown only for a text search (they have no price / type / city)
  let cityOptions = [];
  let searchCitySelect = null;
  let priceSlider = null;
  let areaSlider = null;
  let advOpen = false;
  let hasSearched = false; // true once the visitor has actually searched — makes "Search" deterministic

  const state = { q: '', city: '', kind: 'all', type: 'all', beds: 'any', sort: 'featured', priceMin: 0, priceMax: 0, areaMin: 0, areaMax: 0 };
  let priceBounds = [0, 0];
  let areaBounds = [0, 0];

  /* ---------- helpers ---------- */
  const escHTML = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
  function pick(o, key, arKey) {
    if (isAr()) {
      const v = o[arKey];
      if (v) return window.biText(v);
    }
    return window.biText(o[key]);
  }

  function debounce(fn, ms) {
    let tid;
    return (...args) => { clearTimeout(tid); tid = setTimeout(() => fn(...args), ms); };
  }

  // spelling-insensitive text for matching: case, Arabic diacritics and the usual letter variants
  // (ا أ إ آ / ى ي / ة ه) are ignored, so "القمزي" finds "القمزى"
  const norm = (s) => String(s == null ? '' : s).toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[\s\-_.,&()/]+/g, ' ').trim();
  // every word of the query must appear somewhere in the item's text
  const matchesQuery = (hay, q) => { const w = norm(q); return !w || w.split(' ').every(x => hay.includes(x)); };

  /* ---------- combined dataset ---------- */
  // a unit's real city usually only exists via its linked project's cityId
  // (or, rarely, its own cityId) — its free-text `location` field is a street
  // address, not the city name, so filtering on it alone (as this used to do)
  // silently missed units whose location text doesn't happen to mention the
  // city. Mirrors units.js's own resolution so the homepage search's city
  // filter agrees with units.html's.
  function resolveUnitCity(u, projectsByDbId, cityById) {
    const linkedProject = u.projectId ? projectsByDbId[u.projectId] : null;
    const cityId = linkedProject ? linkedProject.cityId : u.cityId;
    const cityRow = cityId ? cityById[cityId] : null;
    return (linkedProject && linkedProject.city) || (cityRow && cityRow.name) || u.location || '';
  }
  function buildCombined(projects, units, cities, devs) {
    const devById = {};
    (devs || []).forEach(d => { devById[d.id] = d; });
    const projectsByDbId = {};
    (projects || []).forEach(p => { if (p.dbId) projectsByDbId[p.dbId] = p; });
    const cityById = {};
    (cities || []).forEach(c => { cityById[c.id] = c; });

    const linkedProjectOf = (u) => (u.projectId ? projectsByDbId[u.projectId] : null);
    const unitDevId = (u) => u.developerId || (linkedProjectOf(u) && linkedProjectOf(u).developerId) || null;
    const pItems = (projects || []).map(p => ({
      _kind: 'project', id: p.id, slugAr: p.slugAr || '', name: p.name, nameAr: p.nameAr || '', city: p.city || p.location || '',
      type: p.category, price: (p.stats && p.stats.price) || '', priceValue: Number(p.priceValue) || 0,
      area: (p.stats && p.stats.area) || '', areaValue: Number(p.areaValue) || 0, beds: 0,
      cover: p.cover, gallery: p.gallery,
      devName: (devById[p.developerId] && devById[p.developerId].name) || p.developer || '', devNameAr: (devById[p.developerId] && devById[p.developerId].name_ar) || ''
    }));
    const uItems = (units || []).map(u => ({
      _kind: 'unit', id: u.id, slugAr: u.slugAr || '', name: u.name, nameAr: u.nameAr || '', city: resolveUnitCity(u, projectsByDbId, cityById),
      type: u.type, price: u.price || '', priceValue: Number(u.priceValue) || 0,
      area: u.area || '', areaValue: Number(u.areaValue) || 0, beds: Number(u.beds) || 0,
      cover: u.cover, gallery: u.gallery,
      devName: (devById[unitDevId(u)] && devById[unitDevId(u)].name) || u.developer || (linkedProjectOf(u) && linkedProjectOf(u).developer) || '',
      devNameAr: (devById[unitDevId(u)] && devById[unitDevId(u)].name_ar) || ''
    }));
    // the text each item is matched against (name, city, type and its developer, in both languages)
    const all = pItems.concat(uItems);
    all.forEach(it => { it._hay = norm(`${it.name} ${it.nameAr} ${it.city} ${it.type} ${it.devName} ${it.devNameAr}`); });
    return all;
  }

  // one card per published developer (found by name, never browsed): how many projects it has and its page
  function buildDevelopers(projects, devs) {
    const counts = {}, byName = {};
    (projects || []).forEach(p => {
      if (p.developerId) counts[p.developerId] = (counts[p.developerId] || 0) + 1;
      else if (p.developer) byName[p.developer] = (byName[p.developer] || 0) + 1;
    });
    const S = window.SchemaHelpers;
    return (devs || []).map(d => {
      const slug = S && S.entityUrlSlug ? S.entityUrlSlug(d) : '';
      return { _kind: 'developer', id: d.id, name: d.name || '', nameAr: d.name_ar || '', logo: d.logo || '', slug,
        count: counts[d.id] || byName[d.name] || 0, _hay: norm(`${d.name || ''} ${d.name_ar || ''}`) };
    }).sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
  }

  function typesFor(kind) {
    if (kind === 'developer') return [];
    const pool = kind === 'unit' ? COMBINED.filter(i => i._kind === 'unit')
      : kind === 'project' ? COMBINED.filter(i => i._kind === 'project')
      : COMBINED;
    return [...new Set(pool.map(i => i.type).filter(Boolean))];
  }

  /* ---------- dual-range slider ---------- */
  function makeDualSlider(container, { min, max, step, formatLabel }) {
    if (max <= min) max = min + 1;
    container.innerHTML = `
      <div class="ds-track"><div class="ds-range"></div></div>
      <input type="range" class="ds-input ds-min" min="${min}" max="${max}" step="${step}" value="${min}">
      <input type="range" class="ds-input ds-max" min="${min}" max="${max}" step="${step}" value="${max}">
      <div class="ds-labels"><span class="ds-min-label"></span><span class="ds-max-label"></span></div>`;
    const minInput = container.querySelector('.ds-min');
    const maxInput = container.querySelector('.ds-max');
    const range = container.querySelector('.ds-range');
    const minLabel = container.querySelector('.ds-min-label');
    const maxLabel = container.querySelector('.ds-max-label');

    function paint() {
      const lo = Number(minInput.value), hi = Number(maxInput.value);
      const pct = v => ((v - min) / (max - min)) * 100;
      range.style.insetInlineStart = pct(lo) + '%';
      range.style.insetInlineEnd = (100 - pct(hi)) + '%';
      minLabel.textContent = formatLabel(lo);
      maxLabel.textContent = formatLabel(hi);
    }
    let onChange = () => {};
    function fire() { onChange(Number(minInput.value), Number(maxInput.value)); }
    minInput.addEventListener('input', () => {
      if (Number(minInput.value) > Number(maxInput.value)) minInput.value = maxInput.value;
      paint(); fire();
    });
    maxInput.addEventListener('input', () => {
      if (Number(maxInput.value) < Number(minInput.value)) maxInput.value = minInput.value;
      paint(); fire();
    });
    paint();
    return {
      onChange(fn) { onChange = fn; },
      reset() { minInput.value = min; maxInput.value = max; paint(); fire(); },
      setBounds(newMin, newMax) {
        min = newMin; max = Math.max(newMax, newMin + 1);
        minInput.min = maxInput.min = min; minInput.max = maxInput.max = max;
        minInput.value = min; maxInput.value = max;
        paint();
      }
    };
  }

  function priceLabel(v) { return window.formatPrice ? window.formatPrice(String(Math.round(v))) : String(Math.round(v)); }
  function areaLabel(v) { return Math.round(v) + ' m²'; }

  /* ---------- chip groups ---------- */
  function renderKindChips() {
    const opts = [
      { value: 'all', label: t('All') },
      { value: 'project', label: t('Projects') },
      { value: 'unit', label: t('Units') },
      { value: 'developer', label: t('Developers') }
    ];
    kindChipsEl.innerHTML = opts.map(o =>
      `<button type="button" class="chip${state.kind === o.value ? ' active' : ''}" data-value="${o.value}">${o.label}</button>`).join('');
  }
  function renderTypeChips() {
    const types = typesFor(state.kind);
    if (state.type !== 'all' && !types.includes(state.type)) state.type = 'all';
    const opts = [{ value: 'all', label: t('All') }].concat(types.map(ty => ({ value: ty, label: t(ty) })));
    typeChipsEl.innerHTML = opts.map(o =>
      `<button type="button" class="chip${state.type === o.value ? ' active' : ''}" data-value="${escHTML(o.value)}">${escHTML(o.label)}</button>`).join('');
  }
  function renderBedsChips() {
    const opts = [
      { value: 'any', label: t('Any') },
      { value: '1', label: '1+' },
      { value: '2', label: '2+' },
      { value: '3', label: '3+' },
      { value: '4+', label: '4+' }
    ];
    bedsChipsEl.innerHTML = opts.map(o =>
      `<button type="button" class="chip${state.beds === o.value ? ' active' : ''}" data-value="${o.value}">${o.label}</button>`).join('');
  }

  function wireChipGroup(el, onPick) {
    el.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn || btn.classList.contains('active')) return;
      el.querySelector('.active')?.classList.remove('active');
      btn.classList.add('active');
      onPick(btn.dataset.value);
    });
  }

  /* ---------- filter + sort + render ---------- */
  function getFiltered() {
    const q = state.q.trim();
    const priceNarrowed = state.priceMin > priceBounds[0] || state.priceMax < priceBounds[1];
    const areaNarrowed = state.areaMin > areaBounds[0] || state.areaMax < areaBounds[1];
    // developers match by name only: a type / city / bedrooms / price / area filter excludes them
    const devs = (q && (state.kind === 'all' || state.kind === 'developer') && state.type === 'all' && !state.city
      && state.beds === 'any' && !priceNarrowed && !areaNarrowed)
      ? DEVS.filter(d => matchesQuery(d._hay, q)) : [];
    if (state.kind === 'developer') return devs;
    return devs.concat(COMBINED.filter(it => {
      if (state.kind !== 'all' && it._kind !== state.kind) return false;
      if (state.type !== 'all' && it.type !== state.type) return false;
      if (state.city && !it.city.toLowerCase().includes(state.city.toLowerCase())) return false;
      if (it.priceValue > 0 && (it.priceValue < state.priceMin || it.priceValue > state.priceMax)) return false;
      if (it.areaValue > 0 && (it.areaValue < state.areaMin || it.areaValue > state.areaMax)) return false;
      if (state.beds !== 'any' && it._kind === 'unit') {
        const need = state.beds === '4+' ? 4 : Number(state.beds);
        if (state.beds === '4+' ? it.beds < 4 : it.beds !== need) return false;
      }
      if (q && !matchesQuery(it._hay, q)) return false;
      return true;
    }));
  }

  function sortList(list) {
    const byNum = (key, dir) => (a, b) => dir * ((a[key] || 0) - (b[key] || 0));
    switch (state.sort) {
      case 'price-asc': return list.sort(byNum('priceValue', 1));
      case 'price-desc': return list.sort(byNum('priceValue', -1));
      case 'area-desc': return list.sort(byNum('areaValue', -1));
      case 'newest': return list.slice().reverse();
      default: return list;
    }
  }

  function devCardHTML(d) {
    const nm = (isAr() && d.nameAr) ? d.nameAr : d.name;
    const href = `${isAr() ? '/ar' : ''}/developer/${encodeURIComponent(d.slug)}`;
    const pic = d.logo
      ? `<img class="pg-slide active" src="${IMG(d.logo, 400)}" alt="${escHTML(nm)}" width="400" height="300" loading="lazy" decoding="async">`
      : `<span class="dev-initial" aria-hidden="true">${escHTML(String(nm || '·').charAt(0))}</span>`;
    const label = d.count === 0 ? t('No projects yet') : d.count === 1 ? t('1 Project') : `${d.count.toLocaleString()} ${t('Projects')}`;
    return `
    <a class="project reveal is-dev" href="${href}">
      <div class="project-img">${pic}<span class="result-kind-badge developer">${t('Developer')}</span></div>
      <div class="project-body">
        <h3>${escHTML(nm)}</h3>
        <p>${label}</p>
        <div class="project-foot"><span>${d.count === 0 ? t('View developer') : t('View projects')}</span><span></span></div>
      </div>
    </a>`;
  }

  function cardHTML(it) {
    if (it._kind === 'developer') return devCardHTML(it);
    const imgs = (it.gallery && it.gallery.length ? it.gallery : [it.cover]).filter(Boolean).slice(0, 5);
    const altName = String(pick(it, 'name', 'nameAr') || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const slides = imgs.map((g, i) => i === 0
      ? `<img class="pg-slide active" src="${IMG(g, 900)}" alt="${altName}" width="900" height="600" loading="lazy" decoding="async">`
      : `<div class="pg-slide" data-bg="${IMG(g, 900)}"></div>`).join('');
    const dots = imgs.length > 1 ? `<div class="pg-dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
    const href = window.buildUrl(it._kind === 'unit' ? 'unit' : 'project', it);
    const kindBadge = `<span class="result-kind-badge ${it._kind}">${t(it._kind === 'unit' ? 'Unit' : 'Project')}</span>`;
    const contact = window.cardContact ? window.cardContact.markup(pick(it, 'name', 'nameAr')) : '';
    return `
    <a class="project reveal" href="${href}">
      <div class="project-img" data-gallery>${slides}<div class="pg-shade"></div>${dots}${kindBadge}${contact}</div>
      <div class="project-body">
        <span class="project-tag">${it.type ? t(it.type) : ''}</span>
        <h3>${escHTML(pick(it, 'name', 'nameAr'))}</h3>
        <p>${escHTML(window.cityText(it.city))}</p>
        <div class="project-foot"><span>${escHTML(it.area)}</span><span>${window.formatPrice ? window.formatPrice(it.price) : (it.price || '')}</span></div>
      </div>
    </a>`;
  }

  function activeFilterCount() {
    let n = 0;
    if (state.q) n++;
    if (state.city) n++;
    if (state.kind !== 'all') n++;
    if (state.type !== 'all') n++;
    if (state.beds !== 'any') n++;
    if (state.priceMin > priceBounds[0] || state.priceMax < priceBounds[1]) n++;
    if (state.areaMin > areaBounds[0] || state.areaMax < areaBounds[1]) n++;
    return n;
  }

  // when the exact filters match nothing, rank every item by how close it
  // comes instead of just saying "no results" — same idea as the AI
  // matchmaker's scoring, so "no exact match" still surfaces useful picks
  function scoreSimilar(it) {
    let score = 0;
    if (state.kind !== 'all') score += it._kind === state.kind ? 3 : 0;
    if (state.type !== 'all') score += it.type === state.type ? 3 : 0;
    if (state.city) score += it.city.toLowerCase().includes(state.city.toLowerCase()) ? 3 : 0;
    if (state.beds !== 'any' && it._kind === 'unit') {
      const need = state.beds === '4+' ? 4 : Number(state.beds);
      const hit = state.beds === '4+' ? it.beds >= 4 : it.beds === need;
      score += hit ? 2 : (it.beds > 0 ? 0.5 : 0);
    }
    const priceNarrowed = state.priceMin > priceBounds[0] || state.priceMax < priceBounds[1];
    if (priceNarrowed && it.priceValue > 0) {
      const mid = (state.priceMin + state.priceMax) / 2;
      const span = (priceBounds[1] - priceBounds[0]) || 1;
      score += Math.max(0, 2 - (Math.abs(it.priceValue - mid) / span) * 4);
    }
    const areaNarrowed = state.areaMin > areaBounds[0] || state.areaMax < areaBounds[1];
    if (areaNarrowed && it.areaValue > 0) {
      const mid = (state.areaMin + state.areaMax) / 2;
      const span = (areaBounds[1] - areaBounds[0]) || 1;
      score += Math.max(0, 2 - (Math.abs(it.areaValue - mid) / span) * 4);
    }
    const q = state.q.trim().toLowerCase();
    if (q) {
      const hay = `${it.name} ${it.nameAr} ${it.city} ${it.type} ${it.devName || ''} ${it.devNameAr || ''}`.toLowerCase();
      if (hay.includes(q)) score += 4;
      else if (q.split(/\s+/).some(w => w.length > 2 && hay.includes(w))) score += 1.5;
    }
    return score;
  }

  function render() {
    const active = hasSearched || activeFilterCount() > 0;
    resultsWrap.hidden = !active;
    if (!active) return;
    // clear the previous batch's gallery cross-fade timers before replacing
    // resultsGrid's HTML below — render() fires on every debounced keystroke,
    // slider drag and chip/sort change, and without this each firing left its
    // interval(s) running forever against now-detached DOM nodes (unlike
    // projects.js/units.js's listing grids, which already clear these before
    // every re-render)
    resultsGrid.querySelectorAll('[data-gallery]').forEach(b => { if (b._tid) clearInterval(b._tid); });
    const found = getFiltered();
    // developers stay on top; the sort order applies to the projects and units
    let list = found.filter(i => i._kind === 'developer').concat(sortList(found.filter(i => i._kind !== 'developer')));

    if (list.length) {
      resultsCount.textContent = `${list.length} ${t(list.length === 1 ? 'result' : 'results')}`;
      resultsGrid.innerHTML = list.slice(0, 24).map(cardHTML).join('');
    } else {
      const recs = COMBINED.map(it => ({ it, s: scoreSimilar(it) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 6)
        .map(x => x.it);
      resultsCount.textContent = t('No exact matches — recommended for you');
      resultsGrid.innerHTML = recs.length
        ? recs.map(cardHTML).join('')
        : `<p class="smart-results-empty">${t('No projects or units match those filters')}</p>`;
    }
    if (window.cardContact) window.cardContact.wire(resultsGrid);
    if (typeof cycleGalleries === 'function') cycleGalleries('#smartResultsGrid', '.project', 3200);
  }

  /* ---------- advanced panel expand/collapse ---------- */
  function setAdvOpen(open) {
    advOpen = open;
    advToggleBtn.classList.toggle('active', open);
    advToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      advPanel.hidden = false;
      advPanel.style.maxHeight = '0px';
      void advPanel.offsetHeight; // force a reflow so the 0px state is committed before animating
      advPanel.classList.add('open');
      advPanel.style.maxHeight = advPanel.scrollHeight + 'px';
    } else {
      advPanel.style.maxHeight = advPanel.scrollHeight + 'px';
      void advPanel.offsetHeight;
      advPanel.classList.remove('open');
      advPanel.style.maxHeight = '0px';
      setTimeout(() => { if (!advOpen) advPanel.hidden = true; }, 400);
    }
  }

  /* ---------- wiring ---------- */
  function wireEvents() {
    const debouncedInput = debounce(() => { state.q = searchInput.value; render(); }, 200);
    searchInput.addEventListener('input', debouncedInput);

    advToggleBtn.addEventListener('click', () => setAdvOpen(!advOpen));

    wireChipGroup(kindChipsEl, v => {
      state.kind = v;
      const goBtn = form.querySelector('.search-go');
      if (goBtn) goBtn.textContent = t('Search properties');
      renderTypeChips();
      render();
    });
    wireChipGroup(typeChipsEl, v => { state.type = v; render(); });
    wireChipGroup(bedsChipsEl, v => { state.beds = v; render(); });

    advSort.addEventListener('change', () => { state.sort = advSort.value; render(); });

    advReset.addEventListener('click', () => {
      state.kind = 'all'; state.type = 'all'; state.beds = 'any';
      state.city = ''; state.sort = 'featured';
      advSort.value = 'featured';
      if (searchCitySelect) searchCitySelect.setOptions([{ value: '', label: t('All locations') }].concat(cityOptions));
      renderKindChips(); renderTypeChips(); renderBedsChips();
      if (priceSlider) priceSlider.reset();
      if (areaSlider) areaSlider.reset();
      render();
    });

    resultsClear.addEventListener('click', () => {
      state.q = ''; searchInput.value = '';
      hasSearched = false;
      advReset.click();
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      state.q = searchInput.value;
      hasSearched = true;
      render();
      resultsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- public entry point (called from script.js's boot) ---------- */
  function setData(cities, projects, units, devs) {
    COMBINED = buildCombined(projects, units, cities, devs);
    DEVS = buildDevelopers(projects, devs);

    cityOptions = (cities || []).map(c => ({ value: c.name, label: window.cityText(c.name) }));
    searchCitySelect = searchCitySelect || (typeof initCustomSelect === 'function' ? initCustomSelect(document.getElementById('searchCity')) : null);
    if (searchCitySelect) {
      searchCitySelect.setOptions([{ value: '', label: t('All locations') }].concat(cityOptions));
      document.getElementById('searchCity').addEventListener('change', () => {
        state.city = searchCitySelect.value; render();
      });
    }

    const prices = COMBINED.map(i => i.priceValue).filter(v => v > 0);
    const areas = COMBINED.map(i => i.areaValue).filter(v => v > 0);
    priceBounds = [0, prices.length ? Math.ceil(Math.max(...prices) / 50000) * 50000 : 1000000];
    areaBounds = [0, areas.length ? Math.ceil(Math.max(...areas) / 10) * 10 : 500];
    state.priceMin = priceBounds[0]; state.priceMax = priceBounds[1];
    state.areaMin = areaBounds[0]; state.areaMax = areaBounds[1];

    priceSlider = makeDualSlider(priceSliderEl, { min: priceBounds[0], max: priceBounds[1], step: 50000, formatLabel: priceLabel });
    priceSlider.onChange((lo, hi) => { state.priceMin = lo; state.priceMax = hi; render(); });
    areaSlider = makeDualSlider(areaSliderEl, { min: areaBounds[0], max: areaBounds[1], step: 10, formatLabel: areaLabel });
    areaSlider.onChange((lo, hi) => { state.areaMin = lo; state.areaMax = hi; render(); });

    renderKindChips();
    renderTypeChips();
    renderBedsChips();
    render();
  }

  // the complete lists arrived after first paint (the page started from the
  // partial rows api/preload.js sent): swap them in, bounds and chips stay
  function refreshData(cities, projects, units, devs) {
    COMBINED = buildCombined(projects, units, cities, devs);
    DEVS = buildDevelopers(projects, devs);
    if (hasSearched) render();
  }

  wireEvents();
  window.smartSearch = { setData, refreshData };
})();
