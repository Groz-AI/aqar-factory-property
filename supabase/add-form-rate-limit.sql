-- ============================================================
-- Spam brake for the contact form and the newsletter signup
-- ------------------------------------------------------------
-- The two forms write straight into the database from the visitor's
-- browser, so the limit has to live here. A visitor (identified by the
-- IP the proxy forwards) can add at most 10 contact messages and 10
-- newsletter signups per hour; the 11th is refused with an error and the
-- form shows its normal "something went wrong, try again" message.
--
-- Run once, safe to re-run. Take a pg_dump first. Optional but advised.
--
-- BEFORE relying on it, check that the IP reaches the database (see the
-- check at the bottom): Caddy must pass X-Forwarded-For to PostgREST.
-- If the check shows 'unknown', every visitor would share one counter
-- and real people would be blocked: in that case do NOT keep this on
-- (drop the two triggers at the bottom).
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
  if v_ip = '' then v_ip := 'unknown'; end if;

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

commit;

-- ---------- check (do this after running) ----------
-- 1. send one test message from the contact page, then:
--      select kind, ip, at from public.form_hits order by id desc limit 5;
--    ip must be a real address, not 'unknown'.
-- 2. to switch the limit off:
--      drop trigger if exists inquiries_rate_limit on public.inquiries;
--      drop trigger if exists newsletter_rate_limit on public.newsletter_subscribers;
