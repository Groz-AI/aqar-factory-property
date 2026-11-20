/* ============================================================
   Developers page — one card per developer that has projects: logo, name,
   project count and a link to that developer's landing page.
   ============================================================ */
/* city / developer landing page address (falls back to the old filter link) */
function landingHref(kind, ent) {
  const S = window.SchemaHelpers;
  const name = ent && ent.name;
  const slug = S && S.entityUrlSlug ? S.entityUrlSlug(ent) : '';
  const pre = window.i18n && window.i18n.lang === 'ar' ? '/ar' : '';
  return slug ? `${pre}/${kind}/${encodeURIComponent(slug)}` : `projects.html?${kind}=${encodeURIComponent(name)}`;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isAr = () => !!(window.i18n && window.i18n.lang === 'ar');
const imgUrl = (ref, w = 900) =>
  !ref ? '' : /^https?:\/\//.test(ref) ? ref : `https://images.unsplash.com/photo-${ref}?auto=format&fit=crop&w=${w}&q=80`;

(async function () {
  const wrap = document.getElementById('devRows');
  try {
    const [devs, projects] = await Promise.all([window.store.getDevelopers(), window.store.getProjects({ quick: true })]);
    // a developer is listed only when it has projects (its page shows 404 otherwise)
    const counts = {};
    (projects || []).forEach(p => { if (p.developerId) counts[p.developerId] = (counts[p.developerId] || 0) + 1; });
    const byName = {};
    (projects || []).forEach(p => { if (!p.developerId && p.developer) byName[p.developer] = (byName[p.developer] || 0) + 1; });
    const rows = (devs || []).map(d => ({ d, n: counts[d.id] || byName[d.name] || 0 }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n || String(a.d.name).localeCompare(String(b.d.name)));
    wrap.innerHTML = rows.map(({ d, n }) => {
      const label = n === 1 ? t('1 Project') : `${n.toLocaleString()} ${t('Projects')}`;
      const nm = (isAr() && d.name_ar) ? d.name_ar : d.name;
      const logo = d.logo ? imgUrl(d.logo, 400) : '';
      const pic = logo
        ? `<img src="${logo}" alt="${esc(nm)}" width="400" height="250" loading="lazy">`
        : `<span class="dev-initial" aria-hidden="true">${esc(String(nm || '·').charAt(0))}</span>`;
      return `
      <article class="city-row dev-row">
        <a class="city-row-img is-logo" href="${landingHref('developer', d)}" aria-label="${esc(nm)}">${pic}</a>
        <div class="city-row-body">
          <h2>${esc(nm)}</h2>
          <p class="city-row-meta">${label}</p>
          <a class="view-all" href="${landingHref('developer', d)}"><span>${t('View projects')}</span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        </div>
      </article>`;
    }).join('');
  } catch (e) { console.error('developers load failed', e); }
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
