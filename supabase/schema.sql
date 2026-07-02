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

-- Developments / projects
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  category    text not null default 'Residential',
  city        text not null,
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

-- Featured units / listings ("Discover Handpicked Homes")
create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  description text,
  price       text,
  categories  text[] default '{}',                -- villas, apartments, offices...
  badge       text,                               -- For Sale | For Rent | For Lease
  image       text,
  images      text[] default '{}',                -- gallery (cover is `image`)
  beds        int default 0,
  baths       int default 0,
  area        text,
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Cities
create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text,
  image       text,
  unit_count  text,
  size        text default 'normal',              -- normal | wide | big
  sort_order  int default 0,
  published   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

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
-- MAKE YOURSELF AN ADMIN
-- After creating a user in Authentication → Users, run:
--
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'you@example.com';
--
-- Then use the "Import starter data" button in the dashboard to
-- seed all tables from the site's bundled demo content.
-- ============================================================
