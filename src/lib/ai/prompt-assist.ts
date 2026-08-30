import "server-only";

import { generateTextWithRetry } from "@/lib/genai";
import {
  AI_PROMPT_META,
  getAiPrompt,
  type AiPromptKey,
} from "./prompts";

const PROMPT_ASSIST_TIMEOUT_MS = 180_000;
const PROMPT_ASSIST_MAX_RETRIES = 1;

export type PromptAssistMode = "adjust" | "write";

export interface PromptAssistInput {
  key: AiPromptKey;
  mode: PromptAssistMode;
  requirement: string;
}

const PROMPT_ASSIST_SYSTEM = `คุณคือ "วิศวกรออกแบบ Prompt (Prompt Engineer)" ผู้เชี่ยวชาญในการเขียนและปรับปรุง Prompt สำหรับระบบ AI ที่ปรึกษาการจัดซื้อจัดจ้างภาครัฐของไทย

หลักการทำงาน:
1. Prompt ที่เขียนต้องเป็นภาษาไทย (ยกเว้นคำสั่งทางเทคนิคที่ควรเป็นภาษาอังกฤษ) กระชับ ชัดเจน ไม่กำกวม
2. Prompt จะถูกใช้เป็น system prompt หรือ user prompt template ในฟังก์ชันของระบบ (Consult / Quotation / TOR)
3. ตัวแปร template ในรูปแบบ {{ชื่อตัวแปร}} (เช่น {{context}}, {{query}}) เป็นตัวที่ระบบจะเติมค่าจริงเข้าไป — ห้ามแก้ ลบ หรือเปลี่ยนชื่อตัวแปร ยกเว้นผู้ใช้ระบุให้เปลี่ยนอย่างชัดเจน
4. Prompt ควรกำหนดบทบาท หน้าที่ ข้อจำกัด (กฎการตอบ) ภาษาในการตอบ และการจัดการกับบริบทที่ไม่เพียงพอ
5. สำหรับ prompt ของโมเดลประเภท vision/OCR ให้สั่งให้ตอบเฉพาะ JSON ตามโครงสร้างที่กำหนด
6. ตอบเฉพาะเนื้อหา Prompt เท่านั้น ห้ามใส่คำอธิบาย คำนำ หรือสรุปเพิ่มเติม`;

function listPlaceholders(placeholders: string[]): string {
  if (placeholders.length === 0) return "ไม่มี (ระบบเติมบริบทให้อัตโนมัติ)";
  return placeholders.join(", ");
}

export async function assistPrompt(input: PromptAssistInput): Promise<string> {
  const meta = AI_PROMPT_META.find((item) => item.key === input.key);
  const placeholders = meta?.placeholders ?? [];

  const header = [
    `Prompt ที่จะใช้ในฟังก์ชัน: ${meta?.name ?? input.key}`,
    `คำอธิบายการใช้งาน: ${meta?.description ?? "—"}`,
    `ตัวแปร template ที่ระบบรองรับ (ห้ามเปลี่ยนชื่อ): ${listPlaceholders(placeholders)}`,
  ].join("\n");

  const current =
    input.mode === "adjust" ? await getAiPrompt(input.key) : "";

  const userPrompt =
    input.mode === "adjust"
      ? `${header}

ความต้องการของผู้ดูแลระบบที่อยากให้ปรับ: ${input.requirement.trim()}

Prompt ปัจจุบัน:
"""
${current}
"""

จงปรับปรุง Prompt ข้างต้นให้ตรงตามความต้องการ โดยรักษาตัวแปร {{...}} ทั้งหมดที่ระบุไว้
ตอบเฉพาะ Prompt ที่ปรับปรุงแล้วเท่านั้น`
      : `${header}

ความต้องการของผู้ดูแลระบบ (สามารถพิมพ์เป็น Prompt ที่ต้องการ หรือคำอธิบายความต้องการ):
${input.requirement.trim()}

จงเขียน Prompt ใหม่ที่สมบูรณ์ ตรงตามความต้องการ ใช้ตัวแปร {{...}} ที่ระบุไว้ข้างต้น (ถ้ามี)
ตอบเฉพาะ Prompt เท่านั้น`;

  const result = await generateTextWithRetry(
    userPrompt,
    {
      system: PROMPT_ASSIST_SYSTEM,
      temperature: 0.4,
      maxTokens: 4000,
      timeoutMs: PROMPT_ASSIST_TIMEOUT_MS,
    },
    PROMPT_ASSIST_MAX_RETRIES,
  );

  return result.trim();
}
