/* ============================================================
   AQAR FACTORY — Unit detail: populate from ?id, gallery lightbox
   ============================================================ */
const params = new URLSearchParams(location.search);
const id = params.get('id');

const pinSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>`;
const arrowSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
function pick(u, key, arKey) {
  if (isAr()) {
    const v = u[arKey];
    if (Array.isArray(v) ? v.length : v) return v;
  }
  return u[key];
}
// paragraph/heading block text is trusted HTML (bold/italic/link formatting
// from the rich-text toolbar — see blocks-render.js), so it must be
// stripped down to plain text before use in a <meta description> or a
// JSON-LD string field, neither of which should ever contain markup
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || '';
}
function blocksToText(blocks) {
  return (blocks || []).map(b => b && b.text ? stripHtml(b.text) : '').filter(Boolean).join(' ');
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

let ALL = [];
let ALL_PROJECTS = [];
let unit = null;

function populate() {
  const customTitle = pick(unit, 'seoTitle', 'seoTitleAr');
  document.title = customTitle || `${pick(unit, 'name', 'nameAr') || unit.name} — Aqar Factory`;
  const metaDesc = document.querySelector('meta[name="description"]');
  const descBlocks = pick(unit, 'descriptionBlocks', 'descriptionBlocksAr');
  const desc = pick(unit, 'seoDescription', 'seoDescriptionAr') || blocksToText(descBlocks) || pick(unit, 'description', 'descriptionAr') || '';
  if (metaDesc && desc) metaDesc.setAttribute('content', desc.length > 160 ? desc.slice(0, 157) + '…' : desc);
  // canonical/hreflang are handled generically (and language-aware) by
  // i18n.js's injectSeoLinks() — see the note in project.js's populate().

  injectJsonLd({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    mainEntityOfPage: { '@type': 'WebPage', '@id': location.href },
    url: location.href,
    name: customTitle || pick(unit, 'name', 'nameAr') || unit.name,
    description: desc || undefined,
    image: unit.cover ? U(unit.cover, 1600) : undefined,
    // address/numberOfRooms/numberOfBathroomsTotal aren't valid direct
    // properties of RealEstateListing per the schema.org spec — they belong
    // to Accommodation-type things, so nest them under an Apartment instead
    about: (unit.location || unit.beds || unit.baths) ? {
      '@type': 'Apartment',
      name: customTitle || pick(unit, 'name', 'nameAr') || unit.name,
      address: unit.location ? { '@type': 'PostalAddress', addressLocality: unit.location } : undefined,
      numberOfRooms: unit.beds || undefined,
      numberOfBathroomsTotal: unit.baths || undefined
    } : undefined,
    offers: unit.price ? {
      '@type': 'Offer',
      price: unit.priceValue || undefined,
      priceCurrency: 'EGP',
      availability: 'https://schema.org/InStock'
    } : undefined,
    publisher: { '@type': 'Organization', name: 'Aqar Factory', url: 'https://www.aqar-factory.com' }
  });

  const heroImg = document.getElementById('heroImg');
  if (heroImg._tid) clearInterval(heroImg._tid);
  const heroImgs = unitImages(unit);
  heroImg.innerHTML = heroImgs.map((g, n) =>
    `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${U(g, 1600)}')"></div>`).join('');

  document.getElementById('unitName').textContent = pick(unit, 'name', 'nameAr') || unit.name;
  document.getElementById('crumbName').textContent = unit.name;
  document.getElementById('unitLoc').innerHTML = `${pinSVG}${unit.location || ''}`;
  document.getElementById('badges').innerHTML = `
    <span class="dbadge dark">${unit.type ? t(unit.type) : ''}</span>
    ${unit.badge ? `<span class="dbadge">${t(unit.badge)}</span>` : ''}`;

  document.getElementById('description').innerHTML = (descBlocks && descBlocks.length)
    ? window.renderBlocks(descBlocks)
    : `<p>${t('No description yet.')}</p>`;

  const priceEl = document.getElementById('price');
  if (unit.price) { priceEl.innerHTML = `<small>${t('Price')}</small>${window.formatPrice ? window.formatPrice(unit.price) : unit.price}`; priceEl.hidden = false; }
  else { priceEl.hidden = true; }

  const sidebarContact = document.getElementById('sidebarContact');
  if (sidebarContact && window.cardContact) {
    sidebarContact.innerHTML = window.cardContact.markup(unit.name, { inline: true });
    window.cardContact.wire(sidebarContact);
  }

  const facts = [
    ['Type', unit.type ? t(unit.type) : ''],
    ['Bedrooms', unit.beds],
    ['Bathrooms', unit.baths],
    ['Area', unit.area],
    ['Location', unit.location]
  ];
  document.getElementById('factList').innerHTML = facts
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${t(k)}</dt><dd>${v}</dd></div>`).join('');

  // "Part of <Project>" banner — only when this unit is linked to a project
  const banner = document.getElementById('projectBanner');
  const linkedProject = unit.projectId ? ALL_PROJECTS.find(p => p.dbId === unit.projectId) : null;
  if (linkedProject) {
    banner.href = `project.html?id=${encodeURIComponent(linkedProject.id)}`;
    document.getElementById('projectBannerName').textContent = linkedProject.name;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }

  const galleryEl = document.getElementById('gallery');
  galleryEl.innerHTML = (unit.gallery || []).map((g, i) =>
    `<figure data-idx="${i}"><img src="${U(g, 800)}" alt="${unit.name} photo ${i + 1}" loading="lazy" /></figure>`).join('');

  renderRelated();
  cycleGalleries('#detailHero', '.detail-hero', 7000);
  window.scrollTo(0, 0);
}

/* ---- lightbox ---- */
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCount = document.getElementById('lbCount');
let lbIndex = 0;
function gallery() { return (unit && unit.gallery) || []; }
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

/* ---- related units ---- */
function renderRelated() {
  const grid = document.getElementById('related');
  grid.querySelectorAll('[data-gallery]').forEach(b => { if (b._tid) clearInterval(b._tid); });
  const related = ALL
    .filter(u => u.id !== unit.id)
    .sort((a, b) => (b.type === unit.type) - (a.type === unit.type) || (b.projectId === unit.projectId) - (a.projectId === unit.projectId))
    .slice(0, 3);
  grid.innerHTML = related.map(u => {
    const imgs = unitImages(u);
    const slides = imgs.map((g, n) =>
      `<div class="pg-slide${n === 0 ? ' active' : ''}" style="background-image:url('${U(g, 800)}')"></div>`).join('');
    const dots = imgs.length > 1
      ? `<div class="pg-dots">${imgs.map((_, n) => `<i class="${n === 0 ? 'on' : ''}"></i>`).join('')}</div>` : '';
    return `
    <a class="pcard" href="unit.html?id=${encodeURIComponent(u.id)}">
      <div class="pcard-img" data-gallery>
        ${slides}<div class="pg-shade"></div>
        <span class="pcard-cat">${u.type ? t(u.type) : ''}</span>
        ${dots}${window.cardContact ? window.cardContact.markup(u.name) : ''}
      </div>
      <div class="pcard-body">
        <h3>${u.name}</h3>
        <p class="pcard-loc">${pinSVG}${u.location || ''}</p>
        <div class="pcard-foot"><span class="pcard-price">${window.formatPrice ? window.formatPrice(u.price) : (u.price || '')}</span><span class="arrow">${arrowSVG}</span></div>
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

/* ---- boot ---- */
(async function () {
  try {
    const [units, projects] = await Promise.all([
      window.store.getUnits ? window.store.getUnits() : [],
      window.store.getProjects ? window.store.getProjects() : [],
      window.store.getCategories ? window.store.getCategories() : null
    ]);
    ALL = units || [];
    ALL_PROJECTS = projects || [];
  } catch (e) { ALL = []; ALL_PROJECTS = []; }
  // an unmatched ?id= (deleted/renamed/mistyped) must NOT silently render a
  // different, unrelated unit under the wrong URL — that's exactly the kind
  // of "wrong content at this URL" signal that confuses Google's indexing,
  // on top of just being wrong for real visitors
  unit = ALL.find(u => u.id === id);
  if (unit) populate();
  else {
    document.title = `${t('Unit not found')} — Aqar Factory`;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    document.getElementById('unitName').textContent = t('Unit not found');
    const layout = document.querySelector('.detail-layout');
    if (layout) layout.style.display = 'none';
    const related = document.querySelector('.related');
    if (related) related.style.display = 'none';
  }
})();
