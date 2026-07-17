"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

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
const combine = (date: string | null, time: string | null) => {
  if (!date) return null;
  const d = new Date(time ? `${date}T${time}` : date);
  return isNaN(+d) ? null : d;
};

export async function saveAppointment(_prev: ApptFormState, fd: FormData): Promise<ApptFormState> {
  const user = await requireUser();

  const id = int(fd, "id");
  const patientId = int(fd, "patientId");
  const dateStr = str(fd, "appointmentDate");
  if (!patientId) return { error: "Select a patient." };
  if (!dateStr) return { error: "Pick a date." };

  const startsAt = combine(dateStr, str(fd, "startTime"));
  const data = {
    patientId,
    doctorId: int(fd, "doctorId"),
    allocatedUnit: str(fd, "allocatedUnit"),
    appointmentDate: combine(dateStr, null),
    startsAt,
    endsAt: combine(dateStr, str(fd, "endTime")),
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
