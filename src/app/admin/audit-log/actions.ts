"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่เข้าถึงบันทึกการใช้งาน AI ได้");
  }
  return session.user.id;
}

export type AdminAuditLogSummary = {
  id: string;
  action: string;
  userName: string | null;
  userEmail: string | null;
  modelName: string | null;
  timestamp: string;
};

export type AdminAuditLogDetail = {
  id: string;
  action: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  prompt: string | null;
  retrievedSources: Array<Record<string, unknown>> | null;
  modelName: string | null;
  output: string | null;
  timestamp: string;
};

function errorResult(error: unknown): { success: false; error: string } {
  return {
    success: false,
    error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
  };
}

function normalizeSources(value: unknown): Array<Record<string, unknown>> | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    );
  }
  return null;
}

export async function getAuditLogDetail(logId: string) {
  try {
    await requireAdmin();

    const log = await prisma.auditLog.findUnique({
      where: { id: logId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!log) {
      return { success: false, error: "ไม่พบบันทึกนี้" };
    }

    const detail: AdminAuditLogDetail = {
      id: log.id,
      action: log.action,
      userId: log.userId,
      userName: log.user?.name ?? null,
      userEmail: log.user?.email ?? null,
      prompt: log.prompt,
      retrievedSources: normalizeSources(log.retrievedSources),
      modelName: log.modelName,
      output: log.output,
      timestamp: log.timestamp.toISOString(),
    };

    return { success: true, log: detail };
  } catch (error) {
    return errorResult(error);
  }
}