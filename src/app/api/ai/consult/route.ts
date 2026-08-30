import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { retrieveRelevantChunks, consultProcurement, type ConsultHistoryItem, type ConsultImageInput } from "@/lib/ai/rag";
import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai/settings";
import type { Prisma } from "@/generated/prisma/client";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BASE64_LENGTH = 8_000_000; // ~6MB decoded

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    query: string;
    history?: ConsultHistoryItem[];
    sessionId?: string;
    image?: { base64: string; mimeType: string };
  };
  try {
    body = (await request.json()) as {
      query: string;
      history?: ConsultHistoryItem[];
      sessionId?: string;
      image?: { base64: string; mimeType: string };
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let image: ConsultImageInput | undefined;
  if (body.image) {
    const { base64, mimeType } = body.image;
    if (typeof base64 !== "string" || typeof mimeType !== "string" || !base64.trim()) {
      return NextResponse.json({ error: "รูปภาพไม่ถูกต้อง" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WEBP" },
        { status: 400 },
      );
    }
    if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "ไฟล์รูปภาพมีขนาดใหญ่เกินไป (จำกัดไม่เกิน 6MB)" },
        { status: 400 },
      );
    }
    image = { base64, mimeType };
  }

  const trimmedQuery = body.query?.trim() ?? "";
  if (!trimmedQuery && !image) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const effectiveQuery =
    trimmedQuery || "โปรดวิเคราะห์รูปภาพวัสดุ/อุปกรณ์ที่แนบมา และแนะนำวิธีการจัดซื้อจัดจ้างที่เหมาะสม";

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (item) =>
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.trim(),
        )
        .map((item) => ({ role: item.role, content: item.content.trim() }))
        .slice(-20)
    : undefined;

  try {
    // Resolve or create a session owned by the current user.
    let sessionId = body.sessionId;
    if (sessionId) {
      const existing = await prisma.consultSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
        select: { id: true, title: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "ไม่พบการสนทนานี้" }, { status: 404 });
      }
    } else {
      const created = await prisma.consultSession.create({
        data: {
          userId: session.user.id,
          title: effectiveQuery.slice(0, 80),
        },
      });
      sessionId = created.id;
    }

    // Record the user message before calling AI so the question is never lost.
    const userMessageContent = image
      ? `${trimmedQuery ? `${trimmedQuery}\n` : ""}[แนบรูปภาพวัสดุ/อุปกรณ์ 1 ไฟล์]`
      : trimmedQuery;
    await prisma.consultMessage.create({
      data: {
        sessionId,
        role: "user",
        content: userMessageContent,
        createdAt: new Date(),
      },
    });

    const settings = await getAiSettings();
    const relevantChunks = await retrieveRelevantChunks(effectiveQuery, {}, 6);
    const result = await consultProcurement(effectiveQuery, relevantChunks, history, image);

    // Record the assistant answer with citations + confidence.
    await prisma.consultMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: result.answer,
        citations: result.citations as unknown as Prisma.InputJsonValue,
        confidence: result.confidenceScore,
        createdAt: new Date(),
      },
    });

    await prisma.consultSession.update({
      where: { id: sessionId },
      data: {
        title: effectiveQuery.slice(0, 80),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ai_consult",
        prompt: effectiveQuery,
        retrievedSources: relevantChunks.map((c) => ({
          chunkId: c.id,
          documentTitle: c.documentTitle,
          section: c.section,
          score: c.score,
        })),
        modelName: settings.model,
        output: result.answer,
      },
    });

    return NextResponse.json({ ...result, sessionId });
  } catch (error) {
    console.error("Consult AI error:", error);
    const message =
      error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการประมวลผลคำปรึกษา";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
