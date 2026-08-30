"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  FORM_CATEGORIES,
  FORM_PLACEHOLDER_DEFS,
  FORM_TEMPLATE_ROOT,
  normalizePlaceholders,
  type FormPlaceholderDef,
} from "@/lib/ai/form-router";
import { applyPlaceholdersToDocx, validateFormPlaceholderFields, type FormPlaceholderField } from "@/lib/ai/form-analysis";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการแบบฟอร์มได้");
  }
  return session.user.id;
}

function errorResult(error: unknown) {
  return {
    success: false as const,
    error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
  };
}

function isSafeTemplatePath(candidate: string): boolean {
  const root = path.resolve(FORM_TEMPLATE_ROOT);
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(root + path.sep);
}

function defsFromKeys(keys: string[], existing?: FormPlaceholderDef[]): FormPlaceholderDef[] {
  const existingMap = new Map((existing ?? []).map((def) => [def.key, def]));
  return keys.map((key) => {
    const prev = existingMap.get(key);
    const known = FORM_PLACEHOLDER_DEFS[key];
    return (
      prev ??
      known ?? {
        key,
        label: key,
        type: "text" as const,
        required: false,
      }
    );
  });
}

export async function saveFormTemplate(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();

    const id = (formData.get("id") as string)?.trim() || undefined;
    const fileName = (formData.get("fileName") as string)?.trim();
    const category = (formData.get("category") as string)?.trim();
    const budgetMin = Number((formData.get("budgetMin") as string) ?? 0) || 0;
    const budgetMaxRaw = (formData.get("budgetMax") as string)?.trim();
    const budgetMax = budgetMaxRaw ? Number(budgetMaxRaw) : null;
    const description = (formData.get("description") as string)?.trim() || null;
    const isActive = (formData.get("isActive") as string) === "on";
    const placeholdersRaw = (formData.get("placeholders") as string)?.trim() || "";
    const placeholderDefsRaw = (formData.get("placeholderDefs") as string)?.trim();
    const file = formData.get("file") as File | null;

    if (!fileName || !category) {
      return { success: false, error: "กรุณาระบุชื่อแบบฟอร์มและหมวดหมู่" };
    }
    if (!FORM_CATEGORIES.includes(category as never)) {
      return { success: false, error: "หมวดหมู่ไม่ถูกต้อง" };
    }
    if (budgetMax !== null && budgetMax < budgetMin) {
      return { success: false, error: "วงเงินสูงสุดต้องมากกว่าหรือเท่ากับวงเงินขั้นต่ำ" };
    }

    let placeholders: FormPlaceholderDef[] | undefined;
    if (placeholderDefsRaw) {
      try {
        placeholders = validateFormPlaceholderFields(JSON.parse(placeholderDefsRaw));
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "ตัวแปร (placeholder) ไม่ถูกต้อง" };
      }
    } else if (placeholdersRaw) {
      const keys = placeholdersRaw.split(",").map((key) => key.trim()).filter(Boolean);
      let existing: FormPlaceholderDef[] | undefined;
      if (id) {
        const current = await prisma.formTemplate.findUnique({ where: { id } });
        if (current) existing = normalizePlaceholders(current.placeholders);
      }
      placeholders = defsFromKeys(keys, existing);
    }

    const placeholdersJson = placeholders ? JSON.parse(JSON.stringify(placeholders)) : undefined;

    let filePath: string | undefined;
    if (file && file.size > 0) {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        return { success: false, error: "รองรับเฉพาะไฟล์ .docx" };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: "ไฟล์ใหญ่เกินไป (สูงสุด 10MB)" };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const storedName = `${randomUUID()}.docx`;
      const target = path.join(FORM_TEMPLATE_ROOT, storedName);
      if (!isSafeTemplatePath(target)) {
        return { success: false, error: "เส้นทางไฟล์ไม่ปลอดภัย" };
      }
      await fs.mkdir(FORM_TEMPLATE_ROOT, { recursive: true });
      await fs.writeFile(target, buffer);
      filePath = storedName;
    }

    if (id) {
      const current = await prisma.formTemplate.findUnique({ where: { id } });
      if (!current) return { success: false, error: "ไม่พบแบบฟอร์ม" };
      await prisma.formTemplate.update({
        where: { id },
        data: {
          fileName,
          category,
          budgetMin,
          budgetMax,
          description,
          isActive,
          ...(placeholdersJson ? { placeholders: placeholdersJson } : {}),
          ...(filePath ? { filePath } : {}),
        },
      });
      if (filePath) {
        await fs.unlink(path.join(FORM_TEMPLATE_ROOT, path.basename(current.filePath))).catch(() => {});
      }
    } else {
      if (!filePath) {
        return { success: false, error: "กรุณาเลือกไฟล์ .docx แม่แบบ" };
      }
      await prisma.formTemplate.create({
        data: {
          fileName,
          category,
          budgetMin,
          budgetMax,
          filePath,
          placeholders: placeholdersJson ?? [],
          description,
          isActive,
        },
      });
    }

    revalidatePath("/admin/form-templates");
    return { success: true, message: `บันทึกแบบฟอร์ม "${fileName}" เรียบร้อยแล้ว` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveAiFormTemplate(prevState: unknown, formData: FormData) {
  try {
    const userId = await requireAdmin();

    const id = (formData.get("id") as string)?.trim() || undefined;
    const fileName = (formData.get("fileName") as string)?.trim();
    const category = (formData.get("category") as string)?.trim();
    const budgetMin = Number((formData.get("budgetMin") as string) ?? 0) || 0;
    const budgetMaxRaw = (formData.get("budgetMax") as string)?.trim();
    const budgetMax = budgetMaxRaw ? Number(budgetMaxRaw) : null;
    const description = (formData.get("description") as string)?.trim() || null;
    const isActive = (formData.get("isActive") as string) === "on";
    const placeholderDefsRaw = (formData.get("placeholderDefs") as string)?.trim();
    const file = formData.get("file") as File | null;

    if (!fileName || !category) {
      return { success: false, error: "กรุณาระบุชื่อแบบฟอร์มและหมวดหมู่" };
    }
    if (!FORM_CATEGORIES.includes(category as never)) {
      return { success: false, error: "หมวดหมู่ไม่ถูกต้อง" };
    }
    if (budgetMax !== null && budgetMax < budgetMin) {
      return { success: false, error: "วงเงินสูงสุดต้องมากกว่าหรือเท่ากับวงเงินขั้นต่ำ" };
    }
    if (!placeholderDefsRaw) {
      return { success: false, error: "ไม่พบตัวแปร (placeholder) ที่จะฝังลงในเอกสาร" };
    }
    if (!file || file.size === 0) {
      return { success: false, error: "กรุณาเลือกไฟล์ .docx ต้นฉบับ" };
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return { success: false, error: "รองรับเฉพาะไฟล์ .docx" };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "ไฟล์ใหญ่เกินไป (สูงสุด 10MB)" };
    }

    let fields: FormPlaceholderField[];
    try {
      fields = validateFormPlaceholderFields(JSON.parse(placeholderDefsRaw));
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "ตัวแปร (placeholder) ไม่ถูกต้อง" };
    }
    if (fields.length === 0) {
      return { success: false, error: "กรุณาระบุตัวแปรอย่างน้อย 1 ตัว" };
    }

    const sourceBuffer = Buffer.from(await file.arrayBuffer());
    const { buffer: filledBuffer, applied } = applyPlaceholdersToDocx(sourceBuffer, fields);

    const storedName = `${randomUUID()}.docx`;
    const target = path.join(FORM_TEMPLATE_ROOT, storedName);
    if (!isSafeTemplatePath(target)) {
      return { success: false, error: "เส้นทางไฟล์ไม่ปลอดภัย" };
    }
    await fs.mkdir(FORM_TEMPLATE_ROOT, { recursive: true });
    await fs.writeFile(target, filledBuffer);

    const filePath = storedName;

    if (id) {
      const current = await prisma.formTemplate.findUnique({ where: { id } });
      if (!current) return { success: false, error: "ไม่พบแบบฟอร์มที่ต้องการแก้ไข" };
      await prisma.formTemplate.update({
        where: { id },
        data: {
          fileName,
          category,
          budgetMin,
          budgetMax,
          filePath,
          placeholders: JSON.parse(JSON.stringify(fields)),
          description,
          isActive,
        },
      });
      await fs.unlink(path.join(FORM_TEMPLATE_ROOT, path.basename(current.filePath))).catch(() => {});
    } else {
      await prisma.formTemplate.create({
        data: {
          fileName,
          category,
          budgetMin,
          budgetMax,
          filePath,
          placeholders: JSON.parse(JSON.stringify(fields)),
          description,
          isActive,
        },
      });
    }

    const notApplied = fields.filter((field) => (applied[field.key] ?? 0) === 0);
    await prisma.auditLog.create({
      data: {
        userId,
        action: id ? "ai_form_template_update" : "ai_form_template_create",
        prompt: `${id ? "แก้ไข" : "สร้าง"}แบบฟอร์มจาก AI Analysis: ${fileName} (หมวด ${category})`,
        output: JSON.stringify({
          fieldCount: fields.length,
          applied,
          warnings: notApplied.map((field) => field.key),
        }),
      },
    });

    revalidatePath("/admin/form-templates");
    const warnings = notApplied.length
      ? [`ฝังตัวแปรไม่สำเร็จ ${notApplied.length} ช่อง (กรุณาตรวจสอบ matchText): ${notApplied.map((field) => field.key).join(", ")}`]
      : [];
    return { success: true, message: `บันทึกแบบฟอร์ม "${fileName}" เรียบร้อยแล้ว`, warnings };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteFormTemplate(id: string) {
  try {
    await requireAdmin();
    const template = await prisma.formTemplate.findUnique({ where: { id } });
    if (!template) return { success: false, error: "ไม่พบแบบฟอร์ม" };

    await prisma.formTemplate.delete({ where: { id } });
    await fs
      .unlink(path.join(FORM_TEMPLATE_ROOT, path.basename(template.filePath)))
      .catch(() => {});
    revalidatePath("/admin/form-templates");
    return { success: true, message: `ลบแบบฟอร์ม "${template.fileName}" เรียบร้อยแล้ว` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function toggleFormTemplate(id: string, isActive: boolean) {
  try {
    await requireAdmin();
    await prisma.formTemplate.update({
      where: { id },
      data: { isActive },
    });
    revalidatePath("/admin/form-templates");
    return { success: true, message: isActive ? "เปิดใช้งานแบบฟอร์มแล้ว" : "ปิดใช้งานแบบฟอร์มแล้ว" };
  } catch (error) {
    return errorResult(error);
  }
}
