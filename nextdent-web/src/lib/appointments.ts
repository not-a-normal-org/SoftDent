import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CLOSED_STATUSES, STATUSES, type StatusKey } from "./appointment-constants";
import { fromDateInput, toDateInput } from "./format";
import { rangeBounds, type DateRange } from "./date-range";
import { patientSearchSql } from "./patients";
import { sqlInstant } from "./sql";

/**
 * The clinic's calendar day containing `date`, as an instant range.
 *
 * Host-local before, which paired with a host-local `combine()` and so happened to
 * work while the host was Dhaka. Both sides now reckon in Asia/Dhaka explicitly, so
 * the schedule is the same whatever machine serves it.
 */
const dayRange = (date: Date) => {
  const start = fromDateInput(toDateInput(date), "00:00")!;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const apptInclude = {
  patient: { select: { id: true, fullName: true, primaryPhone: true } },
  doctor: { include: { person: true } },
};
const apptOrder = [{ startsAt: "asc" as const }, { id: "asc" as const }];

export const APPT_PAGE_SIZE = 100;

/** Every appointment booked on the range's days, in calendar order, a page at a time. */
export async function getAppointmentsInRange(range: DateRange, page = 1) {
  const { start, end } = rangeBounds(range);
  const where = { appointmentDate: { gte: start, lt: end } };
  const total = await prisma.appointment.count({ where });
  const pages = Math.max(1, Math.ceil(total / APPT_PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  const rows = await prisma.appointment.findMany({
    where,
    include: apptInclude,
    // the day first: a booking with no start time still belongs under its own date
    orderBy: [{ appointmentDate: "asc" }, ...apptOrder],
    skip: (p - 1) * APPT_PAGE_SIZE,
    take: APPT_PAGE_SIZE,
  });
  return { rows, total, page: p, pages };
}

// ── missed appointments ────────────────────────────────────────────────────────
// Booked for a time that has passed and never closed (marked done or cancelled).
// The old "Overdue" panel showed the 50 oldest of these with no way to reach the
// rest; there are hundreds, so they are now listed per day on the page and in full,
// searchable and paged, in a dialog fed by /api/appointments/missed.

export const MISSED_SORTS = ["date", "patient", "doctor", "status"] as const;
export type MissedSort = (typeof MISSED_SORTS)[number];
export const MISSED_PAGE_SIZE = 25;

/** The statuses a missed appointment can carry — everything that does not close it. */
export const OPEN_STATUS_KEYS = STATUSES.map((s) => s.key).filter((k) => !CLOSED_STATUSES.includes(k));

export type MissedRow = {
  id: number;
  appointmentDate: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: StatusKey;
  allocatedUnit: string | null;
  note: string | null;
  patientId: number;
  patientName: string;
  phone: string | null;
  doctorId: number | null;
  doctorName: string | null;
};

/**
 * "Missed" as of `now`: the booked start time has passed (or, with no start time, the
 * whole booked day has) and the status does not close it. Past the start rather than
 * past the day, so the 3pm patient who has not been marked done shows up as missed at
 * 3:01 on the day itself, not only from tomorrow.
 */
function missedSql(now: Date): Prisma.Sql {
  const { start: today } = dayRange(now);
  return Prisma.sql`(a.status IS NULL OR a.status NOT IN (${Prisma.join(CLOSED_STATUSES)}))
    AND (a."startsAt" < ${sqlInstant(now)} OR (a."startsAt" IS NULL AND a."appointmentDate" < ${sqlInstant(today)}))`;
}

// A null or unrecognised status reads as Pending everywhere (`statusMeta`), so it
// counts, filters and sorts as Pending here too.
const STATUS_KEY_SQL = Prisma.sql`(CASE WHEN a.status IN (${Prisma.join(OPEN_STATUS_KEYS)}) THEN a.status ELSE 'PENDING' END)`;

// Column names cannot be bound as parameters, so the sort comes from this fixed map
// and nothing the visitor sent ever reaches the ORDER BY as text.
const MISSED_SORT_SQL: Record<MissedSort, Prisma.Sql> = {
  date: Prisma.sql`COALESCE(a."startsAt", a."appointmentDate")`,
  patient: Prisma.sql`lower(p."fullName")`,
  doctor: Prisma.sql`lower(dp."fullName")`,
  status: STATUS_KEY_SQL,
};

export async function listMissed(opts: {
  q?: string;
  /** null: any date */
  range?: DateRange | null;
  doctorId?: number | null;
  status?: StatusKey | null;
  sort?: MissedSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  const bounds = opts.range ? rangeBounds(opts.range) : null;
  const size = opts.pageSize ?? MISSED_PAGE_SIZE;
  const from = Prisma.sql`
    FROM "Appointment" a
    JOIN "Patient" p ON p.id = a."patientId"
    LEFT JOIN "Doctor" d ON d.id = a."doctorId"
    LEFT JOIN "Person" dp ON dp.id = d."personId"
    WHERE ${missedSql(new Date())}
      AND ${patientSearchSql(opts.q ?? "")}
      AND ${bounds ? Prisma.sql`a."appointmentDate" >= ${sqlInstant(bounds.start)} AND a."appointmentDate" < ${sqlInstant(bounds.end)}` : Prisma.sql`TRUE`}
      AND ${opts.doctorId ? Prisma.sql`a."doctorId" = ${opts.doctorId}` : Prisma.sql`TRUE`}`;

  // Counts per status under every other filter, for the status chips. Fetched before
  // the rows because they fix how many pages exist, so a page past the end lands on
  // the last page rather than an empty one.
  const byStatus = await prisma.$queryRaw<{ status: StatusKey; n: number }[]>`
    SELECT ${STATUS_KEY_SQL} AS status, COUNT(*)::int AS n ${from} GROUP BY 1`;
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<StatusKey, number>>;
  const all = byStatus.reduce((s, r) => s + r.n, 0);
  const total = opts.status ? counts[opts.status] ?? 0 : all;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, opts.page ?? 1), pages);
  const dir = opts.dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const rows = await prisma.$queryRaw<MissedRow[]>`
    SELECT a.id, a."appointmentDate", a."startsAt", a."endsAt", ${STATUS_KEY_SQL} AS status,
           a."allocatedUnit", a.note,
           p.id AS "patientId", p."fullName" AS "patientName", p."primaryPhone" AS phone,
           a."doctorId", dp."fullName" AS "doctorName"
    ${from}
      AND ${opts.status ? Prisma.sql`${STATUS_KEY_SQL} = ${opts.status}` : Prisma.sql`TRUE`}
    ORDER BY ${MISSED_SORT_SQL[opts.sort ?? "date"]} ${dir} NULLS LAST,
             COALESCE(a."startsAt", a."appointmentDate") DESC, a.id DESC
    LIMIT ${size} OFFSET ${(page - 1) * size}`;

  return { rows, total, all, counts, page, pages };
}

/** How many appointments are missed in all, for the "show all" button. */
export async function countMissed() {
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "Appointment" a WHERE ${missedSql(new Date())}`;
  return n;
}

/** Doctors by name, for the missed list's filter. */
export async function listDoctorOptions() {
  const doctors = await prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } });
  return doctors.map((d) => ({ id: d.id, name: d.person.fullName }));
}

export function getUpcoming(limit = 25) {
  const { start: today } = dayRange(new Date());
  return prisma.appointment.findMany({
    where: { appointmentDate: { gte: today } },
    include: apptInclude,
    orderBy: apptOrder,
    take: limit,
  });
}

/** Today's and tomorrow's schedule, for the dashboard's agenda panel. */
export async function getTodayAndTomorrow() {
  const today = dayRange(new Date());
  const tomorrow = dayRange(new Date(today.start.getTime() + 24 * 60 * 60 * 1000));
  const [todayList, tomorrowList] = await Promise.all([
    prisma.appointment.findMany({
      where: { appointmentDate: { gte: today.start, lt: today.end } },
      include: apptInclude,
      orderBy: apptOrder,
    }),
    prisma.appointment.findMany({
      where: { appointmentDate: { gte: tomorrow.start, lt: tomorrow.end } },
      include: apptInclude,
      orderBy: apptOrder,
    }),
  ]);
  return { today: todayList, tomorrow: tomorrowList, todayDate: today.start, tomorrowDate: tomorrow.start };
}

export function getAppointment(id: number) {
  return prisma.appointment.findUnique({ where: { id }, include: apptInclude });
}

// generate "HH:MM" slot start times from open→close at slot-minute steps
function buildSlots(open: string, close: string, minutes: number): string[] {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const start = oh * 60 + om, end = ch * 60 + cm, step = Math.max(5, minutes);
  const out: string[] = [];
  for (let t = start; t + step <= end; t += step) out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

export async function getAppointmentEditorData() {
  const [doctors, units, settings] = await Promise.all([
    prisma.doctor.findMany({ include: { person: true }, orderBy: { id: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.clinicSetting.findFirst(),
  ]);
  const open = settings?.openTime ?? "15:00", close = settings?.closeTime ?? "19:00", slot = settings?.slotMinutes ?? 30;
  return {
    doctors: doctors.map((d) => ({ id: d.id, name: d.person.fullName })),
    units: units.map((u) => u.name),
    schedule: { workingDays: settings?.workingDays ?? [6, 0, 1, 2, 3], slotMinutes: slot, slots: buildSlots(open, close, slot) },
  };
}
export type ApptSchedule = Awaited<ReturnType<typeof getAppointmentEditorData>>["schedule"];
