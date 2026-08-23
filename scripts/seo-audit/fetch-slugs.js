const SUPA_URL = 'https://dwufpgsqblwjgmzoseev.supabase.co';
const SUPA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dWZwZ3NxYmx3amdtem9zZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODgyNTMsImV4cCI6MjA5ODU2NDI1M30.dvO4voO8tRIo-99kHJ3o_x3YvSiaEnq8I0gOmgf1YOY';

async function q(table, select) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=${select}&published=eq.true`, {
    headers: { apikey: SUPA_ANON_KEY, Authorization: `Bearer ${SUPA_ANON_KEY}` }
  });
  if (!res.ok) throw new Error(table + ' ' + res.status);
  return res.json();
}

(async () => {
  const [projects, units, posts] = await Promise.all([
    q('projects', 'slug,slug_ar,name'),
    q('units', 'slug,slug_ar,name'),
    q('blog_posts', 'slug,title')
  ]);
  const out = { projects, units, posts };
  console.log(JSON.stringify(out));
})();
