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

const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
// prefer the Arabic "about" blocks when the site is in Arabic mode and
// they're filled in, otherwise fall back to the English ones — same
// pattern as the blog article's bilingual title/excerpt/tags/blocks
function pick(p, key, arKey) {
  if (isAr()) {
    const v = p[arKey];
    if (Array.isArray(v) ? v.length : v) return v;
  }
  return p[key];
}

// injects/updates a single <script type="application/ld+json"> in <head> —
// JSON.stringify silently drops any key whose value is `undefined`, so
// callers can freely include optional fields (image, offers, address…)
// without a manual "is this set?" filter pass
function injectJsonLd(data) {
  let el = document.getElementById('ldJson');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'ldJson';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

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
  const customTitle = pick(project, 'seoTitle', 'seoTitleAr');
  document.title = customTitle || `${pick(project, 'name', 'nameAr') || project.name} — Aqar Factory`;
  const metaDesc = document.querySelector('meta[name="description"]');
  const desc = pick(project, 'seoDescription', 'seoDescriptionAr') || project.tagline || (project.about && project.about[0]) || '';
  if (metaDesc && desc) metaDesc.setAttribute('content', desc.length > 160 ? desc.slice(0, 157) + '…' : desc);
  // canonical/hreflang are handled generically (and language-aware) by
  // i18n.js's injectSeoLinks() — it self-references the current URL, which
  // already includes this page's ?id=, so no per-page override is needed
  // here (a hardcoded English-only URL would be wrong on the /ar/ version).

  injectJsonLd({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    mainEntityOfPage: { '@type': 'WebPage', '@id': location.href },
    url: location.href,
    name: customTitle || pick(project, 'name', 'nameAr') || project.name,
    description: desc || undefined,
    image: project.cover ? U(project.cover, 1600) : undefined,
    address: (project.city || project.location || project.country) ? {
      '@type': 'PostalAddress',
      addressLocality: project.city || project.location || '',
      addressCountry: project.country || undefined
    } : undefined,
    offers: (project.stats && project.stats.price) ? {
      '@type': 'Offer',
      price: project.priceValue || undefined,
      priceCurrency: 'EGP',
      availability: 'https://schema.org/InStock'
    } : undefined,
    publisher: { '@type': 'Organization', name: 'Aqar Factory', url: 'https://www.aqar-factory.com' }
  });

  const heroImg = document.getElementById('heroImg');
  if (heroImg._tid) clearInterval(heroImg._tid);
  const heroImgs = projectImages(project);
  heroImg.innerHTML = heroImgs.map((g, n) =>
    `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${U(g, 1600)}')"></div>`).join('');

  const displayName = pick(project, 'name', 'nameAr') || project.name;
  document.getElementById('projName').textContent = displayName;
  document.getElementById('crumbName').textContent = displayName;
  document.getElementById('projLoc').innerHTML = `${pinSVG}${project.location || ''}`;
  document.getElementById('tagline').textContent = project.tagline || '';
  document.getElementById('badges').innerHTML = `
    <span class="dbadge dark">${project.category ? t(project.category) : ''}</span>
    <span class="dbadge">${project.status || ''}</span>
    <span class="dbadge">${project.year || ''}</span>`;

  document.getElementById('about').innerHTML = window.renderBlocks(pick(project, 'aboutBlocks', 'aboutBlocksAr'));
  document.getElementById('amenities').innerHTML = (project.amenities || []).map(a =>
    `<div class="amenity"><span class="ic">${checkSVG}</span>${a}</div>`).join('');

  const st = project.stats || {};
  const priceEl = document.getElementById('price');
  if (st.price) { priceEl.innerHTML = `<small>${t('Starting from')}</small>${window.formatPrice ? window.formatPrice(st.price) : st.price}`; priceEl.hidden = false; }
  else { priceEl.hidden = true; }

  const sidebarContact = document.getElementById('sidebarContact');
  if (sidebarContact && window.cardContact) {
    sidebarContact.innerHTML = window.cardContact.markup(project.name, { inline: true });
    window.cardContact.wire(sidebarContact);
  }

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
    .map(([k, v]) => `<div><dt>${t(k)}</dt><dd>${v}</dd></div>`).join('');
  document.getElementById('devName').textContent = project.developer || '';
  const devAv = document.getElementById('devAv');
  if (project.developerLogo) {
    devAv.innerHTML = `<img src="${U(project.developerLogo, 80)}" alt="${project.developer || ''}">`;
    devAv.classList.add('has-logo');
  } else {
    devAv.textContent = (project.developer || '·').charAt(0);
    devAv.classList.remove('has-logo');
  }

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
    const devLogo = p.developerLogo
      ? `<span class="pcard-dev-logo"><img src="${U(p.developerLogo, 100)}" alt="${p.developer || ''}" title="${p.developer || ''}"></span>` : '';
    return `
    <a class="pcard" href="project.html?id=${encodeURIComponent(p.id)}">
      <div class="pcard-img" data-gallery>
        ${slides}<div class="pg-shade"></div>
        <span class="pcard-status ${statusClass(p.status)}"><i></i>${p.status || ''}</span>
        <span class="pcard-cat">${p.category ? t(p.category) : ''}</span>
        ${devLogo}
        ${dots}${window.cardContact ? window.cardContact.markup(p.name) : ''}
      </div>
      <div class="pcard-body">
        <h3>${p.name}</h3>
        <p class="pcard-loc">${pinSVG}${p.location || ''}</p>
        <p class="pcard-tag">${p.tagline || ''}</p>
        <div class="pcard-foot"><span class="pcard-price">${window.formatPrice ? window.formatPrice((p.stats || {}).price) : ((p.stats || {}).price || '')}</span><span class="arrow">${arrowSVG}</span></div>
      </div>
    </a>`;
  }).join('');
  cycleGalleries('#related', '.pcard', 4000);
  if (window.cardContact) window.cardContact.wire(grid);
}

/* ---- nav ---- */
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

function showNotFound() {
  document.title = `${t('Project not found')} — Aqar Factory`;
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex';
  document.head.appendChild(meta);
  document.getElementById('projName').textContent = t('Project not found');
  const layout = document.querySelector('.detail-layout');
  if (layout) layout.style.display = 'none';
  const related = document.querySelector('.related');
  if (related) related.style.display = 'none';
}

/* ---- boot ---- */
(async function () {
  try {
    const [projects] = await Promise.all([window.store.getProjects(), window.store.getCategories ? window.store.getCategories() : null]);
    ALL = projects;
  } catch (e) { ALL = window.PROJECTS || []; }
  if (!ALL || !ALL.length) ALL = window.PROJECTS || [];
  // an unmatched ?id= (deleted/renamed/mistyped) must NOT silently render a
  // different, unrelated project under the wrong URL — that's exactly the
  // kind of "wrong content at this URL" signal that confuses Google's
  // indexing, on top of just being wrong for real visitors
  project = ALL.find(p => p.id === id);
  if (project) populate();
  else showNotFound();
})();
