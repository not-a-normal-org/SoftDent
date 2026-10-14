# TODO

Live: revision `nextdent-00010-fm6` (2026-10-14) — billing paid-amount fix, SMS
placeholder merge + preview, suggested next-open-day.

## Barishal data import — DONE (2026-10-14)

The database now holds the **Barishal clinic's real records**, not the Dhaka sample:
1,453 patients, 1,488 cases, 8,500 treatment lines, 6,881 appointments, 1,485
prescriptions, 1,311 SMS history rows, 34,914 drugs. Local and production both.

Importer: [scripts/etl-barishal.ts](scripts/etl-barishal.ts); checker:
[scripts/verify-barishal.ts](scripts/verify-barishal.ts). Both take `BARISHAL_CSV`.
The Access file is password-protected, so mdbtools cannot read it — it was dumped
with Jackcess + jackcess-encrypt reading dates as `LocalDateTime`.

**The Barishal backend is an older schema than Dhaka's.** Differences handled:
- Prescriptions hold up to ten drugs **inline** (`Drug1…Drug10` + Dose/Duration/Meal);
  there is no `tbl_PrescriptionDrug`. Unpivoted to 4,032 child rows, the slot number
  driving `sortOrder` so a gap (Drug1 and Drug3 filled, Drug2 blank) keeps its order.
- Clinical fields are named for the paper form: `C/C`→complaints, `H/O`→medicalHistory,
  `O/E`→findingsOnExamination, `Diagnosis`→provisionalDiagnosis,
  `Investigation`→investigationAdvised, `TreatmentDone`→procedurePerformed,
  `Advice`→advise. `Note` had no home at all → new `Prescription.note` column
  (migration `20261014120000_prescription_note`).
- Rx templates carry only a name plus inline drugs — no clinical fields.
- No `tbl_UserSetting`, so clinic settings were kept rather than imported.

**Two bugs the verifier caught that counts alone would have missed:**
1. **Discounts are stored as a fraction, not a percent.** `0.1` means 10%, `1.0`
   means waived. Proven against all 8,500 lines: 4,316 reconcile with
   `AfterDiscountAmount` only under that reading and none under the other. Imported
   raw it rendered "0.1%" and would have recomputed the payable from 0.1% on the
   first edit. Now ×100, rounded to 2dp; the stored payable is carried over verbatim
   and stays authoritative.
2. **Dhaka was UTC+06:30 until 1951.** Parsing with a hardcoded `+06:00` put 22
   pre-1951 dates of birth half an hour out. Timestamps now resolve through the
   `Asia/Dhaka` zone, so every one round-trips exactly.

**Preserved across the wipe:** all logins with their password hashes (re-attached to
the matching Barishal person by name — `nayeem`→person 1, `ramen`→person 5; `Himel`
has no legacy record and kept a person of his own), clinic settings, the 14 Bangla
SMS templates, and the integration tokens. Sessions were cleared, so everyone signs
in again. The Barishal letterhead replaced the old one — it carries the full clinic
address and the same `01841272270` helpline.

Not imported: 3 purchase-order headers (no model; their 93 stock movements were
kept), and the legacy `tbl_API` tokens (the live ones were kept instead).

Known source quirks, left exactly as the clinic recorded them: 95 lines whose own
payable does not match their own discount, and one ৳-2,000 refund line.

Captured 2026-09-24. Prescriptions section completed and deployed 2026-09-28.

## Prescriptions — DONE (live, revision nextdent-00003-tks)

- [x] **Printed prescription redesigned; Advice has its own colour.** Amber panel with
      a left rule and label — colour is not load-bearing, since prescriptions get
      photocopied. Drug names 12.5pt bold, numbered gutter spaced per ISMP, Bangla in
      Noto Sans Bengali (it previously had no font at all and fell back to whatever
      the clinic PC happened to have).
- [x] **Rx editor reordered** to Clinical notes → ℞ Medicines → Advice & follow-up.
      Advice had to be split out of the `CLINICAL` array first, or moving the notes
      block up would have carried Advice with it.
