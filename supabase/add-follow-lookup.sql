-- ============================================================
-- "My projects" by phone number (see your follows on any device)
-- ------------------------------------------------------------
-- A visitor types their phone number and gets back the projects that number
-- follows, so the list is no longer tied to one browser. The table itself
-- stays closed to the public (anon has insert only); this function returns
-- ONLY project ids for an exact number — never names, never other numbers.
--
-- Numbers are matched on their last 10 digits, so 01012345678 and
-- +201012345678 are the same person.
--
-- Note: the phone number is the only proof here, so anyone who knows a
-- number can see which projects it follows. Unfollowing is still protected
-- by the per-browser secret (add-unfollow.sql).
--
-- Run ONCE, after add-project-follow-and-timeline.sql. Safe to re-run.
-- ============================================================

begin;

create or replace function public.my_followed_projects(p_phone text)
returns table (project_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare d text;
begin
  d := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(d) < 8 or length(d) > 15 then return; end if;
  return query
    select f.project_id
      from public.project_followers f
     where right(regexp_replace(f.phone, '\D', '', 'g'), 10) = right(d, 10)
     order by f.created_at;
end $$;

revoke all on function public.my_followed_projects(text) from public;
grant execute on function public.my_followed_projects(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- ---------- check to run afterwards (read-only) ----------
--   select proname from pg_proc where proname = 'my_followed_projects';   -- 1 row
--
-- to undo:
--   drop function if exists public.my_followed_projects(text);
