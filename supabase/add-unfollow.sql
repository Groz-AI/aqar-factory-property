-- ============================================================
-- Let a visitor stop following a project ("Unfollow" button)
-- ------------------------------------------------------------
-- Visitors have no accounts, so a follow is owned by a random secret that
-- the visitor's browser generates when they follow and keeps in localStorage.
-- The secret is stored with the follow row; unfollow_project() deletes the
-- row only when the secret matches. Nobody who merely knows a phone number
-- can remove someone else's follow, and the table itself stays closed to the
-- public (anon still has insert only).
--
-- Run ONCE, after add-project-follow-and-timeline.sql. Safe to re-run.
-- Additive: one nullable column + one function. Follows made before this
-- (no secret) can only be removed by an admin from the Followers page.
-- ============================================================

begin;

alter table public.project_followers add column if not exists unfollow_token text;

create or replace function public.unfollow_project(p_project_id uuid, p_token text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_token is null or length(p_token) < 16 then return false; end if;
  delete from public.project_followers
   where project_id = p_project_id and unfollow_token = p_token;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.unfollow_project(uuid, text) from public;
grant execute on function public.unfollow_project(uuid, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- ---------- checks to run afterwards (read-only) ----------
--   select column_name from information_schema.columns
--    where table_name = 'project_followers' and column_name = 'unfollow_token';   -- 1 row
--   select proname from pg_proc where proname = 'unfollow_project';                -- 1 row
--
-- to undo:
--   drop function if exists public.unfollow_project(uuid, text);
--   alter table public.project_followers drop column if exists unfollow_token;
