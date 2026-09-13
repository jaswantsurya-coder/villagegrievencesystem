# GramSeva — Production Readiness & Scaling Roadmap

Target: From "working pilot" to a production-grade system that can run unattended across multiple districts.
Ordered by dependency. Effort is in *Devin sessions* (one session ≈ 1–2 human-weeks of focused work).

---

## Phase 0 — Security Hardening (Blocking, ~1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 0.1 | Rotate & purge credentials | 🔄 In Progress | Rotate the Brevo key hard-coded in `api/nlp.js:518` and the aux Supabase anon key (5 occurrences). Delete every `process.env.X \|\| '<literal>'` fallback — fail closed on missing env instead. Consider `git filter-repo` / BFG if the repo ever goes public. |
| 0.2 | Central authorization helper | 🔄 In Progress | One `requireRole(req, roles[])` used by every JS handler. Apply super_admin to `delete-complaint` and `admin-request-action`; scope `admin-reset-password` so a village admin can only reset users in their own village and never a higher role. |
| 0.3 | Fix `claim_pilot_token` | 🔄 In Progress | Derive the user from `auth.uid()`, ignore `p_user_id`. Revoke `resolve_village` from `authenticated` (service_role only). Implemented in `019_fix_claim_pilot_token.sql`. |
| 0.4 | Lock down `/api/nlp` | ⏳ Pending | Require the service secret or a Supabase JWT on all 9 actions; restrict CORS to known origins; rate-limit `enqueue-ai` per complaint and per IP. |
| 0.5 | Fail-closed AI auth | ⏳ Pending | Make `oracle-inference` refuse to start when `AI_API_KEY`/`AI_HMAC_SECRET` are unset, instead of silently running open. |
| 0.6 | Split the notification secret | ⏳ Pending | Stop falling back to `SUPABASE_SERVICE_ROLE_KEY` as the notification-service bearer token; require a dedicated `NOTIFICATION_API_SECRET`. |
| 0.7 | Invitation TTL | ⏳ Pending | 14-day default, enforced inside `accept_invitation` (currently 100 years and never checked). |
| 0.8 | Secret management | 🔄 In Progress | Move all secrets to Vercel encrypted env + a documented quarterly rotation runbook. Never log payloads containing phone/email/OTP. |

---

## Phase 1 — Data Model Consolidation (Blocking, ~1–2 sessions)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 1.1 | One schema lineage | ⏳ Pending | Decide whether the aux project (`dtucrczgagpzjbbrwqit`) stays. Either merge into a single Supabase project or define a hard contract between the two. Today `complaints` has `ticket_id` in one and `ticket_number`/`cleaned_complaint`/`duplicate_group_id` in the other. |
| 1.2 | Kill the `svc_create_complaint` overload | ⏳ Pending | Drop migration `010`'s TEXT-param version; keep one signature with rate limiting, PostGIS routing and dedup. The "pick any village" fallback must go. |
| 1.3 | Add the missing columns | ⏳ Pending | `profiles.email`/`full_name` (or rewrite `svc_escalate_stale_complaints`, `resolve_village`, `017` to join `auth.users`); NLP/AI columns as real migrations; fix `ai_processing_queue.village_id` UUID → BIGINT. |
| 1.4 | Migration discipline | ⏳ Pending | Move to Supabase CLI migrations with checked-in schema diff + a `supabase db reset` that reproduces prod from scratch. No more "paste this in the SQL editor". |
| 1.5 | Seed + fixtures | ⏳ Pending | Reproducible seed data for local dev and CI. |

---

## Phase 2 — Correctness & CI (~1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 2.1 | Lint + format + typecheck | ⏳ Pending | ESLint + Prettier; consider incremental TypeScript or JSDoc-checked JS. |
| 2.2 | GitHub Actions | ⏳ Pending | Run lint, build, unit tests and the Python tests on every PR; block merge on red. |
| 2.3 | RLS regression suite | ⏳ Pending | pgTAP or a Vitest suite that asserts each role can/cannot read the rows it should — this is the highest-value test class for this app. |
| 2.4 | API contract tests | ⏳ Pending | Wire up `testsprite_tests/` and add tests for every endpoint's 401/403 paths. |
| 2.5 | E2E Tests | ⏳ Pending | Playwright covering submit → track → admin resolve → rate, plus the anonymous OTP flow with a stubbed Brevo. |
| 2.6 | Staging environment | ⏳ Pending | A second Supabase project + Vercel preview env that mirrors prod, so migrations are rehearsed before they land. |

---

## Phase 3 — Reliability of Async Work (~1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 3.1 | Drain `notification_queue` | ⏳ Pending | Nothing in the repo actually processes the queue — rows are written while delivery happens inline. Add a worker (cron every minute) that claims queued rows, sends, retries with backoff, and dead-letters after `max_retries`. |
| 3.2 | Idempotency | ⏳ Pending | Idempotency keys on complaint submission and notification sends so retries can't double-file or double-notify. |
| 3.3 | AI plane HA | ⏳ Pending | The Oracle VM is a single point of failure with one worker. Either run 2+ workers behind a health-checked LB, or make classification a degradable path with an explicit "AI unavailable" UI state. Fix the stuck-job sweep cutoff (`now()` → `now() - 5min`) in `queue_worker.py`. |
| 3.4 | Enqueue on every path | ⏳ Pending | `SubmitView` never calls `enqueue-ai`; only anonymous submissions do. Better: enqueue from a DB trigger so no client path can forget. |
| 3.5 | Cron supervision | ⏳ Pending | Alert when `/api/py/cron_escalate` fails or doesn't run; the current failure mode is silent. |
| 3.6 | Remove fake data | ⏳ Pending | `/api/nlp?action=analytics` returns hard-coded demo numbers on RPC failure — return an error instead. |

---

## Phase 4 — Observability (~0.5–1 session)

| # | Item | Status | Detail |
|---|---|:---:|---|
| 4.1 | Sentry Error Tracking | ✅ Completed | Error tracking on frontend (React + Vite), Node serverless API (`api/*.js`), and Oracle AI Python services (`main.py`, `queue_worker.py`), with release tagging, ErrorBoundary, and PII sanitization. |
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

---

## Suggested Sequencing

1. **Phase 0 + 1** — Must land before any real citizen data exists.
2. **Phase 2** — Makes everything after it safe to change.
3. **Phase 3 + 4** — Makes it operable unattended.
4. **Phase 5** — Before onboarding beyond ~10 villages.
5. **Phase 6** — Before any government MoU / formal pilot.
6. **Phase 7** — As districts onboard.

**Total Effort Estimate:** 7–10 focused sessions, excluding external waits (Supabase tier upgrades, security review, government sign-off, accessibility audit).
