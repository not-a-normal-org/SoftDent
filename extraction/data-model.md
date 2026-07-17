# SoftDent / NextDent — Data Model & Rebuild Notes

> Reverse-engineered from `NextDent_Dhaka_backend.accdb` (MS Access V2010, encrypted).
> Companion files: [`schema.md`](schema.md) (raw column dump) + `data/*.csv` (full data export, **real PHI**).
> This document translates the legacy Access model into a target model for the web app and captures the business rules implied by the data.

---

## 1. What this application is

A **dental clinic practice-management system** for a small multi-doctor practice in Dhaka, Bangladesh, used under at least two clinic brands (**NextDent** and **Dhaka Islamia Dental**). Built as a split Access app: a compiled `.accde` front-end over this encrypted `.accdb` back-end.

**Live data footprint (why the rebuild is worth it):**

| Area | Table | Rows | Note |
|---|---|---:|---|
| Patients | `tbl_Patients` | **3,230** | Core asset — real patient register |
| Drug reference | `tbl_Drugs` | **46,043** | National drug DB (brand/generic/strength/form) |
| Prescriptions | `tbl_Prescriptions` + `tbl_PrescriptionDrug` | 48 + 79 | Rx headers + drug lines (Bangla dosing) |
| Rx line library | `tbl_PrescriptionSider` | 183 | Reusable complaint/diagnosis/advice snippets |
| Rx templates | `tbl_PrescriptionTemplates` (+Drug) | 5 + 5 | Pre-filled clinical templates |
| Treatment | `tbl_PatientTreatmentCases` / `...Details` | 5 / 5 | Case → billable line items |
| Appointments | `tbl_Appointments` | 3 | Calendar bookings |
| Catalog/lookups | `tbl_CommonInfo` | 95 | Treatment price list + all dropdowns |
| Users/security | `tbl_Persons`, `tbl_PersonSecurity`, `tbl_Doctors` | 2 / 2 / 1 | Staff, logins, doctor commission config |
| Config | `tbl_API`, `tbl_UserSetting`, `tbl_PrintDoc`, `tbl_Sms` | — | Integrations, print headers, SMS templates |

Many modules exist in the schema but are **unused so far** (0 rows): inventory (`tbl_Products`, `tbl_PurchaseOrders`, `tbl_PurchaseOrderDetails`, `tbl_Vendors` has 3), lab work (`tbl_LabWork`), HR/payroll (`tbl_EmployeeDetails`, `tbl_PersonPaid`, `tbl_DoctorsPay`), expenses (`tbl_ExpenseDaily/Monthly`, `tbl_RandomIncome`), patient connections/health records, case photos, activity logs. → These are **secondary priority** for the rebuild; the practice mainly uses Patients + Treatment/Billing + Prescriptions + Appointments.

---

## 2. Entity groups (target model)

```
                         ┌──────────────┐
                         │   Person     │  staff/doctors (also drive auth)
                         └──────┬───────┘
                    ┌───────────┼─────────────┐
              ┌─────▼────┐  ┌───▼────────┐  ┌─▼──────────────┐
              │ Doctor   │  │ UserLogin  │  │ DeviceSetting  │
              │(commission)│ │(role,hash)│  └────────────────┘
              └─────┬────┘  └────────────┘
                    │ consultant / operating dr
         ┌──────────▼──────────────────────────────────┐
         │                 Patient                       │  ── consultantDoctor
         └───┬───────────┬───────────┬──────────┬───────┘
             │           │           │          │
     ┌───────▼───┐  ┌────▼──────┐ ┌──▼───────┐ ┌▼──────────────┐
     │Appointment│  │TreatmentCase│ │Prescription│ │HealthRecord/  │
     └───────────┘  └────┬──────┘ └──┬───────┘ │Connections/SMS │
                         │            │         └────────────────┘
                  ┌──────▼──────┐ ┌───▼─────────┐
                  │TreatmentLine│ │RxDrugLine   │  (from Drug catalog)
                  │(billing)    │ └─────────────┘
                  └─────────────┘
```

