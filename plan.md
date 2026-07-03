# NextDent Web App — Development Plan

**Goal:** Replace the offline Microsoft Access desktop app ("SoftDent / NextDent") with a secure, multi-user **web application** so the dental practice can manage patients, treatments, billing, prescriptions, and appointments **remotely**.

**Status:** Legacy backend fully reverse-engineered (38 tables, ~49.7k rows decrypted & exported). See [`extraction/data-model.md`](extraction/data-model.md) and [`extraction/schema.md`](extraction/schema.md). The compiled front-end (`.accde`) has no recoverable source, so **UI/business logic is rebuilt from the data model + client walkthrough**, not ported.

---

## 1. Objectives & success criteria

**Primary objectives**
1. Secure remote access for clinic staff (doctors, receptionists) from any browser.
2. Preserve the core daily workflow: **register patient → plan treatment → book appointment → record work & payment → issue prescription → print/SMS**.
3. Migrate all 3,230 patients + 46k drug catalog + prescriptions/templates without loss.
4. Handle patient PHI responsibly (auth, roles, audit, backups).

**MVP is "done" when** a doctor can, in the browser: find/create a patient, create a treatment case with billed line items and payments, book an appointment, write & print/PDF a prescription (Bangla-capable), and send a payment/appointment SMS — with role-based login and an audit trail.

**Non-goals for v1:** inventory/purchase orders, HR/payroll, expense accounting & profit charts (schema exists but unused). Deferred to Phase 4+.

---

## 2. Scope — feature modules (ported from the Access app)

| # | Module | Priority | Legacy source | Notes |
|---|---|:--:|---|---|
| 1 | **Auth & RBAC** | MVP | `tbl_PersonSecurity`, `tbl_Doctors` | New argon2/bcrypt hashing; roles: Owner/Doctor/Receptionist/Assistant. Replace `frm_Backdoor`. |
| 2 | **Patients** | MVP | `tbl_Patients` | Register, search, profile, medical/drug history, photo, lifetime discount. |
| 3 | **Treatment & Billing** | MVP | `tbl_PatientTreatmentCases/Details` | Case → line items, discount, partial payments, patient balance. Add real `payments` table. |
| 4 | **Appointments / Calendar** | MVP | `tbl_Appointments` | Day/week calendar per chair (Unit), statuses, overdue view; Google Calendar sync (Phase 3). |
| 5 | **Prescriptions** | MVP | `tbl_Prescriptions*`, `tbl_Drugs` | Clinical Rx editor, drug typeahead over 46k catalog, templates & snippet library, Bangla dosing, PDF print (2 layouts). |
| 6 | **Patient history & clinical timeline** | MVP | `tbl_PatientTreatment*`, `tbl_Prescriptions`, clinical notes, photos | Longitudinal per-patient record: unified timeline, dental chart (odontogram), versioned medical/drug history, clinical notes, recalls. **See §6.** |
| 7 | **Instant search (type-ahead everywhere)** | MVP | all entities | Search-as-you-type for patients, 46k drugs, treatments, snippets/templates, lookups + global ⌘K palette. **See §7.** |
| 8 | **Notifications (SMS)** | Phase 2 | `tbl_Sms`, `tbl_API` | BulkSMS BD gateway; templated welcome/payment/appointment SMS. |
| 9 | **Reports & printing** | Phase 2 | `rpt_Invoice`, `rpt_*_Rx` | Invoice + prescription PDFs matching clinic letterhead (`tbl_PrintDoc`). |
| 10 | **Dashboard & settings** | Phase 2 | `tbl_UserSetting`, `tbl_CommonInfo` | Treatment price list & lookups admin; clinic/brand settings; audit log viewer. |
| 11 | **Lab work** | Phase 3 | `tbl_Lab*` | Crown/denture order tracking with external labs. |
| 12 | **Doctor payouts** | Phase 3 | `tbl_Doctors`, `tbl_DoctorsPay` | Revenue-share splits (confirm formula — see data-model §4.3). |
| 13 | **Inventory** | Phase 4 | `tbl_Products`, `tbl_PurchaseOrder*`, `tbl_Vendors` | Currently unused. |
| 14 | **Finance / expenses** | Phase 4 | `tbl_Expense*`, `tbl_RandomIncome` | Income/expense/profit charts. |

---

## 3. Recommended technology stack

Chosen for a **small team, CRUD-heavy clinical app, strong typing, good PDF/print, easy hosting**. (Adjust to team skills — alternatives noted.)

