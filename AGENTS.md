# GramSeva Agent & Engineering Guidelines

## Mandatory Architecture Directive
All development, refactoring, security fixes, and feature work across GramSeva MUST align with and advance the roadmap defined in:
👉 [`PRODUCTION_ROADMAP.md`](file:///d:/Gramseva%20admin%20request%20portal/PRODUCTION_ROADMAP.md) (and [`d:/community-grievance-app/PRODUCTION_ROADMAP.md`](file:///d:/community-grievance-app/PRODUCTION_ROADMAP.md)).

### Core Engineering Principles:
1. **Phased Dependency Order:**
   - **Phase 0 (Security Hardening)** and **Phase 1 (Data Model Consolidation)** are blocking prerequisites before any real citizen data is processed.
   - **Phase 2 (Testing & CI)** and **Phase 3 (Async Reliability)** ensure safe iteration and unattended operation.
   - **Phase 4 (Observability)** is live with Sentry across all 4 runtimes — maintain correlation IDs (`X-Request-Id`) across all new handlers.
   - **Phase 5 (Performance & Scaling)** must be considered for all queries, bundles, and image uploads (rural 3G first).

2. **Security & Authorization Rules:**
   - **Never hardcode secrets** or fall back to default keys (`process.env.X || 'literal'`). Fail closed if an environment variable is missing.
   - All serverless API endpoints must enforce `requireRole(req, roles[])` or verify service secrets.
   - Restrict village admin operations strictly to their own assigned village (`village_id`).
   - Aadhaar last-4 and citizen phone numbers must never be leaked into log streams or unmasked responses.

3. **Database & Migrations:**
   - Follow strict Supabase migration discipline. No manual hotfixing without a reproducible SQL migration file.
   - Maintain RLS policies on all tables. Test that unauthorized roles receive 0 rows / access denied.

4. **Status Tracking:**
   - Keep [`PRODUCTION_ROADMAP.md`](file:///d:/Gramseva%20admin%20request%20portal/PRODUCTION_ROADMAP.md) updated as items transition from `⏳ Pending` to `🔄 In Progress` and `✅ Completed`.
