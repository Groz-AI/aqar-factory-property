#!/usr/bin/env node
// Builds buyer-style FAQs (where is it / what units / payment plan / price /
// delivery / developer / sales phone) for every published project and unit,
// in English and Arabic, from each item's OWN data - and only when that data
// exists AND is in the right language for the page. A question that can't be
// answered correctly from the data is skipped, never guessed.
//
// Usage:
//   node scripts/seo-audit/faq-generate.js            # dry run: writes faq-generated.json, touches nothing
//   node scripts/seo-audit/faq-generate.js --apply    # writes faqs / faqs_ar (never overwrites FAQs already there)

const fs = require('fs');
const path = require('path');

const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';
const OUT = path.join(__dirname, 'faq-generated.json');

// ---------------------------------------------------------------- script helpers
const AR_RE = /[؀-ۿ]/g, LAT_RE = /[A-Za-z]/g;
const arShare = (s) => { const a = (String(s).match(AR_RE) || []).length, l = (String(s).match(LAT_RE) || []).length; return a + l ? a / (a + l) : 0; };
const latinCount = (s) => (String(s).match(LAT_RE) || []).length;
const fmt = (n) => Number(n).toLocaleString('en-US');
const num = (n) => { const x = Number(n); return Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10); };
const sentence = (s) => { s = String(s).trim().replace(/[\s.،,]+$/, ''); return s ? s + '.' : ''; };
const upFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "Kilo 173, ... (الكيلو 173، ...)" and "EN | AR" style locations -> one piece per script
function locPieces(loc) {
  const out = [];
  for (const part of String(loc || '').split(/\s*\|\s*/)) {
    const m = part.match(/^(.*?)\s*[\(（]([^()（）]+)[\)）]\s*\.?$/);
    if (m && Math.abs(arShare(m[1]) - arShare(m[2])) > 0.6) out.push(m[1], m[2]); else out.push(part);
  }
  return out.map((s) => s.trim().replace(/^[\s•·*–-]+/, '').replace(/[\s.،,]+$/, '')).filter(Boolean);
}
function pickLoc(loc, lang) {
  for (const p of locPieces(loc)) {
    const s = arShare(p);
    if (p.length < 8 || p.length > 300) continue;
    if (lang === 'ar' ? s > 0.8 : (s < 0.05 && latinCount(p) >= 6)) return p;
  }
  return null;
}

// project.city is English; the 17 values in use, mapped by hand
const CITY_AR = {
  'north coast': 'الساحل الشمالي', '5th settlement': 'التجمع الخامس', 'new capital': 'العاصمة الإدارية الجديدة', 'cairo': 'القاهرة',
  'mostakbal city - new cairo': 'مدينة المستقبل، القاهرة الجديدة', 'el shorouk city, cairo': 'مدينة الشروق، القاهرة', 'el obour': 'العبور',
  '6th of october city, giza, egypt': 'مدينة 6 أكتوبر، الجيزة، مصر', 'sixth settlement, new cairo': 'التجمع السادس، القاهرة الجديدة',
  'ain sokhna, egypt': 'العين السخنة، مصر', 'red sea': 'البحر الأحمر', 'sheikh zayed city': 'مدينة الشيخ زايد', 'new heliopolis': 'هليوبوليس الجديدة',
  'ras sedr, south sinai': 'رأس سدر، جنوب سيناء', 'new alamein, north coast': 'العلمين الجديدة، الساحل الشمالي', 'new zayed': 'زايد الجديدة',
};
function cityFor(city, lang) {
  if (!city) return null;
  const c = String(city).trim();
  if (arShare(c) > 0 && latinCount(c) > 0) { const m = c.split(/\s*[–-]\s*/); const ar = m.find((x) => arShare(x) > 0.8), en = m.find((x) => arShare(x) < 0.05); return lang === 'ar' ? (ar || null) : (en || null); }
  if (lang === 'en') return arShare(c) < 0.05 ? c : null;
  return CITY_AR[c.toLowerCase()] || null;
}

