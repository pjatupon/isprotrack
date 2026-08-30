"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAiSettings, saveAiSettings } from "@/lib/ai/settings";
import { generateText } from "@/lib/genai";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่ตั้งค่า AI ได้");
  }
  return session.user.id;
}

function isValidBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function saveAiSettingsAction(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();

    const baseUrl = (formData.get("baseUrl") as string)?.trim();
    const apiKey = (formData.get("apiKey") as string)?.trim();
    const model = (formData.get("model") as string)?.trim();

    const updates: {
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    } = {};

    if (baseUrl) {
      if (!isValidBaseUrl(baseUrl)) {
        return { success: false, error: "Base URL ต้องเป็น URL ที่ถูกต้อง (เริ่มด้วย http/https)" };
      }
      updates.baseUrl = baseUrl.replace(/\/+$/, "");
    }
    if (apiKey) updates.apiKey = apiKey;
    if (model) updates.model = model;

    if (Object.keys(updates).length === 0) {
      return { success: false, error: "กรุณาระบุค่าที่ต้องการบันทึกอย่างน้อย 1 รายการ" };
    }

    await saveAiSettings(updates);
    revalidatePath("/admin/ai-settings");
    return { success: true, message: "บันทึกการตั้งค่า AI เรียบร้อยแล้ว" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก",
    };
  }
}

export async function testAiConnectionAction() {
  try {
    await requireAdmin();
    const settings = await getAiSettings();

    if (!settings.apiKey) {
      return { success: false, error: "ยังไม่ได้ตั้งค่า API Key กรุณาบันทึกก่อนทดสอบ" };
    }

    const answer = await generateText("ตอบเพียงคำเดียวว่า OK", {
      temperature: 0,
      maxTokens: 256,
    });

    return {
      success: true,
      message: `เชื่อมต่อสำเร็จ (Base URL: ${settings.baseUrl}, Model: ${settings.model})`,
      answer: answer.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อ AI ได้",
    };
  }
}
