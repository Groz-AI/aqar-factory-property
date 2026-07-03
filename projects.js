/* ============================================================
   REALTEEK — Projects listing: search · category · city · sort · map
   ============================================================ */
let P = [];
const grid = document.getElementById('projectsGrid');
const mapWrap = document.getElementById('mapWrap');
const emptyState = document.getElementById('emptyState');
const resCount = document.getElementById('resCount');
const catChips = document.getElementById('catChips');
const citySelect = document.getElementById('citySelect');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const resetBtn = document.getElementById('resetBtn');
const viewToggle = document.getElementById('viewToggle');

const pinSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>`;
const arrowSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let state = { cat: 'all', city: 'all', q: '', sort: 'featured', view: 'list' };

/* build category chips + city dropdown from the loaded dataset */
function buildFacets() {
  const categories = ['all', ...new Set(P.map(p => p.category))];
  catChips.innerHTML = categories.map((c, i) =>
    `<button class="chip ${i === 0 ? 'active' : ''}" data-cat="${c}">${c === 'all' ? 'All' : c}</button>`
  ).join('');
  const cities = [...new Set(P.map(p => p.city))].sort();
  citySelect.insertAdjacentHTML('beforeend',
    cities.map(c => `<option value="${c}">${c}</option>`).join(''));
}

const statusClass = s => (s || '').toLowerCase().replace(/[^a-z]/g, '-');

function cardHTML(p){
  const stats = p.stats || {};
  return `
  <a class="pcard" href="project.html?id=${encodeURIComponent(p.id)}">
    <div class="pcard-img">
      <img src="${U(p.cover, 800)}" alt="${p.name || ''}" loading="lazy" />
      <span class="pcard-status ${statusClass(p.status)}"><i></i>${p.status || ''}</span>
      <span class="pcard-cat">${p.category || ''}</span>
    </div>
    <div class="pcard-body">
      <h3>${p.name || ''}</h3>
      <p class="pcard-loc">${pinSVG}${p.location || ''}</p>
      <p class="pcard-tag">${p.tagline || ''}</p>
      <div class="pcard-foot">
        <span class="pcard-price">${stats.price || ''}</span>
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
    (!q || [p.name, p.city, p.location, p.category, p.developer].join(' ').toLowerCase().includes(q))
  );
  const byNum = (key, dir) => (a, b) => dir * ((Number(a[key]) || 0) - (Number(b[key]) || 0));
  switch(state.sort){
    case 'price-desc': list.sort(byNum('priceValue', -1)); break;
    case 'price-asc':  list.sort(byNum('priceValue', 1)); break;
    case 'area-desc':  list.sort(byNum('areaValue', -1)); break;
    case 'area-asc':   list.sort(byNum('areaValue', 1)); break;
    case 'year-desc':  list.sort(byNum('year', -1)); break;
    case 'name-asc':   list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
  }
  return list;
}

function render(){
  const list = getFiltered();
  grid.innerHTML = list.map(cardHTML).join('');
  [...grid.children].forEach((el, i) => el.style.animationDelay = `${i * 50}ms`);
  resCount.textContent = list.length;
  emptyState.hidden = list.length !== 0;
  resetBtn.hidden = !(state.cat !== 'all' || state.city !== 'all' || state.q || state.sort !== 'featured');
  searchClear.hidden = !state.q;
  if(state.view === 'map') renderMap(list);
}

/* ---------- map (Leaflet) ---------- */
let map, markerLayer;
function ensureMap(){
  if(map || !window.L) return;
  map = L.map('map', { scrollWheelZoom: false, zoomControl: true }).setView([25, 30], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19, subdomains: 'abcd'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}
function renderMap(list){
  ensureMap();
  if(!map) return;
  setTimeout(() => map.invalidateSize(), 50);
  markerLayer.clearLayers();
  const pts = [];
  list.forEach(p => {
    const stats = p.stats || {};
    const icon = L.divIcon({
      className: 'rt-pin',
      html: `<span>${stats.price || ''}</span>`,
      iconSize: [60, 28], iconAnchor: [30, 32]
    });
    const m = L.marker(p.coords, { icon }).addTo(markerLayer);
    m.bindPopup(
      `<a class="map-pop" href="project.html?id=${encodeURIComponent(p.id)}">
        <img src="${U(p.cover, 320)}" alt="${p.name || ''}" />
        <strong>${p.name || ''}</strong>
        <span>${p.location || ''}</span>
        <b>${stats.price || ''}</b>
      </a>`, { closeButton: true, minWidth: 200 }
    );
    pts.push(p.coords);
  });
  if(pts.length) map.fitBounds(pts, { padding: [60, 60], maxZoom: 12 });
}

/* ---------- view toggle ---------- */
viewToggle.addEventListener('click', e => {
  const btn = e.target.closest('.vt-btn');
  if(!btn) return;
  viewToggle.querySelector('.active')?.classList.remove('active');
  btn.classList.add('active');
  state.view = btn.dataset.view;
  const mapView = state.view === 'map';
  grid.hidden = mapView;
  mapWrap.hidden = !mapView;
  if(mapView) render();
});

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
  state = { ...state, cat: 'all', city: 'all', q: '', sort: 'featured' };
  catChips.querySelector('.active')?.classList.remove('active');
  catChips.querySelector('[data-cat="all"]').classList.add('active');
  citySelect.value = 'all';
  sortSelect.value = 'featured';
  searchInput.value = '';
  render();
}
resetBtn.addEventListener('click', resetAll);
document.getElementById('emptyReset').addEventListener('click', resetAll);

/* ---------- boot: load projects from the data layer ---------- */
(async function () {
  try { P = await window.store.getProjects(); }
  catch (e) { P = window.PROJECTS || []; }
  if (!P || !P.length) P = window.PROJECTS || [];
  buildFacets();
  render();
})();

/* ---------- header + mobile nav ---------- */
const nav = document.getElementById('nav');
document.getElementById('navToggle').addEventListener('click', () => nav.classList.toggle('open'));
nav.addEventListener('click', e => { if(e.target.tagName === 'A') nav.classList.remove('open'); });

const header = document.getElementById('header');
const onHeaderScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
onHeaderScroll();
window.addEventListener('scroll', onHeaderScroll, { passive: true });
