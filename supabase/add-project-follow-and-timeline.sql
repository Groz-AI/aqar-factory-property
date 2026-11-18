-- ============================================================
-- "تابع مشروعك" — follow a project + per-project progress timeline
-- ------------------------------------------------------------
-- 1. projects.timeline  — the construction-progress checkpoints an admin
--    edits inside the project form. One jsonb array per project, each entry:
--      { title, title_ar, status, status_ar, date, desc, desc_ar, photos:[url,...] }
--    (oldest first; the website shows the newest first)
-- 2. project_followers  — visitors who chose to follow a project (name +
--    phone/WhatsApp, one row per project). Anyone may follow a published
--    project (anon insert); only admins with the "followers" page can read
--    or delete. A visitor following the same project twice is ignored by
--    the website (the unique key below).
--
-- Run ONCE, before deploying the site code that uses it. Safe to re-run.
-- Additive only (a nullable column + a new table). Take a pg_dump first.
-- ============================================================

begin;

-- ---------- 1. timeline column ----------
alter table public.projects add column if not exists timeline jsonb default '[]'::jsonb;

-- ---------- 2. followers ----------
create table if not exists public.project_followers (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  phone      text not null,
  created_at timestamptz default now(),
  unique (project_id, phone)
);
create index if not exists idx_project_followers_project on public.project_followers(project_id);

alter table public.project_followers enable row level security;

drop policy if exists "public follow project" on public.project_followers;
create policy "public follow project" on public.project_followers
  for insert with check (
    exists (select 1 from public.projects p where p.id = project_id and p.published)
  );

drop policy if exists "admin read followers" on public.project_followers;
create policy "admin read followers" on public.project_followers
  for select using (public.has_page('followers'));

drop policy if exists "admin delete followers" on public.project_followers;
create policy "admin delete followers" on public.project_followers
  for delete using (public.has_page('followers'));

-- the roles PostgREST uses (harmless if the privileges are already there)
do $$
begin
  grant insert on public.project_followers to anon;
  grant select, delete on public.project_followers to authenticated;
exception when others then
  raise notice 'grant skipped: %', sqlerrm;
end $$;

-- ---------- 3. spam brake (needs add-form-rate-limit.sql to have been run) ----------
-- One row is written per followed project, so the limit is higher than the
-- 10/hour used for contact messages and newsletter signups.
do $$
begin
  if to_regprocedure('public.form_rate_limit()') is not null then
    drop trigger if exists followers_rate_limit on public.project_followers;
    create trigger followers_rate_limit before insert on public.project_followers
      for each row execute function public.form_rate_limit('30');
  else
    raise notice 'form_rate_limit() not found - followers_rate_limit trigger NOT created (run add-form-rate-limit.sql, then re-run this file)';
  end if;
end $$;

-- ---------- 4. live counts in the admin ----------
do $$
begin
  alter publication supabase_realtime add table public.project_followers;
exception when others then null;   -- already added
end $$;

commit;

-- let PostgREST see the new table and column straight away
notify pgrst, 'reload schema';

-- ---------- checks to run afterwards (read-only) ----------
--   select column_name from information_schema.columns
--    where table_name = 'projects' and column_name = 'timeline';          -- 1 row
--   select count(*) from public.project_followers;                          -- 0
--   select tgname from pg_trigger where tgname = 'followers_rate_limit';    -- 1 row
--
-- to undo:
--   drop table if exists public.project_followers;
--   alter table public.projects drop column if exists timeline;
