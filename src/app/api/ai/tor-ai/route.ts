import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateTorDraft, reviewTorDraft } from "@/lib/ai/tor-ai";
import type { TorDraftInput, TorReviewInput } from "@/lib/ai/tor-ai";
import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai/settings";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action: "draft" | "review"; data: TorDraftInput | TorReviewInput };
  try {
    body = (await request.json()) as {
      action: "draft" | "review";
      data: TorDraftInput | TorReviewInput;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "draft" && body.action !== "review") {
    return NextResponse.json(
      { error: "action ต้องเป็น draft หรือ review" },
      { status: 400 },
    );
  }

  try {
    const settings = await getAiSettings();

    if (body.action === "draft") {
      const input = body.data as TorDraftInput;
      const result = await generateTorDraft(input);

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ai_tor_draft",
          prompt: `ร่าง TOR: ${input.objective?.slice(0, 200) || "ไม่ระบุ"}`,
          retrievedSources: result.citations.map((c) => ({
            chunkId: c.chunkId,
            documentTitle: c.documentTitle,
            section: c.section,
            relevanceScore: c.relevanceScore,
          })),
          modelName: settings.model,
          output: JSON.stringify(result.sections),
        },
      });

      return NextResponse.json(result);
    }

    const input = body.data as TorReviewInput;
    const result = await reviewTorDraft(input);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ai_tor_review",
        prompt: `ตรวจร่าง TOR (${input.objective?.slice(0, 200) || "ไม่ระบุ"})`,
        retrievedSources: result.citations.map((c) => ({
          chunkId: c.chunkId,
          documentTitle: c.documentTitle,
          section: c.section,
          relevanceScore: c.relevanceScore,
        })),
        modelName: settings.model,
        output: JSON.stringify({
          summary: result.summary,
          issues: result.issues,
        }),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("TOR AI error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "เกิดข้อผิดพลาดในการประมวลผล TOR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
