-- ============================================================
-- REALTEEK — Supabase schema, security policies & storage
-- Run this whole file in the Supabase SQL Editor.
-- ============================================================

-- ---------- helpers ----------
create extension if not exists pgcrypto;

-- Admin allowlist. Only users listed here can write content.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz default now()
);

-- ---------- roles & per-page permissions ----------
-- role: 'owner' has unconditional full access and is the only role that can
-- manage other admin users. 'staff' is restricted to whatever page keys are
-- listed in `permissions` (e.g. ["projects","cities"]). `active=false` locks
-- an account out immediately (checked by is_admin() below) without deleting it.
-- Defaulting role to 'owner' means re-running this file against an existing
-- database backfills the pre-existing admin row to Owner automatically, with
-- no access change and no manual follow-up.
alter table public.admins add column if not exists role        text not null default 'owner' check (role in ('owner','staff'));
alter table public.admins add column if not exists permissions jsonb not null default '[]'::jsonb;
alter table public.admins add column if not exists active      boolean not null default true;

-- Is the current request made by an active admin (any role)?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and active = true);
$$;

-- Is the current request made by an active Owner?
create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and active = true and role = 'owner');
$$;

-- Does the current request's admin (Owner, or Staff with this page granted)
-- have access to a specific admin page? `page` matches the dashboard's page
-- keys: projects | cities | testimonials | developers | posts | inquiries |
-- newsletter | content.
create or replace function public.has_page(page text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and active = true and (role = 'owner' or permissions ? page)
  );
$$;

-- Media uploads are shared across several content pages with no per-file page
-- tag, so storage access is coarser than has_page(): granted to anyone with
-- at least one content-editing page (not Inquiries/Newsletter-only staff).
create or replace function public.has_any_content_access()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and active = true
      and (role = 'owner' or permissions ?| array['projects','cities','testimonials','developers','posts','content'])
  );
$$;

-- updated_at touch trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- CONTENT TABLES
-- ============================================================

-- Project categories — an admin-managed list feeding the Projects form's
-- Category dropdown. projects.category stays a plain text column (matching
-- whichever category name was picked); deleting a category here does not
-- change any project that already used its name.
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- seed the categories that used to be hardcoded in the admin form, so an
-- existing install's projects keep matching an entry after this migration
insert into public.categories (name, sort_order)
select v.name, v.sort_order from (values
  ('Residential', 0), ('Commercial', 1), ('Mixed-use', 2),
  ('Hospitality', 3), ('Retail', 4), ('Office', 5)
) as v(name, sort_order)
where not exists (select 1 from public.categories);

-- Cities — top of the hierarchy: City -> Projects -> Units
create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text,
  image       text,
  size        text default 'normal',              -- normal | wide | big
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Developments / projects — each optionally belongs to a city
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category    text not null default 'Residential',
  unit_types  text[] default '{}',                -- unit types available, e.g. Villas, Apartments, Duplex
  city        text not null,                      -- display fallback; city_id is the real link
  city_id     uuid references public.cities(id) on delete set null,
  location    text,
  country     text,
  year        int,
  status      text default 'Completed',          -- Completed | Ongoing | Off-plan
  tagline     text,
  cover       text,                               -- Unsplash id or full URL
  about       text[] default '{}',
  amenities   text[] default '{}',
  developer   text,
  developer_logo text,                             -- developer's logo, shown on the project card
  price       text,                               -- display string, e.g. "EGP 3.2M"
  units       text,
  floors      text,
  area        text,
  handover    text,
  price_value numeric default 0,                  -- numeric, for sorting
  area_value  numeric default 0,
  is_rental   boolean default false,
  lat         double precision,
  lng         double precision,
  gallery     text[] default '{}',
  brochure_pdf text,                               -- PDF brochure URL (Storage or external link)
  consultants jsonb default '[]'::jsonb,           -- [{name, logo}] shown in the sidebar
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- migrate an existing install to the relational schema above ----------
-- (all no-ops on a brand new database; safe to re-run any time)
alter table public.projects   add column if not exists city_id    uuid references public.cities(id) on delete set null;
alter table public.cities     drop column if exists unit_count;   -- replaced by a live computed count on the site
alter table public.projects   add column if not exists brochure_pdf text;                    -- PDF brochure URL (Storage or external link)
alter table public.projects   add column if not exists consultants  jsonb default '[]'::jsonb; -- [{name, logo}] shown in the sidebar
alter table public.projects   add column if not exists developer_logo text;                  -- developer's logo, shown on the project card
alter table public.projects   add column if not exists unit_types  text[] default '{}';      -- unit types available, e.g. Villas, Apartments, Duplex
alter table public.projects   add column if not exists about_blocks    jsonb default '[]'::jsonb; -- rich-content blocks (same shape as blog_posts.blocks) replacing the plain `about` text[]
alter table public.projects   add column if not exists about_blocks_ar jsonb default '[]'::jsonb; -- Arabic version; falls back to about_blocks when empty

