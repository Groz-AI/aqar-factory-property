-- FAQs (الأسئلة الشائعة) for projects and units.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Each column holds a list like:
--   [{"q": "Where is it located?", "a": "Behind Palm Hills Golf..."}, ...]
-- `faqs` is the English list, `faqs_ar` the Arabic one; each language's page
-- shows only its own list (no cross-language fallback).

alter table public.projects add column if not exists faqs    jsonb default '[]'::jsonb;
alter table public.projects add column if not exists faqs_ar jsonb default '[]'::jsonb;
alter table public.units    add column if not exists faqs    jsonb default '[]'::jsonb;
alter table public.units    add column if not exists faqs_ar jsonb default '[]'::jsonb;
