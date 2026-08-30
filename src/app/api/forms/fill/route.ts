import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readTemplateFile, buildFilledDocx, normalizePlaceholders } from "@/lib/ai/form-router";
import { downloadDocxHeader } from "@/lib/docx";

const MAX_VALUES = 500;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { templateId?: string; values?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const templateId = String(body.templateId ?? "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "ไม่พบข้อมูลแบบฟอร์ม" }, { status: 400 });
  }
  const values = (body.values ?? {}) as Record<string, unknown>;
  if (!values || typeof values !== "object" || Object.keys(values).length > MAX_VALUES) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.isActive) {
    return NextResponse.json({ error: "ไม่พบแบบฟอร์มในระบบ" }, { status: 404 });
  }

  const defs = normalizePlaceholders(template.placeholders);
  const allowedKeys = new Set(defs.map((def) => def.key));

  const fillValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!allowedKeys.has(key)) continue;
    fillValues[key] =
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value.trim()
          : String(value);
  }

  try {
    const templateBuffer = await readTemplateFile(template.filePath);
    const filled = buildFilledDocx(templateBuffer, fillValues);
    const safeName = template.fileName.replace(/[\\/:*?"<>|]/g, "_");
    const fileName = safeName.endsWith(".docx") ? safeName : `${safeName}.docx`;

    return new NextResponse(new Uint8Array(filled), {
      status: 200,
      headers: downloadDocxHeader(fileName),
    });
  } catch (error) {
    console.error("forms/fill error:", error);
    const message =
      error instanceof Error ? error.message : "ไม่สามารถสร้างไฟล์ .docx ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