-- one-time backfill: turn each existing about[] paragraph into a paragraph
-- block, so existing projects keep their content after switching the admin
-- form over to the block editor (guarded so it only runs once — re-running
-- this file after an admin has started using the block editor won't
-- clobber their work with a fresh re-derivation from the old text column)
update public.projects
   set about_blocks = (
     select coalesce(jsonb_agg(jsonb_build_object('type', 'paragraph', 'text', p)), '[]'::jsonb)
     from unnest(about) as p
   )
 where (about_blocks is null or about_blocks = '[]'::jsonb)
   and about is not null and array_length(about, 1) > 0;

-- best-effort backfill: link existing rows to a city by matching their free text
update public.projects pr
   set city_id = c.id
  from public.cities c
 where pr.city_id is null
   and lower(trim(pr.city)) = lower(trim(c.name));

create index if not exists idx_projects_city_id    on public.projects(city_id);

-- the old standalone units/listings module — no longer part of the site.
-- (its "categories" table is NOT dropped here anymore — that name is now
-- reused above for the admin-managed project-category taxonomy.)
drop table if exists public.properties cascade;

-- Testimonials
create table if not exists public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  quote       text not null,
  name        text not null,
  location    text,
  avatar      text,
  rating      numeric default 5,
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Developer / partner logos
create table if not exists public.developers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo        text,                               -- null = render name as wordmark
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Blog posts
create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  title_ar      text,                                -- Arabic title; falls back to `title` when empty
  excerpt       text,
  excerpt_ar    text,
  cover         text,                               -- Unsplash id or full URL
  author_name   text,
  author_avatar text,
  tags          text[] default '{}',
  tags_ar       text[] default '{}',
  blocks        jsonb default '[]'::jsonb,           -- [{type:'heading'|'paragraph'|'image', text, image}], in display order
  blocks_ar     jsonb default '[]'::jsonb,           -- Arabic article body; falls back to `blocks` when empty
  published_at  timestamptz default now(),           -- editable "posted on" date, independent of created_at
  sort_order    int default 0,
  published     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ---------- migrate an existing blog_posts table missing newer columns ----------
-- (all no-ops on a brand new table; safe to re-run any time — this covers a
-- table that already existed with only some of the columns above, since
-- "create table if not exists" leaves an existing table untouched)
alter table public.blog_posts add column if not exists slug          text unique;
alter table public.blog_posts add column if not exists title         text;
alter table public.blog_posts add column if not exists title_ar      text;
alter table public.blog_posts add column if not exists excerpt       text;
alter table public.blog_posts add column if not exists excerpt_ar    text;
alter table public.blog_posts add column if not exists cover         text;
alter table public.blog_posts add column if not exists author_name   text;
alter table public.blog_posts add column if not exists author_avatar text;
alter table public.blog_posts add column if not exists tags          text[] default '{}';
alter table public.blog_posts add column if not exists tags_ar       text[] default '{}';
alter table public.blog_posts add column if not exists blocks        jsonb default '[]'::jsonb;
alter table public.blog_posts add column if not exists blocks_ar     jsonb default '[]'::jsonb;
alter table public.blog_posts add column if not exists published_at  timestamptz default now();
alter table public.blog_posts add column if not exists sort_order    int default 0;
alter table public.blog_posts add column if not exists published     boolean default true;
alter table public.blog_posts add column if not exists created_at    timestamptz default now();
alter table public.blog_posts add column if not exists updated_at    timestamptz default now();

