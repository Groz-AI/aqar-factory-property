-- ============================================================
-- REALTEEK — fix image uploads
-- Run this in the Supabase SQL Editor if image uploads fail with
-- "Bucket not found" or a row-level-security error.
--
-- It (1) creates the public "media" storage bucket + policies, and
-- (2) makes a user an admin so they're allowed to upload.
-- ============================================================

-- ---- 1. storage bucket for image uploads ----
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- read: anyone can view images (the bucket is public)
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

-- write/update/delete: only admins with at least one content-editing page
-- (has_any_content_access() — defined in schema.sql; run that file at least
-- once before this one so the function exists)
drop policy if exists "media admin write" on storage.objects;
create policy "media admin write" on storage.objects
  for insert with check (bucket_id = 'media' and public.has_any_content_access());

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update using (bucket_id = 'media' and public.has_any_content_access());

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete using (bucket_id = 'media' and public.has_any_content_access());

-- ---- 2. make your user an admin ----
-- IMPORTANT: replace the email with the one you log into the admin with.
insert into public.admins (user_id, email)
select id, email from auth.users
where email = 'you@example.com'
on conflict (user_id) do nothing;

-- ---- verify ----
-- Should return your bucket and your admin row:
select id, public from storage.buckets where id = 'media';
select email from public.admins;