| Layer | Recommendation | Why / alternatives |
|---|---|---|
| **Frontend** | **React + TypeScript** (Next.js App Router) | Component ecosystem, SSR for fast loads, good print/PDF story. *Alt: Vue/Nuxt.* |
| **UI kit** | Tailwind CSS + shadcn/ui (or MUI) | Fast, accessible, consistent. |
| **Backend/API** | **Next.js server actions + tRPC**, or **NestJS** REST | Type-safe end-to-end. *Alt: Laravel/PHP or Django if team prefers.* |
| **Database** | **PostgreSQL 16** | Relational fit, JSONB for flexible bits, full-text search for drug typeahead. |
| **ORM/migrations** | Prisma (TS) | Schema-as-code, typed queries, migration history. |
| **Auth** | Auth.js / Lucia with session cookies; argon2id password hashing | RBAC middleware; MFA-ready. |
| **File/image storage** | S3-compatible (AWS S3 / Cloudflare R2 / MinIO) | Patient & case photos, generated PDFs. |
| **PDF generation** | Server-side (Playwright/Chromium HTML→PDF, or React-PDF) | Needed for Rx/Invoice; **must embed a Bangla (Bengali) font** e.g. Noto Sans Bengali. |
| **SMS** | BulkSMS BD HTTP API (existing account) | Abstract behind a provider interface. |
| **Calendar** | Google Calendar API (OAuth2) | Optional two-way appointment sync. |
| **Background jobs** | BullMQ (Redis) or cron | SMS sending, reminders, calendar sync. |
| **Hosting** | VPS/Docker (Hetzner/DO) or a PaaS; DB managed or self-hosted | Data residency for PHI — pick region deliberately. |
| **Observability** | Sentry + structured logs + Postgres backups | — |

---

## 4. Architecture (high level)

```
Browser (React/TS SPA + PWA)
        │  HTTPS
        ▼
API layer (tRPC/NestJS)  ──►  Auth & RBAC middleware  ──►  Audit log
        │
        ├─► PostgreSQL (patients, treatments, billing, Rx, catalog)
        ├─► Object storage (photos, generated PDFs)
        ├─► Job queue (Redis) ──► SMS worker (BulkSMS) / Calendar sync / reminders
        └─► PDF service (HTML→PDF, Bangla fonts)
```

**Cross-cutting:** RBAC on every endpoint · audit log for create/update/delete on clinical & financial records (the legacy `PersonActivityLogs` intent) · soft-deletes (`deleted_at`) · optimistic concurrency · daily encrypted DB backups.

---

## 5. Data model & migration

The target relational schema is specified in **[`extraction/data-model.md`](extraction/data-model.md)** — including the Access→Postgres table mapping (§3 there), the normalization of the wide `tbl_CommonInfo` lookup table into proper lookups (§5 there), and inferred business rules (§4 there).

**Migration approach**
1. **Freeze** a copy of the Access data (already exported to `extraction/data/*.csv`).
2. Build Postgres schema via Prisma migrations.
3. Write an **ETL script** (Node/Python) that reads the CSVs and:
   - normalizes phones to E.164, merges duplicate legacy columns, combines appointment date+time into timestamps;
   - splits `tbl_CommonInfo` column-by-column into lookup tables;
   - loads `tbl_Drugs` (46k) as read-only reference with a search index;
   - preserves original ids as `legacy_id`, and `deleted_at` for soft-deleted rows;
   - **does not** migrate password hashes (custom VBA hash) → seed users with forced password reset.
4. **Reconcile**: row-count + spot-check reports old vs new; sign-off with client.
5. Re-run ETL idempotently until cutover.

**Known data-quality items** (loose FKs, mixed phone formats, Access time epoch, Bengali Unicode) are catalogued in data-model §6 and handled in ETL.

---

## 6. Patient history & clinical timeline (longitudinal record)

> **Principle:** the patient record is the product. Everything about a patient is kept **forever, in order, and never hard-deleted** — so any clinician can open a patient and instantly see the full story of their care. This is the single most valuable screen in the app.

### 6.1 Unified patient timeline ("patient chart")
One reverse-chronological feed on the patient page that merges **every event** for that patient into a single scrollable history, filterable by type and date:
- Appointments (booked / attended / no-show / cancelled)
- Treatment cases & each billed procedure (with tooth, cost, discount, paid, operating doctor)
- Payments / receipts
- Prescriptions issued (with quick re-print / duplicate)
- Clinical notes (per visit)
- Photos & imaging (RVG / intra-oral) attachments
- Medical/drug-history changes (see §6.3)
- SMS/communication sent
- Lab work orders

Implemented as an **append-only `patient_events` table** (or an events view aggregating the source tables), so the timeline is cheap to render and ordered reliably.

