import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Chip } from "@heroui/react";
import {
  FiActivity,
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiInbox,
  FiLink,
} from "react-icons/fi";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/components/appshell/nav";
import { roleLabel } from "@/components/appshell/nav";
import { ProcurementTimeline } from "@/components/tracking/ProcurementTimeline";
import { StatusDistribution } from "@/components/dashboard/StatusDistribution";

export const dynamic = "force-dynamic";

const STAFF_ROLES: UserRole[] = ["STAFF", "APPROVER", "ADMIN"];
const OPEN_STATUSES = ["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_REVISION"] as const;
const DONE_STATUSES = ["APPROVED", "COMPLETED"] as const;

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

function truncate(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}…`;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "ยื่นคำขอแล้ว",
  IN_REVIEW: "กำลังตรวจสอบ",
  NEEDS_REVISION: "ต้องแก้ไข",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const STATUS_CHIP: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  IN_REVIEW: "bg-orange-50 text-[#a64610]",
  NEEDS_REVISION: "bg-rose-50 text-rose-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  COMPLETED: "bg-teal-50 text-teal-700",
  CANCELLED: "bg-stone-100 text-stone-500",
};

const ACTION_LABEL: Record<string, string> = {
  ai_consult: "ปรึกษา AI Consult",
  ai_ocr: "สแกนใบเสนอราคา",
  ai_quotation_analyze: "วิเคราะห์ใบเสนอราคา",
  ai_tor_draft: "ร่าง TOR",
  ai_tor_review: "ตรวจ TOR",
  ai_form_analyze: "วิเคราะห์แบบฟอร์ม",
  ai_form_template_create: "สร้างแบบฟอร์ม",
  create_procurement_request: "สร้างคำขอจัดซื้อ",
  update_procurement_request: "แก้ไขคำขอจัดซื้อ",
  update_request_status: "อัปเดตสถานะคำขอ",
  save_tor_draft: "บันทึกร่าง TOR",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const user = session.user as {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    department?: string | null;
  };

  const isStaffView = STAFF_ROLES.includes(user.role);

  const [myRequests, statusGroups, activity, queueRequests] = await Promise.all([
    prisma.procurementRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.procurementRequest.groupBy({
      by: ["status"],
      where: isStaffView ? {} : { requesterId: user.id },
      _count: { _all: true },
      _sum: { budget: true },
    }),
    prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: "desc" },
      take: 5,
    }),
    isStaffView
      ? prisma.procurementRequest.findMany({
          where: { status: { in: [...OPEN_STATUSES] } },
          orderBy: { createdAt: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const statusEntries = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
    budget: Number(g._sum.budget ?? 0),
  }));

  const totalRequests = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const totalBudget = statusGroups.reduce((s, g) => s + Number(g._sum.budget ?? 0), 0);
  const openCount = statusGroups
    .filter((g) => (OPEN_STATUSES as readonly string[]).includes(g.status))
    .reduce((s, g) => s + g._count._all, 0);
  const doneCount = statusGroups
    .filter((g) => (DONE_STATUSES as readonly string[]).includes(g.status))
    .reduce((s, g) => s + g._count._all, 0);

  const scopeLabel = isStaffView ? "ในระบบทั้งหมด" : "ของคุณ";

  const metrics = [
    {
      label: `คำขอจัดซื้อ${scopeLabel}`,
      value: totalRequests.toLocaleString("en-US"),
      icon: FiFileText,
      tone: "text-blue-600 bg-blue-50",
      hint: isStaffView ? "ภาพรวมทุกหน่วยงาน" : "คำขอของคุณทั้งหมด",
    },
    {
      label: "งบประมาณรวม",
      value: `${formatBudget(totalBudget)} บาท`,
      icon: FiDollarSign,
      tone: "text-emerald-600 bg-emerald-50",
      hint: "มูลค่ารวมทุกรายการ",
    },
    {
      label: "อยู่ระหว่างดำเนินการ",
      value: openCount.toLocaleString("en-US"),
      icon: FiClock,
      tone: "text-amber-600 bg-amber-50",
      hint: isStaffView ? "รอตรวจสอบ / อนุมัติ" : "รอตรวจสอบ / อนุมัติ",
    },
    {
      label: "อนุมัติ / เสร็จสิ้น",
      value: doneCount.toLocaleString("en-US"),
      icon: FiCheckCircle,
      tone: "text-teal-600 bg-teal-50",
      hint: "ผ่านขั้นตอนเรียบร้อย",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817] uppercase">
            IS PROTROCK · {roleLabel[user.role]}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">
            ยินดีต้อนรับ, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-stone-500">
            แดชบอร์ดภาพรวมการจัดซื้อจัดจ้าง
            {user.department ? ` · ${user.department}` : ""}
          </p>
        </div>
        <Chip className="bg-orange-100 text-[#a64610] text-xs" size="sm">
          วันนี้{" "}
          {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}
        </Chip>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone, hint }) => (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" key={label}>
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={19} />
            </div>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="mt-0.5 truncate text-2xl font-bold tracking-tight text-[#272522]">{value}</p>
            <p className="mt-1 text-[0.68rem] text-stone-400">{hint}</p>
          </div>
        ))}
      </div>

      {/* Pending queue for staff / approver / admin */}
      {isStaffView && queueRequests.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiInbox className="text-amber-600" size={18} />
              <h2 className="text-sm font-bold text-[#272522]">รายการที่ต้องดำเนินการ</h2>
            </div>
            <Chip className="bg-amber-100 text-amber-800" size="sm">
              {queueRequests.length} รายการ
            </Chip>
          </div>
          <ul className="space-y-2">
            {queueRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-amber-100 bg-white px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-800">{r.title}</p>
                  <p className="text-xs text-stone-500">
                    ยื่น {formatDate(r.createdAt)} · {r.procurementType} · {formatBudget(Number(r.budget))} บาท
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIP[r.status] ?? "bg-stone-100 text-stone-600"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  <a
                    href="/requests"
                    className="flex items-center gap-1 rounded-full bg-[#e87722] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#c85f13]"
                  >
                    ตรวจสอบ <FiArrowUpRight size={13} />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main grid: status distribution + recent requests */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#272522]">สถานะคำขอจัดซื้อ</h2>
            <p className="text-xs text-stone-500">
              สัดส่วนตามสถานะ{isStaffView ? " ของทั้งระบบ" : " ของคุณ"}
            </p>
          </div>
          <StatusDistribution entries={statusEntries} />
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#272522]">
                {isStaffView ? "คำขอล่าสุดในระบบ" : "คำขอของคุณล่าสุด"}
              </h2>
              <p className="text-xs text-stone-500">รายการที่เพิ่งสร้างหรืออัปเดต</p>
            </div>
            <a
              href="/requests"
              className="flex items-center gap-1 text-xs font-bold text-[#e87722] hover:text-[#c85f13]"
            >
              ดูทั้งหมด <FiLink size={13} />
            </a>
          </div>
          {myRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-stone-400">
              <FiFileText size={22} />
              <p>ยังไม่มีคำขอจัดซื้อ ลองสร้างคำขอแรกของคุณ</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {myRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">{r.title}</p>
                    <p className="text-xs text-stone-500">
                      {formatDate(r.createdAt)} · {formatBudget(Number(r.budget))} บาท
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CHIP[r.status] ?? "bg-stone-100 text-stone-600"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Activity + Timeline */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#272522]">กิจกรรมล่าสุด</h2>
            <p className="text-xs text-stone-500">ประวัติการใช้งาน AI และการดำเนินการของคุณ</p>
          </div>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-stone-400">
              <FiActivity size={22} />
              <p>ยังไม่มีกิจกรรมในระบบ</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-50 text-[#a64610]">
                    <FiActivity size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">
                      {ACTION_LABEL[a.action] ?? a.action}
                    </p>
                    {a.prompt && <p className="truncate text-xs text-stone-500">{truncate(a.prompt, 60)}</p>}
                    <p className="mt-0.5 text-[0.68rem] text-stone-400">{formatDateTime(a.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#272522]">เส้นทางคำขอจัดซื้อ</h2>
              <p className="text-xs text-stone-500">สถานะปัจจุบันของกระบวนการจัดซื้อจัดจ้าง</p>
            </div>
            <a
              href="/requests"
              className="flex items-center gap-2 rounded-full bg-[#e87722] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#c85f13]"
            >
              สร้างคำขอใหม่ <FiArrowUpRight />
            </a>
          </div>
          <ProcurementTimeline />
        </div>
      </div>
    </div>
  );
}
