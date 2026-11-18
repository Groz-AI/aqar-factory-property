-- ============================================================
-- Market updates: optional city (powers the city filter on /market_update)
-- Run ONCE, after add-market-updates.sql. Safe to re-run. Additive: one nullable column.
-- ============================================================
alter table public.market_updates
  add column if not exists city_id uuid references public.cities(id) on delete set null;

notify pgrst, 'reload schema';

-- check:  select column_name from information_schema.columns
--          where table_name = 'market_updates' and column_name = 'city_id';   -- 1 row
-- undo:   alter table public.market_updates drop column if exists city_id;
