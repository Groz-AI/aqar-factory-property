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

  // self-referencing canonical tag, kept in sync with the current URL so
  // search engines index project.html?id=… / blog-post.html?slug=… as
  // distinct pages instead of collapsing them onto the bare static file.
  // Built from location.origin so it tracks whichever domain serves the
  // page (vercel.app today, a future custom domain later) with no edits.
  // Only the id/slug params are meaningful content identifiers — any other
  // query string (tracking params, etc.) is dropped from the canonical URL.
  (function setCanonical() {
    const keep = new URLSearchParams();
    const qs = new URLSearchParams(location.search);
    ['id', 'slug'].forEach(k => { if (qs.has(k)) keep.set(k, qs.get(k)); });
    const qstr = keep.toString();
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = location.origin + location.pathname + (qstr ? '?' + qstr : '');
  })();

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

  // ---- brand cache (kills the flash of default branding on refresh) ----
  const CACHE_KEY = 'realteek_brand_cache';
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) { return null; }
  }
  function writeCache(c) {
    // only cache a meaningful brand so a failed/empty fetch never wipes it
    if (!c || (!c.name && !c.logo)) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (_) {}
  }

  async function getCompany() {
    try {
      if (window.store && window.store.getCompany) return await window.store.getCompany();
    } catch (_) {}
    return DEFAULT;
  }

  function apply(cRaw) {
    const c = Object.assign({}, DEFAULT, cRaw || {});

    // ---- brand name (header + footer) — hide it and let the logo fill the
    //      space when no company name is set ----
    document.querySelectorAll('.brand-name').forEach(el => {
      el.textContent = c.name || '';
      el.style.display = c.name ? '' : 'none';
    });
    document.querySelectorAll('.brand').forEach(el => el.classList.toggle('brand--logo-only', !c.name));
    if (c.name) {
      document.querySelectorAll('.brand[aria-label]').forEach(el => el.setAttribute('aria-label', c.name + ' home'));
    }

    // ---- logo: swap the inline mark for an uploaded image when set ----
    if (c.logo) {
      const src = imgURL(c.logo, 160);
      document.querySelectorAll('.brand-mark').forEach(m => {
        m.innerHTML = `<img src="${esc(src)}" alt="${esc(c.name || '')}" style="width:100%;height:100%;object-fit:contain;display:block">`;
      });

      // ---- favicon: use the same uploaded logo ----
      const iconHref = imgURL(c.logo, 64);
      ['icon', 'shortcut icon', 'apple-touch-icon'].forEach(rel => {
        let link = document.querySelector(`link[rel="${rel}"]`);
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = iconHref;
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
    // each platform has its own "show icon" toggle (key + '_visible', default
    // shown) plus a URL — both must hold for the icon to actually appear.
    const socials = { Instagram: 'instagram', X: 'x', LinkedIn: 'linkedin', Facebook: 'facebook', TikTok: 'tiktok' };
    Object.keys(socials).forEach(label => {
      const key = socials[label];
      const url = c[key];
      const visible = c[key + '_visible'] !== false;
      document.querySelectorAll(`a[aria-label="${label}"]`).forEach(a => {
        if (visible && url) { a.href = url; a.style.display = ''; }
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

  // 1) paint the cached brand immediately — this script is parser-blocking at the
  //    end of <body>, so the header/footer already exist and we can update them
  //    before the first paint, eliminating the flash of the default brand.
  const cached = readCache();
  if (cached) apply(cached);

  // 2) fetch the live brand and refresh (usually identical → no visible change)
  async function refresh() {
    const c = await getCompany();
    apply(c);
    writeCache(c);
  }
  if (document.readyState !== 'loading') refresh();
  else document.addEventListener('DOMContentLoaded', refresh);

  // in local (localStorage) mode, mirror admin edits onto open pages live
  if (window.RealteekLocal) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'realteek_db_v1') getCompany().then((c) => { apply(c); writeCache(c); });
    });
  }
})();
