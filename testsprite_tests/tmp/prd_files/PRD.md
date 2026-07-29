# Product Requirements Document (PRD) — GramSeva (Village Grievance System)

## 1. Product Overview
GramSeva is a secure, transparent, and scalable community grievance redressal system designed to connect rural citizens with local village authorities (Gram Panchayats). It allows community members to report local issues (such as water leakage, road damage, and sanitation problems), track their resolution progress, and verify the work of local administrators.

---

## 2. Core Personas and Access Control (Roles)
The system enforces strict access control rules at the database level using Postgres Row Level Security (RLS) across four distinct roles:

1. **Anonymous / Guest Users**:
   - Can submit anonymous complaints (limited to 3 reports per hour per phone number to prevent spam).
   - Can track complaints using a unique generated ticket ID.
2. **Citizens**:
   - Have a registered permanent **Home Village** (`profiles.village_id`).
   - Can report issues within their home village or in another village they are visiting (which routes to that target village's admin).
   - Can view and manage their own complaints across all villages.
   - Can rate resolved complaints they submitted.
   - Can upvote community complaints within their home village.
   - Cannot view other citizens' private profiles.
3. **Admins (Sarpanch / Panchayat Heads)**:
   - Manage complaints and assign officers within their registered village boundary.
   - Cannot view or edit complaints or boundaries of another village.
   - Can upload GeoJSON boundaries for their village.
4. **Super Admins**:
   - Have global read and write privileges.
   - Oversee all village registrations, approve/reject admin requests, inspect audit logs, and access all evidence.

---

## 3. Key Features & Workflows

### A. Grievance Registration
- Citizens or guest users submit a title, description, category, and geo-coordinates (latitude/longitude) along with optional photo evidence.
- **Geographic Routing (PostGIS)**: The database automatically resolves the target `complaints.village_id` from the coordinates using PostGIS boundary intersection (`ST_Within`). If coordinates fall outside known boundaries, a manual village selector falls back.
- **Ticket ID Generation**: Every complaint receives a unique, random ticket ID prefix `VGS-XXXXXXXX` via a collision-safe loop with a hard retry cap of 20.
- **Duplicate Prevention**: A unique index on `(citizen_id, md5(title), 5-minute bucket)` prevents concurrent double submissions of the same issue.

### B. Decoupled Home vs. Complaint Village Architecture
- A citizen's permanent residency/home village is stored in `profiles.village_id`.
- The target village where a complaint is filed is stored in `complaints.village_id`.
- If a citizen travels to another village and files a complaint:
  - The complaint routes to the officials of the complaint location.
  - The citizen's profile remains untouched (preserving their home village).
  - The citizen retains ownership and can track/rate their cross-village complaint securely.
  - Admins of the complaint village can view and assign the complaint, while the citizen's home village admins cannot see it.

### C. Photo Evidence Upload & Security
- Photo evidence is stored in a private `complaint-evidence` storage bucket.
- A custom security definer function (`can_read_complaint_evidence`) checks the object path structure:
  - The uploader always has read access.
  - Super admins have read access.
  - Village admins/officers have read access only if the complaint belongs to their village.
  - Standard users from other villages are denied access.

### D. Automated Escalations
- Complaints have a default 7-day SLA deadline.
- A service function `escalate_overdue_complaints()` runs on a schedule to mark overdue open/assigned complaints as "In Progress" and sets `is_escalated = TRUE` (execution restricted to `service_role`).

---

## 4. Technical Stack
- **Frontend**: React (Vite, TailwindCSS, Leaflet for Map integration).
- **Backend/Database**: Supabase PostgreSQL (PostGIS extension, triggers, functions, transactional outbox queue).
