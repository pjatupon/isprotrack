import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function mapMessage(message: {
  id: string;
  role: string;
  content: string;
  citations: unknown;
  confidence: number | null;
  createdAt: Date;
}) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: Array.isArray(message.citations) ? message.citations : null,
    confidence: message.confidence,
    createdAt: message.createdAt.toISOString(),
  };
}

async function requireUser(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

async function getLatestSession(userId: string) {
  return prisma.consultSession.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          role: true,
          content: true,
          citations: true,
          confidence: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const userId = await requireUser(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let session = await getLatestSession(userId);
    if (!session) {
      session = await prisma.consultSession.create({
        data: { userId },
        include: {
          messages: {
            select: {
              id: true,
              role: true,
              content: true,
              citations: true,
              confidence: true,
              createdAt: true,
            },
          },
        },
      });
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        wizardState: session.wizardState,
        messages: session.messages.map(mapMessage),
      },
    });
  } catch (error) {
    console.error("Load consult session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถโหลดการสนทนาได้" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = await requireUser(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const created = await prisma.consultSession.create({ data: { userId } });
    return NextResponse.json({ sessionId: created.id });
  } catch (error) {
    console.error("Create consult session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถสร้างการสนทนาใหม่ได้" },
      { status: 500 },
    );
  }
}
