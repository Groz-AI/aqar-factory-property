-- ============================================================
-- City / developer pages: stable links, stable address, SEO fields
-- ------------------------------------------------------------
-- Run ONCE on the live database, BEFORE the site code that uses these
-- columns is deployed. Safe to re-run (every statement is idempotent).
-- Everything runs in one transaction: if any statement fails nothing is
-- applied. Take a pg_dump first.
--
-- What it does
--  1. cities / developers get: slug (the stable page address), name_ar,
--     seo_title(+_ar), seo_h1(+_ar), seo_description(+_ar). All optional.
--  2. slug is filled for every existing row with EXACTLY the address the
--     site already uses (so the live /city/... and /developer/... links
--     and the sitemap do not change), made unique if two names collide.
--  3. A new row gets its slug from its name; an existing row NEVER changes
--     its slug when the name changes. If the slug is edited by hand, the
--     old one is saved in slug_redirects and the site redirects it (301).
--  4. Renaming a city / developer updates the name text copied into its
--     projects (and the developer text in units), so filters and pages
--     keep finding them.
--  5. Projects / units that are not yet linked by id are linked now
--     (exact name match, ignoring case and spaces).
-- ============================================================

begin;

-- ---------- 1. columns ----------
alter table public.cities     add column if not exists slug               text;
alter table public.cities     add column if not exists name_ar            text;
alter table public.cities     add column if not exists seo_title          text;
alter table public.cities     add column if not exists seo_title_ar       text;
alter table public.cities     add column if not exists seo_h1             text;
alter table public.cities     add column if not exists seo_h1_ar          text;
alter table public.cities     add column if not exists seo_description    text;
alter table public.cities     add column if not exists seo_description_ar text;

alter table public.developers add column if not exists slug               text;
alter table public.developers add column if not exists name_ar            text;
alter table public.developers add column if not exists seo_title          text;
alter table public.developers add column if not exists seo_title_ar       text;
alter table public.developers add column if not exists seo_h1             text;
alter table public.developers add column if not exists seo_h1_ar          text;
alter table public.developers add column if not exists seo_description    text;
alter table public.developers add column if not exists seo_description_ar text;

-- ---------- 2. slug rule (same as schema-helpers.js entitySlug) ----------
create or replace function public.entity_slug(n text) returns text
language sql immutable as $$
  select coalesce(nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(lower(coalesce(n, '')), ',?\s*egypt\y', '', 'g'),
        '[^a-z0-9؀-ۿ]+', '-', 'g')
    ), ''), 'item')
$$;

-- fill the slug of existing rows (published ones first, then oldest first)
with ranked as (
  select id, public.entity_slug(name) as base,
         row_number() over (partition by public.entity_slug(name)
                            order by published desc nulls last, created_at, id) as rn
    from public.cities
   where slug is null or btrim(slug) = ''
)
update public.cities c
   set slug = case when r.rn = 1 then r.base else r.base || '-' || r.rn end
  from ranked r
 where c.id = r.id;

with ranked as (
  select id, public.entity_slug(name) as base,
         row_number() over (partition by public.entity_slug(name)
                            order by published desc nulls last, created_at, id) as rn
    from public.developers
   where slug is null or btrim(slug) = ''
)
update public.developers d
   set slug = case when r.rn = 1 then r.base else r.base || '-' || r.rn end
  from ranked r
 where d.id = r.id;

create unique index if not exists cities_slug_key     on public.cities(slug);
create unique index if not exists developers_slug_key on public.developers(slug);

-- ---------- 3. the slug stays put; hand edits leave a redirect ----------
create or replace function public.entity_slug_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  cand text;
  n    int := 1;
  taken boolean;
begin
  if tg_op = 'INSERT' then
    if new.slug is null or btrim(new.slug) = '' then
      base := public.entity_slug(new.name);
    else
      base := public.entity_slug(new.slug);
    end if;
    cand := base;
    loop
      execute format('select exists(select 1 from public.%I where slug = $1)', tg_table_name)
        into taken using cand;
      exit when not taken;
      n := n + 1;
      cand := base || '-' || n;
    end loop;
    new.slug := cand;
    return new;
  end if;

  -- UPDATE: a blank slug means "keep the current one"; a changed name never touches it
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := old.slug;
    return new;
  end if;
  new.slug := public.entity_slug(new.slug);
  if new.slug is distinct from old.slug and old.slug is not null then
    -- the new address must not already belong to another row
    execute format('select exists(select 1 from public.%I where slug = $1 and id <> $2)', tg_table_name)
      into taken using new.slug, old.id;
    if taken then
      raise exception 'This page address is already used by another row: %', new.slug using errcode = '23505';
    end if;
    insert into public.slug_redirects(table_name, old_slug, row_id)
      values (tg_table_name, old.slug, old.id)
      on conflict (table_name, old_slug) do update set row_id = excluded.row_id;
    -- going back to an address it had before: that old entry is no longer a redirect
    delete from public.slug_redirects where table_name = tg_table_name and old_slug = new.slug;
  end if;
  return new;
end $$;

drop trigger if exists cities_slug_guard on public.cities;
create trigger cities_slug_guard before insert or update on public.cities
  for each row execute function public.entity_slug_guard();

drop trigger if exists developers_slug_guard on public.developers;
create trigger developers_slug_guard before insert or update on public.developers
  for each row execute function public.entity_slug_guard();

-- ---------- 4. renaming keeps the projects' copied name text in step ----------
create or replace function public.sync_city_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.projects set city = new.name where city_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists cities_sync_name on public.cities;
create trigger cities_sync_name after update of name on public.cities
  for each row execute function public.sync_city_name();

create or replace function public.sync_developer_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.projects set developer = new.name where developer_id = new.id;
    update public.units    set developer = new.name where developer_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists developers_sync_name on public.developers;
create trigger developers_sync_name after update of name on public.developers
  for each row execute function public.sync_developer_name();

-- ---------- 5. link what is not linked yet, and re-sync the copied names ----------
update public.projects p
   set city_id = c.id
  from public.cities c
 where p.city_id is null and p.city is not null
   and lower(btrim(p.city)) = lower(btrim(c.name));

update public.projects p
   set developer_id = d.id
  from public.developers d
 where p.developer_id is null and p.developer is not null
   and lower(btrim(p.developer)) = lower(btrim(d.name));

update public.units u
   set developer_id = d.id
  from public.developers d
 where u.developer_id is null and u.developer is not null
   and lower(btrim(u.developer)) = lower(btrim(d.name));

update public.projects p set city = c.name
  from public.cities c where p.city_id = c.id and p.city is distinct from c.name;
update public.projects p set developer = d.name
  from public.developers d where p.developer_id = d.id and p.developer is distinct from d.name;
update public.units u set developer = d.name
  from public.developers d where u.developer_id = d.id and u.developer is distinct from d.name;

commit;

-- ---------- checks to run afterwards (read-only) ----------
-- every city / developer has a slug, and slugs are unique:
--   select count(*) filter (where slug is null) as missing, count(*) as total from public.cities;
--   select count(*) filter (where slug is null) as missing, count(*) as total from public.developers;
-- projects whose city / developer text matches no row (fix them in the admin):
--   select distinct city from public.projects where city_id is null and coalesce(city,'') <> '';
--   select distinct developer from public.projects where developer_id is null and coalesce(developer,'') <> '';
