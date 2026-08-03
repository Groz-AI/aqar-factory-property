/* ============================================================
   AQAR FACTORY — Units listing: search · type · city · sort
   ============================================================ */
let P = [];
const grid = document.getElementById('unitsGrid');
const emptyState = document.getElementById('emptyState');
const resCount = document.getElementById('resCount');
const typeChips = document.getElementById('typeChips');
const citySelect = document.getElementById('citySelect');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const resetBtn = document.getElementById('resetBtn');

const pinSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>`;
const arrowSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- animated cover: cross-fades through the unit's own gallery ---------- */
function unitImages(u) {
  const imgs = (u.gallery || []).filter(Boolean);
  return imgs.length ? imgs.slice(0, 6) : [u.cover].filter(Boolean);
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

let state = { type: 'all', city: 'all', q: '', sort: 'featured' };

/* build type chips + city dropdown from the loaded dataset */
function buildFacets() {
  const types = ['all', ...new Set(P.map(u => u.type).filter(Boolean))];
  typeChips.innerHTML = types.map((ty, i) =>
    `<button class="chip ${i === 0 ? 'active' : ''}" data-type="${ty}">${ty === 'all' ? t('All') : t(ty)}</button>`
  ).join('');
  const cities = [...new Set(P.map(u => u.cityName).filter(Boolean))].sort();
  citySelect.insertAdjacentHTML('beforeend',
    cities.map(c => `<option value="${c}">${c}</option>`).join(''));
}

function cardHTML(u) {
  const imgs = unitImages(u);
  const slides = imgs.map((g, n) =>
    `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${U(g, 800)}')"></div>`).join('');
  const dots = imgs.length > 1
    ? `<div class="pg-dots">${imgs.map((_, n) => `<i class="${n === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
  return `
  <a class="pcard" href="unit.html?id=${encodeURIComponent(u.id)}">
    <div class="pcard-img" data-gallery>
      ${slides}<div class="pg-shade"></div>
      ${u.badge ? `<span class="pcard-status for-sale"><i></i>${t(u.badge)}</span>` : ''}
      <span class="pcard-cat">${u.type ? t(u.type) : ''}</span>
      ${dots}${window.cardContact ? window.cardContact.markup(u.name) : ''}
    </div>
    <div class="pcard-body">
      <h3>${u.name || ''}</h3>
      <p class="pcard-loc">${pinSVG}${u.location || ''}</p>
      <p class="pcard-tag">${[u.beds ? `${u.beds} ${t('Beds')}` : '', u.baths ? `${u.baths} ${t('Baths')}` : '', u.area || ''].filter(Boolean).join(' · ')}</p>
      <div class="pcard-foot">
        <span class="pcard-price">${window.formatPrice ? window.formatPrice(u.price) : (u.price || '')}</span>
        <span class="arrow">${arrowSVG}</span>
      </div>
    </div>
  </a>`;
}

/* ---------- filtering + sorting ---------- */
function getFiltered() {
  const q = state.q.trim().toLowerCase();
  let list = P.filter(u =>
    (state.type === 'all' || u.type === state.type) &&
    (state.city === 'all' || u.cityName === state.city) &&
    (!q || [u.name, u.type, u.location, u.cityName].join(' ').toLowerCase().includes(q))
  );
  const byNum = (key, dir) => (a, b) => dir * ((Number(a[key]) || 0) - (Number(b[key]) || 0));
  switch (state.sort) {
    case 'price-desc': list.sort(byNum('priceValue', -1)); break;
    case 'price-asc':  list.sort(byNum('priceValue', 1)); break;
    case 'area-desc':  list.sort(byNum('areaValue', -1)); break;
    case 'area-asc':   list.sort(byNum('areaValue', 1)); break;
    case 'name-asc':   list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
  }
  return list;
}

function render() {
  const list = getFiltered();
  grid.querySelectorAll('[data-gallery]').forEach(b => { if (b._tid) clearInterval(b._tid); });
  grid.innerHTML = list.map(cardHTML).join('');
  [...grid.children].forEach((el, i) => el.style.animationDelay = `${i * 50}ms`);
  resCount.textContent = list.length;
  emptyState.hidden = list.length !== 0;
  resetBtn.hidden = !(state.type !== 'all' || state.city !== 'all' || state.q || state.sort !== 'featured');
  searchClear.hidden = !state.q;
  cycleGalleries('#unitsGrid', '.pcard', 4000);
  if (window.cardContact) window.cardContact.wire(grid);
}

/* ---------- events ---------- */
typeChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  typeChips.querySelector('.active')?.classList.remove('active');
  chip.classList.add('active');
  state.type = chip.dataset.type;
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

function resetAll() {
  state = { ...state, type: 'all', city: 'all', q: '', sort: 'featured' };
  typeChips.querySelector('.active')?.classList.remove('active');
  typeChips.querySelector('[data-type="all"]').classList.add('active');
  citySelect.value = 'all';
  sortSelect.value = 'featured';
  searchInput.value = '';
  render();
}
resetBtn.addEventListener('click', resetAll);
document.getElementById('emptyReset').addEventListener('click', resetAll);

/* apply ?city=&type= handed off from another page, if present */
function applyURLParams() {
  const params = new URLSearchParams(location.search);
  const city = params.get('city');
  const type = params.get('type');
  if (city && [...citySelect.options].some(o => o.value === city)) {
    state.city = city;
    citySelect.value = city;
  }
  if (type) {
    const chip = typeChips.querySelector(`[data-type="${CSS.escape(type)}"]`);
    if (chip) {
      state.type = type;
      typeChips.querySelector('.active')?.classList.remove('active');
      chip.classList.add('active');
    }
  }
}

/* ---------- boot: load units (+ their resolved city name) from the data layer ---------- */
(async function () {
  try {
    const [units, projects, cities] = await Promise.all([
      window.store.getUnits ? window.store.getUnits() : [],
      window.store.getProjects ? window.store.getProjects() : [],
      window.store.getCities ? window.store.getCities() : [],
      window.store.getCategories ? window.store.getCategories() : null
    ]);
    const projectsByDbId = {};
    (projects || []).forEach(pr => { if (pr.dbId) projectsByDbId[pr.dbId] = pr; });
    const cityById = {};
    (cities || []).forEach(c => { cityById[c.id] = c; });

    P = (units || []).map(u => {
      const linkedProject = u.projectId ? projectsByDbId[u.projectId] : null;
      const cityId = linkedProject ? linkedProject.cityId : u.cityId;
      const cityRow = cityId ? cityById[cityId] : null;
      return Object.assign({}, u, { cityName: (linkedProject && linkedProject.city) || (cityRow && cityRow.name) || '' });
    });
  } catch (e) { P = []; }
  buildFacets();
  applyURLParams();
  render();
})();

/* ---------- header + mobile nav ---------- */
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
navToggle.addEventListener('click', () => nav.classList.toggle('open'));
nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('open'); });
document.addEventListener('click', e => {
  if (nav.classList.contains('open') && !nav.contains(e.target) && !navToggle.contains(e.target)) nav.classList.remove('open');
});

const header = document.getElementById('header');
const onHeaderScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
onHeaderScroll();
window.addEventListener('scroll', onHeaderScroll, { passive: true });
