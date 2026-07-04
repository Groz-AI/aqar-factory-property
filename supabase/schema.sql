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

-- Is the current request made by an admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- updated_at touch trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- CONTENT TABLES
-- ============================================================

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
  price       text,                               -- display string, e.g. "$3.2M"
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
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Featured units / listings ("Discover Handpicked Homes") — each optionally
-- belongs to a project (which supplies its city) or, if standalone, a city directly
create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  description text,
  price       text,
  categories  text[] default '{}',                -- villas, apartments, offices...
  badge       text,                               -- For Sale | New Listing | Exclusive
  image       text,
  images      text[] default '{}',                -- gallery (cover is `image`)
  beds        int default 0,
  baths       int default 0,
  area        text,
  project_id  uuid references public.projects(id) on delete set null,
  city_id     uuid references public.cities(id) on delete set null,
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- migrate an existing install to the relational schema above ----------
-- (all no-ops on a brand new database; safe to re-run any time)
alter table public.projects   add column if not exists city_id    uuid references public.cities(id) on delete set null;
alter table public.properties add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.properties add column if not exists city_id    uuid references public.cities(id) on delete set null;
alter table public.cities     drop column if exists unit_count;   -- replaced by a live computed count on the site

-- carry over the old text-based project link, if this install still has it
do $$
begin
  update public.properties p
     set project_id = pr.id
    from public.projects pr
   where p.project_slug = pr.slug
     and p.project_id is null;
exception when undefined_column then null; -- project_slug never existed on this install
end $$;
alter table public.properties drop column if exists project_slug;

-- best-effort backfill: link existing rows to a city by matching their free text
update public.projects pr
   set city_id = c.id
  from public.cities c
 where pr.city_id is null
   and lower(trim(pr.city)) = lower(trim(c.name));

update public.properties p
   set city_id = c.id
  from public.cities c
 where p.city_id is null
   and p.project_id is null
   and p.location ilike '%' || c.name || '%';

create index if not exists idx_projects_city_id    on public.projects(city_id);
create index if not exists idx_properties_project_id on public.properties(project_id);
create index if not exists idx_properties_city_id    on public.properties(city_id);

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

-- Home filter categories ("Discover Handpicked Homes")
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,                      -- chip label, e.g. "Luxury Villas"
  filter      text not null,                      -- key matched against listing categories, e.g. "luxury"
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

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
  foreach t in array array['projects','properties','cities','testimonials','developers','categories','content_blocks']
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
do $$
declare t text;
begin
  foreach t in array array['projects','properties','cities','testimonials','developers','categories']
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "read published" on public.%I;', t);
    execute format(
      'create policy "read published" on public.%I
         for select using (published = true or public.is_admin());', t);

    execute format('drop policy if exists "admin write" on public.%I;', t);
    execute format(
      'create policy "admin write" on public.%I
         for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- content_blocks: world-readable, admin-writable
alter table public.content_blocks enable row level security;
drop policy if exists "read content" on public.content_blocks;
create policy "read content" on public.content_blocks for select using (true);
drop policy if exists "admin write content" on public.content_blocks;
create policy "admin write content" on public.content_blocks
  for all using (public.is_admin()) with check (public.is_admin());

-- admins: a user may read their own admin row (so the app can check status)
alter table public.admins enable row level security;
drop policy if exists "read own admin" on public.admins;
create policy "read own admin" on public.admins for select using (user_id = auth.uid());

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
  for insert with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update using (bucket_id = 'media' and public.is_admin());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete using (bucket_id = 'media' and public.is_admin());

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
  for select using (public.is_admin());

drop policy if exists "admin update inquiries" on public.inquiries;
create policy "admin update inquiries" on public.inquiries
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete inquiries" on public.inquiries;
create policy "admin delete inquiries" on public.inquiries
  for delete using (public.is_admin());

-- ============================================================
-- REALTIME — let the public site receive live updates when an
-- admin edits content (branding, listings, projects, etc.)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['content_blocks','projects','properties','cities','testimonials','developers','categories']
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
