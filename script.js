/* ============================================================
   REALTEEK — interactions
   Renders from the data layer (window.store): live Supabase data
   when configured, otherwise the bundled FALLBACK content.
   ============================================================ */

/* ---------- image helper ---------- */
const IMG = (ref, w = 800) =>
  !ref ? '' :
  /^https?:\/\//.test(ref) ? ref :
  `https://images.unsplash.com/photo-${ref}?auto=format&fit=crop&w=${w}&q=80`;

/* ---------- inline icons ---------- */
const heartSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" stroke="currentColor" stroke-width="1.6"/></svg>`;
const pinSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>`;
const bedSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M3 18v-5h18v5M3 13V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M7 11h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const bathSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 4 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const areaSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4zM4 10h16M10 4v16" stroke="currentColor" stroke-width="1.4"/></svg>`;
const starSVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2Z"/></svg>`;

const emLast = (s) => {
  const w = String(s || '').trim().split(/\s+/);
  if (w.length < 2) return `<em>${s || ''}</em>`;
  const last = w.pop();
  return `${w.join(' ')} <em>${last}</em>`;
};

/* ============================================================
   PROPERTIES (Handpicked Homes)
   ============================================================ */
let properties = [];
let allProjects = [];
let activeCatFilter = 'all';
let activeCityQuery = '';
const grid = document.getElementById('propertyGrid');

/* shared interior shots to enrich single-image listings into a small gallery */
const INTERIOR_POOL = [
  '1505691938895-1758d7feb511', '1560448204-e02f11c3d0e2', '1556912173-3bb406ef7e77',
  '1600210492493-0946911123ea', '1600607687939-ce8a6c25118c', '1583847268964-b28dc8f51f92'
];
function propImages(p, idx) {
  if (p.images && p.images.length) return p.images.slice(0, 5).filter(Boolean);
  const a = INTERIOR_POOL[idx % INTERIOR_POOL.length];
  const b = INTERIOR_POOL[(idx + 2) % INTERIOR_POOL.length];
  return [p.image, a, b].filter(Boolean);
}

function cardHTML(p, i) {
  const cats = p.categories || [];
  const loc = p.location || '';
  const desc = p.description || '';
  const specs = [];
  if (p.beds) specs.push(`<span>${bedSVG}${p.beds}</span>`);
  if (p.baths) specs.push(`<span>${bathSVG}${p.baths}</span>`);
  if (p.area) specs.push(`<span>${areaSVG}${p.area}</span>`);
  const imgs = propImages(p, i);
  const slides = imgs.map((g, n) =>
    `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${IMG(g)}')"></div>`).join('');
  const dots = imgs.length > 1
    ? `<div class="pg-dots">${imgs.map((_, n) => `<i class="${n === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
  return `
  <article class="card" data-cat="${cats.join(' ')}" data-pname="${p.name || ''}" style="animation-delay:${i * 60}ms">
    <div class="card-img" data-gallery>
      ${slides}<div class="pg-shade"></div>
      <span class="card-badge">${p.badge || ''}</span>
      <button class="card-fav" aria-label="Save">${heartSVG}</button>
      ${dots}
    </div>
    <div class="card-body">
      <h3>${p.name}</h3>
      <p class="card-loc">${pinSVG}${loc}</p>
      <p class="card-desc">${desc}</p>
      <div class="card-foot">
        <span class="card-price">${p.price || ''}</span>
        <div class="card-specs">${specs.join('')}</div>
      </div>
    </div>
  </article>`;
}

