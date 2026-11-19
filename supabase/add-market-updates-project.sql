-- ============================================================
-- Track Your Project: optional linked project
-- (the page then shows a "View project" button to that project's own page)
-- Run ONCE, after add-market-updates.sql. Safe to re-run. Additive: one nullable column.
-- ============================================================
alter table public.market_updates
  add column if not exists project_id uuid references public.projects(id) on delete set null;

notify pgrst, 'reload schema';

-- check:  select column_name from information_schema.columns
--          where table_name = 'market_updates' and column_name = 'project_id';   -- 1 row
-- undo:   alter table public.market_updates drop column if exists project_id;
