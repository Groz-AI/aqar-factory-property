/* ============================================================
   REALTEEK — company / brand applier
   Reads the editable "company" content block (logo, name, contact
   details, socials, offices…) and paints it across every page, so
   the whole site can be rebranded for a different company from the
   admin portal with no code changes.

   Binds by:
     • .brand-name / .brand-mark  → company name + logo (header/footer)
     • .footer-brand > p          → footer tagline
     • .footer-bottom p:first     → copyright line
     • a[aria-label="Instagram|X|LinkedIn|Facebook"] → social links
     • [data-brand="email|emailSecondary|phone|phoneSecondary|address|
        hours|name|tagline|copyright"] → contact details (e.g. contact page)
     • [data-brand-offices]        → office cards rendered from offices[]
   ============================================================ */
(function () {
  'use strict';

  const DEFAULT = (window.FALLBACK && window.FALLBACK.content && window.FALLBACK.content.company) || {};

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const tel = (s) => String(s || '').replace(/[^\d+]/g, '');

  function imgURL(ref, w = 160) {
    if (!ref) return '';
    if (/^(https?:)?\/\//.test(ref) || /^data:/.test(ref)) return ref;
    return `https://images.unsplash.com/photo-${ref}?auto=format&fit=crop&w=${w}&q=80`;
  }

  async function getCompany() {
    try {
      if (window.store && window.store.getCompany) return await window.store.getCompany();
    } catch (_) {}
    return DEFAULT;
  }

  function apply(cRaw) {
    const c = Object.assign({}, DEFAULT, cRaw || {});

    // ---- brand name (header + footer) ----
    if (c.name) {
      document.querySelectorAll('.brand-name').forEach(el => { el.textContent = c.name; });
      document.querySelectorAll('.brand[aria-label]').forEach(el => el.setAttribute('aria-label', c.name + ' home'));
    }

    // ---- logo: swap the inline mark for an uploaded image when set ----
    if (c.logo) {
      const src = imgURL(c.logo, 160);
      document.querySelectorAll('.brand-mark').forEach(m => {
        m.innerHTML = `<img src="${esc(src)}" alt="${esc(c.name || '')}" style="width:100%;height:100%;object-fit:contain;display:block">`;
      });
    }

    // ---- footer tagline ----
    if (c.tagline) document.querySelectorAll('.footer-brand > p').forEach(el => { el.textContent = c.tagline; });

    // ---- copyright (first line of footer-bottom) ----
    if (c.copyright) {
      const cp = document.querySelector('.footer-bottom p');
      if (cp) cp.textContent = c.copyright;
    }

    // ---- social links (header/footer/contact — matched by aria-label) ----
    const socials = { Instagram: 'instagram', X: 'x', LinkedIn: 'linkedin', Facebook: 'facebook' };
    Object.keys(socials).forEach(label => {
      const url = c[socials[label]];
      document.querySelectorAll(`a[aria-label="${label}"]`).forEach(a => {
        if (url) { a.href = url; a.style.display = ''; }
        else { a.style.display = 'none'; }
      });
    });

    // ---- explicit [data-brand] bindings (contact page, etc.) ----
    document.querySelectorAll('[data-brand]').forEach(el => {
      const key = el.getAttribute('data-brand');
      const val = c[key];
      if (val == null || val === '') return;
      if (key === 'email' || key === 'emailSecondary') {
        el.textContent = val;
        if (el.tagName === 'A') el.href = 'mailto:' + val;
      } else if (key === 'phone' || key === 'phoneSecondary') {
        el.textContent = val;
        if (el.tagName === 'A') el.href = 'tel:' + tel(val);
      } else if (key === 'address' || key === 'hours' || key === 'tagline') {
        el.innerHTML = nl2br(val);
      } else {
        el.textContent = val;
      }
    });

    // ---- offices grid ----
    const off = document.querySelector('[data-brand-offices]');
    if (off && Array.isArray(c.offices)) {
      off.innerHTML = c.offices.map(o => `
        <article class="office-card reveal in">
          <h3>${esc(o.city || '')}</h3>
          <p>${nl2br(o.lines || '')}</p>
          ${o.phone ? `<a href="tel:${esc(tel(o.phone))}" class="office-link">${esc(o.phone)}</a>` : ''}
        </article>`).join('');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    apply(await getCompany());
  });

  // in local (localStorage) mode, mirror admin edits onto open pages live
  if (window.RealteekLocal) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'realteek_db_v1') getCompany().then(apply);
    });
  }
})();