function renderProperties(filter = activeCatFilter) {
  activeCatFilter = filter;
  // clear any running gallery timers before replacing the cards
  grid.querySelectorAll('[data-gallery]').forEach(b => { if (b._tid) clearInterval(b._tid); });
  let list = filter === 'all' ? properties : properties.filter(p => (p.categories || []).includes(filter));
  if (activeCityQuery) {
    const q = activeCityQuery.toLowerCase();
    list = list.filter(p => (p.location || '').toLowerCase().includes(q));
  }
  grid.innerHTML = list.length ? list.map((p, i) => cardHTML(p, i)).join('')
    : `<p style="grid-column:1/-1;text-align:center;color:var(--ink-soft);padding:40px 0">No properties match that search. Try a different location or property type.</p>`;
  grid.querySelectorAll('.card-fav').forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    b.classList.toggle('on');
    b.style.background = b.classList.contains('on') ? 'var(--sky)' : '';
    b.style.color = b.classList.contains('on') ? '#fff' : '';
  }));
  grid.querySelectorAll('.card').forEach((cardEl, i) => {
    cardEl.setAttribute('tabindex', '0');
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('aria-label', `View details for ${list[i].name || 'this property'}`);
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav')) return;
      openUnitModal(list[i]);
    });
    cardEl.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.card-fav')) {
        e.preventDefault();
        openUnitModal(list[i]);
      }
    });
  });
  cycleGalleries('#propertyGrid', '.card', 3600);
}

/* ============================================================
   UNIT DETAIL MODAL — scrollable pop-up opened from a property card
   ============================================================ */
const closeSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

let unitModalOverlay = null;
let unitModalBody = null;

function ensureUnitModal() {
  if (unitModalOverlay) return;
  const el = document.createElement('div');
  el.className = 'unit-modal-overlay';
  el.id = 'unitModalOverlay';
  el.innerHTML = `
    <div class="unit-modal" role="dialog" aria-modal="true" aria-label="Property details">
      <button class="unit-modal-close" id="unitModalClose" aria-label="Close">${closeSVG}</button>
      <div class="unit-modal-scroll" id="unitModalBody"></div>
    </div>`;
  document.body.appendChild(el);
  unitModalOverlay = el;
  unitModalBody = el.querySelector('#unitModalBody');
  el.addEventListener('click', e => { if (e.target === el) closeUnitModal(); });
  el.querySelector('#unitModalClose').addEventListener('click', closeUnitModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeUnitModal(); });
}

function unitModalHTML(p) {
  const imgs = propImages(p, 0);
  const slides = imgs.map((g, n) =>
    `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${IMG(g, 1000)}')"></div>`).join('');
  const dots = imgs.length > 1
    ? `<div class="pg-dots">${imgs.map((_, n) => `<i class="${n === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
  const specs = [];
  if (p.beds) specs.push(`<div class="um-spec">${bedSVG}<span>${p.beds} Beds</span></div>`);
  if (p.baths) specs.push(`<div class="um-spec">${bathSVG}<span>${p.baths} Baths</span></div>`);
  if (p.area) specs.push(`<div class="um-spec">${areaSVG}<span>${p.area}</span></div>`);
  const tags = (p.categories || []).map(c => `<span class="um-tag">${c}</span>`).join('');
  const linkedProject = p.project_id ? allProjects.find(pr => pr.dbId === p.project_id) : null;
  const projectCTA = linkedProject
    ? `<a href="project.html?id=${encodeURIComponent(linkedProject.id)}" class="btn btn-dark">Go to ${linkedProject.name}</a>`
    : `<a href="projects.html" class="btn btn-dark">Go to Projects Page</a>`;

  return `
    <div class="um-gallery" data-gallery>
      ${slides}<div class="pg-shade"></div>
      ${p.badge ? `<span class="um-badge">${p.badge}</span>` : ''}
      ${dots}
    </div>
    <div class="um-details">
      <h3>${p.name || ''}</h3>
      <p class="um-loc">${pinSVG}${p.location || ''}</p>
      ${specs.length ? `<div class="um-specs">${specs.join('')}</div>` : ''}
      ${p.price ? `<p class="um-price">${p.price}</p>` : ''}
      ${p.description ? `<p class="um-desc">${p.description}</p>` : ''}
      ${tags ? `<div class="um-tags">${tags}</div>` : ''}
      <div class="um-actions">
        ${projectCTA}
        <a href="contact.html" class="btn btn-ghost">Enquire About This Property</a>
      </div>
    </div>`;
}

