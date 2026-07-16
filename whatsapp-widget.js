/* ============================================================
   AQAR FACTORY — WhatsApp quick-contact
   Header button opens a short lead-capture form; submitting composes
   a WhatsApp message from the answers and opens a chat with the
   number configured in the company profile (phoneSecondary || phone).
   The header button stays hidden until a number is actually resolved.
   ============================================================ */
(function () {
  'use strict';

  const btn = document.getElementById('waHeaderBtn');
  if (!btn) return;

  const t = window.t || ((s) => s);

  const closeSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const waIconSVG = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path fill="currentColor" d="M12.001 2c-5.523 0-10 4.477-10 10 0 1.762.457 3.417 1.257 4.855l-1.32 4.827 4.947-1.297A9.955 9.955 0 0 0 12.001 22c5.523 0 10-4.477 10-10s-4.477-10-10-10zm0 18.166a8.147 8.147 0 0 1-4.15-1.135l-.298-.177-3.05.8.813-2.976-.194-.307a8.147 8.147 0 0 1-1.293-4.371c0-4.517 3.65-8.166 8.166-8.166 4.517 0 8.166 3.65 8.166 8.166 0 4.517-3.65 8.166-8.166 8.166z"/></svg>`;

  let waNumber = '';

  const modal = document.createElement('div');
  modal.className = 'wa-modal';
  modal.id = 'waModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', t('Chat with us on WhatsApp'));
  modal.innerHTML = `
    <div class="wa-modal-backdrop" id="waModalBackdrop"></div>
    <div class="wa-modal-card">
      <button type="button" class="wa-modal-close" id="waModalClose" aria-label="${t('Close')}">${closeSVG}</button>
      <div class="wa-modal-head">
        <span class="wa-modal-icon" aria-hidden="true">${waIconSVG}</span>
        <div><b>${t('Chat with us on WhatsApp')}</b><small>${t('Usually replies in minutes')}</small></div>
      </div>
      <form id="waForm">
        <label class="wa-field">
          <span>${t('Your name')}</span>
          <input type="text" id="waName" required autocomplete="name">
        </label>
        <label class="wa-field">
          <span>${t("I'm interested in")}</span>
          <select id="waInterest">
            <option>${t('Buying a property')}</option>
            <option>${t('Investment advice')}</option>
            <option>${t('Something else')}</option>
          </select>
        </label>
        <label class="wa-field">
          <span>${t('Your message (optional)')}</span>
          <textarea id="waMessage" placeholder="${t('Tell us about the home, office or space you have in mind…')}"></textarea>
        </label>
        <button type="submit" class="wa-submit">${waIconSVG}<span>${t('Continue on WhatsApp')}</span></button>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const backdrop = modal.querySelector('#waModalBackdrop');
  const closeBtn = modal.querySelector('#waModalClose');
  const form = modal.querySelector('#waForm');

  function openModal() {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const n = modal.querySelector('#waName'); if (n) n.focus(); }, 250);
  }
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openModal);
  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!waNumber) return;
    const name = modal.querySelector('#waName').value.trim();
    const interest = modal.querySelector('#waInterest').value;
    const message = modal.querySelector('#waMessage').value.trim();
    const lines = [
      `${t("Hi! I'm")} ${name}.`,
      `${t("I'm interested in")}: ${interest}`
    ];
    if (message) lines.push(`${t('Message')}: ${message}`);
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
    closeModal();
    form.reset();
  });

  // resolve the WhatsApp number from the editable company profile; the
  // header button stays hidden if none is configured
  (async function resolveNumber() {
    try {
      const c = window.store && window.store.getCompany ? await window.store.getCompany() : null;
      const raw = String((c && (c.phoneSecondary || c.phone)) || '').replace(/\D/g, '');
      if (raw) { waNumber = raw; btn.style.display = ''; }
    } catch (_) { /* keep hidden on failure */ }
  })();
})();