Reference/lookup data (treatments+prices, occupations, relations, units, salary types, expense names, lab shades, product categories) currently all live as **columns of the single wide table `tbl_CommonInfo`** and must be **normalized into proper lookup tables** (see §5).

---

## 3. Table-by-table mapping (Access → target Postgres)

Legend: 🟢 core / build first · 🟡 secondary · ⚪ unused, defer.

### Identity & security
| Access table | 🟢🟡⚪ | Target table | Rebuild notes |
|---|:--:|---|---|
| `tbl_Persons` | 🟢 | `people` | Staff & doctors. Has **duplicate/legacy columns** (`PersonDOB` vs `DateOfBirth`, `PersonEmergencyRelation` vs `EmergencyRelation`, etc.) — collapse to one each. |
| `tbl_PersonSecurity` | 🟢 | `users` | `PersonUserName` + `PersonPasswordSalt` + `PersonPasswordHash` use a **custom VBA hash — NOT reusable**. On migration, **force password reset** / re-hash with **argon2id or bcrypt**. `PersonRole` empty → design a real RBAC role set. |
| `tbl_SecurityAccess` | 🟢 | *(drop)* | Single value `"abcd"` — a hard-coded master/backdoor code (see `frm_Backdoor`). **Do not carry forward**; replace with proper admin role. |
| `tbl_Doctors` | 🟢 | `doctors` | 1:1 with a person. Holds **revenue-share config** (owner vs guest consultant vs operating (OT) doctor vs chamber %, per case type 1–4) + degree/designation/clinic/BMDC reg for Rx letterhead. See §4.3. |
| `tbl_PersonDeviceSettings` | 🟡 | `user_device_settings` | Per-device theme/zoom. In web app, mostly replaced by per-user UI prefs. |
| `tbl_PersonAccess`, `tbl_PersonActivityLogs`, `tbl_PersonPaid` | ⚪/🟡 | `permissions`, `audit_log`, `staff_payments` | Empty. Keep the **audit_log** concept — build it natively in the web app. |

### Patients & clinical
| Access table | 🟢🟡⚪ | Target table | Rebuild notes |
|---|:--:|---|---|
| `tbl_Patients` | 🟢 | `patients` | `PatientConsultantDrID` → FK to doctor. `PatientPrimaryPhone` is the de-facto identifier (inconsistent formats e.g. `01712-08464`; normalize to E.164 `+8801…`). Memo fields `PatientMedicalHistory/DrugHistory/Note` → text. `PatientLifeTimeDiscount` = default % discount. Photo stored as file **path/URL** → move to object storage. |
| `tbl_PatientTreatmentCases` | 🟢 | `treatment_cases` | A "case" = an episode of care (e.g. *"LCF Class I on 48"*). `CaseStatus` ∈ {Active, Completed} (free-text → enum). |
| `tbl_PatientTreatmentDetails` | 🟢 | `treatment_lines` | **The billing ledger.** Line = one procedure: `TotalAmount`, `DiscountPercent`, `AfterDiscountAmount`, `AmountPaid`, `OTDrID` (operating doctor), `TreatmentDate`. **Due = AfterDiscountAmount − AmountPaid** (partial payments allowed). See §4.1. |
| `tbl_PatientHealthRecord` | 🟡 | `health_records` | Empty; medical/vitals per patient. |
| `tbl_PatientConnections` | ⚪ | `patient_relationships` | Empty; links family members (relations list in CommonInfo). |
| `tbl_TreatmentCasePhotos` | 🟡 | `case_photos` | Empty; before/after imaging → object storage. |
| `tbl_PatientSmsLogs` | 🟡 | `sms_log` | Per-patient sent-SMS history. |

