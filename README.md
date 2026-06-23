# GramSeva — Super Admin Portal

`admin.gramseva.in` — full dashboard: approvals, village registry, and analytics.

## Setup

```bash
npm install
npm run dev
```

`.env` already contains your real Supabase URL and anon key. Nothing else to configure.

## Access control

This app does **not** implement its own permission system — it relies entirely on
the `sec_get_role()` function and RLS policies already in your database. On login,
the app calls `sec_get_role()` via RPC and only renders the dashboard if the result
is `'super_admin'`. Anyone else sees an "Access restricted" screen.

This means: if a user's `raw_app_meta_data.role` in `auth.users` isn't `'super_admin'`,
they're blocked — both by this app's `ProtectedRoute` component and, independently,
by every RLS policy underneath it (`villages_select`, `admin_requests_update`, etc.).
Even if someone bypassed the frontend check, the database would still refuse their
queries. That's intentional — the UI gate is a convenience, not the real security
boundary.

## Pages

- **Overview** (`/`) — village ledger strip, key counts, recent admin requests
- **Approvals** (`/approvals`) — calls `svc_approve_admin_request` / `svc_reject_admin_request`
  RPCs directly. These are the same functions documented in `001_unified_database_setup.sql`.
- **Villages** (`/villages`) — lists all villages; the "+ New village" form does a direct
  `insert` on `villages`, which only succeeds if your logged-in account satisfies the
  `villages_insert` RLS policy (`super_admin` only). If village creation fails with an
  RLS error, that's the policy working correctly, not a bug.
- **Analytics** (`/analytics`) — trends over time, top villages by complaint volume,
  status breakdown, category breakdown. Pulled from `complaints` joined to `villages`.

## How sign-in works here

There's no separate "create super admin" flow in this app. To get in:

1. The account must already exist in Supabase Auth (sign up via your citizen-facing
   app, or create directly in the Supabase dashboard under Authentication → Users).
2. That user's `profiles.role` must be `'super_admin'`, and `tr_sync_profile_to_auth`
   must have already synced that into `auth.users.raw_app_meta_data.role`. If you just
   changed someone's role in `profiles`, give it a moment (or re-save the row) so the
   sync trigger fires before they try logging in here.

If login succeeds but you immediately see "Access restricted," check:

```sql
SELECT id, email, raw_app_meta_data->>'role' AS role
FROM auth.users
WHERE email = 'your-email@example.com';
```

## Notes on the grant lockdown from earlier

This app issues normal `select`/`insert` calls through the Supabase JS client using the
anon key, so every request is still subject to the table-level grants and RLS policies
already tightened (`002_lockdown_complaints_grants.sql`). Nothing here needs broader
grants than what's in place — `svc_approve_admin_request` and `svc_reject_admin_request`
are `SECURITY DEFINER`, so they don't need the calling role to have direct table grants
on `villages`, `profiles`, or `admin_requests`.