function openUnitModal(p) {
  if (!p) return;
  ensureUnitModal();
  unitModalBody.innerHTML = unitModalHTML(p);
  unitModalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  cycleGalleries('#unitModalOverlay', '.um-gallery', 3800);
}

function closeUnitModal() {
  if (!unitModalOverlay) return;
  unitModalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ---------- filter chips ---------- */
function renderChips(categories) {
  const chips = document.getElementById('chips');
  if (!chips || !categories || !categories.length) return;
  chips.innerHTML =
    `<button class="chip active" data-filter="all">All</button>` +
    categories.map(c => `<button class="chip" data-filter="${c.filter}">${c.label}</button>`).join('');
}

function wireChips() {
  const chips = document.getElementById('chips');
  chips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chips.querySelector('.active')?.classList.remove('active');
    chip.classList.add('active');
    renderProperties(chip.dataset.filter);
  });
  document.getElementById('filterNext').addEventListener('click', () => chips.scrollBy({ left: 260, behavior: 'smooth' }));
  document.getElementById('filterPrev').addEventListener('click', () => chips.scrollBy({ left: -260, behavior: 'smooth' }));
}

/* ---------- custom dropdown (replaces native <select> so the open list can
   actually be styled — browsers render native option popups unstyleable) ---------- */
function initCustomSelect(root) {
  if (!root) return null;
  const btn = root.querySelector('.csel-btn');
  const label = root.querySelector('.csel-label');
  const list = root.querySelector('.csel-list');
  const escHTML = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function close() {
    list.hidden = true;
    root.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function open() {
    document.querySelectorAll('.csel.open').forEach(o => { if (o !== root) o.querySelector('.csel-btn')?.click(); });
    list.hidden = false;
    root.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
  function select(li) {
    list.querySelector('.active')?.classList.remove('active');
    list.querySelectorAll('li').forEach(o => o.setAttribute('aria-selected', 'false'));
    li.classList.add('active');
    li.setAttribute('aria-selected', 'true');
    label.textContent = li.textContent;
    root.dataset.value = li.dataset.value || '';
    root.dispatchEvent(new CustomEvent('change'));
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    list.hidden ? open() : close();
  });
  list.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    select(li);
    close();
  });
  document.addEventListener('click', e => { if (!root.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return {
    setOptions(options) {
      list.innerHTML = options.map((o, i) =>
        `<li role="option" data-value="${escHTML(o.value)}" aria-selected="${i === 0 ? 'true' : 'false'}" class="${i === 0 ? 'active' : ''}">${escHTML(o.label)}</li>`
      ).join('');
      label.textContent = options[0] ? options[0].label : '';
      root.dataset.value = options[0] ? options[0].value : '';
    },
    get value() { return root.dataset.value || ''; }
  };
}

/* ---------- hero search bar (buy-only: location + property type) ---------- */
let searchCitySelect, searchTypeSelect;
function renderSearchFacets(cities, categories) {
  searchCitySelect = searchCitySelect || initCustomSelect(document.getElementById('searchCity'));
  searchTypeSelect = searchTypeSelect || initCustomSelect(document.getElementById('searchType'));
  if (searchCitySelect && cities && cities.length) {
    searchCitySelect.setOptions([{ value: '', label: 'All locations' }].concat(cities.map(c => ({ value: c.name, label: c.name }))));
  }
  if (searchTypeSelect && categories && categories.length) {
    searchTypeSelect.setOptions([{ value: 'all', label: 'All property types' }].concat(categories.map(c => ({ value: c.filter, label: c.label }))));
  }
}

function wireSearchForm() {
  const form = document.getElementById('searchBar');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const city = searchCitySelect ? searchCitySelect.value : '';
    const type = searchTypeSelect ? searchTypeSelect.value : 'all';

    activeCityQuery = city;
    const chips = document.getElementById('chips');
    if (chips) {
      const match = chips.querySelector(`[data-filter="${type}"]`) || chips.querySelector('[data-filter="all"]');
      chips.querySelector('.active')?.classList.remove('active');
      match?.classList.add('active');
    }
    renderProperties(type);
    document.getElementById('homes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ============================================================
   CITIES
   ============================================================ */
// a unit's city comes from its linked project when it has one, else its own city_id
function resolveCityId(p, projectsByDbId) {
  if (p.project_id) {
    const proj = projectsByDbId[p.project_id];
    if (proj) return proj.cityId || null;
  }
  return p.city_id || null;
}

function renderCities(cities, props, projectList) {
  const wrap = document.getElementById('cityGrid');
  if (!wrap || !cities.length) return;
  const projectsByDbId = {};
  (projectList || []).forEach(pr => { if (pr.dbId) projectsByDbId[pr.dbId] = pr; });
  const counts = {};
  (props || []).forEach(p => {
    const cid = resolveCityId(p, projectsByDbId);
    if (cid) counts[cid] = (counts[cid] || 0) + 1;
  });
  wrap.innerHTML = cities.map(c => {
    const size = c.size === 'big' ? ' big' : c.size === 'wide' ? ' wide' : '';
    const w = size ? 900 : 700;
    const n = counts[c.id] || 0;
    const label = n === 1 ? '1 Unit' : `${n.toLocaleString()} Units`;
    return `<article class="city-card${size} reveal" style="--img:url('${IMG(c.image, w)}')">
      <div class="city-meta"><h3>${c.name}</h3><p>${c.country || ''}</p></div>
      <span class="city-count">${label}</span>
    </article>`;
  }).join('');
}

/* ============================================================
   RECENT PROJECTS (first 4) — each card cross-fades its gallery
   ============================================================ */
function renderProjects(projects) {
  const wrap = document.getElementById('projectList');
  if (!wrap || !projects.length) return;
  wrap.innerHTML = projects.slice(0, 4).map(p => {
    const imgs = (p.gallery && p.gallery.length ? p.gallery : [p.cover]).filter(Boolean).slice(0, 5);
    const slides = imgs.map((g, i) =>
      `<div class="pg-slide${i === 0 ? ' active' : ''}" style="background-image:url('${IMG(g, 900)}')"></div>`).join('');
    const dots = imgs.length > 1
      ? `<div class="pg-dots">${imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
    return `
    <a class="project reveal" href="project.html?id=${encodeURIComponent(p.id)}">
      <div class="project-img" data-gallery>${slides}<div class="pg-shade"></div>${dots}</div>
      <div class="project-body">
        <span class="project-tag">${p.category || ''}</span>
        <h3>${p.name}</h3>
        <p>${p.tagline || ''}</p>
        <div class="project-foot"><span>${p.city || p.location || ''}</span><span>${p.year || ''}</span></div>
      </div>
    </a>`;
  }).join('');
  cycleGalleries('#projectList', '.project', 3200);
}

/* ============================================================
   GENERIC GALLERY ROTATOR — cross-fades [data-gallery] blocks,
   staggered so they don't flip in sync; hover advances + speeds up
   ============================================================ */
function cycleGalleries(scopeSel, hoverSel, baseInterval) {
  document.querySelectorAll(scopeSel + ' [data-gallery]').forEach((box, idx) => {
    const slides = box.querySelectorAll('.pg-slide');
    const dots = box.querySelectorAll('.pg-dots i');
    if (slides.length < 2) return;
    let i = 0;
    const advance = () => {
      slides[i].classList.remove('active');
      if (dots[i]) dots[i].classList.remove('on');
      i = (i + 1) % slides.length;
      slides[i].classList.add('active');
      if (dots[i]) dots[i].classList.add('on');
    };
    const run = (ms) => { if (box._tid) clearInterval(box._tid); box._tid = setInterval(advance, ms); };
    run(baseInterval + idx * 350);
    const host = box.closest(hoverSel);
    if (host) {
      host.addEventListener('mouseenter', () => { advance(); run(1800); });
      host.addEventListener('mouseleave', () => { run(baseInterval + idx * 350); });
    }
  });
}

/* ============================================================
   HERO — auto-swiping skyline gallery (Ken Burns)
   ============================================================ */
function initHeroGallery(cities, content) {
  const box = document.getElementById('heroSkyline');
  if (!box) return;
  const heroImgs = content && content.hero && Array.isArray(content.hero.images) ? content.hero.images.filter(Boolean) : [];
  const imgs = (heroImgs.length ? heroImgs
    : (cities && cities.length ? cities.map(c => c.image) : [
        '1486325212027-8081e485255e', '1512453979798-5ea266f8880c',
        '1496442226666-8d4d0e62e6e9', '1513635269975-59663e0ac1ad', '1540959733332-eab4deabeeaf'
      ])).filter(Boolean);
  if (!imgs.length) return;
  box.classList.remove('solo');
  box.innerHTML = imgs.map((g, i) =>
    `<div class="hero-slide${i === 0 ? ' active' : ''}" style="background-image:url('${IMG(g, 1600)}')"></div>`).join('');
  const slides = box.querySelectorAll('.hero-slide');
  if (slides.length < 2) return;
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove('active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('active');
  }, 5500);
}

/* ============================================================
   DEVELOPERS
   ============================================================ */
function renderDevelopers(devs) {
  const wrap = document.getElementById('logoWall');
  if (!wrap || !devs.length) return;
  const item = d => d.logo
    ? `<div class="logo"><img src="${IMG(d.logo, 240)}" alt="${d.name}" loading="lazy" style="max-height:34px;width:auto"></div>`
    : `<div class="logo">${d.name}</div>`;
  // render the set twice so the -50% marquee loops seamlessly
  const set = devs.map(item).join('');
  wrap.innerHTML = `<div class="logo-track">${set}${set}</div>`;
}

/* ============================================================
   TESTIMONIALS
   ============================================================ */
function renderTestimonials(testimonials) {
  const grid = document.getElementById('testiGrid');
  if (!grid || !testimonials.length) return;

  const perPage = 4;
  const pages = Math.max(1, Math.ceil(testimonials.length / perPage));
  let page = 0;
  const idxEl = document.getElementById('testiIndex');
  const pagesEl = document.getElementById('testiPages');
  if (pagesEl) pagesEl.textContent = String(pages).padStart(2, '0');

  const cardHTML = (t, i) => {
    const rating = Math.max(0, Math.min(5, Math.round(Number(t.rating) || 5)));
    return `
    <article class="testi-card" style="--d:${i * 90}ms">
      <div class="tc-stars">${starSVG.repeat(rating)}</div>
      <p class="tc-quote">"${t.quote}"</p>
      <div class="tc-person">
        <img src="${IMG(t.avatar, 120)}" alt="${t.name}" loading="lazy" />
        <div class="who"><h4>${t.name}</h4><p>${t.location || ''}</p></div>
      </div>
    </article>`;
  };

  const paint = (p) => {
    const slice = testimonials.slice(p * perPage, p * perPage + perPage);
    grid.innerHTML = slice.map(cardHTML).join('');
    void grid.offsetWidth;       // reflow so the entrance transition replays
    grid.classList.add('in');
    if (idxEl) idxEl.textContent = String(p + 1).padStart(2, '0');
  };

  function show(n) {
    const next = (n + pages) % pages;
    if (next === page && grid.children.length) return;
    page = next;
    grid.classList.remove('in');                 // fade current cards out
    setTimeout(() => paint(page), 280);
  }

  paint(0); // initial render (no fade-out wait)

  let timer = setInterval(() => show(page + 1), 5200);
  const reset = () => { clearInterval(timer); timer = setInterval(() => show(page + 1), 5200); };
  document.getElementById('testiNext')?.addEventListener('click', () => { show(page + 1); reset(); });
  document.getElementById('testiPrev')?.addEventListener('click', () => { show(page - 1); reset(); });
  const wrap = document.querySelector('.testimonials');
  if (wrap) {
    wrap.addEventListener('mouseenter', () => clearInterval(timer));
    wrap.addEventListener('mouseleave', reset);
  }
}

/* ============================================================
   EDITABLE SITE CONTENT (hero / stats / cta)
   ============================================================ */
function applyContent(c) {
  if (!c) return;
  if (c.hero) {
    const h = c.hero;
    const eye = document.querySelector('.hero-eyebrow');
    const title = document.querySelector('.hero-title');
    const sub = document.querySelector('.hero-sub');
    if (eye && h.eyebrow) eye.textContent = h.eyebrow;
    if (title && (h.titleA || h.titleB)) title.innerHTML = `${h.titleA || ''} <span>${h.titleB || ''}</span>`;
    if (sub && h.sub) sub.textContent = h.sub;
  }
  if (c.stats) {
    const lead = document.querySelector('.journey-lead');
    if (lead && c.stats.lead) lead.textContent = c.stats.lead;
    const nodes = document.querySelectorAll('.stats .stat');
    (c.stats.items || []).forEach((it, i) => {
      const n = nodes[i];
      if (!n) return;
      const num = n.querySelector('.stat-num');
      const p = n.querySelector('p');
      if (num) { num.dataset.count = it.value; num.dataset.suffix = it.suffix || ''; }
      if (p && it.label) p.textContent = it.label;
    });
  }
  if (c.cta) {
    const banner = document.querySelector('.cta-text');
    if (banner) {
      const h2 = banner.querySelector('h2'), p = banner.querySelector('p'), btn = banner.querySelector('.btn');
      if (h2 && (c.cta.titleA || c.cta.titleB)) h2.innerHTML = `${c.cta.titleA || ''}<br/>${emLast(c.cta.titleB || '')}`;
      if (p && c.cta.text) p.textContent = c.cta.text;
      if (btn && c.cta.button) btn.textContent = c.cta.button;
    }
  }
}

/* ============================================================
   HERO — typewriter on the second line ("Real Estate" stays fixed)
   ============================================================ */
function initHeroTyping() {
  const span = document.querySelector('.hero-title span');
  if (!span) return;
  const first = (span.textContent || '').trim() || 'Done Right';
  const phrases = [...new Set([first, 'Made Simple', 'Reimagined', 'Built for You'])];

  span.innerHTML = '<span class="tw"></span><span class="caret"></span>';
  const tw = span.querySelector('.tw');
  let pi = 0, ci = 0, deleting = false;

  function tick() {
    const word = phrases[pi];
    ci += deleting ? -1 : 1;
    tw.textContent = word.slice(0, ci);
    let delay = deleting ? 55 : 105;
    if (!deleting && ci === word.length) { deleting = true; delay = 1700; }
    else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 380; }
    setTimeout(tick, delay);
  }
  setTimeout(tick, 900);
}

/* ============================================================
   STARFIELD — drifting, twinkling particles on a <canvas>
   ============================================================ */
function initStarfield(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const light = canvas.classList.contains('stars--light');
  // footer (light) keeps white stars; everywhere else sits on a light/white
  // background, so use a mid gray that stays visible.
  const rgb = light ? '255,255,255' : '90,104,122';
  const COUNT = light ? 90 : 80;
  const MAX = light ? 0.55 : 0.6;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0, stars = [], t = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = canvas.width = Math.max(1, r.width * dpr);
    h = canvas.height = Math.max(1, r.height * dpr);
  }
  function seed() {
    stars = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() * 1.4 + 0.4) * dpr,
      phase: Math.random() * 6.28, sp: Math.random() * 0.6 + 0.2,
      vx: (Math.random() - 0.5) * 0.14 * dpr, vy: (Math.random() - 0.5) * 0.14 * dpr
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    stars.forEach(s => {
      const tw = Math.sin(t * s.sp + s.phase) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      ctx.fillStyle = `rgba(${rgb},${(MAX * (0.25 + 0.75 * tw)).toFixed(3)})`;
      ctx.fill();
    });
  }
  function frame() {
    t += 0.016;
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy;
      if (s.x < 0) s.x = w; else if (s.x > w) s.x = 0;
      if (s.y < 0) s.y = h; else if (s.y > h) s.y = 0;
    });
    draw();
    requestAnimationFrame(frame);
  }
  resize(); seed();
  if (reduce) { draw(); } else { frame(); }
  window.addEventListener('resize', () => { resize(); seed(); if (reduce) draw(); });
  // re-measure once after layout settles (footer height, fonts)
  setTimeout(() => { resize(); seed(); if (reduce) draw(); }, 500);
}
function initStarfields() {
  document.querySelectorAll('canvas.stars').forEach(initStarfield);
}

/* ============================================================
   SCROLL REVEALS + STAT COUNTERS (run after dynamic render)
   ============================================================ */
function wireReveals() {
  const reveals = [...document.querySelectorAll('.reveal')];
  const show = el => el.classList.add('in');
  const inView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.92 && r.bottom > 0; };

  // Reveal anything already on screen immediately — covers cases where the
  // IntersectionObserver is throttled (e.g. the tab loaded in the background)
  // so above-the-fold content & images never sit invisible.
  reveals.forEach(el => { if (inView(el)) show(el); });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => { if (!el.classList.contains('in')) io.observe(el); });
  } else {
    reveals.forEach(show);
  }

  // Safety net: never leave content permanently hidden if the observer never fires.
  setTimeout(() => reveals.forEach(show), 4000);

  const cio = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const dur = 1600, start = performance.now();
      const fmt = n => n >= 1000 ? n.toLocaleString() : n;
      function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(target * eased)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      cio.unobserve(el);
    });
  }, { threshold: .5 });
  document.querySelectorAll('.stat-num').forEach(c => cio.observe(c));
}

/* ============================================================
   HEADER + MOBILE NAV (no data needed)
   ============================================================ */
(function chrome() {
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  // re-check on back/forward-cache restores and late layout/scroll-anchor shifts,
  // so the header never gets stuck transparent over busy page content
  window.addEventListener('pageshow', onScroll);
  window.addEventListener('load', onScroll);

  const nav = document.getElementById('nav');
  document.getElementById('navToggle').addEventListener('click', () => nav.classList.toggle('open'));
  nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('open'); });

  /* subtle hero parallax — content drifts up & fades, skyline drifts slower */
  const content = document.querySelector('.hero-content');
  const sky = document.getElementById('heroSkyline');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < 820) {
        if (content) { content.style.transform = `translateY(${y * 0.18}px)`; content.style.opacity = String(Math.max(0, 1 - y / 620)); }
        if (sky) sky.style.transform = `translateY(${y * 0.08}px)`;
      }
      ticking = false;
    });
  }, { passive: true });
})();

/* ============================================================
   BOOT
   ============================================================ */
(async function init() {
  const S = window.store;
  try {
    const [props, cities, projects, devs, testis, content, cats] = await Promise.all([
      S.getProperties(), S.getCities(), S.getProjects(), S.getDevelopers(), S.getTestimonials(), S.getContent(),
      S.getCategories ? S.getCategories() : Promise.resolve([])
    ]);
    properties = props || [];
    allProjects = projects || [];
    applyContent(content);
    renderChips(cats || []);
    renderSearchFacets(cities || [], cats || []);
    initHeroTyping();
    renderProperties();
    renderCities(cities || [], properties, allProjects);
    initHeroGallery(cities || [], content);
    renderProjects(projects || []);
    renderDevelopers(devs || []);
    renderTestimonials(testis || []);
  } catch (e) {
    console.error('Realteek: data load failed', e);
  }
  initStarfields();
  wireChips();
  wireSearchForm();
  wireReveals();
})();
