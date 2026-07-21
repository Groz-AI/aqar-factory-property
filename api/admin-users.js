/* ============================================================
   AQAR FACTORY — Admin user management (Vercel serverless function)
   ------------------------------------------------------------
   Handles the three admin-user operations that need Supabase's Admin
   API (create a login, reset someone else's password, delete a
   login) — these touch auth.users and require the service_role key,
   which must never reach the browser. Configure by adding SUPABASE_URL
   and SUPABASE_SERVICE_ROLE_KEY environment variables in the Vercel
   project (Settings -> Environment Variables), then redeploy. Get the
   service_role key from Supabase -> Project Settings -> API ->
   "service_role" secret.

   SUPABASE_SERVICE_ROLE_KEY bypasses every Row Level Security policy
   in the database — treat it like a root DB password. Never log it,
   never echo it in a response, never send it to the browser.

   Everything else (permission edits, deactivate/reactivate, promote/
   demote) is a plain `admins` row update already protected by RLS
   (schema.sql's "owner write admins" policy) and goes straight through
   admin.js's normal anon-key client — this endpoint is only for the
   three operations above.

   No @supabase/supabase-js is installed server-side (no package.json
   in this repo — same constraint as api/ai-chat.js), so this talks to
   Supabase's REST/Admin HTTP API directly via fetch().
   ============================================================ */

const PAGE_KEYS = ['projects', 'cities', 'testimonials', 'developers', 'posts', 'inquiries', 'newsletter', 'content'];

function send(res, status, body) {
  res.status(status).json(body);
}

// Resolves the caller's own identity from their session token, then checks
// that identity is an active Owner in `admins` (via the service-role key,
// which bypasses RLS so this check works regardless of the caller's own
// row-level access).
async function verifyOwner(SUPABASE_URL, SERVICE_KEY, callerToken) {
  if (!callerToken) return { ok: false, status: 401, error: 'no_token' };

  let userRes;
  try {
    userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${callerToken}` }
    });
  } catch (_) {
    return { ok: false, status: 502, error: 'upstream' };
  }
  if (!userRes.ok) return { ok: false, status: 401, error: 'invalid_token' };
  const caller = await userRes.json().catch(() => null);
  if (!caller || !caller.id) return { ok: false, status: 401, error: 'invalid_token' };

  let rowRes;
  try {
    rowRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?user_id=eq.${caller.id}&select=role,active`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
  } catch (_) {
    return { ok: false, status: 502, error: 'upstream' };
  }
  if (!rowRes.ok) return { ok: false, status: 502, error: 'upstream' };
  const rows = await rowRes.json().catch(() => []);
  const me = Array.isArray(rows) ? rows[0] : null;
  if (!me || !me.active || me.role !== 'owner') return { ok: false, status: 403, error: 'not_owner' };
  return { ok: true, callerId: caller.id };
}

async function countActiveOwners(SUPABASE_URL, SERVICE_KEY) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/admins?role=eq.owner&active=eq.true&select=user_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) ? rows.length : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { send(res, 405, { error: 'method_not_allowed' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    send(res, 200, {
      error: 'not_configured',
      message: 'Ask the site owner to finish setup: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the Vercel project settings, then redeploy.'
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const action = String(body.action || '');
  const callerToken = String(body.callerToken || '');

  const auth = await verifyOwner(SUPABASE_URL, SERVICE_KEY, callerToken);
  if (!auth.ok) { send(res, auth.status, { error: auth.error }); return; }

  try {
    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const permissions = Array.isArray(body.permissions) ? body.permissions.filter(p => PAGE_KEYS.includes(p)) : [];

      if (!/^\S+@\S+\.\S+$/.test(email)) { send(res, 400, { error: 'invalid_email' }); return; }
      if (password.length < 6) { send(res, 400, { error: 'invalid_password' }); return; }

      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true })
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) { send(res, 502, { error: 'create_failed', message: created.msg || created.message }); return; }

      const newId = created.id;
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/admins`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: newId, email, role: 'staff', permissions, active: true })
      });
      if (!insertRes.ok) {
        // don't leave an orphaned, permission-less auth user behind
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${newId}`, {
          method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        }).catch(() => {});
        const errBody = await insertRes.json().catch(() => ({}));
        send(res, 502, { error: 'admin_row_failed', message: errBody.message });
        return;
      }

      send(res, 200, { ok: true, user: { id: newId, email, role: 'staff', permissions, active: true } });
      return;
    }

    if (action === 'reset_password') {
      const userId = String(body.userId || '');
      const newPassword = String(body.newPassword || '');
      if (!userId) { send(res, 400, { error: 'missing_user_id' }); return; }
      if (newPassword.length < 6) { send(res, 400, { error: 'invalid_password' }); return; }

      const upRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (!upRes.ok) {
        const errBody = await upRes.json().catch(() => ({}));
        send(res, 502, { error: 'reset_failed', message: errBody.msg || errBody.message });
        return;
      }
      send(res, 200, { ok: true });
      return;
    }

    if (action === 'delete') {
      const userId = String(body.userId || '');
      if (!userId) { send(res, 400, { error: 'missing_user_id' }); return; }
      if (userId === auth.callerId) { send(res, 400, { error: 'cannot_delete_self' }); return; }

      const targetRes = await fetch(`${SUPABASE_URL}/rest/v1/admins?user_id=eq.${userId}&select=role,active`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      });
      const targetRows = await targetRes.json().catch(() => []);
      const target = Array.isArray(targetRows) ? targetRows[0] : null;
      if (target && target.role === 'owner' && target.active) {
        const ownerCount = await countActiveOwners(SUPABASE_URL, SERVICE_KEY);
        if (ownerCount !== null && ownerCount <= 1) { send(res, 400, { error: 'last_owner' }); return; }
      }

      const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      });
      if (!delRes.ok) {
        const errBody = await delRes.json().catch(() => ({}));
        send(res, 502, { error: 'delete_failed', message: errBody.msg || errBody.message });
        return;
      }
      send(res, 200, { ok: true });
      return;
    }

    send(res, 400, { error: 'unknown_action' });
  } catch (e) {
    send(res, 502, { error: 'network', message: (e && e.message) || String(e) });
  }
};