- [x] **Two print formats restored** — "Pre-printed letterhead" checkbox, sticky per
      browser, defaulting to `ClinicSetting.defaultRxType`. This was not a new feature:
      the Access app had Body/Full and the clinic's default was already `Body`.
      Reserved space is tunable in Settings (`rxBodyTopMm` / `rxBodyBottomMm`).
- [x] **Safety formatter** — [src/lib/rx-safety.ts](src/lib/rx-safety.ts) applies the
      ISMP rules on print: trailing zeros, naked decimals, `U`→units, `µg`→mcg,
      `cc`→mL, dose run into drug name. 13 cases pass, idempotent; across real data it
      changes 26 of 79 lines, all `ml`→`mL`.

      Three bugs fixed on the way, two long-standing:
      1. The letterhead had **never printed** — the nav and the letterhead are both
         `<header>` and the print CSS hid the element type.
      2. Multi-page overprint — `padding` applies once, `@page` applies per page.
      3. A ref written during render in `RxPrintMode`.

      Still outstanding for the clinic, not for code:
      - ~~`BMDC Reg No: 5790.0` — trailing `.0`~~ — fixed by the Barishal import,
        which strips the float artefact. Now prints `BMDC Reg No: 5800`.
      - Top/bottom mm default to 45/20 — a guess. Print on real stationery and tune.

## Billing — DONE (2026-10-03)

- [x] **Part-payments over several visits.** No migration was needed: `Payment` was
      already a separate table with many-to-one to `TreatmentLine`, and the live data
      already had part-paid lines (৳4,000 of ৳5,000). The gap was display — the profile
      showed one total. Instalments now list under each line with date, method and a
      running balance.

- [x] **Payment without a bill** (2026-10-13). A paid amount is no longer capped at
      the payable, in either place it could be entered. The cap was silently
      discarding money: a row named with ৳0 amount and ৳100 paid saved as ৳0 paid,
      with no error. Fixed in `addLineInline` and `payLineInline`; the Paid `+` now
      also appears on a row with nothing due, which was previously the one row that
      could never take a payment. Anything above the payable reads as **credit**
      rather than a negative due.

      `Payment.treatmentLineId` is still NOT NULL, so an advance is held against a
      named ৳0 line rather than floating free — no migration needed, and the money
      stays attached to something a receptionist can point at.

- [x] **Reverse discount calculation.** Discount % and payable are now two views of one
      number: type ৳1,800 against ৳2,000 and the discount becomes 10%; type 25% and
      payable becomes ৳1,500. Only `discountPercent` is submitted — payable stays
      derived server-side by `afterDiscount()`, so the two cannot disagree in the
      database. Trade-off: a target like ৳1,777 rounds to the nearest 0.1%, so it may
      land a taka out. Round figures are exact.

## Bulk SMS — BUILT, not yet enabled (2026-10-03)

- [x] **Feature built.** `SmsTemplate` extended in place (the 15 legacy rows were
      already imported) with `key`/`body`/`statusKey`; new `SmsLog` for per-patient
      history. Gateway client in [src/lib/sms.ts](src/lib/sms.ts) with all 20 error
      codes mapped to readable text, segment counting, and BD phone normalisation.
      Settings → SMS templates edits all 14 with a live segment counter and refuses
      English. Patient profile has a send panel plus history. 12 of 14 templates are
      2 segments, exactly as the research predicted for Bangla.