// clean unit-type names only (the project.unit_types field also holds amenities and stray fragments)
const TYPES = {};
[
  ['apartments|apartment|residential apartments|شقق سكنية|شقق|شقة', 'apartments', 'شقق'],
  ['luxury apartments|premium apartments|شقق فاخرة', 'luxury apartments', 'شقق فاخرة'],
  ['standalone villas|standalone villa|فلل مستقلة', 'standalone villas', 'فلل مستقلة'],
  ['villas|villa|فلل|فيلا', 'villas', 'فلل'],
  ['chalets|chalet|شاليهات|شاليه', 'chalets', 'شاليهات'],
  ['luxury chalets', 'luxury chalets', 'شاليهات فاخرة'],
  ['townhouses|townhouse|town houses|تاون هاوس', 'townhouses', 'تاون هاوس'],
  ['twin houses|twin house|twin villas|توين هاوس', 'twin houses', 'توين هاوس'],
  ['penthouses|penthouse|luxury penthouses|بنتهاوس', 'penthouses', 'بنتهاوس'],
  ['studios|studio|luxury studios|premium studios|استوديوهات|استوديو', 'studios', 'استوديوهات'],
  ['duplexes|duplex|luxury duplexes|دوبلكس', 'duplexes', 'دوبلكس'],
  ['administrative offices|offices|office units|administrative units|administrative|مكاتب إدارية', 'administrative offices', 'مكاتب إدارية'],
  ['commercial units|commercial|retail|retail unit|وحدات تجارية', 'commercial units', 'وحدات تجارية'],
  ['commercial shops|محلات تجارية', 'commercial shops', 'محلات تجارية'],
  ['medical clinics|medical units|medical|عيادات طبية|وحدات طبية', 'medical clinics', 'عيادات طبية'],
  ['hotel apartments|hotel units|hotel rooms|شقق فندقية', 'hotel apartments', 'شقق فندقية'],
  ['serviced apartments|serviced residential apartments', 'serviced apartments', 'شقق مخدومة'],
  ['quad villas', 'quad villas', 'فلل كواترو'],
  ['lagoon houses', 'lagoon houses', 'لاجون هاوس'],
  ['lofts|loft|beach lofts|لوفت', 'lofts', 'لوفت'],
  ['cabins|beach cabanas', 'cabins', 'كابينات'],
  ['ground floor apartments with gardens|ground apartments with garden|apartments with garden', 'ground-floor apartments with gardens', 'شقق أرضي بحديقة'],
].forEach(([keys, en, ar]) => keys.split('|').forEach((k) => { TYPES[k] = { id: en, en, ar }; }));
function projectTypes(list) {
  const seen = new Map();
  for (const raw of list || []) {
    const t = TYPES[String(raw).replace(/\s*[\(（].*$/, '').trim().toLowerCase()];
    if (t && !seen.has(t.id)) seen.set(t.id, t);
  }
  return [...seen.values()];
}
const joinList = (arr, and) => { const ar = and === 'و'; return arr.length < 2 ? (arr[0] || '') : arr.slice(0, -1).join(ar ? '، ' : ', ') + (ar ? ' و' : ` ${and} `) + arr[arr.length - 1]; };

// single-unit types (units.type)
const UNIT_TYPE = {
  Apartment: ['apartment', 'الشقة', 'هذه'], Chalet: ['chalet', 'الشاليه', 'هذا'], Villa: ['villa', 'الفيلا', 'هذه'], Retail: ['retail unit', 'المحل التجاري', 'هذا'],
  Townhouse: ['townhouse', 'التاون هاوس', 'هذا'], Studio: ['studio', 'الاستوديو', 'هذا'], Office: ['office', 'المكتب', 'هذا'], Penthouse: ['penthouse', 'البنتهاوس', 'هذا'],
  Duplex: ['duplex', 'الدوبلكس', 'هذا'], Pharmacy: ['pharmacy', 'الصيدلية', 'هذه'],
};

// SEO-stuffed names ("Name | tagline | Name EN | Phase") -> the readable lead segment
function shortName(n) {
  const parts = String(n || '').split(/\s*[|｜]\s*/).filter(Boolean);
  if (!parts.length) return '';
  let s = parts[0];
  if (s.length < 14 && parts[1]) s += ' ' + parts[1];
  return s.trim();
}

// ---------------------------------------------------------------- Arabic number agreement
const arYears = (n) => n === 1 ? 'سنة واحدة' : n === 2 ? 'سنتين' : n <= 10 ? `${n} سنوات` : `${n} سنة`;
const arBeds = (n) => n === 1 ? 'غرفة نوم واحدة' : n === 2 ? 'غرفتي نوم' : n <= 10 ? `${n} غرف نوم` : `${n} غرفة نوم`;
const arBaths = (n) => n === 1 ? 'حمام واحد' : n === 2 ? 'حمامين' : n <= 10 ? `${n} حمامات` : `${n} حمام`;

// ---------------------------------------------------------------- readers for the free-text price/area fields
const DOWN_RE = /(?:مقدم|مقدمات|down\s*payment)[^\d%]{0,25}(\d+(?:\.\d+)?)\s*%/i;
const YEARS_RE = /(?:حتى|تصل\s*(?:إلى|لـ|ل)|على|up\s*to|over)[^\d]{0,15}(\d{1,2})\s*(?:سنوات|سنة|سنين|years|yrs)/i;
const PER_METER_RE = /سعر\s*المتر|سعر\s*متر|per\s*(?:sq|m)|price\s*per/i;
function paymentPlan(text) {
  const d = String(text || '').match(DOWN_RE), y = String(text || '').match(YEARS_RE);
  if (!d || !y) return null;
  const down = Number(d[1]), years = Number(y[1]);
  return down >= 0 && down <= 50 && years >= 1 && years <= 15 ? { down, years } : null;
}
function sizeRange(text) {
  const t = String(text || '');
  let m = t.match(/(?:تبدأ\s*من|يبدأ\s*من|starts?\s*from|from)\s*(\d+(?:\.\d+)?)\s*(?:م²|م2|م|m²|m2|sqm|m)\b(?!\s*(?:to|إلى|الى|-))/i);
  const r = t.match(/(\d+(?:\.\d+)?)\s*(?:م²|م2|م|m²|m2|sqm)?\s*(?:إلى|الى|to|-|–)\s*(\d+(?:\.\d+)?)\s*(?:م²|م2|م|m²|m2|sqm)/i);
  if (r && +r[1] < +r[2] && +r[1] >= 20 && +r[2] <= 3000) return { min: +r[1], max: +r[2] };
  if (m && +m[1] >= 20 && +m[1] <= 3000) return { min: +m[1] };
  return null;
}
function devName(d) {
  d = String(d || '').trim();
  if (d.length < 3 || /^(k|nile)$/i.test(d)) return null;
  return /^[a-z ]+$/.test(d) ? d.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : d;
}
function delivery(h) {
  const t = String(h || '');
  const y = (t.match(/\b(20\d\d)\b/) || [])[1];
  if (y && +y >= 2026) return { year: y };
  if (/immediate|فور/i.test(t)) return { immediate: true };
  return null;
}

// ---------------------------------------------------------------- the question sets
function projectFaqs(p, phone, lang) {
  const ar = lang === 'ar';
  const N = shortName(ar ? (p.name_ar || p.name) : p.name);
  if (!N || (ar && arShare(N) < 0.5) || (!ar && arShare(N) > 0.3)) return [];
  const out = [];
  const add = (q, a) => { if (q && a && (ar || arShare(a) < 0.1)) out.push({ q, a }); };

  const loc = pickLoc(p.location, lang);
  const city = cityFor(p.city, lang);
  if (loc) add(ar ? `أين يقع ${N}؟` : `Where is ${N} located?`, sentence(loc));
  else if (city) add(ar ? `أين يقع ${N}؟` : `Where is ${N} located?`, ar ? `يقع ${N} في ${city}.` : `${N} is located in ${city}.`);

  const types = projectTypes(p.unit_types);
  const size = sizeRange(p.area);
  if (types.length || size) {
    let a = '';
    if (types.length) a += ar ? `يضم ${N} ${joinList(types.map((t) => t.ar), 'و')}.` : `${N} offers ${joinList(types.map((t) => t.en), 'and')}.`;
    if (size) a += ' ' + (size.max
      ? (ar ? `تتراوح المساحات من ${num(size.min)} م² إلى ${num(size.max)} م².` : `Unit sizes range from ${num(size.min)} m² to ${num(size.max)} m².`)
      : (ar ? `تبدأ مساحات الوحدات من ${num(size.min)} م².` : `Unit sizes start from ${num(size.min)} m².`));
    add(ar ? `ما هي أنواع ومساحات الوحدات في ${N}؟` : `What unit types and sizes does ${N} offer?`, a.trim());
  }

  const plan = paymentPlan(p.price);
  if (plan) {
    const a = plan.down === 0
      ? (ar ? `يتيح ${N} التقسيط حتى ${arYears(plan.years)} بدون مقدم.` : `${N} offers installments over up to ${plan.years} years with no down payment.`)
      : (ar ? `يتيح ${N} مقدم ${num(plan.down)}% مع تقسيط حتى ${arYears(plan.years)}.` : `${N} offers a ${num(plan.down)}% down payment with installments over up to ${plan.years} years.`);
    add(ar ? `ما هو نظام التقسيط في ${N}؟` : `What is the payment plan at ${N}?`, a);
  }

  if (p.price_value >= 100000 && !PER_METER_RE.test(p.price || '')) {
    add(ar ? `كم تبدأ أسعار ${N}؟` : `What are the starting prices at ${N}?`,
      ar ? `تبدأ الأسعار في ${N} من ${fmt(p.price_value)} جنيه مصري.` : `Prices at ${N} start from EGP ${fmt(p.price_value)}.`);
  }

  const d = delivery(p.handover);
  if (d) add(ar ? `متى موعد استلام ${N}؟` : `When will ${N} be delivered?`,
    d.year ? (ar ? `الاستلام المتوقع لمشروع ${N} في عام ${d.year}.` : `Delivery of ${N} is scheduled for ${d.year}.`)
           : (ar ? `يتوفر في ${N} وحدات للاستلام الفوري.` : `${N} has units available for immediate delivery.`));

  const dev = devName(p.developer);
  if (dev) add(ar ? `من هو مطور ${N}؟` : `Who is the developer of ${N}?`, ar ? `مطور ${N} هو ${dev}.` : `${N} is developed by ${dev}.`);

  add(ar ? `ما هو رقم مبيعات ${N}؟` : `What is the sales phone number for ${N}?`,
    ar ? `اتصل بفريق المبيعات على ${phone} أو راسلنا على واتساب على نفس الرقم.` : `Call our sales team on ${phone}, or message the same number on WhatsApp.`);
  return out;
}

function unitFaqs(u, proj, phone, lang) {
  const ar = lang === 'ar';
  const t = UNIT_TYPE[u.type];
  const noun = t ? (ar ? t[1] : t[0]) : (ar ? 'الوحدة' : 'unit');
  const dem = t ? t[2] : 'هذه';
  const thisUnit = ar ? `${dem} ${noun}` : `this ${noun}`;
  const out = [];
  const add = (q, a) => { if (q && a && (ar || arShare(a) < 0.1)) out.push({ q, a }); };
  const projName = proj ? shortName(ar ? (proj.name_ar || proj.name) : proj.name) : null;
  const projOk = projName && (ar ? arShare(projName) >= 0.5 : arShare(projName) < 0.3);

  if (u.area_value > 0 || u.beds > 0) {
    const area = u.area_value > 0 ? num(u.area_value) : null;
    let a;
    if (ar) {
      a = `مساحة ${thisUnit}`;
      a = area ? `${a} ${area} م²` : `${thisUnit.replace(/^(هذه|هذا)/, 'تضم هذه').replace('تضم هذه ', 'تضم ')}`;
      const parts = [];
      if (u.beds > 0) parts.push(arBeds(u.beds));
      if (u.baths > 0) parts.push(arBaths(u.baths));
      a = area ? `${a}${parts.length ? ' وتضم ' + parts.join(' و') : ''}.` : `${noun.replace(/^ال/, '')} تضم ${parts.join(' و')}.`;
      if (!area) a = `تضم ${thisUnit} ${parts.join(' و')}.`;
    } else {
      const parts = [];
      if (u.beds > 0) parts.push(`${u.beds} bedroom${u.beds > 1 ? 's' : ''}`);
      if (u.baths > 0) parts.push(`${u.baths} bathroom${u.baths > 1 ? 's' : ''}`);
      a = `${upFirst(thisUnit)} ${area ? `is ${area} m²` : 'has'}${parts.length ? (area ? ' with ' : ' ') + joinList(parts, 'and') : ''}.`;
    }
    add(ar ? `ما هي مساحة ${thisUnit}؟` : `What is the size of ${thisUnit}?`, a);
  }

  if (u.price_value >= 100000 && !PER_METER_RE.test(u.price || '')) {
    add(ar ? `كم سعر ${thisUnit}؟` : `What is the price of ${thisUnit}?`,
      ar ? `سعر ${thisUnit} ${fmt(u.price_value)} جنيه مصري.` : `${upFirst(thisUnit)} is priced at EGP ${fmt(u.price_value)}.`);
  }

  const plan = paymentPlan(u.price);
  if (plan) {
    add(ar ? `ما هو نظام التقسيط لـ${thisUnit}؟` : `What is the payment plan for ${thisUnit}?`,
      plan.down === 0 ? (ar ? `يتيح التقسيط حتى ${arYears(plan.years)} بدون مقدم.` : `Installments are available over up to ${plan.years} years with no down payment.`)
        : (ar ? `مقدم ${num(plan.down)}% مع تقسيط حتى ${arYears(plan.years)}.` : `A ${num(plan.down)}% down payment, with installments over up to ${plan.years} years.`));
  }

  const loc = pickLoc(u.location, lang);
  const city = proj ? cityFor(proj.city, lang) : null;
  if (loc) add(ar ? `أين تقع ${thisUnit}؟`.replace('تقع هذا', 'يقع هذا') : `Where is ${thisUnit} located?`, sentence(loc));
  else if (projOk) add(ar ? `أين تقع ${thisUnit}؟`.replace('تقع هذا', 'يقع هذا') : `Where is ${thisUnit} located?`,
    ar ? `تقع ضمن ${projName}${city ? ` في ${city}` : ''}.` : `It is part of ${projName}${city ? `, in ${city}` : ''}.`);

  if (projOk) add(ar ? `في أي مشروع تقع ${thisUnit}؟`.replace('تقع هذا', 'يقع هذا') : `Which project is ${thisUnit} in?`,
    ar ? `${upFirst(thisUnit).replace(/^./, (c) => c)} ضمن مشروع ${projName}.` : `${upFirst(thisUnit)} is part of ${projName}.`);

  add(ar ? `ما هو رقم المبيعات للاستفسار عن ${thisUnit}؟` : `What is the sales phone number for ${thisUnit}?`,
    ar ? `اتصل بفريق المبيعات على ${phone} أو راسلنا على واتساب على نفس الرقم.` : `Call our sales team on ${phone}, or message the same number on WhatsApp.`);
  return out;
}

// ---------------------------------------------------------------- main
function loadEnvLocal() {
  const env = {};
  for (const line of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const key = apply ? loadEnvLocal().SUPABASE_SERVICE_ROLE_KEY : ANON;
  if (!key) { console.error('SUPABASE_SERVICE_ROLE_KEY missing from .env.local'); process.exit(1); }
  const get = async (t, cols) => (await fetch(`${SUPA_URL}/rest/v1/${t}?select=${cols}&published=eq.true`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();

  const company = ((await (await fetch(`${SUPA_URL}/rest/v1/content_blocks?select=value&key=eq.company`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })).json())[0] || {}).value || {};
  const phone = String(company.phone || '').replace(/^\+20/, '0').replace(/\D/g, '');
  if (!/^01\d{9}$/.test(phone)) { console.error('Company phone not in the expected format:', company.phone); process.exit(1); }

  const projects = await get('projects', 'id,slug,name,name_ar,city,location,developer,handover,unit_types,area,price,price_value,faqs,faqs_ar');
  const units = await get('units', 'id,slug,type,beds,baths,area_value,price,price_value,location,project_id,faqs,faqs_ar');
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));

  const plan = [];
  for (const p of projects) plan.push({ table: 'projects', id: p.id, slug: p.slug, existing: (p.faqs || []).length + (p.faqs_ar || []).length, faqs: projectFaqs(p, phone, 'en'), faqs_ar: projectFaqs(p, phone, 'ar') });
  for (const u of units) plan.push({ table: 'units', id: u.id, slug: u.slug, existing: (u.faqs || []).length + (u.faqs_ar || []).length, faqs: unitFaqs(u, byId[u.project_id], phone, 'en'), faqs_ar: unitFaqs(u, byId[u.project_id], phone, 'ar') });
  fs.writeFileSync(OUT, JSON.stringify(plan, null, 1));

  const stat = (rows, k) => rows.filter((r) => r[k].length).length;
  for (const t of ['projects', 'units']) {
    const rows = plan.filter((r) => r.table === t);
    const lens = (k) => rows.map((r) => r[k].length);
    console.log(`${t}: ${rows.length} | with English FAQs ${stat(rows, 'faqs')} | with Arabic FAQs ${stat(rows, 'faqs_ar')} | avg questions EN ${(lens('faqs').reduce((a, b) => a + b, 0) / rows.length).toFixed(1)} AR ${(lens('faqs_ar').reduce((a, b) => a + b, 0) / rows.length).toFixed(1)} | already holding FAQs (will be skipped): ${rows.filter((r) => r.existing).length}`);
  }
  const qTypes = {};
  for (const r of plan) for (const k of ['faqs', 'faqs_ar']) for (const f of r[k]) { const id = (k === 'faqs_ar' ? 'AR ' : 'EN ') + r.table + ': ' + f.q.replace(/[A-Za-z0-9؀-ۿ'’&\-–.,() ]+?(?=\?|؟)/, '…').slice(0, 45); qTypes[id] = (qTypes[id] || 0) + 1; }
  console.log('\nquestion coverage:'); for (const [k, v] of Object.entries(qTypes).sort((a, b) => a[0].localeCompare(b[0]))) console.log('  ' + String(v).padStart(4) + '  ' + k);
  console.log('\nwrote', OUT);

  if (!apply) { console.log('Dry run only - nothing written.'); return; }
  let ok = 0, skipped = 0, failed = 0;
  for (const r of plan) {
    if (r.existing) { skipped++; continue; }
    if (!r.faqs.length && !r.faqs_ar.length) continue;
    const res = await fetch(`${SUPA_URL}/rest/v1/${r.table}?id=eq.${r.id}`, {
      method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ faqs: r.faqs, faqs_ar: r.faqs_ar }),
    });
    const row = res.ok ? (await res.json())[0] : null;
    if (row && row.faqs.length === r.faqs.length && row.faqs_ar.length === r.faqs_ar.length) ok++; else { failed++; console.log('FAILED', r.table, r.slug, res.status); }
  }
  console.log(`\nApplied ${ok}, skipped ${skipped} that already had FAQs, failed ${failed}.`);
})();
