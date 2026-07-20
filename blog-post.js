/* ============================================================
   AQAR FACTORY — Blog article detail: populate from ?slug
   ============================================================ */
const params = new URLSearchParams(location.search);
const slug = params.get('slug');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arrowSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
  const tags = (p.tags || []).slice(0, 2).map(tag => `<span class="blog-tag">${tag}</span>`).join('');
  return `
  <a class="blog-card reveal" href="blog-post.html?slug=${encodeURIComponent(p.id)}">
    <div class="blog-card-img" style="background-image:url('${U(p.cover, 800)}')"></div>
    <div class="blog-card-body">
      ${tags ? `<div class="blog-card-tags">${tags}</div>` : ''}
      <h3>${p.title || ''}</h3>
      <p class="blog-card-excerpt">${p.excerpt || ''}</p>
      <div class="blog-card-foot">
        <span class="blog-card-date">${formatDate(p.publishedAt)}</span>
        <span class="arrow">${arrowSVG}</span>
      </div>
    </div>
  </a>`;
}

function populate() {
  document.title = `${post.title} — Aqar Factory`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && post.excerpt) metaDesc.setAttribute('content', post.excerpt);

  document.getElementById('heroImg').style.backgroundImage = `url('${U(post.cover, 1600)}')`;
  document.getElementById('postTitle').textContent = post.title || '';
  document.getElementById('postTitle').removeAttribute('data-i18n');
  document.getElementById('crumbTitle').textContent = post.title || '';

  document.getElementById('postTags').innerHTML = (post.tags || [])
    .map(tag => `<span class="blog-tag">${esc(tag)}</span>`).join('');

  const avatarEl = document.getElementById('authorAvatar');
  if (post.authorAvatar) { avatarEl.src = U(post.authorAvatar, 120); avatarEl.hidden = false; }
  document.getElementById('authorName').textContent = post.authorName || '';
  document.getElementById('postDate').textContent = formatDate(post.publishedAt);

  document.getElementById('articleBody').innerHTML = (post.blocks || []).map(blockHTML).join('');

  const related = ALL.filter(p => p.id !== post.id).slice(0, 3);
  const relatedWrap = document.getElementById('relatedPosts');
  const relatedSection = relatedWrap ? relatedWrap.closest('.related') : null;
  if (related.length) {
    relatedWrap.innerHTML = related.map(cardHTML).join('');
  } else if (relatedSection) {
    relatedSection.hidden = true;
  }
}

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
