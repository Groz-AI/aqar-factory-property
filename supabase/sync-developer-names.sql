-- Projects and units keep a copy of their developer's name as text (projects.developer / units.developer)
-- next to the real link (developer_id). After a rename or a merge the text can be left behind
-- (today: "OIA New Capital" says "HASSAN ALLAM" but is linked to "Hassan Allam Properties").
-- This copies the linked developer's current name into the text, only where it differs.
--
-- Run:  docker exec -i supabase-db psql -U postgres -d postgres < sync-developer-names.sql

begin;

update public.projects p set developer = d.name
  from public.developers d
  where p.developer_id = d.id and p.developer is distinct from d.name;

update public.units u set developer = d.name
  from public.developers d
  where u.developer_id = d.id and u.developer is distinct from d.name;

commit;

-- check: both counts should be 0
select
  (select count(*) from public.projects p join public.developers d on d.id = p.developer_id where p.developer is distinct from d.name) as projects_out_of_sync,
  (select count(*) from public.units u join public.developers d on d.id = u.developer_id where u.developer is distinct from d.name) as units_out_of_sync;
