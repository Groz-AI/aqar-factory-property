/* ============================================================
   REALTEEK — Projects listing: search · category · city · sort
   ============================================================ */
let P = [];
const grid = document.getElementById('projectsGrid');
const emptyState = document.getElementById('emptyState');
const resCount = document.getElementById('resCount');
const catChips = document.getElementById('catChips');
const citySelect = document.getElementById('citySelect');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const resetBtn = document.getElementById('resetBtn');

const pinSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>`;
const arrowSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- animated cover: cross-fades through the project's own gallery ---------- */
function projectImages(p) {
  const imgs = (p.gallery || []).filter(Boolean);
  return imgs.length ? imgs.slice(0, 6) : [p.cover].filter(Boolean);
}
// a card's slideshow only runs while the card is near the screen: ~100 cards flipping photos in
// parallel kept the browser restyling and repainting the whole page even when nobody could see them
let galleryIO = null;
function galleryVisibility() {
  if (!galleryIO && 'IntersectionObserver' in window) {
    galleryIO = new IntersectionObserver(es => es.forEach(e => {
      const b = e.target;
      if (e.isIntersecting) { if (b._start) b._start(); } else if (b._stop) b._stop();
    }), { rootMargin: '150px 0px' });
  }
  return galleryIO;
}
function cycleGalleries(scopeSel, hoverSel, baseInterval) {
  document.querySelectorAll(scopeSel + ' [data-gallery]').forEach((box, idx) => {
    const slides = box.querySelectorAll('.pg-slide');
    const dots = box.querySelectorAll('.pg-dots i');
    if (slides.length < 2 || box._cycling) return;   // already running (cards are added in batches)
    box._cycling = true;
    let i = 0;
    const advance = () => {
      slides[i].classList.remove('active');
      if (dots[i]) dots[i].classList.remove('on');
      i = (i + 1) % slides.length;
      window.loadSlide && window.loadSlide(slides[i]);
      slides[i].classList.add('active');
      window.loadSlide && window.loadSlide(slides[(i + 1) % slides.length]);
      if (dots[i]) dots[i].classList.add('on');
    };
    const run = (ms) => { if (box._tid) clearInterval(box._tid); box._tid = setInterval(advance, ms); };
    const stop = () => { if (box._tid) { clearInterval(box._tid); box._tid = 0; } };
    const io = galleryVisibility();
    if (io) { box._start = () => run(baseInterval + idx * 350); box._stop = stop; io.observe(box); }
    else run(baseInterval + idx * 350);
    const host = box.closest(hoverSel);
    if (host) {
      host.addEventListener('mouseenter', () => { advance(); run(1800); });
      host.addEventListener('mouseleave', () => { run(baseInterval + idx * 350); });
    }
  });
}

let state = { cat: 'all', city: 'all', developer: 'all', q: '', sort: 'featured' };
let CITIES = [], DEVS = [];

/* build category chips + city dropdown from the loaded dataset */
function buildFacets() {
  const categories = ['all', ...new Set(P.map(p => p.category).filter(Boolean))];
  catChips.innerHTML = categories.map((c, i) =>
    `<button class="chip ${i === 0 ? 'active' : ''}" data-cat="${c}">${c === 'all' ? t('All') : t(c)}</button>`
  ).join('');
  const cities = [...new Set(P.map(p => p.city).filter(Boolean))].sort();
  citySelect.insertAdjacentHTML('beforeend',
    cities.map(c => `<option value="${c}">${window.cityText(c)}</option>`).join(''));
}

const statusClass = s => (s || '').toLowerCase().replace(/[^a-z]/g, '-');

const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
function pick(p, key, arKey) {
  if (isAr()) {
    const v = p[arKey];
    if (v) return window.biText(v);
  }
  return window.biText(p[key]);
}

function cardHTML(p){
  const stats = p.stats || {};
  const imgs = projectImages(p);
  // the first slide is a real <img> with alt text (so image search can index
  // the card's photo); the other slides stay lazy backgrounds, loaded as the
  // cross-fade reaches them
  const altName = String(pick(p, 'name', 'nameAr') || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slides = imgs.map((g, n) => n === 0
    ? `<img class="pg-slide active" src="${U(g, 800)}" alt="${altName}" width="800" height="600" loading="lazy" decoding="async">`
    : `<div class="pg-slide" data-bg="${U(g, 800)}"></div>`).join('');
  const dots = imgs.length > 1
    ? `<div class="pg-dots">${imgs.map((_, n) => `<i class="${n === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
  const devLogo = p.developerLogo
    ? `<span class="pcard-dev-logo"><img loading="lazy" src="${U(p.developerLogo, 100)}" alt="${p.developer || ''}" title="${p.developer || ''}"></span>` : '';
  return `
  <a class="pcard" href="${window.buildUrl('project', p)}">
    <div class="pcard-img" data-gallery>
      ${slides}<div class="pg-shade"></div>
      <span class="pcard-status ${statusClass(p.status)}"><i></i>${p.status ? t(p.status) : ''}</span>
      <span class="pcard-cat">${p.category ? t(p.category) : ''}</span>
      ${devLogo}
      ${dots}${window.cardContact ? window.cardContact.markup(pick(p, 'name', 'nameAr')) : ''}
    </div>
    <div class="pcard-body">
      <h3>${pick(p, 'name', 'nameAr') || ''}</h3>
      <p class="pcard-loc">${pinSVG}${window.biText(p.location || '')}</p>
      <p class="pcard-tag">${window.biText(p.tagline || '')}</p>
      <div class="pcard-foot">
        <span class="pcard-price">${window.formatPrice ? window.formatPrice(stats.price) : (stats.price || '')}</span>
        <span class="arrow">${arrowSVG}</span>
      </div>
    </div>
  </a>`;
}

/* ---------- filtering + sorting ---------- */
/* spelling-insensitive text for searching: case, Arabic diacritics and the usual letter variants
   (ا أ إ آ / ى ي / ة ه) are ignored */
const norm = (s) => String(s == null ? '' : s).toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[\s\-_.,&()/]+/g, ' ').trim();
let devArById = null;
function searchText(p){
  if (p._hay === undefined) {
    if (!devArById) { devArById = {}; (DEVS || []).forEach(d => { devArById[d.id] = d.name_ar || ''; }); }
    p._hay = norm([p.name, p.nameAr, p.city, p.location, p.category, p.developer, devArById[p.developerId] || ''].join(' '));
  }
  return p._hay;
}
function getFiltered(){
  const words = norm(state.q).split(' ').filter(Boolean);
  let list = P.filter(p =>
    (state.cat === 'all' || p.category === state.cat) &&
    (state.city === 'all' || p.city === state.city) &&
    (state.developer === 'all' || p.developer === state.developer) &&
    (!words.length || words.every(w => searchText(p).includes(w)))
  );
  const byNum = (key, dir) => (a, b) => dir * ((Number(a[key]) || 0) - (Number(b[key]) || 0));
  switch(state.sort){
    case 'price-desc': list.sort(byNum('priceValue', -1)); break;
    case 'price-asc':  list.sort(byNum('priceValue', 1)); break;
    case 'area-desc':  list.sort(byNum('areaValue', -1)); break;
    case 'area-asc':   list.sort(byNum('areaValue', 1)); break;
    case 'year-desc':  list.sort(byNum('year', -1)); break;
    case 'name-asc':   list.sort((a, b) => (pick(a, 'name', 'nameAr') || '').localeCompare(pick(b, 'name', 'nameAr') || '')); break;
  }
  return list;
}

/* the cards are drawn in batches as the visitor scrolls: ~190 cards at once
   meant a very large DOM and a long first render */
const BATCH = 24;
let shown = 0, curList = [], moreObs = null, sentinel = null;
/* api/preload.js sends the first BATCH rows whole and the rest with only a few facts
   (filters, counts, sort need nothing more); the complete list loads right after
   first paint. Until it arrives only the first batch is drawn and filter / search /
   sort wait for it. */
let fullDone = true, fullP = null;
function whenFull(fn){ if (fullDone) fn(); else fullP.then(fn); }
function appendBatch(){
  if (!fullDone && shown >= BATCH) return;   // later cards need the complete rows
  const next = curList.slice(shown, shown + BATCH);
  if (!next.length) { watchMore(); return; }   // empty result: drop the old scroll trigger
  grid.insertAdjacentHTML('beforeend', next.map(cardHTML).join(''));
  const kids = grid.children;
  next.forEach((_, i) => { if (kids[shown + i]) kids[shown + i].style.animationDelay = `${i * 50}ms`; });
  shown += next.length;
  cycleGalleries('#projectsGrid', '.pcard', 4000);
  if (window.cardContact) window.cardContact.wire(grid);
  watchMore();
}
function watchMore(){
  if (moreObs) moreObs.disconnect();
  if (shown >= curList.length) { if (sentinel) sentinel.remove(); sentinel = null; return; }
  if (!('IntersectionObserver' in window)) { appendBatch(); return; }   // no observer: draw the rest
  if (!sentinel) { sentinel = document.createElement('div'); sentinel.style.height = '1px'; grid.after(sentinel); }
  if (!moreObs) moreObs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) appendBatch(); }, { rootMargin: '900px 0px' });
  moreObs.observe(sentinel);   // re-observing re-fires while the sentinel is still near the viewport
}

function render(){
  const list = getFiltered();
  // clear any running gallery timers before replacing the cards
  grid.querySelectorAll('[data-gallery]').forEach(b => { if (b._tid) clearInterval(b._tid); });
  curList = list; shown = 0;
  grid.innerHTML = '';
  appendBatch();
  resCount.textContent = list.length;
  emptyState.hidden = list.length !== 0;
  // a developer page whose developer has no projects yet says so, instead of "no projects match those filters"
  const L = window.__LANDING;
  if (L && L.empty && L.kind === 'developer' && !list.length && state.developer === L.name && !emptyState.dataset.dev) {
    emptyState.dataset.dev = '1';
    emptyState.querySelector('h3').textContent = t('No projects published yet for this developer');
    emptyState.querySelector('p').textContent = t('New projects are added regularly. Browse everything we have in the meantime.');
    const b = emptyState.querySelector('button');
    const a = document.createElement('a');
    a.className = 'btn btn-dark'; a.href = '/projects.html'; a.style.marginTop = '1.2rem'; a.textContent = t('Browse all projects');
    b.replaceWith(a);
  }
  resetBtn.hidden = !(state.cat !== 'all' || state.city !== 'all' || state.developer !== 'all' || state.q || state.sort !== 'featured');
  searchClear.hidden = !state.q;
  renderIntro();
  renderHero();
}

/* a city's own cover replaces the default page banner while that city is the
   active filter; any other state puts the default banner back */
const heroEl = document.querySelector('.subpage-hero');
const DEFAULT_HERO_BG = heroEl ? heroEl.style.getPropertyValue('--bg') : '';
function renderHero(){
  if (!heroEl) return;
  const row = state.city !== 'all' ? CITIES.find(c => c.name === state.city) : null;
  heroEl.style.setProperty('--bg', row && row.image ? `url('${U(row.image, 1700)}')` : DEFAULT_HERO_BG);
}

/* the city's / developer's own paragraph (written in the admin), shown above
   the list while that filter is active. Each language shows only its own
   text; nothing renders if there isn't one. */
const fullRowsPromise = {};
function loadFullRows(kind) {
  if (!fullRowsPromise[kind]) {
    fullRowsPromise[kind] = (async () => {
      let rows = null;
      try {
        const r = await fetch('/api/list?t=' + kind);
        if (r.ok) rows = await r.json();
      } catch (_) {}
      if (!Array.isArray(rows) && window.store && window.store.sb) {
        try { const { data } = await window.store.sb.from(kind).select('*').eq('published', true); rows = data; } catch (_) {}
      }
      const list = kind === 'developers' ? DEVS : CITIES;
      (rows || []).forEach(full => {
        const own = list.find(x => x.id === full.id);
        if (own) Object.assign(own, full);
      });
      // never ask twice: rows still without the key just have no intro text
      list.forEach(x => { if (!('description' in x)) x.description = ''; if (!('description_ar' in x)) x.description_ar = ''; });
    })();
  }
  return fullRowsPromise[kind];
}

function renderIntro(){
  const box = document.getElementById('listingIntro');
  if (!box) return;
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const row = state.developer !== 'all' ? DEVS.find(d => d.name === state.developer)
    : state.city !== 'all' ? CITIES.find(c => c.name === state.city) : null;
  // the page arrives with city / developer rows WITHOUT their long text (keeps
  // the first HTML small); the first time one is chosen, fetch the full rows
  if (row && !('description' in row)) {
    const kind = state.developer !== 'all' ? 'developers' : 'cities';
    loadFullRows(kind).then(() => renderIntro());
  }
  const text = row ? ((isAr() ? row.description_ar : row.description) || '') : '';
  const wrap = document.getElementById('listingWrap');
  if (!row || !text.trim()) { box.hidden = true; box.innerHTML = ''; if (wrap) wrap.classList.remove('has-intro'); return; }
  // [link text](https://…) written in the admin becomes a real link; only
  // http(s), mailto, tel and site-relative targets are accepted
  const withLinks = (x) => esc(x).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(url)
    ? `<a href="${url}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : ''}>${label}</a>` : m);
  const paras = text.split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => `<p>${withLinks(x)}</p>`).join('');
  const photo = state.developer !== 'all' && row.logo ? `<img class="li-logo" src="${U(row.logo, 200)}" alt="${esc(row.name)}">` : '';
  box.innerHTML = photo + `<h2>${esc(row.name)}</h2>${paras}`;
  box.hidden = false;
  if (wrap) wrap.classList.add('has-intro');
}

