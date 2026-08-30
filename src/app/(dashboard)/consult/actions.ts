"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  selectFormTemplate,
  readTemplateFile,
  buildFilledDocx,
  autofillValues,
  placeholderKeys,
  resolveFormCategory,
  type FormPlaceholderDef,
} from "@/lib/ai/form-router";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  return session;
}

export type SelectFormResult = {
  success: boolean;
  error?: string;
  template?: {
    id: string;
    fileName: string;
    category: string;
    filePath: string;
    description: string | null;
    placeholders: FormPlaceholderDef[];
  };
};

export async function selectFormForConsult(prevState: unknown, formData: FormData) {
  try {
    await requireSession();
    const itemType = (formData.get("itemType") as string)?.trim() ?? "";
    const budgetRaw = (formData.get("budget") as string)?.trim() ?? "";
    const note = (formData.get("note") as string)?.trim() ?? "";
    const budget = budgetRaw ? Number(budgetRaw) : 0;

    if (!itemType) {
      return { success: false, error: "กรุณาระบุประเภทพัสดุ/งานก่อน" };
    }

    const template = await selectFormTemplate({ itemType, budget, note });
    if (!template) {
      return {
        success: false,
        error: `ไม่พบแบบฟอร์มที่ตรงกับหมวด "${resolveFormCategory({ itemType, budget, note })}" ในคลังแบบฟอร์ม กรุณาติดต่อเจ้าหน้าที่พัสดุ`,
      };
    }

    return {
      success: true,
      template: {
        id: template.id,
        fileName: template.fileName,
        category: template.category,
        filePath: template.filePath,
        description: template.description,
        placeholders: template.placeholderDefs,
      },
    } satisfies SelectFormResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการเลือกแบบฟอร์ม",
    };
  }
}

export type FillDocxResult = {
  success: boolean;
  error?: string;
  fileName?: string;
  base64?: string;
};

export async function fillAndDownloadDocx(prevState: unknown, formData: FormData) {
  try {
    await requireSession();
    const templateId = (formData.get("templateId") as string)?.trim();
    if (!templateId) {
      return { success: false, error: "ไม่พบข้อมูลแบบฟอร์ม" };
    }

    const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      return { success: false, error: "ไม่พบแบบฟอร์มในระบบ" };
    }

    const values: Record<string, string> = {};
    const keys = placeholderKeys(template.placeholders);
    for (const key of keys) {
      const raw = formData.get(key);
      if (raw && typeof raw === "string") {
        values[key] = raw.trim();
      } else {
        values[key] = "";
      }
    }

    const templateBuffer = await readTemplateFile(template.filePath);
    const templateWithKeys = {
      ...template,
      placeholders: keys,
    };
    const filled = buildFilledDocx(templateBuffer, autofillValues(templateWithKeys, values));
    const base64 = filled.toString("base64");
    const safeName = template.fileName.replace(/[\\/:*?"<>|]/g, "_");

    return { success: true, fileName: `${safeName}.docx`, base64 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "ไม่สามารถสร้างไฟล์ .docx ได้",
    };
  }
}

export type SubmitConsultResult = {
  success: boolean;
  error?: string;
  requestId?: string;
};

export async function submitConsultRequest(prevState: unknown, formData: FormData) {
  try {
    const session = await requireSession();
    const title = (formData.get("title") as string)?.trim();
    const objective = (formData.get("objective") as string)?.trim();
    const budgetRaw = (formData.get("budget") as string)?.trim();
    const budgetSource = (formData.get("budgetSource") as string)?.trim() || null;
    const procurementType = (formData.get("procurementType") as string)?.trim() || "ซื้อพัสดุ";
    const itemType = (formData.get("itemType") as string)?.trim() ?? "";

    if (!title || !objective || !budgetRaw) {
      return { success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
    }
    const budget = Number(budgetRaw);
    if (isNaN(budget) || budget <= 0) {
      return { success: false, error: "กรุณาระบุวงเงินงบประมาณที่ถูกต้อง" };
    }

    const request = await prisma.procurementRequest.create({
      data: {
        title,
        objective,
        budget,
        budgetSource,
        procurementType,
        procurementMethod:
          budget <= 500000
            ? "เฉพาะเจาะจง"
            : budget <= 2000000
              ? "ประกวดราคาแบบ e-Market"
              : "ประกวดราคาอิเล็กทรอนิกส์ (e-Bidding)",
        requesterId: session.user.id,
      },
    });

    if (itemType) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "consult_form_submit",
          prompt: `ส่งคำขอจากหน้าปรึกษา: ${itemType} วงเงิน ${budget} บาท`,
          output: request.id,
        },
      });
    }

    return { success: true, requestId: request.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งคำขอ",
    };
  }
}

