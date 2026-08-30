"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  isAiPromptKey,
  saveAiPrompts,
  resetAiPrompt,
  type PromptUpdate,
} from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไข Prompt ได้");
  }
  return session.user.id;
}

function errorResult(error: unknown): { success: false; error: string } {
  return {
    success: false,
    error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
  };
}

export async function saveAiPromptsAction(prevState: unknown, formData: FormData) {
  try {
    const userId = await requireAdmin();

    const entries: PromptUpdate[] = [];
    for (const [key, value] of formData.entries()) {
      if (isAiPromptKey(key) && typeof value === "string") {
        entries.push({ key, value });
      }
    }

    if (entries.length === 0) {
      return { success: false, error: "ไม่พบข้อมูล Prompt ที่ต้องการบันทึก" };
    }

    const saved = await saveAiPrompts(entries);

    await prisma.auditLog.create({
      data: {
        userId,
        action: "ai_prompt.updated",
        prompt: `ปรับแต่ง Prompt AI จำนวน ${saved} รายการ`,
        output: JSON.stringify({ saved, keys: entries.map((e) => e.key) }),
      },
    });

    revalidatePath("/admin/ai-prompts");
    return { success: true, message: `บันทึก Prompt เรียบร้อย (${saved} รายการ)` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function resetAiPromptAction(key: string) {
  try {
    const userId = await requireAdmin();
    if (!isAiPromptKey(key)) {
      return { success: false, error: "Prompt key ไม่ถูกต้อง" };
    }

    await resetAiPrompt(key);

    await prisma.auditLog.create({
      data: {
        userId,
        action: "ai_prompt.reset",
        prompt: `รีเซ็ต Prompt ${key} เป็นค่าเริ่มต้น`,
        output: null,
      },
    });

    revalidatePath("/admin/ai-prompts");
    return { success: true, message: "รีเซ็ต Prompt เป็นค่าเริ่มต้นเรียบร้อย" };
  } catch (error) {
    return errorResult(error);
  }
}
