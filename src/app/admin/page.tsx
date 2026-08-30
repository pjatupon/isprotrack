import React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  Activity,
  Bot,
  BookOpen,
  Building2,
  FileText,
  FormInput,
  MessageSquareText,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/StatCard";
import { StatusDistribution } from "@/components/dashboard/StatusDistribution";

export const dynamic = "force-dynamic";

function formatBudget(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function truncate(text: string | null, max: number): string {
  if (!text) return "—";
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}…`;
}

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  ai_consult: { label: "AI Consult ปรึกษาระเบียบ", color: "bg-violet-50 text-violet-700" },
  ai_ocr: { label: "สแกนใบเสนอราคา (OCR)", color: "bg-blue-50 text-blue-700" },
  ai_quotation_analyze: { label: "วิเคราะห์ใบเสนอราคา", color: "bg-blue-50 text-blue-700" },
  ai_tor_draft: { label: "ร่าง TOR ด้วย AI", color: "bg-orange-50 text-orange-700" },
  ai_tor_review: { label: "ตรวจ TOR", color: "bg-orange-50 text-orange-700" },
  ai_form_analyze: { label: "วิเคราะห์แบบฟอร์ม", color: "bg-teal-50 text-teal-700" },
  ai_form_template_create: { label: "สร้างแบบฟอร์ม AI", color: "bg-teal-50 text-teal-700" },
  ai_form_template_update: { label: "แก้ไขแบบฟอร์ม AI", color: "bg-teal-50 text-teal-700" },
  create_procurement_request: { label: "สร้างคำขอจัดซื้อ", color: "bg-emerald-50 text-emerald-700" },
  update_request_status: { label: "อัปเดตสถานะคำขอ", color: "bg-emerald-50 text-emerald-700" },
  save_tor_draft: { label: "บันทึกร่าง TOR", color: "bg-orange-50 text-orange-700" },
  create_regulation_document: { label: "เพิ่มเอกสารระเบียบ", color: "bg-slate-100 text-slate-600" },
  "knowledge.document.uploaded": { label: "อัปโหลดเอกสารความรู้", color: "bg-slate-100 text-slate-600" },
  "knowledge.document.processed": { label: "ประมวลผลเอกสารความรู้", color: "bg-slate-100 text-slate-600" },
};

const DONE_STATUSES = ["APPROVED", "COMPLETED", "CANCELLED", "REJECTED"] as const;

export default async function AdminDashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN" && role !== "STAFF") redirect("/");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    userGroups,
    requestGroups,
    departments,
    regulationGroups,
    categories,
    chunkCount,
    templateCount,
    consultSessions,
    consultMessages,
    intakeCount,
    torDraftCount,
    auditTotal,
    auditRecent,
    auditActions,
    recentLogs,
    allRequests,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.procurementRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { budget: true },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, _count: { select: { users: true } } },
    }),
    prisma.regulationDocument.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.knowledgeCategory.count({ where: { isActive: true } }),
    prisma.regulationChunk.count(),
    prisma.formTemplate.count({ where: { isActive: true } }),
    prisma.consultSession.count(),
    prisma.consultMessage.count(),
    prisma.documentIntake.count(),
    prisma.torDraft.count(),
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { timestamp: { gte: sevenDaysAgo } } }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 8,
      include: { user: { select: { name: true, role: true } } },
    }),
    prisma.procurementRequest.findMany({
      include: { requester: { select: { department: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const totalUsers = userGroups.reduce((s, g) => s + g._count._all, 0);
  const totalRequests = requestGroups.reduce((s, g) => s + g._count._all, 0);
  const totalBudget = requestGroups.reduce((s, g) => s + Number(g._sum.budget ?? 0), 0);
  const activeRequests = requestGroups
    .filter((g) => !(DONE_STATUSES as readonly string[]).includes(g.status))
    .reduce((s, g) => s + g._count._all, 0);
  const totalRegDocs = regulationGroups.reduce((s, g) => s + g._count._all, 0);
  const completedRequests = requestGroups
    .filter((g) => g.status === "COMPLETED")
    .reduce((s, g) => s + g._count._all, 0);
  const completionRate =
    totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;

  const statusEntries = requestGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
    budget: Number(g._sum.budget ?? 0),
  }));

  // Requests grouped by department
  const deptStats = new Map<string, { count: number; budget: number }>();
  for (const r of allRequests) {
    const name = r.requester?.department ?? "ไม่ระบุหน่วยงาน";
    const cur = deptStats.get(name) ?? { count: 0, budget: 0 };
    cur.count += 1;
    cur.budget += Number(r.budget);
    deptStats.set(name, cur);
  }
  const deptStatsSorted = [...deptStats.entries()].sort((a, b) => b[1].budget - a[1].budget);
  const maxDeptBudget = deptStatsSorted.length > 0 ? deptStatsSorted[0][1].budget : 1;

  // AI usage breakdown (top actions)
  const topAiActions = auditActions
    .filter((a) => a.action.startsWith("ai_"))
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 6);

  const aiTotal = auditActions
    .filter((a) => a.action.startsWith("ai_"))
    .reduce((s, a) => s + a._count._all, 0);

  const roleMeta: Record<string, { label: string; color: string }> = {
    ADMIN: { label: "ผู้ดูแลระบบ", color: "bg-red-50 text-[#8B0000]" },
    STAFF: { label: "เจ้าหน้าที่พัสดุ", color: "bg-amber-50 text-amber-700" },
    APPROVER: { label: "ผู้อนุมัติ", color: "bg-blue-50 text-blue-700" },
    REQUESTER: { label: "ผู้ขอจัดซื้อ", color: "bg-emerald-50 text-emerald-700" },
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            ADMINISTRATION CENTER
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">ภาพรวมระบบ</h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            ข้อมูลภาพรวมครอบคลุมทุกโมดูลของระบบ I-Smart ProTrack
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            อัปเดตล่าสุด {formatDate(new Date())}
          </span>
        </div>
      </div>

      {/* 2. Primary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <StatCard
          title="ผู้ใช้งานทั้งหมด"
          value={totalUsers.toLocaleString("en-US")}
          description={`อัตราสำเร็จคำขอ ${completionRate}% · ${totalRequests} คำขอในระบบ`}
          icon={Users}
          iconBgColor="bg-red-50"
          iconTextColor="text-[#8B0000]"
          borderColor="border-l-4 border-l-[#8B0000]"
          descriptionColor="text-[#8B0000]"
        />
        <StatCard
          title="หน่วยงานในระบบ"
          value={departments.length.toLocaleString("en-US")}
          description="สังกัดหลักและหน่วยงานย่อยที่ใช้งานอยู่"
          icon={Building2}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          borderColor="border-l-4 border-l-amber-500"
        />
        <StatCard
          title="คำขอจัดซื้อทั้งหมด"
          value={totalRequests.toLocaleString("en-US")}
          description={`อยู่ระหว่างดำเนินการ ${activeRequests} รายการ`}
          icon={FileText}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          borderColor="border-l-4 border-l-blue-500"
        />
        <StatCard
          title="งบประมาณรวม"
          value={`${formatBudget(totalBudget)} บาท`}
          description="มูลค่ารวมทุกคำขอจัดซื้อในระบบ"
          icon={Wallet}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          borderColor="border-l-4 border-l-emerald-500"
        />
        <StatCard
          title="คลังความรู้ AI"
          value={totalRegDocs.toLocaleString("en-US")}
          description={`${categories} หมวด · ${chunkCount.toLocaleString("en-US")} chunks`}
          icon={BookOpen}
          iconBgColor="bg-violet-50"
          iconTextColor="text-violet-600"
          borderColor="border-l-4 border-l-violet-500"
        />
        <StatCard
          title="แบบฟอร์ม + การสนทนา AI"
          value={(templateCount + consultSessions).toLocaleString("en-US")}
          description={`${templateCount} แบบฟอร์ม · ${consultSessions} สนทนา AI`}
          icon={FormInput}
          iconBgColor="bg-teal-50"
          iconTextColor="text-teal-600"
          borderColor="border-l-4 border-l-teal-500"
        />
      </div>

      {/* 3. Status Distribution + AI Usage */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800">สัดส่วนสถานะคำขอจัดซื้อ</h2>
            <p className="text-xs text-slate-500">แจกแจงคำขอตามสถานะและงบประมาณ</p>
          </div>
          <StatusDistribution entries={statusEntries} />
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">การใช้งานโมดูล AI</h2>
              <p className="text-xs text-slate-500">จำนวนครั้งที่ระบบ AI ถูกเรียกใช้</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <Bot className="h-3.5 w-3.5" /> {aiTotal} ครั้ง
            </span>
          </div>
          {topAiActions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลการใช้งาน AI</p>
          ) : (
            <ul className="space-y-3">
              {topAiActions.map((a) => {
                const meta = ACTION_LABEL[a.action] ?? { label: a.action, color: "bg-slate-100 text-slate-600" };
                const pct = aiTotal > 0 ? Math.round((a._count._all / aiTotal) * 100) : 0;
                return (
                  <li key={a.action} className="flex items-center gap-3">
                    <span className={`w-44 shrink-0 truncate rounded-full px-2.5 py-1 text-xs font-semibold ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#8B0000]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-700">
                      {a._count._all}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
              ผู้ใช้งานจำแนกตามบทบาท
            </h3>
            <div className="flex flex-wrap gap-2">
              {userGroups.map((g) => {
                const meta = roleMeta[g.role] ?? { label: g.role, color: "bg-slate-100 text-slate-600" };
                return (
                  <span key={g.role} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                    {meta.label}
                    <b>{g._count._all}</b>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Department budget + System inventory */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
          <h2 className="mb-1 text-base font-bold text-slate-800">งบประมาณคำขอตามหน่วยงาน</h2>
          <p className="mb-4 text-xs text-slate-500">หน่วยงานที่มีคำขอจัดซื้อสูงสุด</p>
          {deptStatsSorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลคำขอ</p>
          ) : (
            <ul className="space-y-3">
              {deptStatsSorted.slice(0, 6).map(([name, stats]) => (
                <li key={name} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-xs font-medium text-slate-600">{name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8B0000] to-[#c24a3a]"
                      style={{ width: `${Math.max(4, (stats.budget / maxDeptBudget) * 100)}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 truncate text-right text-xs font-bold text-slate-700">
                    {formatBudget(stats.budget)} บาท
                    <span className="ml-1 font-medium text-slate-400">({stats.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
          <h2 className="mb-1 text-base font-bold text-slate-800">ความครอบคลุมข้อมูลทั้งระบบ</h2>
          <p className="mb-4 text-xs text-slate-500">ภาพรวมข้อมูลในแต่ละโมดูลของโครงการ</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <FileText className="mb-2 h-5 w-5 text-blue-600" />
              <p className="text-2xl font-black text-slate-800">{totalRequests}</p>
              <p className="text-xs font-medium text-slate-500">คำขอจัดซื้อ</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <Activity className="mb-2 h-5 w-5 text-emerald-600" />
              <p className="text-2xl font-black text-slate-800">{intakeCount}</p>
              <p className="text-xs font-medium text-slate-500">ใบเสนอราคาที่ตรวจ</p>
            </div>
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
              <FileText className="mb-2 h-5 w-5 text-orange-600" />
              <p className="text-2xl font-black text-slate-800">{torDraftCount}</p>
              <p className="text-xs font-medium text-slate-500">ร่าง TOR ทั้งหมด</p>
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
              <FormInput className="mb-2 h-5 w-5 text-teal-600" />
              <p className="text-2xl font-black text-slate-800">{templateCount}</p>
              <p className="text-xs font-medium text-slate-500">แบบฟอร์มราชการ</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
              <Bot className="mb-2 h-5 w-5 text-violet-600" />
              <p className="text-2xl font-black text-slate-800">{totalRegDocs}</p>
              <p className="text-xs font-medium text-slate-500">เอกสารคลังความรู้</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
              <MessageSquareText className="mb-2 h-5 w-5 text-rose-600" />
              <p className="text-2xl font-black text-slate-800">{consultSessions}</p>
              <p className="text-xs font-medium text-slate-500">
                สนทนา AI · {consultMessages} ข้อความ
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-xs font-medium text-slate-500">Audit Log ทั้งหมด</span>
              <span className="text-base font-black text-slate-800">{auditTotal.toLocaleString("en-US")}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-xs font-medium text-slate-500">การใช้งาน 7 วันล่าสุด</span>
              <span className="text-base font-black text-[#8B0000]">{auditRecent.toLocaleString("en-US")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Recent Activity */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">กิจกรรมล่าสุด</h2>
            <p className="text-xs text-slate-500">เหตุการณ์ล่าสุดที่บันทึกลง Audit Log</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <ScrollText className="h-3.5 w-3.5" /> {recentLogs.length} รายการ
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {recentLogs.map((log) => {
            const meta = ACTION_LABEL[log.action] ?? { label: log.action, color: "bg-slate-100 text-slate-600" };
            return (
              <li key={log.id} className="flex items-center gap-3 py-3">
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${meta.color}`}>
                  {meta.label}
                </span>
                <p className="min-w-0 flex-1 truncate text-xs text-slate-600">
                  {log.prompt ? truncate(log.prompt, 70) : log.output ? truncate(log.output, 70) : "—"}
                </p>
                <span className="shrink-0 text-xs font-medium text-slate-500">{log.user?.name ?? "ระบบ"}</span>
                <span className="shrink-0 text-[0.68rem] text-slate-400">{formatDateTime(log.timestamp)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
