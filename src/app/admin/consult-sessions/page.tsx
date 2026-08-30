import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConsultSessionsManager } from "./ConsultSessionsManager";

export const dynamic = "force-dynamic";

export default async function ConsultSessionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN" && role !== "STAFF") {
    redirect("/admin");
  }

  const [sessions, sessionCount, totalMessages] = await Promise.all([
    prisma.consultSession.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
      take: 200,
    }),
    prisma.consultSession.count(),
    prisma.consultMessage.count(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-3 pb-2 border-b border-slate-200/80 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            CONSULT SESSION LOG
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            บันทึกการสนทนาปรึกษา AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            ดูประวัติคำถาม-คำตอบของผู้ใช้ เพื่อนำไปปรับปรุง Prompt และการทำงานของที่ปรึกษาพัสดุ AI
          </p>
        </div>
      </div>

      <ConsultSessionsManager
        sessions={sessions.map((session) => ({
          id: session.id,
          title: session.title,
          userName: session.user.name,
          userEmail: session.user.email,
          messageCount: session._count.messages,
          updatedAt: session.updatedAt.toISOString(),
        }))}
        totalSessions={sessionCount}
        totalMessages={totalMessages}
      />
    </div>
  );
}
