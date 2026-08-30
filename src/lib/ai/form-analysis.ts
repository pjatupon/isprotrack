import "server-only";

import { generateTextWithRetry } from "@/lib/genai";
import { FORM_CATEGORIES } from "@/lib/ai/form-template-defs";
import {
  extractDocxText,
  applyPlaceholdersToDocx,
  validateFormPlaceholderFields,
  type FormPlaceholderField,
} from "@/lib/ai/form-docx";

export { extractDocxText, applyPlaceholdersToDocx, validateFormPlaceholderFields };
export type { FormPlaceholderField } from "@/lib/ai/form-docx";

const FORM_ANALYSIS_TIMEOUT_MS = 360_000;
const FORM_ANALYSIS_MAX_RETRIES = 3;

export interface FormAnalysisResult {
  title: string;
  category: string;
  fields: FormPlaceholderField[];
  warnings: string[];
  applied: Record<string, number>;
  documentText: string;
}

export const FORM_CATEGORY_VALUES = FORM_CATEGORIES as readonly string[];

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) {
    throw new Error("AI ไม่ได้ตอบกลับเป็น JSON ที่ถูกต้อง");
  }
  return text.slice(start, end + 1);
}

const ANALYSIS_PROMPT = (documentText: string) => `คุณเป็นผู้เชี่ยวชาญด้านเอกสารราชการไทยและแบบฟอร์มพัสดุ/การจัดซื้อจัดจ้าง
วิเคราะห์แบบฟอร์ม .docx ต่อไปนี้ แล้วระบุช่องที่ต้องกรอกข้อมูล (placeholder field) ทั้งหมด

ข้อกำหนดการตอบ:
- ตอบเป็น JSON เท่านั้น ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON
- JSON มีโครงสร้างดังนี้:
{
  "title": "ชื่อแบบฟอร์มโดยย่อ",
  "category": "หนึ่งใน ${FORM_CATEGORIES.join(" / ")}",
  "fields": [
    {
      "key": "ชื่อตัวแปรภาษาอังกฤษแบบ snake_case เช่น requesterName, department, itemDetails, quantity, budget",
      "label": "ป้ายชื่อช่องเป็นภาษาไทย เช่น ชื่อ-นามสกุลผู้ขอ",
      "type": "text | number | date | textarea",
      "required": true หรือ false (true สำหรับช่องที่จำเป็นต้องกรอก)",
      "matchText": "ข้อความในเอกสารที่ต้องการแทนที่ ต้องตรงกับตัวอักษรในเอกสารที่ให้มาทุกตัวพอดี ห้ามแต่งขึ้นเอง",
      "anchor": "replace หรือ after"
    }
  ],
  "warnings": ["ข้อความเตือนถ้ามี เช่น ช่องกรอกไม่ชัดเจน"]
}

คำอธิบาย matchText และ anchor (สำคัญมาก):
- ให้เลือก anchor เป็น "after" เป็นหลัก โดย matchText เป็นข้อความป้ายชื่อ/ข้อความกำกับที่สั้นแต่เจาะจงและปรากฏในเอกสารเพียงครั้งเดียว เช่น "2. จำนวน" "3. วงเงินงบประมาณ" "ข้าพเจ้า" "หน่วยงาน" ระบบจะเติม " {key}" ต่อท้าย matchText โดยไม่ลบป้ายชื่อเดิม
- ถ้าป้ายชื่อซ้ำกันในเอกสาร ให้เพิ่มบริบทให้ matchText ไม่ซ้ำ เช่น "2. จำนวน" แทน "จำนวน"
- เลือก anchor เป็น "replace" เฉพาะเมื่อเส้นขีด/จุด (เช่น ___, ......) ของช่องนั้นยาวไม่ซ้ำกับช่องอื่นและชัดเจนว่าเป็นช่องว่างของช่องนี้เท่านั้น ระบบจะแทนที่เส้นนั้นด้วย {key}
- matchText ต้องตรงกับตัวอักษรในเอกสารทุกตัวพอดี ห้ามเติมหรือตัดอักขระ และไม่ควรมีช่องว่างขึ้นต้น/ลงท้าย
- ห้ามใช้เส้นจุด/ขีดยาวๆ ที่เหมือนกันหลายที่ในเอกสารเป็น matchText เพราะจะทำให้แทนที่ผิดตำแหน่ง

ข้อกำหนดเพิ่มเติม:
- รวมเฉพาะช่องที่ผู้ขอ/ผู้ใช้ต้องกรอกจริง เช่น ชื่อผู้ขอ หน่วยงาน ตำแหน่ง เบอร์โทร ประเภทพัสดุ รายละเอียด จำนวน หน่วยนับ วงเงินงบประมาณ แหล่งงบประมาณ เหตุผลความจำเป็น วันที่ใช้งาน สถานที่ส่งมอบ ชื่อครุภัณฑ์ รหัสครุภัณฑ์ สถานที่ย้าย สถานที่เดิม รายละเอียดความชำรุด
- ไม่รวมหัวเรื่อง หมายเลขแบบฟอร์ม หรือข้อความกำกับทั่วไปที่ไม่ใช่ช่องกรอก
- ไม่รวมส่วนลายเซ็น/ตำแหน่งผู้อนุมัติ

ข้อความเอกสาร:
${documentText}`;

export async function analyzeFormDocx(buffer: Buffer, fileName: string): Promise<FormAnalysisResult> {
  const documentText = extractDocxText(buffer);
  if (!documentText) {
    throw new Error("ไม่พบข้อความในไฟล์ .docx");
  }

  let response: string;
  try {
    response = await generateTextWithRetry(ANALYSIS_PROMPT(documentText), {
      temperature: 0.1,
      maxTokens: 6000,
      timeoutMs: FORM_ANALYSIS_TIMEOUT_MS,
      system: "คุณตอบเป็น JSON ที่ถูกต้องเท่านั้น ตอบเป็นภาษาไทยสำหรับ label และ warnings",
    }, FORM_ANALYSIS_MAX_RETRIES);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Network error") || message.includes("fetch failed")) {
      throw new Error(
        "ไม่สามารถเชื่อมต่อกับบริการ AI ได้ชั่วคราว (เครือข่าย/API ไม่ตอบสนอง) กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
      );
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(response));
  } catch (error) {
    console.error("form-analysis JSON parse error:", error, response.slice(0, 500));
    throw new Error("AI ตอบกลับมาไม่ใช่ JSON ที่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
  }

  const result = (parsed ?? {}) as Record<string, unknown>;
  const fields = validateFormPlaceholderFields(result.fields);
  if (fields.length === 0) {
    throw new Error("AI ไม่พบช่องกรอกข้อมูลในเอกสารนี้");
  }

  const categoryRaw = String(result.category ?? "").trim();
  const category = FORM_CATEGORY_VALUES.includes(categoryRaw) ? categoryRaw : "วัสดุ";
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.map((warning) => String(warning)).filter(Boolean)
    : [];

  const { applied } = applyPlaceholdersToDocx(buffer, fields);
  const notApplied = fields.filter((field) => (applied[field.key] ?? 0) === 0);
  if (notApplied.length > 0) {
    warnings.push(
      `ไม่พบตำแหน่งของ ${notApplied.length} ช่องที่จะฝังตัวแปร: ${notApplied.map((field) => field.key).join(", ")} — กรุณาตรวจสอบ matchText`,
    );
  }

  return {
    title: String(result.title ?? fileName.replace(/\.docx$/i, "")).trim() || fileName.replace(/\.docx$/i, ""),
    category,
    fields,
    warnings,
    applied,
    documentText,
  };
}