/* ---------- events ---------- */
catChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if(!chip) return;
  catChips.querySelector('.active')?.classList.remove('active');
  chip.classList.add('active');
  state.cat = chip.dataset.cat;
  whenFull(render);
});
citySelect.addEventListener('change', () => { state.city = citySelect.value; whenFull(render); });
sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; whenFull(render); });

let searchT;
searchInput.addEventListener('input', () => {
  clearTimeout(searchT);
  searchT = setTimeout(() => { state.q = searchInput.value; whenFull(render); }, 160);
});
searchClear.addEventListener('click', () => { searchInput.value = ''; state.q = ''; whenFull(render); searchInput.focus(); });

function resetAll(){
  state = { ...state, cat: 'all', city: 'all', developer: 'all', q: '', sort: 'featured' };
  catChips.querySelector('.active')?.classList.remove('active');
  catChips.querySelector('[data-cat="all"]').classList.add('active');
  citySelect.value = 'all';
  sortSelect.value = 'featured';
  searchInput.value = '';
  whenFull(render);
}
resetBtn.addEventListener('click', resetAll);
document.getElementById('emptyReset').addEventListener('click', resetAll);

/* apply ?city=&cat= handed off from the home page hero search, if present */
function applyURLParams() {
  const params = new URLSearchParams(location.search);
  const city = params.get('city');
  const cat = params.get('cat');
  const dev = params.get('developer');
  // /city/<slug> and /developer/<slug> pages start with their city / developer selected
  const L = window.__LANDING;
  if (L && L.kind === 'developer' && (L.empty || P.some(p => p.developer === L.name))) state.developer = L.name;
  if (L && L.kind === 'city' && [...citySelect.options].some(o => o.value === L.name)) { state.city = L.name; citySelect.value = L.name; }
  if (dev && P.some(p => p.developer === dev)) state.developer = dev;
  if (city && [...citySelect.options].some(o => o.value === city)) {
    state.city = city;
    citySelect.value = city;
  }
  if (cat) {
    const chip = catChips.querySelector(`[data-cat="${CSS.escape(cat)}"]`);
    if (chip) {
      state.cat = cat;
      catChips.querySelector('.active')?.classList.remove('active');
      chip.classList.add('active');
    }
  }
}

