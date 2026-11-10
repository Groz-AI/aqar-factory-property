/* ============================================================
   Cities page — one row per city: image, name, the paragraph written
   in the admin (each language shows only its own), project count and a
   link to that city's projects.
   ============================================================ */
/* city / developer landing page address (falls back to the old filter link) */
function landingHref(kind, name) {
  const S = window.SchemaHelpers;
  const slug = S && S.entitySlug ? S.entitySlug(name) : '';
  const pre = window.i18n && window.i18n.lang === 'ar' ? '/ar' : '';
  return slug ? `${pre}/${kind}/${encodeURIComponent(slug)}` : `projects.html?${kind}=${encodeURIComponent(name)}`;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
const imgUrl = (ref, w = 900) =>
  !ref ? '' : /^https?:\/\//.test(ref) ? ref : `https://images.unsplash.com/photo-${ref}?auto=format&fit=crop&w=${w}&q=80`;

(async function () {
  const wrap = document.getElementById('cityRows');
  try {
    const [cities, projects] = await Promise.all([window.store.getCities(), window.store.getProjects()]);
    const counts = {};
    (projects || []).forEach(p => { if (p.cityId) counts[p.cityId] = (counts[p.cityId] || 0) + 1; });
    wrap.innerHTML = (cities || []).map(c => {
      const n = counts[c.id] || 0;
      const label = n === 1 ? t('1 Project') : `${n.toLocaleString()} ${t('Projects')}`;
      return `
      <article class="city-row">
        <a class="city-row-img" href="${landingHref('city', c.name)}" style="background-image:url('${imgUrl(c.image)}')" aria-label="${esc(c.name)}"></a>
        <div class="city-row-body">
          <h2>${esc(c.name)}</h2>
          <p class="city-row-meta">${esc(c.country || '')}${c.country ? ' · ' : ''}${label}</p>
          <a class="view-all" href="${landingHref('city', c.name)}"><span>${t('View projects')}</span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        </div>
      </article>`;
    }).join('');
  } catch (e) { console.error('cities load failed', e); }
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
