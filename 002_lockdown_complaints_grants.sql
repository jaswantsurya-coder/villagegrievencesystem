-- ============================================================================
-- GramSeva — 002_lockdown_complaints_grants.sql
-- Removes standing UPDATE/DELETE/TRUNCATE grants on complaints that had no
-- grant-layer backstop — RLS was the only thing blocking anon writes.
-- ============================================================================

-- anon has no legitimate write path to complaints at all — close every write privilege
REVOKE UPDATE, DELETE, TRUNCATE ON public.complaints FROM anon;

-- authenticated genuinely needs UPDATE (admin/officer via RLS) and DELETE (citizen-owns-row via RLS)
-- so don't revoke those — but TRUNCATE has no legitimate authenticated use case either
REVOKE TRUNCATE ON public.complaints FROM authenticated;

-- Verification: anon should show only SELECT, REFERENCES
-- authenticated should show SELECT, UPDATE, DELETE, REFERENCES
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'complaints'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
