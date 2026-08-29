import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveKnowledgeFilePath } from "@/lib/knowledge/file";
import { canManageKnowledge } from "@/lib/knowledge/policy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!canManageKnowledge(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { documentId } = await params;
  const doc = await prisma.regulationDocument.findUnique({ where: { id: documentId } });
  if (!doc || !doc.storedName || !doc.mimeType) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(resolveKnowledgeFilePath(doc.storedName));
  } catch {
    return NextResponse.json({ error: "File Missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.originalName ?? doc.title)}`,
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
