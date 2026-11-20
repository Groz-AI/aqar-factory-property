-- Hassan Allam was entered twice in Developers:
--   "HASSAN ALLAM"             has the written text (EN + AR) and the SEO fields, but no projects
--   "Hassan Allam Properties"  owns the 8 projects, but has no text, so its page is not offered to Google
-- This keeps the second row (the one the projects point to), copies the text
-- into it, moves anything still pointing at the old row, keeps the old address
-- (/developer/hassan-allam) working as a 301 to the new one, and removes the old row.
--
-- Run:  docker exec -i supabase-db psql -U postgres -d postgres < merge-hassan-allam.sql

begin;

update public.developers n set
  name_ar            = o.name_ar,
  description        = o.description,
  description_ar     = o.description_ar,
  seo_title          = o.seo_title,
  seo_title_ar       = o.seo_title_ar,
  seo_h1             = o.seo_h1,
  seo_h1_ar          = o.seo_h1_ar,
  seo_description    = o.seo_description,
  seo_description_ar = o.seo_description_ar,
  sort_order         = coalesce(n.sort_order, o.sort_order)
from public.developers o
where n.id = '89690152-c588-4f9e-97c0-9d8733499928'   -- Hassan Allam Properties (keeps)
  and o.id = '494f8f93-8916-4724-ac52-3f932e1d327a';  -- HASSAN ALLAM (removed)

update public.projects set developer_id = '89690152-c588-4f9e-97c0-9d8733499928'
  where developer_id = '494f8f93-8916-4724-ac52-3f932e1d327a';
update public.units set developer_id = '89690152-c588-4f9e-97c0-9d8733499928'
  where developer_id = '494f8f93-8916-4724-ac52-3f932e1d327a';

insert into public.slug_redirects (table_name, old_slug, row_id)
  select 'developers', 'hassan-allam', '89690152-c588-4f9e-97c0-9d8733499928'
  where not exists (select 1 from public.slug_redirects where table_name = 'developers' and old_slug = 'hassan-allam');

delete from public.developers where id = '494f8f93-8916-4724-ac52-3f932e1d327a';

commit;

-- check: one row, with its text and its projects
select d.name, d.name_ar, d.slug, length(d.description) as en_chars, length(d.description_ar) as ar_chars,
       (select count(*) from public.projects p where p.developer_id = d.id) as projects
from public.developers d where d.name ilike '%hassan allam%';
