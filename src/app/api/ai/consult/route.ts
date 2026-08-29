import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateEmbedding, searchRegulations, consultProcurement } from "@/lib/ai/rag";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { query: string };
  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const queryVector = await generateEmbedding(body.query.trim());
  const relevantChunks = await searchRegulations(queryVector, 5);
  const result = await consultProcurement(body.query.trim(), relevantChunks);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ai_consult",
      prompt: body.query.trim(),
      retrievedSources: relevantChunks.map((c) => ({
        chunkId: c.id,
        documentTitle: c.documentTitle,
        section: c.section,
        score: c.score,
      })),
      modelName: "gemini-2.5-flash",
      output: result.answer,
    },
  });

  return NextResponse.json(result);
}