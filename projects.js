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
      window.loadSlide && window.loadSlide(slides[i]);
      slides[i].classList.add('active');
      window.loadSlide && window.loadSlide(slides[(i + 1) % slides.length]);
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
    cities.map(c => `<option value="${c}">${c}</option>`).join(''));
}

const statusClass = s => (s || '').toLowerCase().replace(/[^a-z]/g, '-');

const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
function pick(p, key, arKey) {
  if (isAr()) {
    const v = p[arKey];
    if (v) return v;
  }
  return p[key];
}

function cardHTML(p){
  const stats = p.stats || {};
  const imgs = projectImages(p);
  const slides = imgs.map((g, n) =>
    `<div class="pg-slide${n === 0 ? ' active' : ''}" data-bg="${U(g, 800)}"></div>`).join('');
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
      <p class="pcard-loc">${pinSVG}${p.location || ''}</p>
      <p class="pcard-tag">${p.tagline || ''}</p>
      <div class="pcard-foot">
        <span class="pcard-price">${window.formatPrice ? window.formatPrice(stats.price) : (stats.price || '')}</span>
        <span class="arrow">${arrowSVG}</span>
      </div>
    </div>
  </a>`;
}

/* ---------- filtering + sorting ---------- */
function getFiltered(){
  const q = state.q.trim().toLowerCase();
  let list = P.filter(p =>
    (state.cat === 'all' || p.category === state.cat) &&
    (state.city === 'all' || p.city === state.city) &&
    (state.developer === 'all' || p.developer === state.developer) &&
    (!q || [p.name, p.nameAr, p.city, p.location, p.category, p.developer].join(' ').toLowerCase().includes(q))
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

function render(){
  const list = getFiltered();
  // clear any running gallery timers before replacing the cards
  grid.querySelectorAll('[data-gallery]').forEach(b => { if (b._tid) clearInterval(b._tid); });
  grid.innerHTML = list.map(cardHTML).join('');
  [...grid.children].forEach((el, i) => el.style.animationDelay = `${i * 50}ms`);
  resCount.textContent = list.length;
  emptyState.hidden = list.length !== 0;
  resetBtn.hidden = !(state.cat !== 'all' || state.city !== 'all' || state.developer !== 'all' || state.q || state.sort !== 'featured');
  searchClear.hidden = !state.q;
  cycleGalleries('#projectsGrid', '.pcard', 4000);
  if (window.cardContact) window.cardContact.wire(grid);
  renderIntro();
}

/* the city's / developer's own paragraph (written in the admin), shown above
   the list while that filter is active. Each language shows only its own
   text; nothing renders if there isn't one. */
function renderIntro(){
  const box = document.getElementById('listingIntro');
  if (!box) return;
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const row = state.developer !== 'all' ? DEVS.find(d => d.name === state.developer)
    : state.city !== 'all' ? CITIES.find(c => c.name === state.city) : null;
  const text = row ? ((isAr() ? row.description_ar : row.description) || '') : '';
  const wrap = document.getElementById('listingWrap');
  if (!row || !text.trim()) { box.hidden = true; box.innerHTML = ''; if (wrap) wrap.classList.remove('has-intro'); return; }
  const paras = text.split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');
  const photo = state.developer !== 'all' ? (row.logo ? `<img class="li-logo" src="${U(row.logo, 200)}" alt="${esc(row.name)}">` : '')
    : (row.image ? `<img class="li-photo" src="${U(row.image, 700)}" alt="${esc(row.name)}">` : '');
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
  render();
});
citySelect.addEventListener('change', () => { state.city = citySelect.value; render(); });
sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; render(); });

let searchT;
searchInput.addEventListener('input', () => {
  clearTimeout(searchT);
  searchT = setTimeout(() => { state.q = searchInput.value; render(); }, 160);
});
searchClear.addEventListener('click', () => { searchInput.value = ''; state.q = ''; render(); searchInput.focus(); });

function resetAll(){
  state = { ...state, cat: 'all', city: 'all', developer: 'all', q: '', sort: 'featured' };
  catChips.querySelector('.active')?.classList.remove('active');
  catChips.querySelector('[data-cat="all"]').classList.add('active');
  citySelect.value = 'all';
  sortSelect.value = 'featured';
  searchInput.value = '';
  render();
}
resetBtn.addEventListener('click', resetAll);
document.getElementById('emptyReset').addEventListener('click', resetAll);

/* apply ?city=&cat= handed off from the home page hero search, if present */
function applyURLParams() {
  const params = new URLSearchParams(location.search);
  const city = params.get('city');
  const cat = params.get('cat');
  const dev = params.get('developer');
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
  try {
    const [projects, cities, devs] = await Promise.all([window.store.getProjects(), window.store.getCities ? window.store.getCities() : [], window.store.getDevelopers ? window.store.getDevelopers() : [], window.store.getCategories ? window.store.getCategories() : null]);
    P = projects; CITIES = cities || []; DEVS = devs || [];
  } catch (e) { P = window.PROJECTS || []; }
  if (!P || !P.length) P = window.PROJECTS || [];
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
