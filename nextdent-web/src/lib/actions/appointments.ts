"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fromDateInput } from "@/lib/format";

export type ApptFormState = { error?: string };

const str = (fd: FormData, k: string) => {
  const s = String(fd.get(k) ?? "").trim();
  return s === "" ? null : s;
};
const int = (fd: FormData, k: string) => {
  const s = str(fd, k);
  const n = s ? Number.parseInt(s, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};
/**
 * "2026-11-05" + "15:30" → the instant the clinic's own clock read that.
 *
 * `new Date("2026-11-05T15:30")` parses in the HOST's zone. That was right only for
 * as long as the host happened to be Dhaka; on a UTC machine every appointment moved
 * six hours. It must change together with `dayRange` in lib/appointments.ts, which
 * buckets the day — fixing one side alone shifts every appointment into the wrong
 * day rather than the wrong hour.
 */
const combine = (date: string | null, time: string | null) => {
  if (!date) return null;
  return fromDateInput(date, time ?? "00:00");
};

export async function saveAppointment(_prev: ApptFormState, fd: FormData): Promise<ApptFormState> {
  const user = await requireUser();

  const id = int(fd, "id");
  const patientId = int(fd, "patientId");
  const dateStr = str(fd, "appointmentDate");
  if (!patientId) return { error: "Select a patient." };
  if (!dateStr) return { error: "Pick a date." };

  const startsAt = combine(dateStr, str(fd, "startTime"));
  const endsAt = combine(dateStr, str(fd, "endTime"));
  // Both times are paired with the one date this form submits, so an end "before" the
  // start is not an overnight booking — it is an appointment stored ending ~a day
  // before it begins, which every day view and duration then reads wrong.
  if (startsAt && endsAt && +endsAt <= +startsAt) {
    return { error: "The end time must be after the start time." };
  }

  const data = {
    patientId,
    doctorId: int(fd, "doctorId"),
    allocatedUnit: str(fd, "allocatedUnit"),
    appointmentDate: combine(dateStr, null),
    startsAt,
    endsAt,
    status: str(fd, "status") ?? "PENDING",
    note: str(fd, "note"),
  };

  try {
    if (id) {
      await prisma.appointment.update({ where: { id }, data });
      await prisma.auditLog.create({ data: { actorId: user.id, entity: "appointment", entityId: String(id), action: "update" } });
    } else {
      const appt = await prisma.appointment.create({ data });
      await prisma.patientEvent.create({
        data: { patientId, eventType: "appointment", refId: appt.id, occurredAt: startsAt ?? data.appointmentDate ?? new Date(), summary: `Appointment${data.allocatedUnit ? ` (${data.allocatedUnit})` : ""}` },
      });
      await prisma.auditLog.create({ data: { actorId: user.id, entity: "appointment", entityId: String(appt.id), action: "create" } });
    }
  } catch (e) {
    console.error("saveAppointment failed", e);
    return { error: "Could not save the appointment. Please try again." };
  }

  revalidatePath("/appointments");
  redirect(`/appointments?date=${dateStr}`);
}

// quick status change from the day view
export async function setAppointmentStatus(id: number, status: string) {
  const user = await requireUser();
  await prisma.appointment.update({ where: { id }, data: { status } });
  await prisma.auditLog.create({ data: { actorId: user.id, entity: "appointment", entityId: String(id), action: "status" } });
  revalidatePath("/appointments");
}
