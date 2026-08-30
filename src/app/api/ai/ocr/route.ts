import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractQuotationData } from "@/lib/ai/ocr";
import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai/settings";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "ไฟล์ใหญ่เกินไป (สูงสุด 10MB)" },
      { status: 400 },
    );
  }

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "รองรับเฉพาะ PDF, JPEG, PNG และ WebP เท่านั้น" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const settings = await getAiSettings();
    const result = await extractQuotationData(buffer, file.type);

    const requestId = formData.get("requestId") as string | null;
    let savedIntakeId: string | null = null;
    if (requestId) {
      const intake = await prisma.documentIntake.create({
        data: {
          requestId,
          vendorName: result.vendorName,
          taxId: result.taxId || null,
          totalAmount: result.grandTotal,
          vatAmount: result.vatAmount || null,
          priceValidityDays: result.priceValidityDays || null,
          rawOcrJson: JSON.parse(JSON.stringify(result)),
        },
      });
      savedIntakeId = intake.id;
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ai_ocr",
        prompt: `OCR: ${file.name} (${file.type}, ${(buffer.length / 1024).toFixed(1)} KB)`,
        retrievedSources: JSON.parse(
          JSON.stringify(requestId ? [{ requestId }] : null),
        ),
        modelName: settings.model,
        output: JSON.stringify(result),
      },
    });

    return NextResponse.json({ ...result, savedIntakeId });
  } catch (error) {
    console.error("OCR AI error:", error);
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการประมวลผลเอกสาร";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
