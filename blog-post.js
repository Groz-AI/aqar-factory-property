/* ============================================================
   AQAR FACTORY — Blog article detail: populate from ?slug
   ============================================================ */
const params = new URLSearchParams(location.search);
const slug = params.get('slug');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

let ALL = [];
let post = null;

function blockHTML(b) {
  if (!b) return '';
  if (b.type === 'heading') return b.text ? `<h2>${esc(b.text)}</h2>` : '';
  if (b.type === 'image') return b.image ? `<figure class="blog-block-image"><img src="${U(b.image, 1200)}" alt="" loading="lazy"></figure>` : '';
  return b.text ? `<p>${esc(b.text)}</p>` : '';
}

function cardHTML(p) {
  const tags = (pick(p, 'tags', 'tagsAr') || []).slice(0, 2).map(tag => `<span class="blog-tag">${tag}</span>`).join('');
  return `
  <a class="blog-card reveal" href="blog-post.html?slug=${encodeURIComponent(p.id)}">
    <div class="blog-card-img" style="background-image:url('${U(p.cover, 800)}')"></div>
    <div class="blog-card-body">
      ${tags ? `<div class="blog-card-tags">${tags}</div>` : ''}
      <h3>${pick(p, 'title', 'titleAr') || ''}</h3>
      <p class="blog-card-excerpt">${pick(p, 'excerpt', 'excerptAr') || ''}</p>
      <div class="blog-card-foot">
        <span class="blog-card-date">${formatDate(p.publishedAt)}</span>
        <span class="arrow">${arrowSVG}</span>
      </div>
    </div>
  </a>`;
}

function populate() {
  const title = pick(post, 'title', 'titleAr') || '';
  const excerpt = pick(post, 'excerpt', 'excerptAr') || '';
  document.title = `${title} — Aqar Factory`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && excerpt) metaDesc.setAttribute('content', excerpt);

  document.getElementById('heroImg').style.backgroundImage = `url('${U(post.cover, 1600)}')`;
  document.getElementById('postTitle').textContent = title;
  document.getElementById('postTitle').removeAttribute('data-i18n');
  document.getElementById('crumbTitle').textContent = title;

  document.getElementById('postTags').innerHTML = (pick(post, 'tags', 'tagsAr') || [])
    .map(tag => `<span class="blog-tag">${esc(tag)}</span>`).join('');

  const avatarEl = document.getElementById('authorAvatar');
  if (post.authorAvatar) { avatarEl.src = U(post.authorAvatar, 120); avatarEl.hidden = false; }
  document.getElementById('authorName').textContent = post.authorName || '';
  document.getElementById('postDate').textContent = formatDate(post.publishedAt);

  document.getElementById('articleBody').innerHTML = (pick(post, 'blocks', 'blocksAr') || []).map(blockHTML).join('');

  const related = ALL.filter(p => p.id !== post.id).slice(0, 3);
  const relatedWrap = document.getElementById('relatedPosts');
  const relatedSection = relatedWrap ? relatedWrap.closest('.related') : null;
  if (related.length) {
    relatedWrap.innerHTML = related.map(cardHTML).join('');
    [...relatedWrap.children].forEach(el => {
      if (revealObserver) revealObserver.observe(el); else el.classList.add('in');
    });
  } else if (relatedSection) {
    relatedSection.hidden = true;
  }
}

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealObserver.unobserve(en.target); }
    }), { threshold: .16 })
  : null;

(async function () {
  try { ALL = await window.store.getBlogPosts(); }
  catch (e) { ALL = (window.FALLBACK && window.FALLBACK.blogPosts) || []; }
  if (!ALL || !ALL.length) ALL = (window.FALLBACK && window.FALLBACK.blogPosts) || [];
  post = ALL.find(p => p.id === slug) || ALL[0];
  if (!post) { location.href = 'blog.html'; return; }
  populate();
})();

/* ---------- header + mobile nav ---------- */
const nav = document.getElementById('nav');
document.getElementById('navToggle').addEventListener('click', () => nav.classList.toggle('open'));
nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('open'); });

const header = document.getElementById('header');
const onHeaderScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
onHeaderScroll();
window.addEventListener('scroll', onHeaderScroll, { passive: true });
