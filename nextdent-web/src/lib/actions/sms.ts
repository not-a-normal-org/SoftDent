"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth";
import { sendSms, renderTemplate, getSmsTemplate, normalisePhone, countSegments, smsValuesForPatient } from "@/lib/sms";

export type SmsState = { error?: string; sent?: string; savedAt?: number };

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Edit a template body. Owner only — these go out to patients under the clinic's name. */
export async function saveSmsTemplate(_prev: SmsState, fd: FormData): Promise<SmsState> {
  const user = await requireRole("OWNER");
  const id = Number(fd.get("id"));
  const body = s(fd, "body");
  if (!Number.isInteger(id)) return { error: "Missing template." };
  if (!body) return { error: "Message cannot be empty." };
  // The gateway rejects English on a masked sender ID (code 1012), so catch it here
  // rather than letting the clinic discover it on a real send.
  if (!/[ঀ-৿]/.test(body)) {
    return { error: "Message must contain Bangla — the gateway rejects English on a masked sender ID." };
  }
  try {
    await prisma.smsTemplate.update({ where: { id }, data: { body } });
    await prisma.auditLog.create({
      data: { actorId: user.id, entity: "sms-template", entityId: String(id), action: "update" },
    });
  } catch (e) {
    console.error("saveSmsTemplate failed", e);
    return { error: "Could not save the template." };
  }
  revalidatePath("/settings/sms");
  return { savedAt: Date.now() };
}

/**
 * Send one templated message to one patient. Every attempt is logged, successful or
 * not, so staff can see what actually went out.
 */
export async function sendPatientSms(_prev: SmsState, fd: FormData): Promise<SmsState> {
  await requireUser();
  const patientId = Number(fd.get("patientId"));
  const key = s(fd, "templateKey");
  if (!Number.isInteger(patientId) || !key) return { error: "Missing patient or template." };

  const [patient, template] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    getSmsTemplate(key),
  ]);
  if (!patient) return { error: "Patient not found." };
  if (!template?.body) return { error: "That template has no message yet." };

  const phone = normalisePhone(patient.primaryPhone);
  if (!phone) return { error: "This patient has no valid mobile number on file." };

  // The staff member sends the text they were shown, edits included — so a reminder
  // can carry a time that isn't booked yet. With no edit this falls back to the same
  // merge the preview used, never to the empty form fields it used to read.
  const edited = s(fd, "body");
  const body = edited ?? renderTemplate(template.body, (await smsValuesForPatient(patientId)).values);
  if (!body) return { error: "The message is empty." };
  // the gateway rejects English on a masked sender ID (code 1012)
  if (!/[ঀ-৿]/.test(body)) {
    return { error: "The message must be in Bangla — the gateway rejects English on a masked sender ID." };
  }
  if (/\{\w+\}/.test(body)) {
    return { error: "The message still has an unfilled {placeholder}." };
  }

  const res = await sendSms({ to: phone, body, patientId, templateKey: key });
  revalidatePath(`/patients/${patientId}`);
  return res.ok ? { sent: body } : { error: res.message };
}

export type SmsTestState = {
  error?: string;
  ok?: boolean;
  code?: string;
  message?: string;
  body?: string;
  segments?: number;
};

/**
 * Send a one-off message to an arbitrary number, to prove the gateway works.
 *
 * Owner only, because it spends real credit. The gateway's response code is returned
 * verbatim alongside its meaning — when this fails, the code is the whole diagnosis
 * (1007 empty balance, 1012 English on a masked sender, 1032 IP not allowlisted).
 */
export async function sendTestSms(_prev: SmsTestState, fd: FormData): Promise<SmsTestState> {
  await requireRole("OWNER");
  const to = s(fd, "to");
  const body = s(fd, "body");
  if (!to) return { error: "Enter a mobile number." };
  if (!body) return { error: "Enter a message." };

  const phone = normalisePhone(to);
  if (!phone) return { error: `"${to}" is not a valid Bangladeshi mobile number.` };
  if (!/[ঀ-৿]/.test(body)) {
    return { error: "Write the message in Bangla — the gateway rejects English on a masked sender ID (code 1012)." };
  }

  const res = await sendSms({ to: phone, body, patientId: null, templateKey: "TEST" });
  const { segments } = countSegments(body);
  revalidatePath("/settings/sms");
  return { ok: res.ok, code: res.code, message: res.message, body, segments };
}
