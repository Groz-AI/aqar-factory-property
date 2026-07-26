/* ============================================================
   AQAR FACTORY — per-card WhatsApp / Call quick-contact
   ------------------------------------------------------------
   Small icon pair usable on any project/unit card (overlaid on the
   card image) and inline on detail-page sidebars. Numbers resolve
   once from the same editable company profile the header contact
   button uses (see whatsapp-widget.js); each icon opens a direct
   wa.me chat or tel: call, prefilled with the project/unit's name.
   Buttons stopPropagation so they don't trigger the parent card's
   own link navigation.
   ============================================================ */
(function () {
  'use strict';

  const t = window.t || ((s) => s);
  const escAttr = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const waIconSVG = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path fill="currentColor" d="M12.001 2c-5.523 0-10 4.477-10 10 0 1.762.457 3.417 1.257 4.855l-1.32 4.827 4.947-1.297A9.955 9.955 0 0 0 12.001 22c5.523 0 10-4.477 10-10s-4.477-10-10-10zm0 18.166a8.147 8.147 0 0 1-4.15-1.135l-.298-.177-3.05.8.813-2.976-.194-.307a8.147 8.147 0 0 1-1.293-4.371c0-4.517 3.65-8.166 8.166-8.166 4.517 0 8.166 3.65 8.166 8.166 0 4.517-3.65 8.166-8.166 8.166z"/></svg>`;
  const phoneIconSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

  let waNumber = '';
  let callNumber = '';

  function markup(name, opts) {
    const inline = !!(opts && opts.inline);
    const waLabel = inline ? `<span>${t('WhatsApp')}</span>` : '';
    const callLabel = inline ? `<span>${t('Call us')}</span>` : '';
    return `<span class="card-contact${inline ? ' inline' : ''}" data-name="${escAttr(name)}" hidden>
      <button type="button" class="cc-btn cc-wa" aria-label="${escAttr(t('WhatsApp'))}" hidden>${waIconSVG}${waLabel}</button>
      <button type="button" class="cc-btn cc-call" aria-label="${escAttr(t('Call us'))}" hidden>${phoneIconSVG}${callLabel}</button>
    </span>`;
  }

  function paint(root) {
    (root || document).querySelectorAll('.card-contact').forEach(el => {
      const wa = el.querySelector('.cc-wa');
      const call = el.querySelector('.cc-call');
      if (wa) wa.hidden = !waNumber;
      if (call) call.hidden = !callNumber;
      el.hidden = !waNumber && !callNumber;
      if (el.dataset.wired) return;
      el.dataset.wired = '1';
      const name = el.dataset.name || '';
      if (wa) wa.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (!waNumber) return;
        const msg = `${t("Hi! I'm interested in")} ${name} — ${t('could you share more details?')}`;
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      });
      if (call) call.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (!callNumber) return;
        window.location.href = 'tel:' + callNumber;
      });
    });
  }

  async function init() {
    try {
      const c = window.store && window.store.getCompany ? await window.store.getCompany() : null;
      if (c) {
        waNumber = String(c.phoneSecondary || c.phone || '').replace(/\D/g, '');
        callNumber = String(c.phone || c.phoneSecondary || '').replace(/[^\d+]/g, '');
      }
    } catch (_) { /* keep hidden on failure */ }
    paint(document);
  }

  window.cardContact = { markup, wire: paint };
  init();

  // Admin-entered price strings sometimes come in as bare digits (e.g. a
  // number pasted straight from another listing site) with no currency or
  // thousands separators. Leave anything that already has letters/symbols
  // (e.g. "$3.2M", "EGP 4.8K/mo") untouched — only reformat pure digit runs.
  window.formatPrice = function (str) {
    if (str == null) return '';
    const s = String(str).trim();
    if (!s) return '';
    if (/^\d+$/.test(s)) return 'EGP ' + Number(s).toLocaleString('en-US');
    return s;
  };
})();