-- Editable singletons: hero text, stats, CTA, section headings…
create table if not exists public.content_blocks (
  key        text primary key,                    -- 'hero' | 'stats' | 'cta' ...
  value      jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['projects','cities','categories','testimonials','developers','blog_posts','content_blocks']
  loop
    execute format(
      'drop trigger if exists trg_touch_%1$s on public.%1$s;
       create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- public can read published rows; only admins can write.
-- ============================================================
-- reads stay broad (any active admin, not scoped per-page): the dashboard
-- already relies on cross-table reads regardless of write scope (e.g. the
-- Projects form's city picker reads `cities` even for a staffer who can only
-- write `projects`), and there's no security benefit to scoping reads — the
-- risk this feature closes is unscoped *writes*, not reads.
do $$
declare t text;
begin
  foreach t in array array['projects','cities','categories','testimonials','developers','blog_posts']
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "read published" on public.%I;', t);
    execute format(
      'create policy "read published" on public.%I
         for select using (published = true or public.is_admin());', t);
  end loop;
end $$;

-- per-page write policies — one explicit block per table (not a loop) since
-- the dashboard's page key for blog_posts is "posts", not the table name.
drop policy if exists "admin write" on public.projects;
create policy "admin write" on public.projects
  for all using (public.has_page('projects')) with check (public.has_page('projects'));

drop policy if exists "admin write" on public.cities;
create policy "admin write" on public.cities
  for all using (public.has_page('cities')) with check (public.has_page('cities'));

drop policy if exists "admin write" on public.testimonials;
create policy "admin write" on public.testimonials
  for all using (public.has_page('testimonials')) with check (public.has_page('testimonials'));

drop policy if exists "admin write" on public.developers;
create policy "admin write" on public.developers
  for all using (public.has_page('developers')) with check (public.has_page('developers'));

drop policy if exists "admin write" on public.categories;
create policy "admin write" on public.categories
  for all using (public.has_page('categories')) with check (public.has_page('categories'));

drop policy if exists "admin write" on public.blog_posts;
create policy "admin write" on public.blog_posts
  for all using (public.has_page('posts')) with check (public.has_page('posts'));

-- content_blocks: world-readable, admin-writable (page key "content")
alter table public.content_blocks enable row level security;
drop policy if exists "read content" on public.content_blocks;
create policy "read content" on public.content_blocks for select using (true);
drop policy if exists "admin write content" on public.content_blocks;
create policy "admin write content" on public.content_blocks
  for all using (public.has_page('content')) with check (public.has_page('content'));

-- admins: a user may read their own row (so the app can check status);
-- an Owner may read every row (needed for the Users management page).
-- Writes are Owner-only — used for permission edits, deactivate/reactivate
-- and promote/demote, which go straight through the anon-key client;
-- create/reset-password/delete instead go through the service-role
-- serverless endpoint (api/admin-users.js), which bypasses RLS entirely.
alter table public.admins enable row level security;
drop policy if exists "read own admin" on public.admins;
drop policy if exists "read admins" on public.admins;
create policy "read admins" on public.admins
  for select using (user_id = auth.uid() or public.is_owner());
drop policy if exists "owner write admins" on public.admins;
create policy "owner write admins" on public.admins
  for all using (public.is_owner()) with check (public.is_owner());

-- ============================================================
-- STORAGE — public "media" bucket for image uploads
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media admin write" on storage.objects;
create policy "media admin write" on storage.objects
  for insert with check (bucket_id = 'media' and public.has_any_content_access());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update using (bucket_id = 'media' and public.has_any_content_access());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete using (bucket_id = 'media' and public.has_any_content_access());

-- ============================================================
-- INQUIRIES — contact-form submissions
-- Anyone may submit (anon insert); only admins can read/manage.
-- ============================================================
create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  first      text,
  last       text,
  email      text,
  phone      text,
  interest   text,
  budget     text,
  message    text,
  status     text default 'new',                 -- new | read | handled
  created_at timestamptz default now()
);

alter table public.inquiries enable row level security;

drop policy if exists "public submit inquiry" on public.inquiries;
create policy "public submit inquiry" on public.inquiries
  for insert with check (true);

drop policy if exists "admin read inquiries" on public.inquiries;
create policy "admin read inquiries" on public.inquiries
  for select using (public.has_page('inquiries'));

drop policy if exists "admin update inquiries" on public.inquiries;
create policy "admin update inquiries" on public.inquiries
  for update using (public.has_page('inquiries')) with check (public.has_page('inquiries'));

drop policy if exists "admin delete inquiries" on public.inquiries;
create policy "admin delete inquiries" on public.inquiries
  for delete using (public.has_page('inquiries'));

-- ============================================================
-- NEWSLETTER — footer signup-form subscribers
-- Anyone may subscribe (anon insert); only admins can read/manage.
-- ============================================================
create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz default now()
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "public subscribe" on public.newsletter_subscribers;
create policy "public subscribe" on public.newsletter_subscribers
  for insert with check (true);

drop policy if exists "admin read subscribers" on public.newsletter_subscribers;
create policy "admin read subscribers" on public.newsletter_subscribers
  for select using (public.has_page('newsletter'));

drop policy if exists "admin delete subscribers" on public.newsletter_subscribers;
create policy "admin delete subscribers" on public.newsletter_subscribers
  for delete using (public.has_page('newsletter'));

-- ============================================================
-- REALTIME — let the public site receive live updates when an
-- admin edits content (branding, listings, projects, etc.)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['content_blocks','projects','cities','categories','testimonials','developers','blog_posts','inquiries','newsletter_subscribers']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when others then null;   -- already added
    end;
  end loop;
end $$;

-- ============================================================
-- MAKE YOURSELF AN ADMIN
-- After creating a user in Authentication → Users, run:
--
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'you@example.com';
--
-- Then use the "Import starter data" button in the dashboard to
-- seed all tables from the site's bundled demo content.
-- ============================================================
