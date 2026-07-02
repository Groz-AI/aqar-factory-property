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
  url: "https://dwufpgsqblwjgmzoseev.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY"
};
