-- ============================================================
-- Trim the stock "...across the world's great cities" tagline
-- out of the live "company" content block.
--
-- The code-level defaults (fallback.js, api/bot-render.js, the static
-- HTML placeholders) were already trimmed in the same commit that added
-- this file, but the ACTUAL text every visitor sees on the site (footer
-- tagline, and anywhere else branding.js paints company.tagline) comes
-- from this row in the database — it was seeded once on 2026-07-02 and
-- never edited, so it still had the old wording. Run this once in the
-- Supabase/self-hosted SQL editor (safe to re-run; it's a no-op after
-- the first time).
-- ============================================================
update public.content_blocks
set value = jsonb_set(
  value,
  '{tagline}',
  '"Real estate done right — handpicked homes, offices and luxury units."'
)
where key = 'company'
  and value->>'tagline' = 'Real estate done right — handpicked homes, offices and luxury units across the world''s great cities.';
