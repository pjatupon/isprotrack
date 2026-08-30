import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assistPrompt, type PromptAssistInput } from "@/lib/ai/prompt-assist";
import { isAiPromptKey } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai/settings";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Partial<PromptAssistInput>;
  try {
    body = (await request.json()) as Partial<PromptAssistInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = body.key;
  const mode = body.mode;
  const requirement = body.requirement?.trim() ?? "";

  if (!key || !isAiPromptKey(key)) {
    return NextResponse.json({ error: "key ไม่ถูกต้อง" }, { status: 400 });
  }
  if (mode !== "adjust" && mode !== "write") {
    return NextResponse.json({ error: "mode ต้องเป็น adjust หรือ write" }, { status: 400 });
  }
  if (!requirement) {
    return NextResponse.json({ error: "กรุณาระบุความต้องการ" }, { status: 400 });
  }
  if (requirement.length > 4000) {
    return NextResponse.json(
      { error: "ความต้องการยาวเกินไป (สูงสุด 4000 ตัวอักษร)" },
      { status: 400 },
    );
  }

  try {
    const settings = await getAiSettings();
    const prompt = await assistPrompt({ key, mode, requirement });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ai_prompt.assist",
        prompt: `ช่วยปรับแต่ง Prompt ${key} (${mode})`,
        modelName: settings.model,
        output: prompt,
      },
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Prompt assist AI error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "เกิดข้อผิดพลาดในการช่วยเขียน Prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
