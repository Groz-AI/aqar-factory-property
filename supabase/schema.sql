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
-- Staff get CREATE (adding new rows) on their granted pages by default; an
-- Owner must separately grant edit rights before a staffer can also UPDATE
-- or DELETE existing rows there. Owners are always unrestricted regardless.
-- (Legacy: `can_edit` was a single all-or-nothing boolean; superseded by the
-- per-page `edit_permissions` below, which lets an Owner grant edit rights
-- to one page, several, or all of a staffer's accessible pages independently.
-- Column kept around unused rather than dropped, and one-time-backfilled
-- into edit_permissions just below so nobody's existing edit access is lost.)
alter table public.admins add column if not exists can_edit    boolean not null default false;
alter table public.admins add column if not exists edit_permissions jsonb not null default '[]'::jsonb;

-- one-time backfill: a staffer who had the old blanket can_edit=true gets
-- edit rights on every page they can already access, preserving their
-- current effective permissions under the new granular model. Guarded so
-- re-running this file won't clobber edit rights an Owner later narrowed.
update public.admins
   set edit_permissions = permissions
 where can_edit = true and (edit_permissions is null or edit_permissions = '[]'::jsonb);

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
-- keys: projects | cities | testimonials | developers | posts | units |
-- inquiries | newsletter | content.
create or replace function public.has_page(page text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and active = true and (role = 'owner' or permissions ? page)
  );
$$;

-- Can the current request's admin UPDATE or DELETE existing rows on this
-- specific page (as opposed to just creating new ones)? Owners always can;
-- Staff need this page's key granted in `edit_permissions` explicitly (see
-- the per-page Edit checkboxes on the Users page in the dashboard).
create or replace function public.can_edit_content(page text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and active = true and (role = 'owner' or edit_permissions ? page)
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
      and (role = 'owner' or permissions ?| array['projects','cities','testimonials','developers','posts','units','content'])
  );
$$;

-- updated_at touch trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- CONTENT TABLES
-- ============================================================

-- Shared admin-managed taxonomy for two otherwise-unrelated dropdowns:
-- `kind = 'project'` feeds the Projects form's Category dropdown, and
-- `kind = 'unit'` feeds the Units form's Unit Type dropdown (replacing what
-- used to be a hardcoded list). Both projects.category and units.type stay
-- plain text columns (matching whichever name was picked); deleting an
-- entry here does not change any project/unit that already used its name.
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ar     text,                                -- Arabic name; falls back to `name` when empty
  kind        text not null default 'project' check (kind in ('project','unit')),
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.categories add column if not exists kind text not null default 'project' check (kind in ('project','unit'));
alter table public.categories add column if not exists name_ar text;

-- seed the unit types that used to be hardcoded in the admin form, so an
-- existing install's units keep matching an entry after this migration
insert into public.categories (name, kind, sort_order)
select v.name, 'unit', v.sort_order from (values
  ('Villa', 0), ('Apartment', 1), ('Duplex', 2), ('Townhouse', 3),
  ('Studio', 4), ('Office', 5), ('Retail', 6)
) as v(name, sort_order)
where not exists (select 1 from public.categories where kind = 'unit');

-- seed the categories that used to be hardcoded in the admin form, so an
-- existing install's projects keep matching an entry after this migration
insert into public.categories (name, kind, sort_order)
select v.name, 'project', v.sort_order from (values
  ('Residential', 0), ('Commercial', 1), ('Mixed-use', 2),
  ('Hospitality', 3), ('Retail', 4), ('Office', 5)
) as v(name, sort_order)
where not exists (select 1 from public.categories where kind = 'project');

-- backfill the Arabic name for the built-in defaults above (matching the
-- translations already in i18n.js) so they display correctly in Arabic
-- immediately, with no admin action needed; never overwrites a value an
-- admin already set (or already ran this backfill against)
update public.categories set name_ar = case name
  when 'Residential'  then 'سكني'
  when 'Commercial'   then 'تجاري'
  when 'Mixed-use'    then 'متعدد الاستخدامات'
  when 'Hospitality'  then 'ضيافة'
  when 'Retail'       then 'تجزئة'
  when 'Office'       then 'مكتبي'
  when 'Villa'        then 'فيلا'
  when 'Apartment'    then 'شقة'
  when 'Duplex'       then 'دوبلكس'
  when 'Townhouse'    then 'تاون هاوس'
  when 'Studio'       then 'استوديو'
  else name_ar
end
where name_ar is null;

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
alter table public.projects   add column if not exists name_ar        text;                       -- Arabic name; falls back to `name` when empty (same pattern as units.name_ar)

-- custom SEO <title>/<meta description> override — falls back to the
-- auto-generated one (name + tagline/about) on the public page when empty.
-- Same four columns added to units and blog_posts below.
alter table public.projects   add column if not exists seo_title          text;
alter table public.projects   add column if not exists seo_title_ar       text;
alter table public.projects   add column if not exists seo_description    text;
alter table public.projects   add column if not exists seo_description_ar text;

