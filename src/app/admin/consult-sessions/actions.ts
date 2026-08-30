"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN" && role !== "STAFF") {
    throw new Error("ไม่มีสิทธิ์ดูบันทึกการสนทนา");
  }
  return session.user.id;
}

export type AdminConsultMessageView = {
  id: string;
  role: string;
  content: string;
  citations: unknown[] | null;
  confidence: number | null;
  createdAt: string;
};

export type AdminConsultSessionDetail = {
  id: string;
  title: string;
  userName: string;
  userEmail: string;
  wizardState: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  messages: AdminConsultMessageView[];
};

function errorResult(error: unknown): { success: false; error: string } {
  return {
    success: false,
    error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
  };
}

export async function getConsultSessionDetail(sessionId: string) {
  try {
    await requireAccess();

    const session = await prisma.consultSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { name: true, email: true } },
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            role: true,
            content: true,
            citations: true,
            confidence: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return { success: false, error: "ไม่พบการสนทนานี้" };
    }

    const detail: AdminConsultSessionDetail = {
      id: session.id,
      title: session.title,
      userName: session.user.name,
      userEmail: session.user.email,
      wizardState: session.wizardState as Record<string, unknown> | null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        citations:
          message.citations && Array.isArray(message.citations)
            ? (message.citations as unknown[] as unknown[])
            : null,
        confidence: message.confidence,
        createdAt: message.createdAt.toISOString(),
      })),
    };

    return { success: true, session: detail };
  } catch (error) {
    return errorResult(error);
  }
}
