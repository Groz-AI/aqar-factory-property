// Shared by the Cloudflare build (cf/build.js) and the Pages Function (functions/_middleware.js).

// the same crawler lists as middleware.js (Vercel): preview bots, search engines and AI crawlers
const PREVIEW_BOT_RE = /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|redditbot|pinterest|skypeuripreview|vkshare|w3c_validator|embedly|quora link preview|showyoubot|outbrain|nuzzel|flipboard|tumblr|bitlybot|iframely|viber|line-poker|kakaotalk/i;
const AI_BOT_RE = /gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|google-extended|applebot-extended|bytespider|ccbot|diffbot|amazonbot|youbot|cohere-ai|meta-externalagent|timpibot|imagesiftbot|googlebot|google-inspectiontool|googleother|adsbot-google|bingbot|bingpreview|yandexbot/i;

// a crawler, or anything that does not behave like a browser (every real browser sends Sec-Fetch-Mode)
export function isBot(headers) {
  const ua = headers.get('user-agent') || '';
  return PREVIEW_BOT_RE.test(ua) || AI_BOT_RE.test(ua) || !headers.get('sec-fetch-mode');
}

// "/ar/project/some%20slug/" -> "/ar/project/some slug"
export function normalizePath(pathname) {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch (_) { /* keep as sent */ }
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

// pre-built pages are stored under a hash of their address (Arabic slugs are too long for file names)
export async function pageKey(path) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(path));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// the old query-string addresses: /project.html?id=x -> /project/x (empty id -> the list page)
export function oldQueryRedirect(path, searchParams) {
  const ar = path === '/ar' || path.startsWith('/ar/');
  const page = ar ? path.slice(3) : path;
  if (page === '/index.html') return ar ? '/ar' : '/';
  const kind = page === '/project.html' ? 'project' : page === '/unit.html' ? 'unit' : page === '/blog-post.html' ? 'blog' : null;
  if (!kind) return null;
  const listing = { project: '/projects.html', unit: '/units.html', blog: '/blog.html' };
  const id = String(searchParams.get('id') || searchParams.get('slug') || '').replace(/^\/+|\/+$/g, '');
  if (!id) return (ar ? '/ar' : '') + listing[kind];
  return `${ar ? '/ar' : ''}/${kind}/${encodeURIComponent(id)}`;
}
