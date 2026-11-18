-- ============================================================
-- Market updates ("تابع مشروعك" tab) — admin-written pages
-- ------------------------------------------------------------
-- Each row is one public, indexable page at /market_update/<slug> (and
-- /ar/market_update/<slug>): title, description, photos, links and a
-- WhatsApp button, all written in the admin portal. The slug is typed by
-- the admin and is the whole last part of the page's address.
--
-- Public can read published rows only. Writes need the 'market_updates'
-- page permission (Owners always have it; staff are ticked on the Users page).
--
-- Run ONCE. Safe to re-run. Additive: one new table, no existing data touched.
-- ============================================================

begin;

create table if not exists public.market_updates (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,               -- the part after /market_update/
  title           text not null,
  title_ar        text,
  summary         text,                               -- short line for the list card + search snippet
  summary_ar      text,
  description     text,                               -- body; blank line = new paragraph
  description_ar  text,
  photos          text[] default '{}',                -- first photo is the cover
  links           text,                               -- one per line:  Label | https://url | Arabic label (optional)
  whatsapp_number text,                               -- empty = the company WhatsApp number
  whatsapp_text   text,                               -- pre-filled message
  seo_title       text,
  seo_title_ar    text,
  seo_description    text,
  seo_description_ar text,
  published_at    timestamptz default now(),
  sort_order      int default 0,
  published       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

drop trigger if exists trg_touch_market_updates on public.market_updates;
create trigger trg_touch_market_updates before update on public.market_updates
  for each row execute function public.touch_updated_at();

alter table public.market_updates enable row level security;

drop policy if exists "read published" on public.market_updates;
create policy "read published" on public.market_updates
  for select using (published = true or public.is_admin());

drop policy if exists "admin create" on public.market_updates;
create policy "admin create" on public.market_updates
  for insert with check (public.has_page('market_updates'));
drop policy if exists "admin edit" on public.market_updates;
create policy "admin edit" on public.market_updates
  for update using (public.has_page('market_updates') and public.can_edit_content('market_updates'))
  with check (public.has_page('market_updates') and public.can_edit_content('market_updates'));
drop policy if exists "admin delete" on public.market_updates;
create policy "admin delete" on public.market_updates
  for delete using (public.has_page('market_updates') and public.can_edit_content('market_updates'));

grant select on public.market_updates to anon, authenticated;
grant insert, update, delete on public.market_updates to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.market_updates;
exception when others then null;   -- already added
end $$;

-- photo uploads: a staffer who only has Market updates must still be able to upload
create or replace function public.has_any_content_access()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and active = true
      and (role = 'owner' or permissions ?| array['projects','cities','testimonials','developers','posts','units','content','market_updates'])
  );
$$;

commit;

notify pgrst, 'reload schema';

-- ---------- checks to run afterwards (read-only) ----------
--   select count(*) from public.market_updates;                                  -- 0
--   select policyname from pg_policies where tablename = 'market_updates';       -- 4 rows
--
-- to undo:
--   drop table if exists public.market_updates;
