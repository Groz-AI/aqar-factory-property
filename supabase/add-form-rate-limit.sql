-- ============================================================
-- Spam brake for the contact form and the newsletter signup
-- ------------------------------------------------------------
-- The forms write straight into the database from the visitor's browser,
-- so the limit has to live here. A visitor (identified by the IP the proxy
-- forwards) can add at most 10 contact messages, 10 newsletter signups and
-- 30 project follows per hour; the next one is refused with an error and the
-- form shows its normal "something went wrong, try again" message.
--
-- Run once, safe to re-run. Take a pg_dump first. Optional but advised.
--
-- If the proxy does NOT forward the visitor's IP, the trigger does nothing
-- (no limit, nothing logged) instead of making every visitor share one
-- counter - so it can never block real people. See the check at the bottom
-- to confirm the IP does arrive (form_hits gets rows with a real address).
-- ============================================================

begin;

create table if not exists public.form_hits (
  id   bigserial primary key,
  kind text not null,
  ip   text not null,
  at   timestamptz not null default now()
);
create index if not exists form_hits_lookup on public.form_hits(kind, ip, at);

-- nobody reads or writes it directly; only the trigger below (security definer)
alter table public.form_hits enable row level security;

create or replace function public.form_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  max_per_hour int := coalesce(nullif(tg_argv[0], '')::int, 10);
  hdrs json;
  v_ip text;
  n int;
begin
  begin
    hdrs := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    hdrs := null;
  end;
  v_ip := btrim(split_part(coalesce(hdrs->>'x-forwarded-for', ''), ',', 1));
  -- no visitor IP available: fail open rather than lump everyone together
  if v_ip = '' then return new; end if;

  -- the staff (signed in admins) are never limited
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'authenticated' then
    return new;
  end if;

  select count(*) into n from public.form_hits
   where kind = tg_table_name and ip = v_ip and at > now() - interval '1 hour';
  if n >= max_per_hour then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;

  insert into public.form_hits(kind, ip) values (tg_table_name, v_ip);
  -- tidy up now and then
  if random() < 0.02 then
    delete from public.form_hits where at < now() - interval '2 days';
  end if;
  return new;
end $$;

drop trigger if exists inquiries_rate_limit on public.inquiries;
create trigger inquiries_rate_limit before insert on public.inquiries
  for each row execute function public.form_rate_limit('10');

drop trigger if exists newsletter_rate_limit on public.newsletter_subscribers;
create trigger newsletter_rate_limit before insert on public.newsletter_subscribers
  for each row execute function public.form_rate_limit('10');

-- one row is written per followed project, hence the higher limit
-- (needs supabase/add-project-follow-and-timeline.sql to have created the table)
do $$
begin
  if to_regclass('public.project_followers') is not null then
    drop trigger if exists followers_rate_limit on public.project_followers;
    create trigger followers_rate_limit before insert on public.project_followers
      for each row execute function public.form_rate_limit('30');
  end if;
end $$;

commit;

-- ---------- check (do this after running) ----------
-- 1. follow a project from the website (or send a contact message), then:
--      select kind, ip, at from public.form_hits order by id desc limit 5;
--    a row with a real address means the limit is active. NO row means the
--    proxy is not forwarding the IP, so nothing is being limited (harmless).
-- 2. to switch the limit off:
--      drop trigger if exists inquiries_rate_limit on public.inquiries;
--      drop trigger if exists newsletter_rate_limit on public.newsletter_subscribers;
--      drop trigger if exists followers_rate_limit on public.project_followers;
