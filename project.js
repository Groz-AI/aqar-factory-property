/* ============================================================
   REALTEEK — Project detail: populate from ?id, gallery lightbox
   ============================================================ */
const params = new URLSearchParams(location.search);
const id = params.get('id');

const pinSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>`;
const checkSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const arrowSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const statusClass = s => (s || '').toLowerCase().replace(/[^a-z]/g, '-');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

let ALL = [];
let project = null;

function populate() {
  document.title = `${project.name} — Realteek`;

  const heroImg = document.getElementById('heroImg');
  if (heroImg._tid) clearInterval(heroImg._tid);
  const heroImgs = projectImages(project);
  heroImg.innerHTML = heroImgs.map((g, n) =>
    `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${U(g, 1600)}')"></div>`).join('');

  document.getElementById('projName').textContent = project.name;
  document.getElementById('crumbName').textContent = project.name;
  document.getElementById('projLoc').innerHTML = `${pinSVG}${project.location || ''}`;
  document.getElementById('tagline').textContent = project.tagline || '';
  document.getElementById('badges').innerHTML = `
    <span class="dbadge dark">${project.category || ''}</span>
    <span class="dbadge">${project.status || ''}</span>
    <span class="dbadge">${project.year || ''}</span>`;

  document.getElementById('about').innerHTML = (project.about || []).map(p => `<p>${p}</p>`).join('');
  document.getElementById('amenities').innerHTML = (project.amenities || []).map(a =>
    `<div class="amenity"><span class="ic">${checkSVG}</span>${a}</div>`).join('');

  const st = project.stats || {};
  const priceEl = document.getElementById('price');
  if (st.price) { priceEl.innerHTML = `<small>Starting from</small>${st.price}`; priceEl.hidden = false; }
  else { priceEl.hidden = true; }

  const facts = [
    ['Status', project.status],
    ['Handover', st.handover],
    ['Units', st.units],
    ['Floors', st.floors],
    ['Unit size', st.area],
    ['City', project.city],
    ['Location', project.location],
  ];
  document.getElementById('factList').innerHTML = facts
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  document.getElementById('devName').textContent = project.developer || '';
  document.getElementById('devAv').textContent = (project.developer || '·').charAt(0);

  const brochureBtn = document.getElementById('brochureBtn');
  if (project.brochurePdf) { brochureBtn.href = project.brochurePdf; brochureBtn.hidden = false; }
  else { brochureBtn.hidden = true; }

  const consultants = (project.consultants || []).filter(c => c && (c.name || c.logo));
  const consultantsWrap = document.getElementById('consultants');
  if (consultants.length) {
    document.getElementById('consultantsList').innerHTML = consultants.map(c => `
      <li>${c.logo ? `<img src="${U(c.logo, 100)}" alt="">` : ''}<span>${esc(c.name || '')}</span></li>`).join('');
    consultantsWrap.hidden = false;
  } else {
    consultantsWrap.hidden = true;
  }

  const galleryEl = document.getElementById('gallery');
  galleryEl.innerHTML = (project.gallery || []).map((g, i) =>
    `<figure data-idx="${i}"><img src="${U(g, 800)}" alt="${project.name} photo ${i + 1}" loading="lazy" /></figure>`).join('');

  renderRelated();
  cycleGalleries('#detailHero', '.detail-hero', 7000);
  window.scrollTo(0, 0);
}

/* ---- lightbox ---- */
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCount = document.getElementById('lbCount');
let lbIndex = 0;
function gallery() { return (project && project.gallery) || []; }
function openLb(i) {
  const g = gallery();
  if (!g.length) return;
  lbIndex = (i + g.length) % g.length;
  lbImg.src = U(g[lbIndex], 1600);
  lbCount.textContent = `${String(lbIndex + 1).padStart(2, '0')} / ${String(g.length).padStart(2, '0')}`;
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
}
function closeLb() { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); }
document.getElementById('gallery').addEventListener('click', e => {
  const fig = e.target.closest('figure');
  if (fig) openLb(+fig.dataset.idx);
});
document.getElementById('lbClose').addEventListener('click', closeLb);
document.getElementById('lbNext').addEventListener('click', () => openLb(lbIndex + 1));
document.getElementById('lbPrev').addEventListener('click', () => openLb(lbIndex - 1));
lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
document.addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowRight') openLb(lbIndex + 1);
  if (e.key === 'ArrowLeft') openLb(lbIndex - 1);
});

/* ---- related projects ---- */
function renderRelated() {
  const grid = document.getElementById('related');
  grid.querySelectorAll('[data-gallery]').forEach(b => { if (b._tid) clearInterval(b._tid); });
  const related = ALL
    .filter(p => p.id !== project.id)
    .sort((a, b) => (b.city === project.city) - (a.city === project.city) || (b.category === project.category) - (a.category === project.category))
    .slice(0, 3);
  grid.innerHTML = related.map(p => {
    const imgs = projectImages(p);
    const slides = imgs.map((g, n) =>
      `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${U(g, 800)}')"></div>`).join('');
    const dots = imgs.length > 1
      ? `<div class="pg-dots">${imgs.map((_, n) => `<i class="${n === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
    return `
    <a class="pcard" href="project.html?id=${encodeURIComponent(p.id)}">
      <div class="pcard-img" data-gallery>
        ${slides}<div class="pg-shade"></div>
        <span class="pcard-status ${statusClass(p.status)}"><i></i>${p.status || ''}</span>
        <span class="pcard-cat">${p.category || ''}</span>
        ${dots}
      </div>
      <div class="pcard-body">
        <h3>${p.name}</h3>
        <p class="pcard-loc">${pinSVG}${p.location || ''}</p>
        <p class="pcard-tag">${p.tagline || ''}</p>
        <div class="pcard-foot"><span class="pcard-price">${(p.stats || {}).price || ''}</span><span class="arrow">${arrowSVG}</span></div>
      </div>
    </a>`;
  }).join('');
  cycleGalleries('#related', '.pcard', 4000);
}

/* ---- nav ---- */
const nav = document.getElementById('nav');
document.getElementById('navToggle').addEventListener('click', () => nav.classList.toggle('open'));
nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('open'); });

const header = document.getElementById('header');
const onHeaderScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
onHeaderScroll();
window.addEventListener('scroll', onHeaderScroll, { passive: true });

/* ---- boot ---- */
(async function () {
  try { ALL = await window.store.getProjects(); }
  catch (e) { ALL = window.PROJECTS || []; }
  if (!ALL || !ALL.length) ALL = window.PROJECTS || [];
  project = ALL.find(p => p.id === id) || ALL[0];
  populate();
})();