- [x] **Placeholders actually merge, and the message is previewed** (2026-10-13).
      `sendPatientSms` was reading `{date}`, `{time}`, `{total}`, `{paid}` and `{due}`
      from form fields that the patient page never submitted, so every one of them
      rendered as an empty string — "মোট খরচ  টাকা". They now come from
      `smsValuesForPatient()`, which reads the patient's own billing total and next
      appointment, and is used by both the preview and the send, so the two cannot
      disagree. The pure text helpers moved to
      [src/lib/sms-text.ts](src/lib/sms-text.ts) so the browser can render the same
      merge. The profile now shows the merged body in an editable box with a live
      segment count, and names any placeholder the record could not fill.

      With nothing booked, `{date}` falls back to **the next day the clinic is open**
      — read from `ClinicSetting.workingDays` (currently Sat–Wed, so Thursday and
      Friday are skipped) rather than hardcoded, so changing the schedule in Settings
      changes this too. The panel says the date is a suggestion, not a booking.
      `{time}` is still left blank on purpose: a time is a promise to the patient.

      **Still needed before it can send:**
      - `BULKSMS_API_KEY` is set locally and in Secret Manager; balance is ৳478.89
        as of 2026-10-13, so sends now work. **Rotate the key** — the current one was
        shared in chat.
      - ~~Confirm whether IP allowlisting is enforced (code 1032)~~ — it is not.
        Proven by sending from Cloud Run and from this machine; both returned 202.
      - **Have the clinic review the Bangla wording.** I drafted it; a native
        clinical reviewer should check it before it reaches patients.
      - Consent and opt-out are still undecided.


<details><summary>Original scoping notes (kept for reference)</summary>

Needs thinking through
      before any code. Nothing exists yet: the schema has only
      `Appointment.smsSent`, and `.env.example` carries unused `BULKSMS_API_KEY` /
      `BULKSMS_SENDER_ID` placeholders.

      **Start from the legacy templates — they survived the extraction.**
      `../extraction/data/tbl_Sms.csv` holds 14 usable templates (SmsID 1 is a blank
      placeholder):

      | Group | Templates |
      |---|---|
      | Appointment lifecycle (SmsID 6–14) | Confirmed, Reminded, Rescheduled, Cancelled, Waitlisted, Late, Overdue, Pending Confirmation, Completed |
      | Payment & welcome (2–5, 15) | Regular Payment, Welcome, Payment Without Due, Member Welcome, Due Payment |

      The nine appointment templates map **1:1 onto the existing `StatusKey` values**
      via `LEGACY_STATUS_BY_CODE` in
      [src/lib/appointment-constants.ts](src/lib/appointment-constants.ts) — so the
      status list and the template list already line up.

      **Points to settle:**

      - *Template format.* The legacy rows are a heading plus up to six body
        fragments that the old VBA concatenated around runtime values
        (`"Dear" + name + ", your due is BDT" + amount + "."`). Replace with named
        placeholders (`{patientName}`, `{date}`, `{time}`, `{amountDue}`) so
        templates are editable in Settings without code changes.
      - *Don't copy the legacy coupling.* In Access, `AppointmentStatusID` was a
        foreign key **into the SMS table** — the status list and the template list
        were the same thing, so changing a status could fire a message as a side
        effect. Keep sending explicit and separate from status.
      - *Schema.* `data-model.md` earmarks `sms_templates` and `sms_log`
        (from `tbl_Sms` and `tbl_PatientSmsLogs`). Needs a migration plus a per-patient
        send history, so staff can see what went out and nothing double-sends.
      - *Bengali text costs 2.3× more.* Non-Latin SMS uses UCS-2 at 70 characters per
        segment versus 160 for GSM-7. Templates written in Bangla will silently cost
        multiple segments each — worth showing a segment counter in the editor.
      - *Consent and opt-out.* These go to patients about medical appointments.
        Decide how consent is recorded and how a patient stops receiving them.
      - *Rotate the gateway key first.* `tbl_API` in the legacy DB contains a **live
        BulkSMS BD key**; `data-model.md` flags it. Rotate before enabling anything.
      - *Trigger model.* Manual send, automatic on status change, or a scheduled
        reminder run (e.g. day-before reminders)? This decides most of the design.

### Gateway: BulkSMS BD

Account is provisioned. Sender ID **`NextDent`** (masked). Decided: **all templates
in Bangla.**

| | |
|---|---|
| Send one/many-to-same | `POST https://bulksmsbd.net/api/smsapi` — `api_key`, `senderid`, `number`, `message` |
| Send different messages | `POST https://bulksmsbd.net/api/smsapimany` — `api_key`, `senderid`, `messages` (JSON array of `{to, message}`) |
| Balance | `GET https://bulksmsbd.net/api/getBalanceApi?api_key=…` |
| Number format | `88017XXXXXXXX` — country code, no `+`, comma-separated for bulk |
| Success | code **202**. Anything else is a failure to be logged, not swallowed |

