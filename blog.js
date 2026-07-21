/* ============================================================
   AQAR FACTORY — Blog listing
   ============================================================ */
let POSTS = [];
const blogGrid = document.getElementById('blogGrid');
const emptyState = document.getElementById('emptyState');

const arrowSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
// prefer the Arabic field when the site is in Arabic mode and it's filled in,
// otherwise fall back to the English one — same pattern as the homepage's
// bilingual hero/stats/cta content
function pick(p, key, arKey) {
  if (isAr()) {
    const v = p[arKey];
    if (Array.isArray(v) ? v.length : v) return v;
  }
  return p[key];
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const lang = (window.i18n && window.i18n.lang) || 'en';
  return d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function cardHTML(p) {
  const tags = (pick(p, 'tags', 'tagsAr') || []).map(tag => `<span class="blog-tag">${tag}</span>`).join('');
  return `
  <a class="blog-card reveal" href="blog-post.html?slug=${encodeURIComponent(p.id)}">
    <div class="blog-card-img" style="background-image:url('${U(p.cover, 800)}')"></div>
    <div class="blog-card-body">
      ${tags ? `<div class="blog-card-tags">${tags}</div>` : ''}
      <h3>${pick(p, 'title', 'titleAr') || ''}</h3>
      <p class="blog-card-excerpt">${pick(p, 'excerpt', 'excerptAr') || ''}</p>
      <div class="blog-card-foot">
        <div class="blog-card-author"><span>${p.authorName || ''}</span></div>
        <span class="blog-card-date">${formatDate(p.publishedAt)}</span>
      </div>
    </div>
  </a>`;
}

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); }
    }), { threshold: .16 })
  : null;

function render() {
  const list = [...POSTS].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  blogGrid.innerHTML = list.map(cardHTML).join('');
  [...blogGrid.children].forEach((el, i) => {
    el.style.animationDelay = `${i * 60}ms`;
    if (revealObserver) revealObserver.observe(el); else el.classList.add('in');
  });
  emptyState.hidden = list.length !== 0;
}

(async function () {
  try { POSTS = await window.store.getBlogPosts(); }
  catch (e) { POSTS = (window.FALLBACK && window.FALLBACK.blogPosts) || []; }
  if (!POSTS || !POSTS.length) POSTS = (window.FALLBACK && window.FALLBACK.blogPosts) || [];
  render();
})();

/* ---------- header + mobile nav ---------- */
const nav = document.getElementById('nav');
document.getElementById('navToggle').addEventListener('click', () => nav.classList.toggle('open'));
nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('open'); });

const header = document.getElementById('header');
const onHeaderScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
onHeaderScroll();
window.addEventListener('scroll', onHeaderScroll, { passive: true });
