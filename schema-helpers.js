/* ============================================================
   Shared JSON-LD builders — loaded as a plain <script> by the detail
   pages (project.js / unit.js / blog-post.js read window.SchemaHelpers)
   AND require()'d by api/bot-render.js, so the markup a crawler gets and
   the markup a real browser/validator gets can never drift apart.
   ============================================================ */
(function (root) {
  const SITE = 'https://www.aqar-factory.com';
  const ORG_ID = SITE + '/#organization';
  const WEBSITE_ID = SITE + '/#website';

  const decodeEntities = (s) => s
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  // block text is rich-text HTML; line structure (<br>, block-level closes)
  // is what separates a question from its answer, so keep it as newlines
  function htmlToLines(html) {
    return decodeEntities(String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|div|tr|td|th|table|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  const ENDS_WITH_QUESTION = /[?؟]$/;

  // Only emits Q&A that is literally on the page: a line ending in "?"/"؟"
  // immediately followed by a non-question line is taken as question +
  // answer. Anything less clear-cut is skipped, and fewer than 2 pairs
  // means no FAQPage at all - a mismatch between FAQ markup and visible
  // content is a structured-data policy violation, so this errs on silence.
  const BULLET = /^([•\-*▪✔✅►◦]|\d+[.)-])\s*/;

  function extractFaq(blocks) {
    const lines = []; // { text, block }
    (blocks || []).forEach((b, bi) => {
      if (!b || !b.text || (b.type !== 'paragraph' && b.type !== 'heading')) return;
      for (const text of htmlToLines(b.text)) lines.push({ text, block: bi });
    });
    const pairs = [];
    const seen = new Set();
    for (let i = 0; i < lines.length - 1; i++) {
      const q = lines[i].text;
      // long rhetorical marketing lines ("can you imagine owning...?") are
      // not questions a visitor asked; real FAQ questions are short
      if (!ENDS_WITH_QUESTION.test(q) || q.length < 10 || q.length > 120) continue;
      const first = lines[i + 1];
      if (ENDS_WITH_QUESTION.test(first.text)) continue;
      // an answer that introduces a list ("...if you are looking for:")
      // continues through that list, but never past its own content block
      // or into the next question
      let answer = first.text;
      let inList = /[:：]$/.test(answer);
      let j = i + 2;
      while (j < lines.length && lines[j].block === first.block && !ENDS_WITH_QUESTION.test(lines[j].text)
        && (inList || BULLET.test(lines[j].text)) && answer.length < 1200) {
        answer += ' ' + lines[j].text;
        if (/[:：]$/.test(lines[j].text)) inList = true;
        j++;
      }
      // a short "answer" is almost always the next section's heading, not
      // a reply to the line above it
      if (answer.length < 30 || answer.length > 1500) continue;
      if (!seen.has(q)) { seen.add(q); pairs.push({ q, a: answer }); }
      i = j - 1;
    }
    return pairs.length >= 2 ? pairs : [];
  }

  function faqNode(pairs, pageUrl) {
    if (!pairs || !pairs.length) return null;
    return {
      '@type': 'FAQPage',
      '@id': pageUrl + '#faq',
      mainEntity: pairs.map((p) => ({
        '@type': 'Question', name: p.q,
        acceptedAnswer: { '@type': 'Answer', text: p.a }
      }))
    };
  }

  // mirrors the visible breadcrumb on project.html / unit.html /
  // blog-post.html exactly (same labels i18n.js renders in Arabic)
  const CRUMB_LABELS = {
    en: { home: 'Home', project: 'Projects', unit: 'Units', blog: 'Blog' },
    ar: { home: 'الرئيسية', project: 'مشاريع', unit: 'الوحدات', blog: 'المدونة' }
  };
  const LIST_PATH = { project: '/projects.html', unit: '/units.html', blog: '/blog.html' };

  function breadcrumbNode(kind, isAr, name, pageUrl) {
    const L = CRUMB_LABELS[isAr ? 'ar' : 'en'];
    return {
      '@type': 'BreadcrumbList',
      '@id': pageUrl + '#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: L.home, item: SITE + (isAr ? '/ar' : '/') },
        { '@type': 'ListItem', position: 2, name: L[kind], item: SITE + (isAr ? '/ar' : '') + LIST_PATH[kind] },
        { '@type': 'ListItem', position: 3, name, item: pageUrl }
      ]
    };
  }

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIdx = (d) => DAYS.findIndex((x) => x.toLowerCase().startsWith(String(d).toLowerCase().slice(0, 3)));
  const to24 = (h, m, ap) => {
    let hh = Number(h) % 12;
    if (/pm/i.test(ap)) hh += 12;
    return String(hh).padStart(2, '0') + ':' + (m || '00');
  };

  // "Sunday – Thursday: 9am – 6pm" style lines only; anything else
  // ("Saturday: by appointment") is skipped rather than guessed at
  function parseHours(text) {
    const specs = [];
    const re = /^([A-Za-z]+)(?:\s*[–-]\s*([A-Za-z]+))?\s*:\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;
    for (const line of String(text || '').split(/\n/).map((s) => s.trim()).filter(Boolean)) {
      const m = line.match(re);
      if (!m) continue;
      const from = dayIdx(m[1]);
      const to = m[2] ? dayIdx(m[2]) : from;
      if (from < 0 || to < 0) continue;
      const days = [];
      for (let d = from; ; d = (d + 1) % 7) { days.push(DAYS[d]); if (d === to) break; }
      specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens: to24(m[3], m[4], m[5]), closes: to24(m[6], m[7], m[8]) });
    }
    return specs;
  }

  // "street, area, Cairo Governorate, Egypt" - last part is the country,
  // the one before it the governorate; the rest stays as the street line
  function parseAddress(text) {
    const parts = String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return null;
    const addr = { '@type': 'PostalAddress' };
    if (/^egypt$/i.test(parts[parts.length - 1])) { addr.addressCountry = 'EG'; parts.pop(); }
    if (parts.length > 1 && /governorate/i.test(parts[parts.length - 1])) {
      addr.addressRegion = parts.pop();
      addr.addressLocality = addr.addressRegion.replace(/\s*governorate\s*/i, '').trim();
    }
    addr.streetAddress = parts.join(', ');
    return addr;
  }

  const realUrl = (u) => typeof u === 'string' && /^https?:\/\//.test(u);

  // full company entity - same @id every detail page's lightweight
  // Organization node points at; only real, visible social links count
  function companyNode(c) {
    c = c || {};
    const sameAs = ['facebook', 'instagram', 'linkedin', 'tiktok', 'x', 'youtube']
      .filter((k) => realUrl(c[k]) && c[k + '_visible'] !== false)
      .map((k) => c[k]);
    const hours = parseHours(c.hours);
    return {
      '@id': ORG_ID,
      '@type': ['Organization', 'RealEstateAgent'],
      name: c.name || 'Aqar Factory',
      url: SITE + '/',
      logo: c.logo || undefined,
      image: c.logo || undefined,
      description: c.tagline || undefined,
      email: c.email || undefined,
      telephone: c.phone || undefined,
      address: parseAddress(c.address) || undefined,
      openingHoursSpecification: hours.length ? hours : undefined,
      areaServed: { '@type': 'Country', name: 'Egypt' },
      sameAs: sameAs.length ? sameAs : undefined,
      contactPoint: c.phone ? [{
        '@type': 'ContactPoint', telephone: c.phone, email: c.email || undefined,
        contactType: 'sales', areaServed: 'EG', availableLanguage: ['English', 'Arabic']
      }] : undefined
    };
  }

  function websiteNode() {
    return {
      '@id': WEBSITE_ID, '@type': 'WebSite', name: 'Aqar Factory', url: SITE + '/',
      inLanguage: ['en', 'ar'], publisher: { '@id': ORG_ID }
    };
  }

  const api = { SITE, ORG_ID, WEBSITE_ID, extractFaq, faqNode, breadcrumbNode, companyNode, websiteNode, parseHours, parseAddress };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SchemaHelpers = api;
})(typeof window !== 'undefined' ? window : globalThis);
