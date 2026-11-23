/* ============================================================
   Developers page — one card per published developer: logo, name,
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
const imgUrl = (ref, w = 900) => window.U ? window.U(ref, w) :
  !ref ? '' : /^https?:\/\//.test(ref) ? ref : `https://images.unsplash.com/photo-${ref}?auto=format&fit=crop&w=${w}&q=80`;

/* spelling-insensitive text for searching: case, Arabic diacritics and the usual letter variants
   (ا أ إ آ / ى ي / ة ه) are ignored, so "القمزي" finds "القمزى" */
const norm = (s) => String(s == null ? '' : s).toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[\s\-_.,&()/]+/g, ' ').trim();

(async function () {
  const wrap = document.getElementById('devRows');
  const empty = document.getElementById('devEmpty');
  const input = document.getElementById('devSearch');
  const clear = document.getElementById('devSearchClear');
  const count = document.getElementById('devCount');
  try {
    const [devs, projects] = await Promise.all([window.store.getDevelopers(), window.store.getProjects({ quick: true })]);
    // every published developer is listed, the moment it is created in the admin: the ones with
    // projects first (most projects first), then the ones whose projects are still to come
    const counts = {};
    (projects || []).forEach(p => { if (p.developerId) counts[p.developerId] = (counts[p.developerId] || 0) + 1; });
    const byName = {};
    (projects || []).forEach(p => { if (!p.developerId && p.developer) byName[p.developer] = (byName[p.developer] || 0) + 1; });
    const rows = (devs || []).map(d => ({ d, n: counts[d.id] || byName[d.name] || 0, hay: norm((d.name || '') + ' ' + (d.name_ar || '')) }))
      .sort((a, b) => (b.n > 0) - (a.n > 0) || b.n - a.n || String(a.d.name).localeCompare(String(b.d.name)));

    const cardHTML = ({ d, n }) => {
      const label = n === 0 ? t('No projects yet') : n === 1 ? t('1 Project') : `${n.toLocaleString()} ${t('Projects')}`;
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
          <a class="view-all" href="${landingHref('developer', d)}"><span>${n === 0 ? t('View developer') : t('View projects')}</span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        </div>
      </article>`;
    };

    function render() {
      const q = norm(input.value);
      const words = q ? q.split(' ') : [];
      const list = words.length ? rows.filter(r => words.every(w => r.hay.includes(w))) : rows;
      wrap.innerHTML = list.map(cardHTML).join('');
      count.textContent = list.length.toLocaleString();
      empty.hidden = list.length !== 0;
      clear.hidden = !input.value;
    }
    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
    clear.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
    document.getElementById('devEmptyReset').addEventListener('click', () => { input.value = ''; render(); input.focus(); });
    // /developers.html?q=name opens with the search filled in
    const q0 = new URLSearchParams(location.search).get('q');
    if (q0) input.value = q0;
    render();
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