### Appointments
| Access table | 🟢🟡⚪ | Target table | Rebuild notes |
|---|:--:|---|---|
| `tbl_Appointments` | 🟢 | `appointments` | `AppointmentDate` + separate `AppointmentStartTime`/`EndTime` (times stored on the Access `1899-12-30` epoch — **merge into real `timestamptz`**). `AppointmentStatusID` is a **numeric code (12,14…) with no lookup table in the DB** → enumeration lives in front-end VBA; **reconstruct with client** (Scheduled/Confirmed/Completed/Cancelled/No-show/Overdue). `AllocatedUnit` = chair/room ("Unit-1"). Google Calendar sync fields (`GCalendarID/Log`). |

### Prescriptions
| Access table | 🟢🟡⚪ | Target table | Rebuild notes |
|---|:--:|---|---|
| `tbl_Prescriptions` | 🟢 | `prescriptions` | Rich clinical note (complaints, exam findings, provisional/differential/confirmatory diagnosis, treatment plan, procedure, advice, follow-up). `Random*` fields = one-off (non-registered) patient Rx. Soft-delete via `DeleteAt/DeleteBy` → use `deleted_at`. |
| `tbl_PrescriptionDrug` | 🟢 | `prescription_drugs` | Drug lines: `Drug`, `Dose`, `Meal`, `Duration`, `SortOrder`. **Dosing is Bengali text** (`১+০+১, ১২ ঘন্টা পর পর` / `খাবার পর খাবেন`) → keep Unicode, ensure Bangla font in PDF. |
| `tbl_PrescriptionSider` | 🟢 | `rx_snippets` | Reusable phrase library (complaint/diagnosis/advice/drug dose presets) powering autocomplete in the Rx editor. |
| `tbl_PrescriptionTemplates` (+`...TemplateDrug`) | 🟢 | `rx_templates` (+ lines) | Named, pre-filled Rx by scenario (Scaling, Extraction…). Has created/edited audit columns. |
| `tbl_Drugs` | 🟢 | `drugs` (reference) | 46k rows: Manufacturer/BrandName/GenericName/Strength/DosagesForm. Load as **read-only master data**; index for fast typeahead. |

### Catalog, finance, inventory, lab (mostly secondary)
| Access table | 🟢🟡⚪ | Target table | Rebuild notes |
|---|:--:|---|---|
| `tbl_CommonInfo` | 🟢 | **split into many lookup tables** | See §5 — the single most important normalization task. Contains the **treatment price list**. |
| `tbl_LabDetails` / `tbl_LabWork` | 🟡 | `labs` / `lab_orders` | External dental labs + crown/denture work orders. |
| `tbl_Vendors` / `tbl_Products` / `tbl_PurchaseOrders(+Details)` | 🟡 | inventory module | Barely used; defer to a later phase. |
| `tbl_ExpenseDaily/Monthly`, `tbl_RandomIncome`, `tbl_DoctorsPay`, `tbl_EmployeeDetails` | 🟡 | finance/HR module | Empty; the Access charts (income/expense/profit) read these. Defer. |
| `tbl_API` | 🟢 | `integration_settings` (secrets in vault) | Google Calendar OAuth + **BulkSMS BD** gateway + device (Camera/RVG/Intra-oral) locations. **⚠ Contains a live SMS API key — rotate it.** |
| `tbl_UserSetting` | 🟢 | `clinic_settings` | Default Rx type/report, auto-create/auto-complete appointment toggles. |
| `tbl_PrintDoc` | 🟢 | `document_templates` | Header/footer text for Invoice & Prescription per clinic brand. |
| `tbl_Sms` | 🟢 | `sms_templates` | Parameterized SMS bodies (welcome/payment/appointment confirm/reminder). |

---

## 4. Business rules inferred from the data

### 4.1 Billing / payments
- A **patient** owns many **treatment cases**; a case owns many **treatment lines**. Billing happens at the **line** level.
- Per line: `AfterDiscountAmount = TotalAmount × (1 − DiscountPercent)`, and **outstanding due = AfterDiscountAmount − AmountPaid**. Partial payment is normal (data shows 5000 total / 4000 paid).
- Patient-level balance = Σ due across all their lines. `PatientLifeTimeDiscount` seeds the default discount for new lines.
- **No separate payment/receipt table exists** — payment is just the running `AmountPaid` number on the line. **Recommendation:** in the new model add a proper `payments` table (date, amount, method, taken-by) so history/receipts are auditable, and derive `AmountPaid` from it.

