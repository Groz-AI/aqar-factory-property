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
const starSVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2Z"/></svg>`;
const closeSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

const escHTML = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const emLast = (s) => {
  const w = String(s || '').trim().split(/\s+/);
  if (w.length < 2) return `<em>${s || ''}</em>`;
  const last = w.pop();
  return `${w.join(' ')} <em>${last}</em>`;
};

let allProjects = [];

/* ---------- custom dropdown (replaces native <select> so the open list can
   actually be styled — browsers render native option popups unstyleable) ---------- */
function initCustomSelect(root) {
  if (!root) return null;
  const btn = root.querySelector('.csel-btn');
  const label = root.querySelector('.csel-label');
  const list = root.querySelector('.csel-list');
  const escHTML = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Move the list to <body>. The search bar uses backdrop-filter for its
  // frosted-glass look, and per spec backdrop-filter (like filter/transform)
  // creates a new containing block for position:fixed descendants — so left
  // in place, "fixed" here would silently position relative to the search
  // bar instead of the viewport. Reparenting avoids that entirely.
  document.body.appendChild(list);

  // Flips upward and clamps height to whichever side of the button has more
  // room, so the list never renders past the viewport edge.
  function position() {
    const r = btn.getBoundingClientRect();
    const margin = 10;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;

    list.style.position = 'fixed';
    list.style.left = r.left + 'px';
    list.style.width = Math.max(r.width, 220) + 'px';
    if (openUp) {
      list.style.top = '';
      list.style.bottom = (window.innerHeight - r.top + margin) + 'px';
      list.style.maxHeight = Math.max(120, Math.min(280, spaceAbove)) + 'px';
    } else {
      list.style.bottom = '';
      list.style.top = (r.bottom + margin) + 'px';
      list.style.maxHeight = Math.max(120, Math.min(280, spaceBelow)) + 'px';
    }
  }
  function close() {
    list.hidden = true;
    root.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function open() {
    document.querySelectorAll('.csel.open').forEach(o => { if (o !== root) o.querySelector('.csel-btn')?.click(); });
    position();
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
  // the list lives at <body> level now (see above), not inside root, so an
  // "outside click" check has to test both
  document.addEventListener('click', e => { if (!root.contains(e.target) && !list.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // reposition (not close) on scroll — a fixed-position list won't track the
  // button under it otherwise. This also matters because focusing/clicking
  // the trigger button can itself cause a native scroll-into-view, which
  // would otherwise close the dropdown the instant it opens.
  window.addEventListener('scroll', () => { if (!list.hidden) position(); }, { passive: true, capture: true });
  window.addEventListener('resize', () => { if (!list.hidden) position(); });

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

/* ---------- hero search bar (location + project category → projects.html) ---------- */
let searchCitySelect, searchTypeSelect;
function renderSearchFacets(cities, projects) {
  searchCitySelect = searchCitySelect || initCustomSelect(document.getElementById('searchCity'));
  searchTypeSelect = searchTypeSelect || initCustomSelect(document.getElementById('searchType'));
  if (searchCitySelect && cities && cities.length) {
    searchCitySelect.setOptions([{ value: '', label: t('All locations') }].concat(cities.map(c => ({ value: c.name, label: c.name }))));
  }
  if (searchTypeSelect && projects && projects.length) {
    const cats = [...new Set(projects.map(p => p.category).filter(Boolean))];
    searchTypeSelect.setOptions([{ value: 'all', label: t('All project types') }].concat(cats.map(c => ({ value: c, label: c }))));
  }
}

function wireSearchForm() {
  const form = document.getElementById('searchBar');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const city = searchCitySelect ? searchCitySelect.value : '';
    const cat = searchTypeSelect ? searchTypeSelect.value : 'all';
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (cat && cat !== 'all') params.set('cat', cat);
    const qs = params.toString();
    window.location.href = 'projects.html' + (qs ? '?' + qs : '');
  });
}

/* ============================================================
   CITIES
   ============================================================ */
function renderCities(cities, projectList) {
  const wrap = document.getElementById('cityGrid');
  if (!wrap || !cities.length) return;
  const counts = {};
  (projectList || []).forEach(pr => { if (pr.cityId) counts[pr.cityId] = (counts[pr.cityId] || 0) + 1; });
  wrap.innerHTML = cities.map(c => {
    const size = c.size === 'big' ? ' big' : c.size === 'wide' ? ' wide' : '';
    const w = size ? 900 : 700;
    const n = counts[c.id] || 0;
    const label = n === 1 ? t('1 Project') : `${n.toLocaleString()} ${t('Projects')}`;
    return `<article class="city-card${size} reveal" data-city-id="${c.id}" tabindex="0" role="button" aria-label="${t('View projects in')} ${c.name}" style="--img:url('${IMG(c.image, w)}')">
      <div class="city-meta"><h3>${c.name}</h3><p>${c.country || ''}</p></div>
      <span class="city-count">${label}</span>
    </article>`;
  }).join('');

  wrap.querySelectorAll('.city-card').forEach(card => {
    const cid = card.dataset.cityId;
    const city = cities.find(c => c.id === cid);
    const projects = (projectList || []).filter(pr => pr.cityId === cid);
    const open = () => openCityModal(city, projects);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

/* ============================================================
   CITY PROJECTS MODAL — opened by clicking a city card
   ============================================================ */
let cityModalOverlay = null;
let cityModalBody = null;

function ensureCityModal() {
  if (cityModalOverlay) return;
  const el = document.createElement('div');
  el.className = 'unit-modal-overlay';
  el.id = 'cityModalOverlay';
  el.innerHTML = `
    <div class="unit-modal city-modal" role="dialog" aria-modal="true" aria-label="${t('Projects in this city')}">
      <button class="unit-modal-close" id="cityModalClose" aria-label="Close">${closeSVG}</button>
      <div class="unit-modal-scroll" id="cityModalBody"></div>
    </div>`;
  document.body.appendChild(el);
  cityModalOverlay = el;
  cityModalBody = el.querySelector('#cityModalBody');
  el.addEventListener('click', e => { if (e.target === el) closeCityModal(); });
  el.querySelector('#cityModalClose').addEventListener('click', closeCityModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCityModal(); });
}

function openCityModal(city, projects) {
  if (!city) return;
  ensureCityModal();
  const rows = projects.map(p => {
    const stats = p.stats || {};
    return `<a class="cmp-item" href="project.html?id=${encodeURIComponent(p.id)}">
      <img src="${IMG(p.cover, 160)}" alt="" loading="lazy">
      <div class="cmp-item-body"><h4>${p.name || ''}</h4><p>${p.location || ''}</p></div>
      <span class="cmp-item-price">${stats.price || ''}</span>
    </a>`;
  }).join('');
  const countLabel = projects.length === 1 ? t('1 Project') : projects.length + ' ' + t('Projects');
  cityModalBody.innerHTML = `
    <div class="city-modal-head">
      <h3>${city.name}</h3>
      <p>${city.country ? city.country + ' · ' : ''}${countLabel}</p>
    </div>
    <div class="city-modal-projects">
      ${projects.length ? rows : `<div class="city-modal-empty">${t('No projects linked to this city yet.')}</div>`}
    </div>`;
  cityModalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCityModal() {
  if (!cityModalOverlay) return;
  cityModalOverlay.classList.remove('open');
  document.body.style.overflow = '';
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

    const devLine = p.developer ? `
      <div class="project-dev">
        <span class="av${p.developerLogo ? ' has-logo' : ''}">${p.developerLogo ? `<img src="${IMG(p.developerLogo, 80)}" alt="">` : escHTML((p.developer || '·').charAt(0))}</span>
        <span>${window.t ? t('Developed by') : 'Developed by'} <b>${escHTML(p.developer)}</b></span>
      </div>` : '';

    const consultants = (p.consultants || []).filter(c => c && (c.name || c.logo));
    const consultantsLine = consultants.length ? `
      <div class="project-consultants">
        <span class="pc-label">${window.t ? t('Executive Consultants') : 'Executive Consultants'}</span>
        <div class="pc-avatars">${consultants.map(c => c.logo
          ? `<img class="pc-avatar" src="${IMG(c.logo, 60)}" alt="" title="${escHTML(c.name || '')}">`
          : `<span class="pc-avatar pc-avatar-fallback" title="${escHTML(c.name || '')}">${escHTML((c.name || '·').charAt(0))}</span>`
        ).join('')}</div>
        <span class="pc-names">${consultants.map(c => escHTML(c.name)).filter(Boolean).join(', ')}</span>
      </div>` : '';

    return `
    <a class="project reveal" href="project.html?id=${encodeURIComponent(p.id)}">
      <div class="project-img" data-gallery>${slides}<div class="pg-shade"></div>${dots}</div>
      <div class="project-body">
        <span class="project-tag">${p.category || ''}</span>
        <h3>${p.name}</h3>
        <p>${p.tagline || ''}</p>
        ${devLine}
        ${consultantsLine}
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
    ? `<div class="logo"><img src="${IMG(d.logo, 240)}" alt="${d.name}" loading="lazy"></div>`
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
  const isAr = !!(window.i18n && window.i18n.lang === 'ar');
  const pick = (obj, key) => (isAr && obj[key + '_ar']) ? obj[key + '_ar'] : obj[key];
  if (c.sections && c.sections.testimonials === false) {
    const sec = document.querySelector('.testimonials');
    if (sec) sec.style.display = 'none';
  }
  if (c.hero) {
    const h = c.hero;
    const eye = document.querySelector('.hero-eyebrow');
    const title = document.querySelector('.hero-title');
    const sub = document.querySelector('.hero-sub');
    const eyebrow = pick(h, 'eyebrow'), titleA = pick(h, 'titleA'), titleB = pick(h, 'titleB'), subText = pick(h, 'sub');
    if (eye && eyebrow) eye.textContent = eyebrow;
    if (title && (titleA || titleB)) title.innerHTML = `${titleA || ''} <span>${titleB || ''}</span>`;
    if (sub && subText) sub.textContent = subText;
  }
  if (c.stats) {
    const lead = document.querySelector('.journey-lead');
    const leadText = pick(c.stats, 'lead');
    if (lead && leadText) lead.textContent = leadText;
    const nodes = document.querySelectorAll('.stats .stat');
    (c.stats.items || []).forEach((it, i) => {
      const n = nodes[i];
      if (!n) return;
      const num = n.querySelector('.stat-num');
      const p = n.querySelector('p');
      if (num) { num.dataset.count = it.value; num.dataset.suffix = it.suffix || ''; }
      const label = pick(it, 'label');
      if (p && label) p.textContent = label;
    });
  }
  if (c.cta) {
    const banner = document.querySelector('.cta-text');
    if (banner) {
      const h2 = banner.querySelector('h2'), p = banner.querySelector('p'), btn = banner.querySelector('.btn');
      const titleA = pick(c.cta, 'titleA'), titleB = pick(c.cta, 'titleB'), text = pick(c.cta, 'text'), button = pick(c.cta, 'button');
      if (h2 && (titleA || titleB)) h2.innerHTML = `${titleA || ''}<br/>${emLast(titleB || '')}`;
      if (p && text) p.textContent = text;
      if (btn && button) btn.textContent = button;
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
  const isAr = !!(window.i18n && window.i18n.lang === 'ar');
  const more = isAr
    ? ['بمنتهى البساطة', 'بمفهوم جديد', 'مصممة من أجلك']
    : ['Made Simple', 'Reimagined', 'Built for You'];
  const phrases = [...new Set([first, ...more])];

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
    const [cities, projects, devs, testis, content] = await Promise.all([
      S.getCities(), S.getProjects(), S.getDevelopers(), S.getTestimonials(), S.getContent()
    ]);
    allProjects = projects || [];
    applyContent(content);
    renderSearchFacets(cities || [], allProjects);
    initHeroTyping();
    renderCities(cities || [], allProjects);
    initHeroGallery(cities || [], content);
    renderProjects(projects || []);
    renderDevelopers(devs || []);
    renderTestimonials(testis || []);
  } catch (e) {
    console.error('Realteek: data load failed', e);
  }
  initStarfields();
  wireSearchForm();
  wireReveals();
})();
