import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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
  if (!doc || !doc.storedName) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const publicUrl = doc.fileUrl || `/media/${doc.storedName}`;
  return NextResponse.redirect(new URL(publicUrl, request.url), 302);
}