### 4.2 Prescriptions
- Rx can be for a **registered patient** (`PatientID`) or an **anonymous/walk-in** (`RandomName/Age/Sex`).
- Two Rx print formats: **"Body/Short"** (`rpt_Dh_NextDent_Rx` / `rpt_PrescriptionShort`) and **"Full"** (`rpt_Prescription`) — chosen by `tbl_UserSetting.DefaultRxType`.
- Drug lines reference free-typed drug strings (seeded from the 46k `tbl_Drugs` catalog) with **Bengali** dose/meal/duration.

### 4.3 Doctor revenue sharing (important, complex)
`tbl_Doctors` encodes how a treatment's revenue is split, by **case type (1–4)** among: **owner**, **guest consultant doctor**, **operating (OT) doctor**, and **chamber** (the clinic). Example values: owner consultation 20%, OT 40%, chamber 40%; guest-consultant case splits differ. `LabBillReductionMethods = "Reduce Before Split"` means lab costs are deducted before the split. → This drives **doctor payout reports** (`tbl_DoctorsPay`). **Confirm exact formula with the client** before implementing.

### 4.4 Automation toggles (`tbl_UserSetting`)
- `AutoAddAppointmentWhenAddingTreatmentDetails` — adding a treatment line auto-creates an appointment.
- `AutoCompleteAppointmentWhenAddingTreatmentDetails` — and marks the appointment completed.

### 4.5 Notifications
- SMS via **BulkSMS BD** (`bulksmsbd.net`), sender id `NextDent`. Triggered for payments, welcome, appointment confirm/remind. Templates in `tbl_Sms` with `{name}`/amount placeholders assembled from the `SmsBodyN` parts.
- **Google Calendar** two-way sync for appointments (`GCalendarID`, `GCalendarLog`, OAuth in `tbl_API`).

---

## 5. `tbl_CommonInfo` → normalized lookups (do this first)

This one 95-row table is a bag of **independent, non-aligned columns**; each column is a dropdown source. Split into:

| CommonInfo column | New lookup table | Sample values |
|---|---|---|
| `TreatmentName` + `TreatmentPrice` | `treatments` (name, default_price) | Simple Extraction=5000, RCO Standard=7000, Zirconia Bridge 3-unit=45000 … (~90 procedures) |
| `Occupation` | `occupations` | Doctor, Banker, Student, Engineer, House-wife … |
| `Relationship` / `ConnectionRelation` | `relations` / `connection_relations` | Father, Mother, Husband-Wife, Parent-Child … |
| `Address` | `address_presets` | Dhaka areas |
| `ScheduleTime` | `schedule_slots` | 12 PM, 12:30 PM … 10:30 PM |
| `TreatmentCase` | `case_types` | RCT & Restoration, Pulpectomy, General … |
| `LabColorShade` | `lab_shades` | A1, A2, B1, W1 … (VITA shades) |
| `UnitName` | `chairs`/`units` | Unit-1, Unit-2 |
| `EmployeeSalaryType` | `salary_types` | Base Salary, Overtime, Housing Allowance … |
| `InventoryProductCategory` | `product_categories` | Accessories, Orthodontics, Endodontic … |
| `ExpenseName` + `ExpenseAmount` | `expense_categories` | House Rent, Wifi, Current Bill … |
| `CalendarWarning` | `settings` (scalar) | numeric reminder-day values |

> Because the columns aren't row-aligned, migrate **column-by-column** (take distinct non-empty values of each), not row-by-row.

---

