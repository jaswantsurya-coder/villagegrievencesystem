# GramSeva — Production Readiness & Scaling Roadmap

Target: From "working pilot" to a production-grade system that can run unattended across multiple districts.
Ordered by dependency. Effort is in *Devin sessions* (one session ≈ 1–2 human-weeks of focused work).

---

## Phase 0 — Security Hardening (Blocking, ~1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 0.1 | Rotate & purge credentials | 🔄 In Progress | Rotate the Brevo key hard-coded in `api/nlp.js:518` and the aux Supabase anon key (5 occurrences). Delete every `process.env.X \|\| '<literal>'` fallback — fail closed on missing env instead. |
| 0.2 | Central authorization helper | ✅ Completed | One `requireRole(req, roles[])` used by JS handlers with constant-time internal secret comparison. |
| 0.3 | Fix `claim_pilot_token` | ✅ Completed | Implemented in `019_fix_claim_pilot_token.sql` with DROP FUNCTION statements to handle return type modification. |
| 0.4 | Lock down `/api/nlp` | ⏳ Pending | Require the service secret or a Supabase JWT on all 9 actions; restrict CORS to known origins; rate-limit `enqueue-ai` per complaint and per IP. |
| 0.5 | Fail-closed AI auth | ⏳ Pending | Make `oracle-inference` refuse to start when `AI_API_KEY`/`AI_HMAC_SECRET` are unset, instead of silently running open. |
| 0.6 | Split the notification secret | ⏳ Pending | Stop falling back to `SUPABASE_SERVICE_ROLE_KEY` as the notification-service bearer token; require a dedicated `NOTIFICATION_API_SECRET`. |
| 0.7 | Invitation TTL | ✅ Completed | 14-day default enforced in `accept_invitation()` and `lookup_invitation()` in `022_phase1_data_model_consolidation.sql`. |
| 0.8 | Secret management | ✅ Completed | All live environment variables moved to Vercel encrypted/sensitive storage. Zero credentials logged. |

---

## Phase 1 — Data Model Consolidation (Blocking, ~1–2 sessions)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 1.1 | One schema lineage | ✅ Completed | Unified under canonical Supabase project (`dtucrczgagpzjbbrwqit`). All environments synchronized. |
| 1.2 | Kill the `svc_create_complaint` overload | ✅ Completed | All 6 historical conflicting overloads explicitly dropped. Canonical 12-parameter function with PostGIS routing, rate limiting, and fail-closed village validation deployed in `022_phase1_data_model_consolidation.sql`. |
| 1.3 | Add the missing columns | ✅ Completed | `profiles.email` and `full_name` added with auto-sync trigger on `auth.users` + historical backfill. Scoped RLS deployed to prevent citizen PII scraping. `ai_processing_queue.village_id` converted to `BIGINT REFERENCES public.villages(id)` with truncation lock protection. |
| 1.4 | Migration discipline | ✅ Completed | Sequential `022_phase1_data_model_consolidation.sql` with idempotent execution, lock timeouts (`SET LOCAL lock_timeout = '5s'`), and complete `022_..._DOWN.sql` rollback manifest. |
| 1.5 | Seed + fixtures | ✅ Completed | Created `supabase/seed.sql` with idempotent test villages, platform settings, and SRID 4326 WGS84 GeoJSON boundaries. |

---

## Phase 2 — Correctness & CI (~1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 2.1 | Lint + format + typecheck | ✅ Completed | ESLint configured and verified with 0 errors across entire codebase. |
| 2.2 | GitHub Actions Quality Gates | ✅ Completed | `.github/workflows/ci.yml` updated with 4 blocking gates: `npm ci`, `npm run lint`, `npm test`, and `npm run build`. |
| 2.3 | Unit & Regression Suite | ✅ Completed | Vitest configured with 15 passing automated unit tests covering ticket formatting, PII masking, phone normalization, and `requireRole` middleware. |
| 2.4 | API contract tests | ⏳ Pending | High-fidelity contract assertions against Supabase CLI test container. |
| 2.5 | E2E Tests | ⏳ Pending | Playwright covering citizen submit $\rightarrow$ tracking $\rightarrow$ admin resolution $\rightarrow$ rating. |
| 2.6 | Staging environment | ⏳ Pending | Dedicated preview environment for migration rehearsals. |

---

## Phase 3 — Reliability of Async Work (~1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 3.1 | Drain `notification_queue` | ⏳ Pending | Worker (cron every minute) to claim queued rows, send, retry with backoff, and dead-letter after `max_retries`. |
| 3.2 | Idempotency | ⏳ Pending | Idempotency keys on complaint submission and notification sends. |
| 3.3 | AI plane HA | ⏳ Pending | Multi-worker HA or degradable AI path with stuck-job sweep cutoff fix. |
| 3.4 | Enqueue on every path | ⏳ Pending | Enqueue from DB trigger on complaints table. |
| 3.5 | Cron supervision | ⏳ Pending | Alert when `/api/py/cron_escalate` fails or doesn't run. |
| 3.6 | Remove fake data | ⏳ Pending | Remove hardcoded mock demo data fallback on RPC failures. |