-- optional custom Arabic-language URL slug (e.g. مشروع-اسم), used on the
-- /ar/ version of the project page; falls back to the English `slug` when
-- empty. Unique like `slug` (NULLs don't collide under a unique index).
alter table public.projects   add column if not exists slug_ar text unique;

-- link to the shared `developers` list instead of a free-typed name, so
-- "same developer" recommendations (and anything else site-wide) match
-- exactly instead of relying on identical spelling/casing in a text field.
-- `developer` (free text) is kept in sync from this on every save — see
-- admin.js's saveForm() — so existing code reading it directly still works.
alter table public.projects   add column if not exists developer_id uuid references public.developers(id) on delete set null;

-- units never had a developer of their own before (only inherited via a
-- linked project) — same linked-list pattern as projects.developer_id,
-- letting a unit declare its developer directly even with no project link.
alter table public.units add column if not exists developer_id uuid references public.developers(id) on delete set null;
alter table public.units add column if not exists developer text;

-- one-time backfill: auto-link any existing project whose free-typed
-- `developer` text exactly matches a name already in the `developers`
-- table, so existing content doesn't lose its developer on migration.
-- Anything that doesn't match exactly (typo, different casing) is left
-- for the admin to pick manually in the now-dropdown field.
update public.projects p
   set developer_id = d.id
  from public.developers d
 where p.developer_id is null
   and p.developer is not null
   and lower(trim(p.developer)) = lower(trim(d.name));

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

alter table public.units add column if not exists description_blocks    jsonb default '[]'::jsonb; -- rich-content blocks (same editor as projects.about_blocks)
alter table public.units add column if not exists description_blocks_ar jsonb default '[]'::jsonb; -- Arabic version; falls back to description_blocks when empty

alter table public.units add column if not exists seo_title          text;
alter table public.units add column if not exists seo_title_ar       text;
alter table public.units add column if not exists seo_description    text;
alter table public.units add column if not exists seo_description_ar text;

-- optional custom Arabic-language URL slug — same purpose as
-- projects.slug_ar above, see that comment.
alter table public.units add column if not exists slug_ar text unique;

-- one-time backfill: turn each existing plain-text description into a single
-- paragraph block, so units keep their content after switching the admin
-- form over to the block editor (guarded the same way as about_blocks above)
update public.units u
   set description_blocks = (
     select coalesce(jsonb_agg(jsonb_build_object('type', 'paragraph', 'text', trim(p))), '[]'::jsonb)
     from regexp_split_to_table(u.description, '\n+') as p
     where trim(p) <> ''
   )
 where (description_blocks is null or description_blocks = '[]'::jsonb)
   and description is not null and length(trim(description)) > 0;

update public.units u
   set description_blocks_ar = (
     select coalesce(jsonb_agg(jsonb_build_object('type', 'paragraph', 'text', trim(p))), '[]'::jsonb)
     from regexp_split_to_table(u.description_ar, '\n+') as p
     where trim(p) <> ''
   )
 where (description_blocks_ar is null or description_blocks_ar = '[]'::jsonb)
   and description_ar is not null and length(trim(description_ar)) > 0;

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

-- Units — individual for-sale homes/offices. May optionally belong to a
-- Project (inheriting its city) or, if standalone, link to a City directly.
create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  name_ar     text,                                -- Arabic name; falls back to `name` when empty
  type        text not null default 'Apartment',    -- Villa | Apartment | Duplex | Townhouse | Studio | Office | Retail
  badge       text,                                -- For Sale | New Listing | Exclusive
  price       text,                                -- display string, e.g. "EGP 3.2M"
  price_value numeric default 0,
  beds        int default 0,
  baths       int default 0,
  area        text,                                -- display string, e.g. "185 m²"
  area_value  numeric default 0,
  location    text,
  description text,                                 -- legacy plain text; superseded by description_blocks below
  description_ar text,
  description_blocks    jsonb default '[]'::jsonb,   -- rich-content blocks (same editor as projects.about_blocks)
  description_blocks_ar jsonb default '[]'::jsonb,   -- Arabic version; falls back to description_blocks when empty
  cover       text,                                -- Unsplash id or full URL
  gallery     text[] default '{}',
  project_id  uuid references public.projects(id) on delete set null,
  city_id     uuid references public.cities(id) on delete set null,
  lat         double precision,
  lng         double precision,
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_units_project_id on public.units(project_id);
create index if not exists idx_units_city_id    on public.units(city_id);

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
alter table public.blog_posts add column if not exists seo_title          text;
alter table public.blog_posts add column if not exists seo_title_ar       text;
alter table public.blog_posts add column if not exists seo_description    text;
alter table public.blog_posts add column if not exists seo_description_ar text;
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
  foreach t in array array['projects','cities','categories','testimonials','developers','blog_posts','units','content_blocks']
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
  foreach t in array array['projects','cities','categories','testimonials','developers','blog_posts','units']
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "read published" on public.%I;', t);
    execute format(
      'create policy "read published" on public.%I
         for select using (published = true or public.is_admin());', t);
  end loop;
end $$;

-- per-page write policies — a table/page-key pair per content table (the
-- dashboard's page key for blog_posts is "posts", not the table name, hence
-- the parallel arrays instead of deriving one from the other). Split into
-- CREATE (insert — granted to any staffer with the page, by default) vs
-- EDIT (update/delete — additionally requires can_edit_content(), which an
-- Owner grants per staff account on the Users page).
do $$
declare
  tables text[] := array['projects','cities','testimonials','developers','categories','blog_posts','units'];
  pages  text[] := array['projects','cities','testimonials','developers','categories','posts','units'];
  i int;
begin
  for i in 1..array_length(tables, 1) loop
    execute format('drop policy if exists "admin write" on public.%I;', tables[i]);
    execute format('drop policy if exists "admin create" on public.%I;', tables[i]);
    execute format('drop policy if exists "admin edit" on public.%I;', tables[i]);
    execute format('drop policy if exists "admin delete" on public.%I;', tables[i]);
    execute format(
      'create policy "admin create" on public.%I for insert with check (public.has_page(%L));', tables[i], pages[i]);
    execute format(
      'create policy "admin edit" on public.%I for update using (public.has_page(%L) and public.can_edit_content(%L)) with check (public.has_page(%L) and public.can_edit_content(%L));', tables[i], pages[i], pages[i], pages[i], pages[i]);
    execute format(
      'create policy "admin delete" on public.%I for delete using (public.has_page(%L) and public.can_edit_content(%L));', tables[i], pages[i], pages[i]);
  end loop;
end $$;

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
-- ACTIVITY LOG — append-only audit trail of admin actions, shown on
-- the Users → Activity Log page (Owner only). `email` is a snapshot
-- taken at the time of the action, so the log stays readable even if
-- that admin is later renamed/deleted. Nobody can UPDATE or DELETE a
-- row through the client — no policy grants it — so the trail can't
-- be edited or covered up from the admin UI.
-- ============================================================
create table if not exists public.activity_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  email          text,
  action         text not null,   -- 'create' | 'update' | 'delete' | other admin actions (e.g. 'deactivate_user')
  resource       text not null,   -- page key: projects | units | cities | ... | users
  resource_label text,            -- display name/title snapshot at the time of the action
  created_at     timestamptz default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "admin insert own log" on public.activity_log;
create policy "admin insert own log" on public.activity_log
  for insert with check (auth.uid() = user_id and public.is_admin());

drop policy if exists "owner read log" on public.activity_log;
create policy "owner read log" on public.activity_log
  for select using (public.is_owner());

-- ============================================================
-- REALTIME — let the public site receive live updates when an
-- admin edits content (branding, listings, projects, etc.)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['content_blocks','projects','cities','categories','testimonials','developers','blog_posts','units','inquiries','newsletter_subscribers']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when others then null;   -- already added
    end;
  end loop;
end $$;

-- ============================================================
-- SLUG REDIRECTS — records a project/unit/post's PREVIOUS slug every time
-- an admin renames one, so a URL Google already indexed keeps resolving
-- instead of 404ing the moment the slug changes. Written by admin.js's
-- recordSlugRename() on every save where the slug or slug_ar actually
-- changed; read by middleware.js's fetchRenamedRowId() when a clean-path
-- request matches no current row, before it falls back to a real 404.
--
-- Looked up by (table_name, old_slug) and resolved by row_id rather than
-- storing "old slug -> new slug" directly, so a row renamed twice still
-- redirects correctly through BOTH old URLs to whatever slug it answers
-- to right now — no stale intermediate redirect to chase.
-- ============================================================
create table if not exists public.slug_redirects (
  id         uuid primary key default gen_random_uuid(),
  table_name text not null,   -- 'projects' | 'units' | 'blog_posts'
  old_slug   text not null,   -- a slug (en OR ar) this row used to answer to
  row_id     uuid not null,
  created_at timestamptz default now(),
  unique (table_name, old_slug)
);

alter table public.slug_redirects enable row level security;

-- middleware.js reads this with the public anon key (same as every other
-- public-facing table it queries), so it must be openly readable
drop policy if exists "public read slug redirects" on public.slug_redirects;
create policy "public read slug redirects" on public.slug_redirects
  for select using (true);

drop policy if exists "admin write slug redirects" on public.slug_redirects;
create policy "admin write slug redirects" on public.slug_redirects
  for insert with check (public.is_admin());

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