// ---------- Chat Session Persistence ----------

export type ConsultSessionMessageView = {
  id: string;
  role: string;
  content: string;
  citations: unknown[] | null;
  confidence: number | null;
  createdAt: string;
};

export type ConsultSessionView = {
  id: string;
  title: string;
  wizardState: Record<string, unknown> | null;
  messages: ConsultSessionMessageView[];
};

function mapMessage(message: {
  id: string;
  role: string;
  content: string;
  citations: Prisma.JsonValue | null;
  confidence: number | null;
  createdAt: Date;
}): ConsultSessionMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: message.citations && typeof message.citations === "object" && Array.isArray(message.citations)
      ? (message.citations as unknown[] as unknown[])
      : null,
    confidence: message.confidence,
    createdAt: message.createdAt.toISOString(),
  };
}

export type GetOrCreateSessionResult =
  | { success: true; session: ConsultSessionView }
  | { success: false; error: string };

export async function getOrCreateConsultSession(): Promise<GetOrCreateSessionResult> {
  try {
    const session = await requireSession();

    const existing = await prisma.consultSession.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, role: true, content: true, citations: true, confidence: true, createdAt: true },
        },
      },
    });

    if (existing) {
      return {
        success: true,
        session: {
          id: existing.id,
          title: existing.title,
          wizardState: existing.wizardState as Record<string, unknown> | null,
          messages: existing.messages.map(mapMessage),
        },
      };
    }

    const created = await prisma.consultSession.create({
      data: { userId: session.user.id },
    });

    return {
      success: true,
      session: { id: created.id, title: created.title, wizardState: null, messages: [] },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการโหลดการสนทนา",
    };
  }
}

export type SaveSessionStateResult = { success: boolean; error?: string };

export async function saveConsultSessionState(
  sessionId: string,
  wizardState: Record<string, unknown> | null,
  title?: string,
): Promise<SaveSessionStateResult> {
  try {
    const session = await requireSession();
    const target = await prisma.consultSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
      select: { id: true, title: true },
    });
    if (!target) {
      return { success: false, error: "ไม่พบการสนทนานี้" };
    }

    const nextTitle = title?.trim() || target.title;
    await prisma.consultSession.update({
      where: { id: sessionId },
      data: {
        title: nextTitle,
        wizardState:
          wizardState === null
            ? Prisma.JsonNull
            : (wizardState as Prisma.InputJsonValue),
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกสถานะ",
    };
  }
}

export async function appendConsultMessages(
  sessionId: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<SaveSessionStateResult> {
  try {
    const session = await requireSession();
    const target = await prisma.consultSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
      select: { id: true },
    });
    if (!target) {
      return { success: false, error: "ไม่พบการสนทนานี้" };
    }

    const now = Date.now();
    await prisma.consultMessage.createMany({
      data: messages.map((message, index) => ({
        sessionId,
        role: message.role,
        content: message.content,
        createdAt: new Date(now + index),
      })),
    });
    await prisma.consultSession.update({ where: { id: sessionId }, data: {} });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกข้อความ",
    };
  }
}

export type CreateNewSessionResult = { success: true; sessionId: string } | { success: false; error: string };

export async function createNewConsultSession(): Promise<CreateNewSessionResult> {
  try {
    const session = await requireSession();
    const created = await prisma.consultSession.create({
      data: { userId: session.user.id },
    });
    return { success: true, sessionId: created.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการสร้างการสนทนาใหม่",
    };
  }
}
