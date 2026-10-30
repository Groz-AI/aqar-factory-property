-- Homepage sections: "أبرز المشروعات" (Featured) and "استلام فوري" (Ready to move).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Every project/unit starts switched off for both sections.

alter table public.projects add column if not exists is_featured  boolean not null default false;
alter table public.projects add column if not exists ready_to_move boolean not null default false;
alter table public.units    add column if not exists is_featured  boolean not null default false;
alter table public.units    add column if not exists ready_to_move boolean not null default false;
