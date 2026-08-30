import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeQuotation } from "@/lib/ai/quotation-analysis";
import type { QuotationExtract } from "@/lib/ai/ocr";
import { prisma } from "@/lib/prisma";
import { getAiSettings } from "@/lib/ai/settings";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { quotation: QuotationExtract; objective?: string };
  try {
    body = (await request.json()) as {
      quotation: QuotationExtract;
      objective?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.quotation || typeof body.quotation !== "object") {
    return NextResponse.json(
      { error: "quotation data is required" },
      { status: 400 },
    );
  }

  try {
    const settings = await getAiSettings();
    const result = await analyzeQuotation({
      quotation: body.quotation,
      objective: body.objective,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ai_quotation_analyze",
        prompt: `วิเคราะห์ใบเสนอราคา: ${body.quotation.vendorName || "ไม่ระบุผู้ขาย"} วงเงิน ${Number(body.quotation.grandTotal ?? 0)} บาท`,
        retrievedSources: result.citations.map((c) => ({
          chunkId: c.chunkId,
          documentTitle: c.documentTitle,
          section: c.section,
          relevanceScore: c.relevanceScore,
        })),
        modelName: settings.model,
        output: result.analysis,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Quotation analysis AI error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "เกิดข้อผิดพลาดในการวิเคราะห์ใบเสนอราคา";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
