/* ============================================================
   REALTEEK AI — floating property matchmaker
   A self-contained widget: injects its own markup, asks a short
   conversational flow (type -> city -> budget), scores real listings
   from window.store, and surfaces the best-fit matches. No external
   AI service is called — it's a transparent, deterministic matching
   engine presented as a friendly assistant.
   ============================================================ */
(function () {
  'use strict';

  const sparkSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 8l1.4 3.6L17 13l-3.6 1.4L12 18l-1.4-3.6L7 13l3.6-1.4L12 8Z" fill="currentColor"/></svg>`;
  const closeSVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

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

  let started = false;
  let answers = { type: null, typeLabel: '', city: '', budget: null };
  let dataset = { properties: [], categories: [], cities: [] };

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
      const [props, cats, cities] = await Promise.all([
        S.getProperties ? S.getProperties() : [],
        S.getCategories ? S.getCategories() : [],
        S.getCities ? S.getCities() : []
      ]);
      dataset.properties = props || [];
      dataset.categories = cats || [];
      dataset.cities = cities || [];
    } catch (_) { /* keep empty dataset, matching just falls back gracefully */ }
  }

  async function boot() {
    await botSay("Hi! I'm Realteek AI — tell me what you're after and I'll match you with the best-fit homes.", 500);
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

    if (!top.length) {
      addMessage('No listings are published yet — check back soon!', 'bot');
    } else {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-self:stretch';
      top.forEach(({ p }) => {
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