## 6. Data-quality issues to handle in migration
- **Phone formats inconsistent** (`01712-08464`, `01712845953`, `+880…`) → normalize to E.164; keep raw in a `phone_raw` column.
- **Duplicate legacy columns** in `tbl_Persons`/`tbl_Patients` (two DOB, two emergency-contact sets) → pick the populated one.
- **Loose referential integrity**: transactional FKs (e.g. `PatientConsultantDrID`, `OTDrID`, `AppointmentStatusID`) are **not enforced** in Access and some point to ids with no matching parent (legacy import). Validate/repair on load; don't assume FK validity.
- **Access time epoch**: time-only fields serialize as `1899-12-30Thh:mm` — combine appointment date+time into a single timestamp.
- **Soft-deletes**: several tables use `DeleteAt/DeleteBy` — preserve as `deleted_at`/`deleted_by`.
- **Bengali Unicode** throughout Rx dosing — ensure UTF-8 end-to-end and a Bangla-capable font in generated PDFs.
- **PatientID gaps**: ids exceed row count (deletes) — preserve original ids as `legacy_id` for traceability.

---

## 7. Open questions — resolved by forensics vs. still needing the client

### 7.1 ✅ RESOLVED — `AppointmentStatusID` decoded
**`tbl_Appointments.AppointmentStatusID` is a foreign key into `tbl_Sms.SmsID`.** The old app used the SMS-template table as its appointment status list, so setting a status could fire the matching SMS (hence the `IsAppointSmsSend` / `AppointmentSmsLog` columns).

| SmsID | Status | | SmsID | Status |
|---:|---|---|---:|---|
| 6 | Confirmed | | 11 | Late |
| 7 | Reminded | | 12 | **Overdue** |
| 8 | Rescheduled | | 13 | Pending Confirmation |
| 9 | Cancelled | | 14 | **Completed** |
| 10 | Waitlisted | | 1–5 | *(payment/welcome templates — not statuses)* |

**Evidence:**
1. `tbl_Sms` rows 6–14 are exactly an appointment-lifecycle vocabulary; rows 1–5 are payment/welcome templates.
2. The only two codes present in the data decode correctly against their dates — **12 → Overdue** (two Jan-2026 appointments never completed) and **14 → Completed** (a Mar-2026 appointment).
3. The status words appear **zero times** in the compiled `.accde` (only "Overdue" shows up, from `frm_AppointmentOverdue`) — i.e. they were **bound from a table, not hardcoded** — and `tbl_Sms` is the only table containing that vocabulary.

→ Implemented in the web app (`lib/appointment-constants.ts`) with a `legacyCode` mapping; the ETL and a backfill decode `statusCode` → status. **Confidence: high — worth a one-line client confirmation.**

### 7.2 ✅ RESOLVED — doctor revenue-split reconstructed
Every scenario's shares **sum to exactly 100%**, which validates the reading. **Chamber (clinic) always takes 40%; the operating (OT) doctor always takes 40%; the consultant tier splits the remaining 20%.**

| Scenario | Consultant | Operates | Consultant | Appointing owner | OT doctor | Chamber |
|---|---|---|---:|---:|---:|---:|
| **Base** | Owner | Owner | 20% *(owner)* | — | 40% *(owner)* | 40% |
| **Case 1** | Guest | Guest | 10% | 10% | 40% | 40% |
| **Case 2** | Guest | **Owner** | 20% | — | 40% *(owner)* | 40% |
| **Case 3** | **Owner** | Guest | 20% *(owner)* | — | 40% *(guest)* | 40% |
| **Case 4** | Guest | Guest | 10% | 10% | 40% | 40% |

- Roles come from **`Patient.PatientConsultantDrID`** (consultant) and **`TreatmentLine.OTDrID`** (operator).
- **`LabBillReductionMethods = "Reduce Before Split"`** ⇒ lab cost is deducted **before** applying percentages:
  `splitBase = afterDiscountAmount − labCost`, then `share = splitBase × percent`.
- ⚠️ **Case 1 and Case 4 are numerically identical** (10/10/40/40), so whatever distinguishes them is **not** derivable from the data — needs the client.
- ⚠️ Legacy typo to watch in the source columns: `Case1Gust OTDrPercent` vs `Case3/4Guest OTDrPercent`.

→ **Deliberately not implemented yet.** This formula moves money, so it should be confirmed before it drives payouts. It's also moot today: the practice has only **one doctor (the owner)**, so every real row is the Base case (owner 60% / chamber 40%).

