/* ============================================================
   REALTEEK — footer newsletter signup
   Wires every .news-form on the page (one per page) to save the
   email via store.submitNewsletter, with inline success/error text.
   ============================================================ */
(function () {
  'use strict';

  function wireForm(form) {
    const input = form.querySelector('input[type="email"]');
    const btn = form.querySelector('button[type="submit"]');
    if (!input || !btn) return;
    const original = btn.textContent;

    // appended as a sibling, not a child — the form is a flex pill, so a
    // message inside it would just become a squeezed third flex item
    let msg = form.nextElementSibling;
    if (!msg || !msg.classList.contains('news-msg')) {
      msg = document.createElement('p');
      msg.className = 'news-msg';
      msg.hidden = true;
      form.insertAdjacentElement('afterend', msg);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.textContent = 'Please enter a valid email address.';
        msg.className = 'news-msg err';
        msg.hidden = false;
        return;
      }

      input.disabled = true; btn.disabled = true; btn.textContent = 'Joining…';
      msg.hidden = true;

      let res = { error: { message: 'not configured' } };
      try {
        if (window.store && window.store.submitNewsletter) res = await window.store.submitNewsletter(email);
      } catch (_) {
        res = { error: { message: 'network' } };
      }

      if (res && res.error) {
        const already = /duplicate|unique/i.test(String(res.error.message || ''));
        msg.textContent = already ? "You're already on the list — thanks!" : "Sorry, something went wrong. Please try again.";
        msg.className = 'news-msg ' + (already ? 'ok' : 'err');
        msg.hidden = false;
        input.disabled = false; btn.disabled = false; btn.textContent = original;
        if (already) input.value = '';
        return;
      }

      msg.textContent = "You're subscribed — welcome aboard!";
      msg.className = 'news-msg ok';
      msg.hidden = false;
      btn.textContent = 'Joined ✓';
      input.value = '';
    });
  }

  document.querySelectorAll('.news-form').forEach(wireForm);
})();
