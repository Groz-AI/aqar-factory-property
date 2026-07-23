/* ============================================================
   AQAR FACTORY — shared rich-content block renderer
   ------------------------------------------------------------
   Turns the block-array shape produced by the admin's block editor
   (admin/admin.js's wireBlocks()) into HTML. Used by both project.js
   (project "about" section) and blog-post.js (article body) so the
   two surfaces never drift apart — fix a block's rendering once here.

   Block text (paragraph/quote/callout/table cells) is rendered as
   trusted HTML, not escaped: the editor's rich-text toolbar produces
   inline <b>/<i>/<span style="...">/<a> tags that need to render as
   real formatting, not literal text. This mirrors the trusted-admin-
   content model already used elsewhere in this app (e.g. project
   "about" paragraphs before this file existed).

   window.ICON_LIBRARY is also defined here since both the public
   renderer and the admin's icon picker need the exact same set.
   ============================================================ */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- curated icon set (Feather-style stroke SVGs, currentColor) ----------
  window.ICON_LIBRARY = {
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/></svg>',
    bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-2.6 1L4 6"/><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 12h20"/><path d="M6 19v2M18 19v2"/></svg>',
    ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="1"/><path d="M6 7v3M10 7v5M14 7v3M18 7v5"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM3 17V9l2-5h14l2 5v8"/></svg>',
    pool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M4 6c1.5 2 3 2 4.5 0S12 4 12 4"/><path d="M2 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5 17.5 17.5"/><path d="m21 21-1.5-1.5M3 3l1.5 1.5"/><path d="M18.5 4.5a2 2 0 1 1 3 3l-1 1a2 2 0 1 1-3-3zM2.5 15.5a2 2 0 1 1 3 3l-1 1a2 2 0 1 1-3-3z"/><path d="m16 8 1-1M7 17l1-1"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0"/><path d="M2 8.5a15.5 15.5 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/></svg>',
    elevator: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="m10 8 2-2 2 2M10 16l2 2 2-2"/></svg>',
    tree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 7 9h2l-4 6h3l-3 5h14l-3-5h3l-4-6h2z"/><path d="M12 22v-4"/></svg>',
    paw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="6" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="17" cy="6" r="2"/><circle cx="20" cy="11" r="2"/><path d="M9.5 18c-2 0-4-1.5-4-4 0-2 2-3 4-3s3 1 4.5 1 2.5-1 4.5-1 4 1 4 3c0 2.5-2 4-4 4-1.5 0-2-1-4.5-1s-3 1-4.5 1Z"/></svg>',
    snowflake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1M2 12h20"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
  };

  // recognizes a plain YouTube/Vimeo link and turns it into an embeddable
  // player URL; anything else is passed through as-is (already an embed URL)
  function toEmbedURL(url) {
    url = String(url || '').trim();
    let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
    return url;
  }

  const alignStyle = (b) => b && b.align ? ` style="text-align:${esc(b.align)}"` : '';

  function slotHTML(slot) {
    if (!slot) return '';
    if (slot.type === 'image' && slot.image) {
      const src = /^(https?:)?\/\//.test(slot.image) || /^data:/.test(slot.image)
        ? slot.image
        : `https://images.unsplash.com/photo-${slot.image}?auto=format&fit=crop&w=800&q=80`;
      return `<img src="${esc(src)}" alt="" loading="lazy">`;
    }
    return slot && slot.text ? `<p${alignStyle(slot)}>${slot.text}</p>` : '';
  }

  function blockHTML(b) {
    if (!b) return '';
    if (b.type === 'heading') return b.text ? `<h2${alignStyle(b)}>${esc(b.text)}</h2>` : '';
    if (b.type === 'image') {
      if (!b.image) return '';
      const src = /^(https?:)?\/\//.test(b.image) || /^data:/.test(b.image)
        ? b.image
        : `https://images.unsplash.com/photo-${b.image}?auto=format&fit=crop&w=1200&q=80`;
      return `<figure class="blog-block-image"><img src="${esc(src)}" alt="" loading="lazy"></figure>`;
    }
    if (b.type === 'quote') return b.text ? `<blockquote class="blog-block-quote"${alignStyle(b)}>${b.text}</blockquote>` : '';
    if (b.type === 'list') {
      const items = String(b.text || '').split('\n').map(s => s.trim()).filter(Boolean);
      return items.length ? `<ul class="blog-block-list">${items.map(li => `<li>${esc(li)}</li>`).join('')}</ul>` : '';
    }
    if (b.type === 'video') {
      const src = toEmbedURL(b.text);
      return src ? `<div class="blog-block-video"><iframe src="${esc(src)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="video"></iframe></div>` : '';
    }
    if (b.type === 'divider') return `<hr class="block-divider">`;
    if (b.type === 'callout') {
      if (!b.text) return '';
      const bg = b.color || 'var(--sky-soft)';
      return `<div class="block-callout" style="background:${esc(bg)}">${b.text}</div>`;
    }
    if (b.type === 'button') {
      if (!b.url || !b.label) return '';
      return `<a class="block-button" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)}</a>`;
    }
    if (b.type === 'icon-row') {
      const items = Array.isArray(b.items) ? b.items.filter(it => it && (it.label || it.icon)) : [];
      if (!items.length) return '';
      return `<div class="block-icon-row">${items.map(it =>
        `<span class="block-icon-item">${window.ICON_LIBRARY[it.icon] || ''}<span>${esc(it.label || '')}</span></span>`
      ).join('')}</div>`;
    }
    if (b.type === 'columns') {
      const left = slotHTML(b.left), right = slotHTML(b.right);
      return (left || right) ? `<div class="block-columns"><div>${left}</div><div>${right}</div></div>` : '';
    }
    if (b.type === 'table') {
      const rows = Array.isArray(b.cells) ? b.cells : [];
      if (!rows.length) return '';
      const body = rows.map(row => `<tr>${(row || []).map(cell => {
        const style = cell && cell.bg ? ` style="background:${esc(cell.bg)}"` : '';
        return `<td${style}>${(cell && cell.text) || ''}</td>`;
      }).join('')}</tr>`).join('');
      return `<table class="block-table"><tbody>${body}</tbody></table>`;
    }
    // paragraph (default) — trusted HTML: may contain <b>/<i>/<span style>/<a> from the rich-text toolbar
    return b.text ? `<p${alignStyle(b)}>${b.text}</p>` : '';
  }

  window.renderBlocks = function renderBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : []).map(blockHTML).join('');
  };
})();
