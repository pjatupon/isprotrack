import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditLogManager, type AuditLogSummary } from "@/components/admin/audit-log/audit-log-manager";

export const dynamic = "force-dynamic";

const LAST_24H_START = new Date(Date.now() - 24 * 60 * 60 * 1000);

export default async function AuditLogPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    redirect("/admin");
  }

  const [logs, totalLogs, uniqueUsers] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
      take: 200,
    }),
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  const recentActions = await prisma.auditLog.findMany({
    where: {
      timestamp: {
        gte: LAST_24H_START,
      },
    },
    select: { id: true },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-3 pb-2 border-b border-slate-200/80 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            AI AUDIT LOG
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            บันทึกการใช้งาน AI (Audit Log)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            ตรวจสอบการเรียกใช้ AI ทุกครั้ง เพื่อสอบทานคำถาม แหล่งอ้างอิง และคำตอบที่ AI สร้างขึ้น
          </p>
        </div>
      </div>

      <AuditLogManager
        logs={logs.map<AuditLogSummary>((log) => ({
          id: log.id,
          action: log.action,
          userName: log.user?.name ?? null,
          userEmail: log.user?.email ?? null,
          modelName: log.modelName,
          timestamp: log.timestamp.toISOString(),
        }))}
        totalLogs={totalLogs}
        uniqueUserCount={uniqueUsers.filter((u) => u.userId).length}
        last24hCount={recentActions.length}
      />
    </div>
  );
}