# Realteek — connecting a real database (Supabase)

The site works with **zero setup** in local demo mode (everything saves in the
browser). When you're ready to publish content to the cloud and share it across
devices and visitors, connect **Supabase**.

## Why Supabase (and not Neon)

This is a static site with **no backend server**. It needs three things it can
call safely from the browser: a **database**, **auth**, and **image storage**.

| Need | Supabase | Neon |
|------|----------|------|
| Postgres database | ✅ | ✅ |
| Auth (admin login) | ✅ built-in | ❌ build your own |
| Image / file storage | ✅ Storage buckets | ❌ needs S3 / R2 |
| Safe browser API | ✅ (protected by Row-Level Security) | ❌ can't expose a DB string to the browser |
| Already coded in this app | ✅ 100% | ❌ would need a custom API server |

Neon is excellent **serverless Postgres**, but on its own it can't power a
browser-only app — you'd have to host an API server, an auth system and separate
image storage. Supabase covers all three, and this project is already built for
it, so connecting is just pasting two keys and running one SQL file.

---

## Step-by-step (about 10 minutes)

### 1. Create the project
1. Go to <https://supabase.com> → **New project** (free tier).
2. Pick a name, a strong database password, and the region closest to your users.

### 2. Create the tables, security rules and storage
1. In the dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   This creates every table (projects, listings, cities, categories, testimonials,
   developers, content blocks), the row-level-security policies, and the public
   `media` image bucket.

### 3. Add your keys to the app
1. In Supabase: **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key.
3. Open [`config.js`](config.js) and paste them in:
   ```js
   window.SUPA = {
     url: "https://xxxxxxxx.supabase.co",
     anonKey: "eyJhbGciOi...your-anon-key..."
   };
   ```
   > The anon key is safe to ship in the browser — Row-Level Security (from
   > `schema.sql`) is what actually protects writes. The app switches from local
   > demo mode to the cloud automatically the moment these are real.

### 4. Create your admin user
1. Supabase: **Authentication → Users → Add user** → enter your email + password
   (tick "Auto confirm").
2. Back in **SQL Editor**, run this so the app treats you as an admin:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'you@example.com';
   ```

### 5. Seed the starter content
1. Open the site's admin at `admin/login.html` and sign in with the user above.
2. Go to **Account & settings → Import starter data**. This fills every table
   with the bundled demo content. Now edit anything, upload images, change hero
   images, add categories — it all saves to Supabase and appears on the live site.

You can change your admin **email and password** any time from
**Account & settings** in the dashboard.

---

## Keeping the free tier alive (important)

Supabase pauses a **free** project after ~7 days of no activity. Two safety nets:

1. **Nothing breaks if it ever pauses.** The public site automatically falls
   back to the bundled content, so visitors still see a full site while the DB
   wakes (a few seconds on the next request).
2. **Keep it awake for free.** A ready-made GitHub Action pings the database on a
   schedule so it never idles — see
   [`.github/workflows/supabase-keepalive.yml`](.github/workflows/supabase-keepalive.yml).
   In your GitHub repo, add two **Actions secrets**:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = your anon key

   That's it — it runs every 3 days and resets the inactivity timer.

If you don't use GitHub, any free uptime pinger (e.g. cron-job.org, UptimeRobot)
hitting `https://<your-project>.supabase.co/rest/v1/categories?select=id&limit=1`
with header `apikey: <anon key>` every few days does the same job.

---

## Free-tier limits (plenty for a showcase site)

- **Database:** 500 MB
- **Storage:** 1 GB of images
- **Bandwidth:** 5 GB / month
- **Auth users:** 50,000 monthly active

## Going back to demo mode

Set the two `config.js` values back to their `YOUR_...` placeholders and the app
returns to browser-only local mode.
