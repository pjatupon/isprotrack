"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card } from "@heroui/react";
import { ChevronRight, HelpCircle } from "lucide-react";
import { filterMenuForRole, isMenuActive, userMenuItems, type UserRole } from "./nav";

type NavGroup = {
  group: string;
  items: (typeof userMenuItems)[number][];
};

export type UserSidebarProps = {
  role: UserRole;
  onNavigate?: () => void;
};

export function UserSidebar({ role, onNavigate }: UserSidebarProps) {
  const pathname = usePathname();

  const visibleItems = filterMenuForRole(userMenuItems, role);

  const groups: NavGroup[] = (["ภาพรวม", "AI PROCUREMENT", "GOVERNANCE"] as const)
    .map((group) => ({
      group,
      items: visibleItems.filter((item) => item.group === group),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="flex h-full w-[260px] flex-col justify-between border-r border-slate-200 bg-white">
      {/* Menu Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {groups.map(({ group, items }) => (
          <div key={group} className="space-y-1">
            <p className="px-3 text-[0.68rem] font-bold tracking-wider text-slate-400 uppercase">
              {group}
            </p>
            <div className="space-y-0.5 pt-1">
              {items.map((item) => {
                const isActive = isMenuActive(item.href, pathname);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
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
                      <div className="min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.description && (
                          <span
                            className={`block truncate text-[0.68rem] ${
                              isActive ? "text-[#8B0000]/70" : "text-slate-400"
                            }`}
                          >
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.badge ? (
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold ${
                          isActive
                            ? "bg-[#8B0000] text-white"
                            : "bg-red-50 text-[#8B0000] border border-red-200"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : (
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                          isActive
                            ? "text-[#8B0000]"
                            : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-400"
                        }`}
                      />
                    )}
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
