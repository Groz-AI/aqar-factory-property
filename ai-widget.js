/* ============================================================
   REALTEEK AI — floating property matchmaker
   A self-contained widget with two ways to get matched:
     1. A guided quick-reply flow (type -> city -> budget) that
        scores real listings from window.store with a transparent,
        deterministic matching engine — instant, no API calls.
     2. A free-text box wired to a real AI (Gemini, via the
        /api/ai-chat serverless proxy) that can hold an open-ended
        conversation, grounded in the site's live listings so it
        only ever recommends real properties.
   ============================================================ */
(function () {
  'use strict';

  const sparkSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.8A2.8 2.8 0 0 1 6.8 4h10.4A2.8 2.8 0 0 1 20 6.8v6.4a2.8 2.8 0 0 1-2.8 2.8H10.2l-3.9 2.9a.7.7 0 0 1-1.12-.56V16h-.4A2.8 2.8 0 0 1 4 13.2V6.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14.2 7.4c.3 1.55.95 2.2 2.5 2.5-1.55.3-2.2.95-2.5 2.5-.3-1.55-.95-2.2-2.5-2.5 1.55-.3 2.2-.95 2.5-2.5Z" fill="currentColor"/></svg>`;
  const closeSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const sendSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const IMG = (ref, w = 200) =>
    !ref ? '' :
    /^https?:\/\//.test(ref) ? ref :
    `https://images.unsplash.com/photo-${ref}?auto=format&fit=crop&w=${w}&q=80`;

  const BUDGETS = [
    { label: '< $500k', min: 0, max: 500000 },
    { label: '$500k – $1M', min: 500000, max: 1000000 },
    { label: '$1M – $3M', min: 1000000, max: 3000000 },
    { label: '$3M+', min: 3000000, max: Infinity }
  ];

  function parsePrice(str) {
    const m = String(str || '').replace(/[, ]/g, '').match(/([\d.]+)\s*([MK]?)/i);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    if (/m/i.test(m[2])) n *= 1e6;
    else if (/k/i.test(m[2])) n *= 1e3;
    return n;
  }

  // ---------- build the widget shell ----------
  const root = document.createElement('div');
  root.className = 'ai-widget';
  root.innerHTML = `
    <div class="ai-panel" id="aiPanel" aria-hidden="true" role="dialog" aria-label="Realteek AI property matchmaker">
      <div class="ai-panel-head">
        <div class="ai-panel-id">
          <span class="ai-avatar">${sparkSVG}</span>
          <div><b>Realteek AI</b><small>Your property matchmaker</small></div>
        </div>
        <button class="ai-panel-close" id="aiPanelClose" aria-label="Close">${closeSVG}</button>
      </div>
      <div class="ai-panel-body" id="aiPanelBody"></div>
      <div class="ai-panel-foot" id="aiPanelFoot"></div>
      <form class="ai-input-row" id="aiInputForm">
        <input type="text" id="aiInputField" placeholder="Or just ask me anything…" autocomplete="off" maxlength="500" />
        <button type="submit" aria-label="Send" id="aiInputSend">${sendSVG}</button>
      </form>
    </div>
    <button class="ai-fab" id="aiFabBtn" aria-expanded="false" aria-label="Let AI choose for you">
      <span class="ai-fab-glow" aria-hidden="true"></span>
      <span class="ai-fab-icon" aria-hidden="true">${sparkSVG}</span>
      <span class="ai-fab-label">Let AI Choose For You</span>
    </button>`;
  document.body.appendChild(root);

  const panel = root.querySelector('#aiPanel');
  const fabBtn = root.querySelector('#aiFabBtn');
  const closeBtn = root.querySelector('#aiPanelClose');
  const body = root.querySelector('#aiPanelBody');
  const foot = root.querySelector('#aiPanelFoot');
  const inputForm = root.querySelector('#aiInputForm');
  const inputField = root.querySelector('#aiInputField');
  const sendBtn = root.querySelector('#aiInputSend');

  let started = false;
  let answers = { type: null, typeLabel: '', city: '', budget: null };
  let dataset = { properties: [], categories: [], cities: [], companyName: '' };
  let chatHistory = []; // { role: 'user'|'model', text } — free-text AI conversation memory

  // ---------- keep the fab clear of the hero search bar at any viewport size ----------
  // The search bar sits inside a vertically-centered 100vh hero, so its on-screen
  // position shifts with viewport height — a fixed pixel offset can't reliably
  // clear it. Measure it live instead and only lift the widget while it's visible.
  (function avoidSearchBarOverlap() {
    const searchBar = document.getElementById('searchBar');
    if (!searchBar) return; // pages without a hero search bar just use the CSS default
    const GAP = 24;
    const DEFAULT_BOTTOM = 26;
    function reposition() {
      const r = searchBar.getBoundingClientRect();
      const visible = r.bottom > 0 && r.top < window.innerHeight;
      if (!visible) { root.style.removeProperty('--ai-fab-bottom'); return; }

      const fabH = fabBtn.offsetHeight || 54;
      const roomBelow = window.innerHeight - r.bottom;
      if (roomBelow >= fabH + GAP + DEFAULT_BOTTOM) {
        // plenty of space between the search bar and the viewport edge already
        root.style.removeProperty('--ai-fab-bottom');
      } else {
        // not enough room below — lift the button clear of the search bar's top instead
        const needed = Math.max(DEFAULT_BOTTOM, window.innerHeight - r.top + GAP);
        root.style.setProperty('--ai-fab-bottom', needed + 'px');
      }
    }
    reposition();
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    // re-check after web fonts / hero images settle, since that can nudge layout
    setTimeout(reposition, 350);
    setTimeout(reposition, 1200);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reposition);
  })();

  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    fabBtn.setAttribute('aria-expanded', 'true');
    if (!started) { started = true; boot(); }
  }
  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    fabBtn.setAttribute('aria-expanded', 'false');
  }
  fabBtn.addEventListener('click', () => {
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  closeBtn.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  // ---------- conversation helpers ----------
  function addMessage(text, who) {
    const div = document.createElement('div');
    div.className = 'ai-msg ' + who;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }
  function showTyping() {
    const t = document.createElement('div');
    t.className = 'ai-typing';
    t.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
    return t;
  }
  function botSay(text, delay = 650) {
    return new Promise(resolve => {
      const typing = showTyping();
      setTimeout(() => {
        typing.remove();
        addMessage(text, 'bot');
        resolve();
      }, delay);
    });
  }
  function setChips(options, onPick) {
    foot.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'ai-chips';
    options.forEach(opt => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ai-chip';
      b.textContent = opt.label;
      b.addEventListener('click', () => {
        foot.innerHTML = '';
        addMessage(opt.label, 'user');
        onPick(opt);
      });
      wrap.appendChild(b);
    });
    foot.appendChild(wrap);
  }
  function clearFoot() { foot.innerHTML = ''; }

  // ---------- data + flow ----------
  async function loadData() {
    const S = window.store;
    if (!S) return;
    try {
      const [props, cats, cities, content] = await Promise.all([
        S.getProperties ? S.getProperties() : [],
        S.getCategories ? S.getCategories() : [],
        S.getCities ? S.getCities() : [],
        S.getContent ? S.getContent() : {}
      ]);
      dataset.properties = props || [];
      dataset.categories = cats || [];
      dataset.cities = cities || [];
      dataset.companyName = (content && content.company && content.company.name) || '';
    } catch (_) { /* keep empty dataset, matching just falls back gracefully */ }
  }

  // ---------- free-text chat with the real AI (Gemini, via /api/ai-chat) ----------
  function slimProperties() {
    return dataset.properties.slice(0, 30).map(p => ({
      name: p.name, price: p.price, location: p.location,
      categories: p.categories, beds: p.beds, baths: p.baths, badge: p.badge
    }));
  }

  async function sendFreeText(message) {
    addMessage(message, 'user');
    chatHistory.push({ role: 'user', text: message });
    if (!dataset.properties.length) await loadData();

    const typing = showTyping();
    let reply = "Sorry, I'm having trouble connecting right now. Please try again shortly.";
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: chatHistory.slice(0, -1),
          context: {
            companyName: dataset.companyName,
            cities: dataset.cities.map(c => c.name),
            categories: dataset.categories.map(c => c.label),
            properties: slimProperties()
          }
        })
      });
      const data = await res.json();
      if (data && data.reply) reply = data.reply;
    } catch (_) { /* keep the fallback message */ }

    typing.remove();
    addMessage(reply, 'bot');
    chatHistory.push({ role: 'model', text: reply });
    body.scrollTop = body.scrollHeight;

    // if the AI named an exact listing, surface it as a clickable match card too
    const named = dataset.properties.filter(p => p.name && reply.includes(p.name));
    if (named.length) renderMatchCards(named.slice(0, 3));
  }

  function setSending(isSending) {
    inputField.disabled = isSending;
    sendBtn.disabled = isSending;
  }

  inputForm.addEventListener('submit', async e => {
    e.preventDefault();
    const text = inputField.value.trim();
    if (!text) return;
    if (!started) { started = true; openPanel(); await botSay("Hi! I'm Realteek AI — what can I help you find?", 400); await loadData(); }
    inputField.value = '';
    clearFoot();
    setSending(true);
    await sendFreeText(text);
    setSending(false);
    inputField.focus();
  });

  async function boot() {
    await botSay("Hi! I'm Realteek AI — answer a few quick questions and I'll match you with the best-fit homes, or just type your own question below anytime.", 500);
    await loadData();
    askType();
  }

  function askType() {
    const opts = [{ label: 'Any type', value: 'all' }]
      .concat(dataset.categories.map(c => ({ label: c.label, value: c.filter })));
    botSay('What kind of property are you looking for?', 500).then(() => setChips(opts, opt => {
      answers.type = opt.value; answers.typeLabel = opt.label;
      askCity();
    }));
  }

  function askCity() {
    const opts = [{ label: 'Anywhere', value: '' }]
      .concat(dataset.cities.map(c => ({ label: c.name, value: c.name })));
    botSay('Nice choice. Any particular location in mind?', 550).then(() => setChips(opts, opt => {
      answers.city = opt.value;
      askBudget();
    }));
  }

  function askBudget() {
    const opts = BUDGETS.map(b => ({ label: b.label, value: b }));
    botSay("Got it. What's your budget range?", 550).then(() => setChips(opts, opt => {
      answers.budget = opt.value;
      showResults();
    }));
  }

  function scoreProperty(p, a) {
    let score = 0;
    if (a.type && a.type !== 'all') score += (p.categories || []).includes(a.type) ? 4 : 0;
    if (a.city) score += (p.location || '').toLowerCase().includes(a.city.toLowerCase()) ? 4 : 0;
    if (a.budget) {
      const price = parsePrice(p.price);
      if (price >= a.budget.min && price < a.budget.max) score += 3;
      else if (price > 0) {
        const span = (a.budget.max === Infinity ? a.budget.min : a.budget.max - a.budget.min) || 1;
        const dist = price < a.budget.min ? a.budget.min - price : price - a.budget.max;
        if (dist / span < 0.25) score += 1; // close-enough consolation points
      }
    }
    return score;
  }

  function renderMatchCards(list) {
    if (!list.length) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-self:stretch';
    list.forEach(p => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ai-match';
      card.innerHTML = `
        <img src="${IMG(p.image, 160)}" alt="" loading="lazy">
        <div class="ai-match-body">
          <h4>${p.name || ''}</h4>
          <p>${p.location || ''}</p>
          <b>${p.price || ''}</b>
        </div>`;
      card.addEventListener('click', () => jumpToProperty(p.name));
      wrap.appendChild(card);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  async function showResults() {
    clearFoot();
    await botSay('Let me find your best matches…', 700);
    const scored = dataset.properties
      .map(p => ({ p, s: scoreProperty(p, answers) }))
      .sort((a, b) => b.s - a.s || parsePrice(b.p.price) - parsePrice(a.p.price));
    const top = scored.slice(0, 3);
    const anyReal = top.some(x => x.s > 0);

    await botSay(anyReal
      ? "Here's what I found for you ✨"
      : "I don't have an exact match for that combination, but here are some homes you might love:", 550);

    if (!top.length) addMessage('No listings are published yet — check back soon!', 'bot');
    else renderMatchCards(top.map(x => x.p));

    setChips(
      [{ label: 'Start over', value: 'restart' }, { label: 'Talk to an advisor', value: 'advisor' }],
      opt => {
        if (opt.value === 'advisor') { window.location.href = 'contact.html'; return; }
        answers = { type: null, typeLabel: '', city: '', budget: null };
        body.innerHTML = '';
        askType();
      }
    );
  }

  function jumpToProperty(name) {
    closePanel();
    // clear any active category/city filter so the matched card is guaranteed visible
    const chips = document.getElementById('chips');
    if (chips) {
      chips.querySelector('.active')?.classList.remove('active');
      chips.querySelector('[data-filter="all"]')?.classList.add('active');
    }
    if (typeof window.renderProperties === 'function') window.renderProperties('all');
    else if (typeof renderProperties === 'function') renderProperties('all');

    requestAnimationFrame(() => {
      const grid = document.getElementById('propertyGrid');
      const card = grid && Array.from(grid.querySelectorAll('.card')).find(c => c.dataset.pname === name);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('ai-highlight');
        setTimeout(() => card.classList.remove('ai-highlight'), 1900);
      } else {
        document.getElementById('homes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
})();
