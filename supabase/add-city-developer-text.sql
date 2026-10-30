-- A paragraph (English + Arabic) for every city and every developer.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Shown on the Cities page and above the project list when
-- the visitor filters by that city or developer; each language shows only its own text.

alter table public.cities     add column if not exists description    text;
alter table public.cities     add column if not exists description_ar text;
alter table public.developers add column if not exists description    text;
alter table public.developers add column if not exists description_ar text;
