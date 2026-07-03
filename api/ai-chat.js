/* ============================================================
   REALTEEK — AI chat proxy (Vercel serverless function)
   ------------------------------------------------------------
   Keeps the Gemini API key server-side. The browser never sees it.
   Configure by adding a GEMINI_API_KEY environment variable in the
   Vercel project (Settings -> Environment Variables), then redeploy.
   Get a free key (no credit card) at https://aistudio.google.com/apikey
   ============================================================ */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      error: 'not_configured',
      reply: "Our live AI advisor isn't connected yet — the site owner needs to add a free Gemini API key. In the meantime, try the quick match above!"
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const message = String(body.message || '').slice(0, 800).trim();
  if (!message) { res.status(400).json({ error: 'empty_message' }); return; }

  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const ctx = body.context || {};
  const properties = Array.isArray(ctx.properties) ? ctx.properties.slice(0, 30) : [];
  const cities = Array.isArray(ctx.cities) ? ctx.cities.slice(0, 30) : [];
  const categories = Array.isArray(ctx.categories) ? ctx.categories.slice(0, 30) : [];
  const companyName = String(ctx.companyName || 'Realteek').slice(0, 60);

  const systemPrompt = [
    `You are "Realteek AI", a warm, concise real-estate advisor for ${companyName}, a property marketplace that only SELLS homes (no rentals or leasing).`,
    `Only recommend properties that appear in the LISTINGS JSON below — never invent an address, price or property name.`,
    `When you recommend a property, state its exact "name" field from the JSON so the site can link to it.`,
    `If nothing in the listings fits what the customer wants, say so honestly and suggest the closest alternatives.`,
    `Keep replies short: 2-4 sentences, friendly, end with a clarifying question when it helps narrow things down.`,
    ``,
    `CITIES: ${JSON.stringify(cities)}`,
    `CATEGORIES: ${JSON.stringify(categories)}`,
    `LISTINGS: ${JSON.stringify(properties)}`
  ].join('\n');

  const contents = history
    .map(h => ({
      role: h && h.role === 'user' ? 'user' : 'model',
      parts: [{ text: String((h && h.text) || '').slice(0, 800) }]
    }))
    .concat([{ role: 'user', parts: [{ text: message }] }]);

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 320, temperature: 0.6 }
        })
      }
    );
    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(200).json({
        error: 'upstream',
        reply: "Sorry, I'm having trouble thinking right now — please try again in a moment.",
        detail: data && data.error && data.error.message
      });
      return;
    }
    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    res.status(200).json({ reply: (text || '').trim() || "I couldn't quite catch that — could you rephrase?" });
  } catch (e) {
    res.status(200).json({ error: 'network', reply: "Sorry, I'm having trouble connecting right now. Please try again shortly." });
  }
};