### 6.2 Dental chart / odontogram (tooth-level history)
- Interactive **tooth chart using FDI two-digit numbering** (the legacy data already uses it — e.g. *"Ext 14"*, *"on 48"*, *"on 28"*).
- Each tooth shows current status (healthy / restored / RCT / extracted / crown / implant …) and, on click, its **full per-tooth treatment history**.
- Every treatment line optionally links to one or more teeth → the chart is derived from treatment history, and history is derived from the chart. One source of truth.

### 6.3 Versioned clinical history (as-of correctness)
- **Medical history, drug history, allergies change over time.** Store them **append-only/versioned** (`patient_history_versions`) instead of overwriting, so you can see *what was known at the time* of any past treatment or prescription.
- Each **prescription and treatment snapshots** the relevant history version it was written against (medico-legally important).
- Free-text **clinical notes are immutable once saved** (edits create a new note/version with author + timestamp), matching the legacy `ClinicalNote` intent.

### 6.4 Recalls & follow-ups
- `FollowUpDate` / follow-up reason from prescriptions and treatments feed a **recall worklist** ("who is due back") — drives reminder SMS in Phase 2.

### 6.5 Two distinct "history" concepts (keep both)
| | **Clinical history** (this section) | **Audit log** (§8) |
|---|---|---|
| Purpose | Care narrative — what happened to the patient | Compliance — who changed what record when |
| Audience | Doctors/clinicians | Admin/security |
| Shape | Timeline, dental chart, versioned records | Immutable technical change log |

### 6.6 Data-model additions (see data-model.md §9)
`clinical_notes`, `patient_history_versions` (medical/drug/allergy), `tooth_chart_entries`, `treatment_line_teeth` (link), `attachments` (photos/imaging), `recalls`, and either a `patient_events` timeline table or an aggregating view. Migration seeds the timeline from existing treatment/appointment/Rx rows.

---

## 7. Instant search — type-ahead on every search (search-as-you-type)

> **Principle:** no "type → press Search → wait" anywhere. **Every** lookup filters live as the user types, with keyboard navigation. This is a first-class requirement, designed once and reused across all screens.

### 7.1 Where it applies
| Search | Fields matched | Data size | Notes |
|---|---|---|---|
| **Patient search** | full name, nickname, primary/foreign phone, patient ID | 3,230 | The main entry point; phone match ignores dashes/spaces. |
| **Drug picker** (Rx) | brand + generic + strength + form | **46,043** | Needs an index (below); rank brand-name matches first. |
| **Treatment picker** | treatment name (+ auto-fills price) | ~90 | From the normalized `treatments` catalog. |
| **Rx snippet / template picker** | complaint, diagnosis, advice, template name | 183 / 5 | Powers the fast Rx editor. |
| **Lookup dropdowns** | occupation, relation, address, unit, salary type… | small | All become type-ahead combos. |
| **Staff/doctor picker** | person name | few | — |
| **Global command palette** (⌘K / Ctrl-K) | patients + navigation + actions | — | Jump to any patient or screen from anywhere. |

### 7.2 UX rules (applied uniformly)
- **Debounce** input ~150–250 ms and **cancel stale requests** (abort in-flight query when a new keystroke arrives) so results never flicker or arrive out of order.
- **Min-chars:** 1 for small lookups, 2 for large sets (drugs/patients).
- **Keyboard-first:** ↑/↓ to move, Enter to pick, Esc to close; full mouse support too.
- **Match highlighting** in results; **tolerant matching** — case/accent-insensitive, partial/substring, and typo-tolerant (fuzzy) for names & drugs.
- **Empty state = recents:** show recently/frequently used items before the user types.
- **Capped results** (~20–50) with a "keep typing to refine" hint; never dump thousands.

### 7.3 Backend & indexing
- PostgreSQL **`pg_trgm` + GIN indexes** on searchable text (patient name, drug brand/generic) for fast fuzzy `ILIKE`/similarity queries.
- A **normalized digits-only phone column** for phone search regardless of formatting.
- Dedicated lightweight **`/search/*` endpoints** returning only the minimal fields needed to render a row (id + label + subtitle), server-side paginated, rate-limited.
- 46k drugs are comfortably handled by trigram/FTS in Postgres; if catalogs grow much larger, drop in a dedicated search engine (**Meilisearch / Typesense**) behind the same endpoint contract — no UI change.
- **Performance target:** p95 < 150 ms per keystroke response; results limited and cached client-side for repeat queries.