/* ---------- boot: load projects from the data layer ---------- */
(async function () {
  // partial first HTML (see appendBatch); a page that starts already filtered
  // (?city= / ?cat= / ?developer=) needs the complete rows for its first paint
  const quick = !!(window.__PRELOAD_PARTIAL && window.__PRELOAD_PARTIAL.projects) && !/[?&](city|cat|developer)=/.test(location.search);
  try {
    const [projects, cities, devs] = await Promise.all([window.store.getProjects(quick ? { quick: true } : undefined), window.store.getCities ? window.store.getCities() : [], window.store.getDevelopers ? window.store.getDevelopers() : [], window.store.getCategories ? window.store.getCategories() : null]);
    P = projects; CITIES = cities || []; DEVS = devs || []; window.registerCities(CITIES);
  } catch (e) { P = window.PROJECTS || []; }
  if (!P || !P.length) P = window.PROJECTS || [];
  if (quick) {
    fullDone = false;
    fullP = Promise.resolve(window.store.getProjects()).then(full => {
      if (Array.isArray(full) && full.length) {
        // keep the order of the first paint so the next batches continue where it stopped
        const byId = new Map(full.map(r => [r.dbId || r.id, r]));
        const seen = new Set(P.map(r => r.dbId || r.id));
        P = P.map(r => byId.get(r.dbId || r.id) || r).concat(full.filter(r => !seen.has(r.dbId || r.id)));
      }
    }).catch(() => {}).then(() => { fullDone = true; curList = getFiltered(); watchMore(); });
  }
  buildFacets();
  applyURLParams();
  render();
})();

/* ---------- header + mobile nav ---------- */
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
navToggle.addEventListener('click', () => nav.classList.toggle('open'));
nav.addEventListener('click', e => { if(e.target.tagName === 'A') nav.classList.remove('open'); });
document.addEventListener('click', e => {
  if (nav.classList.contains('open') && !nav.contains(e.target) && !navToggle.contains(e.target)) nav.classList.remove('open');
});

const header = document.getElementById('header');
const onHeaderScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
onHeaderScroll();
window.addEventListener('scroll', onHeaderScroll, { passive: true });
