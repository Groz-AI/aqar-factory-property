/* ============================================================
   REALTEEK — Supabase configuration
   ------------------------------------------------------------
   1. Create a project at https://supabase.com
   2. Project Settings → API → copy the Project URL and the
      "anon / public" key into the two values below.
   3. Run supabase/schema.sql in the Supabase SQL editor.
   4. Create an admin user (Authentication → Users → Add user),
      then add their id to the `admins` table (see schema.sql).

   The anon key is safe to expose in the browser — Row Level
   Security policies (in schema.sql) are what protect your data.
   Until these are filled in, the site runs on bundled demo data.
   ============================================================ */
window.SUPA = {
  url: "https://api.aqar-factory.com",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkzNDE0OTE4LCJleHAiOjE5NTEwOTQ5MTh9.mD68-Zl0D11mxbFhuckIpEouBs3DPjjesSQjJ1ouj84"
};