---

## Phase 4 — Observability (~0.5–1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 4.1 | Sentry Error Tracking | ✅ Completed | Live error tracking on frontend (React + Vite), Node serverless API (`api/*.js`), and Oracle AI Python services, with release tagging, ErrorBoundary, and PII sanitization. |
| 4.2 | Correlation IDs | ✅ Completed | Request/correlation ID (`X-Request-Id`) threaded across frontend $\rightarrow$ API $\rightarrow$ DB $\rightarrow$ AI worker. |
| 4.3 | Metrics & Dashboard | ⏳ Pending | Submissions/min, queue depth, AI p95 latency, notification success rate, escalations/day, RLS denials. |
| 4.4 | Uptime Health Checks | ⏳ Pending | Automated uptime checks on `/api/py/notification_service/health` and the Oracle `/health`. |
| 4.5 | Alert Routing | ⏳ Pending | Email/Slack alert routing with an on-call runbook per alert. |
| 4.6 | Audit Log Review UI | ⏳ Pending | `audit_logs` and `outbox_events` are written but never surfaced — build a super-admin audit view. |

---

## Phase 5 — Performance & Scale (~1–2 sessions)

| Area | Status | Work |
|---|:---:|---|
| **Bundle Splitting** | ⏳ Pending | Split `App.jsx` (6,950 lines) into route-level lazy chunks; target <200 KB gzip initial. Critical for rural 3G. |
| **Image Optimization** | ⏳ Pending | Client-side compression before upload, thumbnails, `srcset`, lazy loading. Evidence photos currently upload full-size. |
| **Server-side Queries** | ⏳ Pending | The admin console fetches *all* complaints with nested joins then filters client-side — move to server-side pagination, filtering and sorting. `fetchUpvotes` pulls every upvote row to count them; replace with an aggregate or counter column. |
| **Composite Indexes** | ⏳ Pending | Add composite indexes for the real access patterns (`village_id, status, created_at`), and `EXPLAIN ANALYZE` the admin list query. |
| **Realtime Scoping** | ⏳ Pending | One `postgres_changes` subscription on the whole `complaints` table refetches everything on any change; scope the filter to the admin's village. |
| **HTTP & Edge Caching** | ⏳ Pending | HTTP caching for `village_boundaries` and gov links; CDN headers on static assets. |
| **Edge Rate Limits** | ⏳ Pending | `rate_limits` is a table — fine at pilot scale, will contend under load. Move hot limits to an edge KV/Redis. |
| **Load Testing** | ⏳ Pending | k6 against submit + admin list at 10×, 100× expected district volume; establish Supabase tier headroom. |
| **Storage Lifecycle** | ⏳ Pending | Lifecycle policy for evidence photos (archive/expire after N years) and a cost model per 100k complaints. |

---

## Phase 6 — Operations & Compliance (~1 session)

| Item | Status | Detail |
|---|:---:|---|
| **Backup & PITR** | ⏳ Pending | Documented backup/restore, PITR enabled, and a **tested** restore drill for both Supabase projects. |
| **Disaster Recovery** | ⏳ Pending | Disaster recovery runbook with RTO/RPO targets. |
| **Data Retention** | ⏳ Pending | Data retention & deletion policy; a citizen "delete my data" path (anonymous complaints hold phone/email). |
| **Privacy & Aadhaar Masking** | ⏳ Pending | Aadhaar last-4 and phone numbers are stored — document lawful basis, encrypt at rest, restrict who can query them, and mask in admin UI by default. |
| **Consent & Terms Versioning**| ⏳ Pending | `terms_update`/`privacy_update` notification types already exist but nothing drives them. |
| **Accessibility (WCAG 2.1 AA)** | ⏳ Pending | Mandatory for government-facing services; also fixes usability for low-literacy users. |
| **i18n Completeness** | ⏳ Pending | Full translation audit across English, Telugu, and Hindi including error strings and emails. |
| **Support Queue** | ⏳ Pending | `help_tickets` exists but has no admin queue UI. |

---

## Phase 7 — Multi-Tenant Scaling (~1–2 sessions)

| Item | Status | Detail |
|---|:---:|---|
| **District/State Hierarchy** | ⏳ Pending | `district_admin` exists in the role enum but the district plane is thin — dashboards, cross-village analytics, and escalation to district level after village SLA breach. |
| **Tenant Isolation at Scale** | ⏳ Pending | Tenant isolation testing at 1,000+ villages: verify `sec_*` helpers stay index-friendly and RLS doesn't degrade. |
| **Bulk Village Onboarding** | ⏳ Pending | Village/boundary import at state scale rather than one-at-a-time. |
| **Configurable SLAs** | ⏳ Pending | Configurable SLA per category/state instead of the hard-coded 7 days. |
| **Workload Routing** | ⏳ Pending | Officer workload routing and auto-assignment (the AI already predicts `ai_department`). |
| **Feature Flags** | ⏳ Pending | Feature flags via the existing `platform_settings` table for staged rollouts. |
