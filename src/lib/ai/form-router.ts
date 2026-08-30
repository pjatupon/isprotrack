import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { FormTemplate } from "@/generated/prisma/client";
import {
  FORM_PLACEHOLDER_DEFS,
  type FormPlaceholderDef,
} from "@/lib/ai/form-template-defs";

export { FORM_CATEGORIES, FORM_PLACEHOLDER_DEFS } from "@/lib/ai/form-template-defs";
export type { FormFieldType, FormPlaceholderDef } from "@/lib/ai/form-template-defs";

export const FORM_TEMPLATE_ROOT = path.join(process.cwd(), "public", "media", "templates");


const MATERIAL_KEYWORDS = ["วัสดุ", "เครื่องเขียน", "อุปกรณ์สำนักงาน"];
const EQUIPMENT_KEYWORDS = ["ครุภัณฑ์", "เครื่อง", "คอมพิวเตอร์", "โทรทัศน์", "เฟอร์นิเจอร์", "เครื่องใช้สำนักงาน"];
const SERVICE_KEYWORDS = ["จ้าง", "บริการ", "เหมา", "ซ่อมบำรุง", "ดูแลระบบ", "ทำความสะอาด"];
const REPAIR_KEYWORDS = ["จ้างซ่อม", "ซ่อมทรัพย์สิน", "ซ่อมครุภัณฑ์", "ซ่อมแซม"];
const MOVED_KEYWORDS = ["เคลื่อนย้าย", "ย้ายครุภัณฑ์", "ย้ายสถานที่"];
const RETURN_KEYWORDS = ["ส่งคืน", "คืนพัสดุ", "พัสดุชำรุด"];
const WITHDRAW_KEYWORDS = ["เบิกวัสดุ", "เบิกครุภัณฑ์", "ขอเบิก", "เบิก"];

export interface FormRoutingInput {
  itemType?: string;
  budget?: number;
  note?: string;
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function resolveFormCategory(input: FormRoutingInput): string {
  const itemType = input.itemType ?? "";
  const note = input.note ?? "";
  const text = `${itemType} ${note}`;

  if (includesAny(text, REPAIR_KEYWORDS)) return "จ้างซ่อมทรัพย์สิน";
  if (includesAny(text, MOVED_KEYWORDS)) return "เบิก/คืน/เคลื่อนย้าย";
  if (includesAny(text, RETURN_KEYWORDS)) return "เบิก/คืน/เคลื่อนย้าย";
  if (includesAny(text, WITHDRAW_KEYWORDS)) return "เบิก/คืน/เคลื่อนย้าย";
  if (includesAny(text, MATERIAL_KEYWORDS) && !includesAny(text, EQUIPMENT_KEYWORDS)) return "วัสดุ";
  if (includesAny(text, EQUIPMENT_KEYWORDS)) return "ครุภัณฑ์";
  if (includesAny(text, SERVICE_KEYWORDS)) return "จ้างบริการ/จ้างเหมา";
  return "ครุภัณฑ์";
}

export interface SelectedFormTemplate extends FormTemplate {
  placeholders: string[];
  placeholderDefs: FormPlaceholderDef[];
}

export function normalizePlaceholders(value: unknown): FormPlaceholderDef[] {
  if (!Array.isArray(value)) return [];
  const defs: FormPlaceholderDef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === "string") {
      const known = FORM_PLACEHOLDER_DEFS[item];
      if (known && !seen.has(known.key)) {
        defs.push(known);
        seen.add(known.key);
      }
      continue;
    }
    if (item && typeof item === "object") {
      const raw = item as Record<string, unknown>;
      const key = String(raw.key ?? "").trim();
      if (!key || seen.has(key)) continue;
      const known = FORM_PLACEHOLDER_DEFS[key];
      const type = (["text", "number", "date", "textarea"] as const).includes(raw.type as never)
        ? (raw.type as FormPlaceholderDef["type"])
        : "text";
      defs.push({
        key,
        label: String(raw.label ?? known?.label ?? key).trim() || key,
        type,
        required: raw.required === true || known?.required === true,
      });
      seen.add(key);
    }
  }
  return defs;
}

export function placeholderKeys(value: unknown): string[] {
  return normalizePlaceholders(value).map((def) => def.key);
}

export async function selectFormTemplate(
  input: FormRoutingInput,
): Promise<SelectedFormTemplate | null> {
  const category = resolveFormCategory(input);
  const budget = input.budget ?? 0;

  const templates = await prisma.formTemplate.findMany({
    where: { isActive: true, category },
    orderBy: [{ budgetMin: "asc" }, { createdAt: "desc" }],
  });

  const matched = templates.find(
    (template) =>
      budget >= template.budgetMin &&
      (template.budgetMax === null || budget <= template.budgetMax),
  );

  const toSelected = (template: FormTemplate): SelectedFormTemplate => ({
    ...template,
    placeholders: placeholderKeys(template.placeholders),
    placeholderDefs: normalizePlaceholders(template.placeholders),
  });

  if (matched) {
    return toSelected(matched);
  }

  const anyBudget = templates.find((template) => template.budgetMax === null);
  if (anyBudget) {
    return toSelected(anyBudget);
  }

  return templates.length > 0 ? toSelected(templates[0]) : null;
}

export function resolveTemplateFilePath(storedName: string): string {
  if (typeof storedName !== "string" || storedName.length === 0) {
    throw new Error("ชื่อไฟล์แม่แบบไม่ถูกต้อง");
  }
  const root = path.resolve(FORM_TEMPLATE_ROOT);
  const resolved = path.resolve(root, storedName);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("เส้นทางไฟล์แม่แบบไม่ปลอดภัย");
  }
  return resolved;
}

export async function readTemplateFile(storedName: string): Promise<Buffer> {
  return fs.readFile(resolveTemplateFilePath(storedName));
}

export function buildFilledDocx(templateBuffer: Buffer, values: Record<string, string>): Buffer {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(values);
  const buffer = doc.getZip().generate({ type: "nodebuffer" });
  return Buffer.from(buffer);
}

export function autofillValues(
  template: Pick<SelectedFormTemplate, "placeholders">,
  source: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of template.placeholders) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      result[key] = String(value);
    } else {
      result[key] = "";
    }
  }
  return result;
}

export function placeholdersToDefs(placeholders: string[] | FormPlaceholderDef[]): FormPlaceholderDef[] {
  return normalizePlaceholders(placeholders);
}
