/* ============================================================
   AQAR FACTORY — market update pages (/market_update, /market_update/<slug>)
   ------------------------------------------------------------
   The page itself is written by the server (api/market-update.js), so it is
   complete without any script. This file only adds two conveniences:
     • a photo viewer (click a photo, Esc / click to close, arrows to browse)
     • the WhatsApp button for pages whose admin left the number empty:
       it uses the company WhatsApp number from the site settings, and the
       button stays hidden when there is none.
   ============================================================ */
(function () {
  'use strict';

  // ---------- WhatsApp with the company number ----------
  const waBtns = [...document.querySelectorAll('[data-mu-wa]')];
  if (waBtns.length) {
    (async () => {
      let num = '';
      try {
        const c = window.store && window.store.getCompany ? await window.store.getCompany() : null;
        if (c) num = String(c.phoneSecondary || c.phone || '').replace(/\D/g, '');
      } catch (_) {}
      waBtns.forEach(b => {
        if (!num) return;
        const text = b.getAttribute('data-text') || '';
        b.href = 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '');
        b.hidden = false;
      });
    })();
  }

  // ---------- photo viewer ----------
  const photos = [...document.querySelectorAll('a.mu-photo')];
  if (!photos.length) return;
  let box = null, imgEl, idx = 0;
  function build() {
    box = document.createElement('div');
    box.className = 'mu-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button type="button" class="mu-lb-x" aria-label="Close">×</button>' +
      '<button type="button" class="mu-lb-nav mu-lb-prev" aria-label="Previous">‹</button>' +
      '<img alt=""><button type="button" class="mu-lb-nav mu-lb-next" aria-label="Next">›</button>';
    document.body.appendChild(box);
    imgEl = box.querySelector('img');
    box.addEventListener('click', e => { if (e.target === box || e.target.classList.contains('mu-lb-x')) close(); });
    box.querySelector('.mu-lb-prev').addEventListener('click', () => show(idx - 1));
    box.querySelector('.mu-lb-next').addEventListener('click', () => show(idx + 1));
    document.addEventListener('keydown', e => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx + (document.dir === 'rtl' ? 1 : -1));
      else if (e.key === 'ArrowRight') show(idx + (document.dir === 'rtl' ? -1 : 1));
    });
  }
  function show(i) {
    idx = (i + photos.length) % photos.length;
    imgEl.src = photos[idx].getAttribute('href');
    imgEl.alt = (photos[idx].querySelector('img') || {}).alt || '';
    box.classList.toggle('single', photos.length < 2);
  }
  function open(i) {
    if (!box) build();
    show(i);
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() { box.classList.remove('open'); document.body.style.overflow = ''; }
  photos.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); open(i); }));
})();