### 7.3 ❓ Still needs the client (not derivable from the data)
1. **Case 1 vs Case 4** — what distinguishes two identically-weighted guest/guest scenarios?
2. **Invoice & Rx print layouts** — sample **PDFs** of `rpt_Invoice` / `rpt_Prescription` / `rpt_Dh_*_Rx` for pixel parity. *(Both are built from `tbl_PrintDoc` letterhead data, but exact parity needs the samples.)*
3. **Patient/invoice auto-numbering** format, if any (IDs look like plain autonumbers).
4. **Which brands/clinics** are in active use (`NextDent` vs `Dhaka Islamia Dental`) and whether data should be per-clinic.
5. **SMS trigger rules** — exact events and timing (e.g. reminder = X days before). *(§7.1 strongly implies a status change fires the same-named template — confirm.)*
6. **Roles & permissions** — the intended role matrix (legacy RBAC was stubbed/empty; the web app now ships OWNER/DOCTOR/RECEPTIONIST/ASSISTANT).

---

## 8. Suggested target schema (starter DDL sketch)
See [`plan.md`](../plan.md) §5 for how this fits the app. Core tables to create first:
`people, users, roles, doctors, patients, treatments(lookup), treatment_cases, treatment_lines, payments, appointments, appointment_statuses, drugs, prescriptions, prescription_drugs, rx_templates, rx_snippets, sms_templates, sms_log, integration_settings, document_templates, clinic_settings, audit_log` — plus the normalized lookups from §5, and the history/search tables in §9.

---

## 9. Patient history & instant search — schema additions

Supports [`plan.md`](../plan.md) §6 (longitudinal record) and §7 (type-ahead search). None of these exist in the legacy DB — they are **new** in the target model.

### 9.1 Clinical history tables
| Table | Purpose | Key columns |
|---|---|---|
| `clinical_notes` | Immutable per-visit notes (edits = new version) | patient_id, appointment_id?, author_id, body, created_at |
| `patient_history_versions` | Append-only medical/drug/allergy history so past records are "as-of" correct | patient_id, kind(medical/drug/allergy), body, valid_from, author_id |
| `tooth_chart_entries` | Current + historical status per tooth (FDI numbering) | patient_id, tooth_fdi, status, treatment_line_id?, recorded_at |
| `treatment_line_teeth` | Link a billed procedure to one/more teeth | treatment_line_id, tooth_fdi |
| `attachments` | Photos / RVG / intra-oral images | patient_id, case_id?, tooth_fdi?, storage_key, kind, created_at |
| `recalls` | Follow-up / recall worklist (from Rx & treatment follow-ups) | patient_id, due_date, reason, status |
| `patient_events` | Denormalized timeline feed (or a VIEW over the sources) | patient_id, event_type, ref_id, occurred_at, summary |
| `audit_log` | Technical who/what/when (compliance, distinct from clinical history) | actor_id, entity, entity_id, action, diff, at |

- On migration, **seed `patient_events`** from existing `treatment_lines`, `appointments`, `prescriptions`, `sms_log`. Seed `tooth_chart_entries` by parsing tooth numbers already embedded in `CaseName`/`TreatmentName` text (e.g. "Ext 14", "on 48").
- Prescriptions/treatments should store a reference to the `patient_history_versions` row current at creation time.

### 9.2 Search indexes (type-ahead performance)
- Enable `pg_trgm`; add **GIN trigram indexes** on: `patients(full_name)`, `patients(nickname)`, `drugs(brand_name)`, `drugs(generic_name)`, `treatments(name)`, `rx_snippets(*)`.
- Add a **`patients.phone_digits`** generated column (digits only) with a btree/trgm index for dash-insensitive phone search.
- Optional combined `search_vector tsvector` on `drugs` (brand+generic+strength+form) for full-text ranking.
- Keep `/search/*` endpoints returning minimal `{id, label, subtitle}` rows; cap results ~20–50, server-paginated.
