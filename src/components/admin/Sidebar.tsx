"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card } from "@heroui/react";
import {
  LayoutDashboard,
  Activity,
  Building2,
  Bot,
  FormInput,
  GitFork,
  Users,
  ShieldAlert,
  Sliders,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Settings2,
  MessageSquareText,
  Home,
  ScrollText,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    group: "ภาพรวม",
    items: [
      { href: "/admin", label: "แดชบอร์ด", icon: LayoutDashboard },
      { href: "/admin/activities", label: "กิจกรรมล่าสุด", icon: Activity },
    ],
  },
  {
    group: "ข้อมูลพื้นฐาน",
    items: [
      { href: "/admin/departments", label: "หน่วยงาน", icon: Building2 },
      { href: "/admin/knowledge-base", label: "คลังความรู้ AI", icon: Bot },
      { href: "/admin/form-templates", label: "คลังแบบฟอร์มเอกสาร", icon: FormInput },
      { href: "/admin/workflows", label: "ตัวสร้าง Workflow", icon: GitFork },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { href: "/admin/users", label: "ข้อมูลผู้ใช้งานระบบ", icon: Users },
      { href: "/admin/rbac", label: "จัดการ RBAC", icon: ShieldAlert },
      { href: "/admin/ai-settings", label: "ตั้งค่า AI", icon: Sparkles },
      { href: "/admin/ai-prompts", label: "ปรับแต่ง Prompt AI", icon: Settings2 },
      { href: "/admin/consult-sessions", label: "บันทึกการสนทนา AI", icon: MessageSquareText },
      { href: "/admin/audit-log", label: "บันทึกการใช้งาน AI (Audit)", icon: ScrollText },
      { href: "/admin/settings", label: "ตั้งค่าระบบ", icon: Sliders },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col justify-between border-r border-slate-200 bg-white">
      {/* Menu Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        <Link
          href="/"
          className="group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Home className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
            <span className="truncate">กลับหน้าแรก</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-400" />
        </Link>
        {navigationGroups.map((group) => (
          <div key={group.group} className="space-y-1">
            <p className="px-3 text-[0.68rem] font-bold tracking-wider text-slate-400 uppercase">
              {group.group}
            </p>
            <div className="space-y-0.5 pt-1">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-red-50 text-[#8B0000] font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {/* Active highlight bar on the left */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#8B0000]" />
                    )}

                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-[#8B0000]"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        isActive
                          ? "text-[#8B0000]"
                          : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-400"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Help Card */}
      <div className="p-3 border-t border-slate-100">
        <Card className="border border-orange-200/60 bg-[#FAF5F3] p-3.5 shadow-none rounded-xl">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-100/80 text-[#8B0000]">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800">
                ต้องการความช่วยเหลือ?
              </p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500 leading-tight">
                ติดต่อฝ่ายเทคโนโลยีสารสนเทศ คณะสหวิทยาการ
              </p>
            </div>
          </div>
        </Card>
      </div>
    </aside>
  );
}