### 7.4 Cross-cutting UX & data-keeping conventions ("…etc.")
These small rules make the app feel like the fast desktop tool it replaces:
- **Autosave / draft-safe forms** — a half-written prescription or note is never lost on navigation or disconnect.
- **Recently viewed patients** list + quick "new patient / new appointment" actions.
- **Never hard-delete** — soft-delete with restore; full edit history on clinical & financial records.
- **Consistent formatting** — BDT currency, local date/time, E.164 phones, English + Bengali throughout.
- **Keyboard shortcuts** for common actions (new patient, new Rx, save, search).
- **Optimistic UI** with clear save/confirm states so remote (higher-latency) use still feels instant.
- **Dark mode** — full light/dark theming with a user toggle (persisted per user) plus a "system" option that follows the OS. Design all screens, cards, charts, and the print/PDF views to be theme-aware (PDF/print stays light for paper). Implement early via CSS variables / Tailwind `dark:` so every new module is built dark-ready from the start rather than retrofitted. Ensure WCAG AA contrast in both themes.

---

## 8. Security, privacy & compliance
- **PHI-grade handling:** TLS everywhere; encryption at rest for DB & object storage; least-privilege DB roles.
- **AuthN/AuthZ:** argon2id passwords, session cookies, RBAC; optional MFA for owner/admin. Remove the `"abcd"` backdoor.
- **Audit trail:** who-did-what-when on patient, billing, and Rx records.
- **Secrets:** move API keys (SMS, Google) to a secrets manager/env vault. **⚠ Rotate the BulkSMS API key that was exposed in `tbl_API`.**
- **Backups & DR:** automated daily encrypted backups + tested restore; retention policy.
- **Access controls:** receptionist ≠ doctor scope; patient data export limited & logged.
- Confirm any **Bangladesh data-residency / medical-records** requirements with the client.

---

## 9. Integrations
| Integration | Purpose | Source config | Phase |
|---|---|---|---|
| **BulkSMS BD** | Appointment/payment/welcome SMS | `tbl_API` (rotate key), `tbl_Sms` templates | 2 |
| **Google Calendar** | Two-way appointment sync | `tbl_API` OAuth | 3 |
| **Imaging devices** (Camera / RVG / Intra-oral) | Attach clinical images to cases | `tbl_API` device locations | 3 (upload-based) |
| **PDF/print** | Invoice & prescription documents | `tbl_PrintDoc`, report layouts | 2 |

---

## 10. Delivery roadmap (phased)

> Indicative for a small team (≈1–2 devs). Adjust after estimation.

| Phase | Focus | Rough effort |
|---|---|---|
| **0 — Foundations** | Repo, CI/CD, Postgres schema, auth/RBAC skeleton, ETL harness, staging deploy, **reusable type-ahead search component + trigram indexes** (§7), **theming tokens + light/dark mode foundation** (§7.4) | 2–3 wks |
| **1 — Core clinical MVP** | Patients + Treatment/Billing + Appointments + Prescriptions (with drug catalog, templates, Bangla PDF) + **patient timeline, dental chart & versioned history (§6)** + **instant search wired into every screen (§7)** + data migration | 8–10 wks |
| **2 — Comms & documents** | SMS templates & sending, Invoice/Rx PDF polish, settings & lookups admin, dashboard, audit-log viewer, **recalls/follow-up worklist, global ⌘K palette** | 3–4 wks |
| **3 — Sync & extras** | Google Calendar sync, lab work, image attachments, doctor payout reports | 3–4 wks |
| **4 — Back office** | Inventory, expenses/finance charts, HR/payroll | as needed |
| **UAT & cutover** | Parallel run vs Access, final data migration, training, go-live | 1–2 wks |

---

## 11. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Business logic lived in unrecoverable VBA | Reconstruct via data + **client walkthrough**; capture the open questions in data-model §7 early. |
| Appointment status codes / revenue-split formula unknown | Confirm with client before building those screens. |
| Print layouts must match current documents | Collect **sample PDFs** of existing Invoice/Rx and replicate. |
| PHI exposure | Security controls in §6; rotate leaked SMS key now. |
| Scope creep into unused modules | Enforce phasing — MVP is the 4 core modules only. |
| Bengali rendering in PDFs | Standardize on UTF-8 + Noto Sans Bengali; test early. |

---

## 12. Immediate next steps
1. **Client walkthrough / screen recording** of the current app to confirm workflows (fills data-model §7 open questions).
2. Collect **sample Invoice & Prescription PDFs** for layout parity.
3. **Confirm the tech stack** (this plan's recommendation vs team preference).
4. Stand up **Phase 0**: repo + Postgres schema (from data-model) + auth + ETL skeleton loading the exported CSVs into staging.
5. **Rotate the exposed BulkSMS API key.**

---

### Reference artifacts in this project
- [`extraction/schema.md`](extraction/schema.md) — every table, column, type, relationship.
- [`extraction/data-model.md`](extraction/data-model.md) — Access→web mapping, business rules, migration notes, open questions.
- `extraction/data/*.csv` — full data export for all 38 tables (**real PHI — keep private, do not commit to a public repo**).
