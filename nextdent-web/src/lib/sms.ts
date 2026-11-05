import "server-only";
import { prisma } from "./prisma";
import { countSegments, type SmsValues } from "./sms-text";
import { fmtDate, fmtTime, toDateInput, CLINIC_TZ } from "./format";

// The text maths is pure and the preview needs it in the browser, so it lives in
// sms-text.ts and is re-exported here — callers keep importing from one place.
export { countSegments, renderTemplate, missingPlaceholders, placeholdersIn } from "./sms-text";
export type { SmsValues } from "./sms-text";

/**
 * BulkSMS BD gateway (bulksmsbd.net).
 *
 * Two things from their error codes shape everything here:
 *
 *   1012 "Masking SMS must be sent in Bengali" — with a masked sender ID like
 *        "NextDent" the gateway REJECTS English content. Bangla is not a preference,
 *        it is a requirement, so there is no bilingual path.
 *   1032 "ip Not whitelisted" — if the account enforces IP allowlisting this cannot
 *        work from Cloud Run, whose egress IPs are dynamic. It would need a VPC
 *        connector plus Cloud NAT with a reserved address.
 *
 * Their sample code uses http:// and disables TLS verification. We use https://,
 * which their host serves with a valid certificate — these requests carry patient
 * phone numbers, names and amounts.
 */

const BASE = "https://bulksmsbd.net/api";

/** Gateway response codes worth explaining to a receptionist rather than showing raw. */
const CODES: Record<string, string> = {
  "202": "Sent",
  "1001": "Invalid number",
  "1002": "Sender ID is wrong or disabled",
  "1003": "Missing required field — contact the administrator",
  "1005": "Gateway internal error",
  "1006": "Balance validity expired",
  "1007": "Insufficient balance — top up the SMS account",
  "1011": "User ID not found",
  "1012": "Masked SMS must be written in Bangla",
  "1013": "Sender ID has no gateway for this API key",
  "1014": "Sender type not found for this API key",
  "1015": "Sender ID has no valid gateway",
  "1016": "No active price for this sender ID",
  "1017": "No price info for this sender ID",
  "1018": "Account owner is disabled",
  "1019": "Price for this account is disabled",
  "1020": "Parent account not found",
  "1021": "Parent account has no active price",
  "1031": "Account not verified — contact the administrator",
  "1032": "This server's IP is not whitelisted with the gateway",
};

export const describeCode = (code: string) => CODES[code] ?? `Gateway error ${code}`;

/**
 * Normalise a Bangladeshi mobile number to the gateway's format: 8801XXXXXXXXX,
 * country code included, no plus sign, no separators.
 * Returns null if it does not look like a BD mobile number.
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (/^8801\d{9}$/.test(d)) return d;
  if (/^01\d{9}$/.test(d)) return `88${d}`;
  if (/^1\d{9}$/.test(d)) return `880${d}`;
  return null;
}

type SendResult = { ok: boolean; code: string; message: string; raw: string };

function config() {
  const apiKey = process.env.BULKSMS_API_KEY ?? "";
  const senderId = process.env.BULKSMS_SENDER_ID ?? "NextDent";
  return { apiKey, senderId, configured: apiKey.length > 0 };
}

/** The gateway answers with JSON on success and sometimes bare text on failure. */
function parseResponse(text: string): { code: string } {
  try {
    const j = JSON.parse(text) as { response_code?: number | string };
    if (j.response_code !== undefined) return { code: String(j.response_code) };
  } catch {
    // not JSON — fall through to the digit scan
  }
  const m = text.match(/\b(202|10\d{2})\b/);
  return { code: m ? m[1] : "unknown" };
}

/** Send one message to one number. Logs the attempt either way. */
export async function sendSms(opts: {
  to: string;
  body: string;
  patientId?: number | null;
  templateKey?: string | null;
}): Promise<SendResult> {
  const { apiKey, senderId, configured } = config();
  const phone = normalisePhone(opts.to);
  const { segments } = countSegments(opts.body);

  const log = async (status: string, code: string | null, error: string | null) => {
    await prisma.smsLog.create({
      data: {
        patientId: opts.patientId ?? null,
        phone: phone ?? String(opts.to),
        body: opts.body,
        templateKey: opts.templateKey ?? null,
        status,
        gatewayCode: code,
        error,
        segments,
      },
    });
  };

  if (!phone) {
    await log("FAILED", null, "Not a valid Bangladeshi mobile number");
    return { ok: false, code: "1001", message: describeCode("1001"), raw: "" };
  }
  if (!configured) {
    await log("FAILED", null, "BULKSMS_API_KEY is not set");
    return { ok: false, code: "unconfigured", message: "SMS is not configured yet.", raw: "" };
  }

  let raw = "";
  try {
    const res = await fetch(`${BASE}/smsapi`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: apiKey,
        senderid: senderId,
        number: phone,
        message: opts.body,
      }),
    });
    raw = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    await log("FAILED", null, msg);
    return { ok: false, code: "network", message: msg, raw: "" };
  }

  const { code } = parseResponse(raw);
  const ok = code === "202";
  await log(ok ? "SENT" : "FAILED", code, ok ? null : describeCode(code));
  return { ok, code, message: describeCode(code), raw };
}