**Constraints found in their error codes — these drive the design:**

- **Bangla is mandatory, not a preference.** Code **1012 — "Masking SMS must be sent
  in Bengali"**. With a masked sender ID like `NextDent`, the gateway *rejects*
  English content. So there is no bilingual option: every template must be Bangla.
- **Code 1032 — "ip Not whitelisted".** If the account enforces IP allowlisting this
  is a real problem: **Cloud Run egress IPs are dynamic.** Pinning them needs a VPC
  connector plus Cloud NAT with a reserved static IP, which costs a few dollars a
  month and is the single biggest infra question here. Confirm with BulkSMS BD
  whether allowlisting is enforced on this account *before* designing around it.
- **Code 1007 — "Balance Insufficient".** Messages fail silently from the clinic's
  point of view. Poll `getBalanceApi` and surface a low-balance warning in Settings.
- Codes 1001/1002/1003 and 1005–1021 are per-request failures worth mapping to
  readable messages rather than showing a bare number to staff.

**Two corrections to the vendor's sample code — don't copy it as-is:**

- Their PHP uses `http://` and sets `CURLOPT_SSL_VERIFYPEER => false`. I checked:
  **`https://bulksmsbd.net` works and presents a valid certificate.** Use HTTPS with
  verification on — these requests carry patient phone numbers, names and amounts.
- `message` must be URL-encoded (`&`, `$`, `@` and friends), which matters more with
  Bangla text.

**Cost:** Bangla forces UCS-2 encoding — 70 characters per single SMS, 67 per segment
once concatenated, versus 160 for Latin. Measured against realistic template text,
a typical appointment or payment message is **~100 characters → 2 segments**, so
budget roughly double the per-SMS rate. Show a live segment counter in the template
editor so staff can see when an edit tips a message into another segment.

**Key handling:** the current key was shared in chat and `data-model.md` already flags
a live key in the legacy `tbl_API`. Rotate before go-live, then store it in Secret
Manager (as `nextdent-db-url` already is) — never in `.env` on a deployed image.

</details>

## Infrastructure (carried over)

- [~] **Second backup copy in Google Drive** — image and script ready, needs your
      one-time OAuth consent. `drive-sync.sh` is built into backup image v4 (with
      rclone); step-by-step setup is in [ops/backup/README.md](ops/backup/README.md).
      A service account cannot write usefully into personal My Drive, so the job must
      act as you, and only you can grant that in a browser.

      Original note:
      Backups currently live only in `gs://nextdent-backups-727181117105`. Mirroring
      them to Drive gives a second copy so data sits in two places.

      *What this does and does not protect against:* it covers accidental deletion,
      a bad lifecycle rule, GCP project deletion, and billing suspension — Drive's
      own trash keeps 30 days. It does **not** cover account compromise or account
      termination, since both copies are under one Google login. A genuinely
      independent copy needs a second provider or a periodic local download.

      *Implementation note:* a service account can't simply write into a personal
      My Drive folder — files it creates are owned by the service account, which has
      no storage quota outside a Workspace Shared Drive. So this needs a user OAuth
      refresh token (rclone-style) held in Secret Manager, with the copy step added
      to the existing nightly job. Volume is trivial: ~800 KB/night, ~24 MB for 30
      days against 15 GB free.
      → [ops/backup/README.md](ops/backup/README.md)

- [ ] **Rotate the Supabase database password.** The current one was shared in chat
      during setup. Rotating means a new password in Supabase, then
      `gcloud secrets versions add` for both `nextdent-db-url` and
      `nextdent-db-session-url`.

- [x] **Alert on backup failure.** Cloud Monitoring policy "NextDent — nightly
      database backup failed" emails nextdent.barishal@gmail.com on any ERROR log from
      the backup job. Verified by deliberately pointing the job at a non-existent
      bucket and confirming the failure produced a matching log entry.
