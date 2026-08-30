import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeFormDocx } from "@/lib/ai/form-analysis";
import { getAiSettings } from "@/lib/ai/settings";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .docx" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกินไป (สูงสุด 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const settings = await getAiSettings();
    const result = await analyzeFormDocx(buffer, file.name);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ai_form_analyze",
        prompt: `วิเคราะห์แบบฟอร์มด้วย AI: ${file.name} (${(buffer.length / 1024).toFixed(1)} KB)`,
        modelName: settings.model,
        output: JSON.stringify({
          title: result.title,
          category: result.category,
          fieldCount: result.fields.length,
          applied: result.applied,
        }),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("form-analyze AI error:", error);
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการวิเคราะห์แบบฟอร์ม";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