/**
 * Remaining credit, for the low-balance warning. Null when unavailable.
 *
 * The response is `{"response_code":202,"balance":1.39}`, so it must be parsed as
 * JSON — scanning for the first number in the text returns 202, the success code,
 * and silently reports a healthy balance when the account is empty.
 */
export async function getBalance(): Promise<number | null> {
  const { apiKey, configured } = config();
  if (!configured) return null;
  try {
    const res = await fetch(`${BASE}/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`);
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { balance?: number | string };
      if (j.balance !== undefined) {
        const n = Number(j.balance);
        // the gateway returns full float noise (1.3899999999…) — one paisa is plenty
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
      }
    } catch {
      // not JSON — fall through
    }
    // Only accept a bare number if the whole body is one, so a stray code is not
    // mistaken for credit.
    const trimmed = text.trim();
    return /^-?\d+(\.\d+)?$/.test(trimmed) ? Math.round(Number(trimmed) * 100) / 100 : null;
  } catch {
    return null;
  }
}

export const listSmsTemplates = () =>
  prisma.smsTemplate.findMany({ where: { active: true }, orderBy: { id: "asc" } });

export const getSmsTemplate = (key: string) =>
  prisma.smsTemplate.findUnique({ where: { key } });

export const recentSmsForPatient = (patientId: number) =>
  prisma.smsLog.findMany({ where: { patientId }, orderBy: { sentAt: "desc" }, take: 20 });

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Day of the week in the clinic's timezone, 0=Sunday — not the server's. */
const clinicDow = (d: Date) =>
  DOW.indexOf(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: CLINIC_TZ }).format(d));

/**
 * The first day the clinic is open, starting from tomorrow.
 *
 * Used as the suggested {date} when the patient has no appointment booked, so a
 * reminder doesn't go out with a hole in it. The open days come from
 * `ClinicSetting.workingDays` rather than being hardcoded — the clinic's is Sat–Wed,
 * i.e. closed Thursday and Friday, and if that changes in Settings this follows.
 * Dhaka has no DST, so stepping in whole days is exact.
 */
function nextOpenDay(workingDays: number[], from = new Date()): Date {
  const tomorrow = new Date(from.getTime() + 86_400_000);
  if (workingDays.length === 0) return tomorrow; // no schedule set — don't loop forever
  for (let i = 0; i < 7; i++) {
    const day = new Date(tomorrow.getTime() + i * 86_400_000);
    if (workingDays.includes(clinicDow(day))) return day;
  }
  return tomorrow;
}

/**
 * The merge values for one patient, from the patient's own record rather than from
 * the form. This is the single source of truth: the profile renders the preview from
 * it and the send action re-reads it, so what is shown is what goes out.
 *
 * Previously these came from hidden form fields that the patient page never sent, so
 * every {date}, {total}, {paid} and {due} rendered as an empty string.
 */
export async function smsValuesForPatient(
  patientId: number
): Promise<{ values: SmsValues; booked: boolean }> {
  // Dhaka is a fixed UTC+6 with no DST, so the clinic's day starts at a known instant.
  // Counting from the start of today, not from now, keeps an appointment earlier the
  // same morning in scope when a message goes out that evening.
  const startOfToday = new Date(`${toDateInput(new Date())}T00:00:00+06:00`);

  const [patient, clinic, settings, agg, appt] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, select: { fullName: true } }),
    prisma.documentTemplate.findFirst({ where: { docName: "Prescription" } }),
    prisma.clinicSetting.findFirst(),
    prisma.treatmentLine.aggregate({
      where: { case: { patientId } },
      _sum: { afterDiscountAmount: true, amountPaid: true },
    }),
    prisma.appointment.findFirst({
      where: { patientId, appointmentDate: { gte: startOfToday } },
      orderBy: { appointmentDate: "asc" },
    }),
  ]);

  const billed = agg._sum.afterDiscountAmount ?? 0;
  const paid = agg._sum.amountPaid ?? 0;
  const when = appt?.startsAt ?? appt?.appointmentDate ?? null;
  // Nothing booked → suggest the next day the clinic is open, so a reminder reads as
  // a sentence instead of "… তারিখ -এ …". It is a suggestion, not a booking: the
  // staff see it in the preview and can type over it.
  const date = when ?? nextOpenDay(settings?.workingDays ?? [6, 0, 1, 2, 3]);

  return {
    booked: Boolean(when),
    values: {
      name: patient?.fullName ?? "",
      clinic: clinic?.heading1 ?? "NextDent",
      phone: clinic?.heading8?.replace(/\D/g, "") ?? "",
      date: fmtDate(date),
      // Left blank deliberately when nothing is booked: a time is a promise to the
      // patient, and appointmentDate alone carries no time of day either.
      time: appt?.startsAt ? fmtTime(appt.startsAt) : "",
      total: String(billed),
      paid: String(paid),
      // a credit balance is not a due — the patient owes nothing
      due: String(Math.max(0, billed - paid)),
    },
  };
}
