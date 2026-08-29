"use client";

import { Button, Chip, Tooltip } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FiBookOpen, FiChevronLeft, FiClipboard, FiFileText, FiLogOut, FiMenu, FiMessageCircle, FiPenTool, FiShield, FiX } from "react-icons/fi";
import { authClient } from "@/lib/auth-client";

type Role = "REQUESTER" | "STAFF" | "APPROVER" | "ADMIN";

type DashboardShellProps = {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: Role;
    department?: string | null;
  };
};

const menuItems = [
  { href: "/dashboard", label: "AI Consult", description: "ปรึกษาความต้องการ", icon: FiMessageCircle },
  { href: "/dashboard/quotations", label: "Quotation Inspector", description: "ตรวจใบเสนอราคา", icon: FiFileText },
  { href: "/dashboard/tor", label: "TOR Generator", description: "ช่วยร่าง TOR", icon: FiPenTool },
  { href: "/dashboard/tracking", label: "Request Tracking", description: "ติดตามสถานะคำขอ", icon: FiClipboard },
  { href: "/staff/regulations", label: "Regulation Hub", description: "จัดการระเบียบพัสดุ", icon: FiBookOpen, roles: ["STAFF", "ADMIN"] },
  { href: "/admin/audit-log", label: "Audit Log", description: "ประวัติการดำเนินการ", icon: FiShield, roles: ["ADMIN"] },
] as const;

const roleLabel: Record<Role, string> = {
  REQUESTER: "ผู้ขอจัดซื้อ",
  STAFF: "เจ้าหน้าที่",
  APPROVER: "ผู้อนุมัติ",
  ADMIN: "ผู้ดูแลระบบ",
};

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = menuItems.filter((item) => !item.roles || item.roles.includes(user.role));

  function logout() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  const navigation = (
    <nav className="flex h-full flex-col" aria-label="เมนูหลัก">
      <div className="border-b border-white/10 px-5 py-6">
        <Link className="flex items-center gap-3" href="/dashboard" onClick={() => setMenuOpen(false)}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e87722] text-sm font-black text-white">IS</span>
          <span>
            <span className="block text-sm font-bold tracking-[0.14em] text-white">PROTRACK</span>
            <span className="block text-xs text-stone-400">SIS · KKU</span>
          </span>
        </Link>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[0.68rem] font-bold tracking-[0.16em] text-stone-500">WORKSPACE</p>
        {visibleItems.map(({ href, label, description, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <Tooltip key={href} delay={400}>
              <Tooltip.Trigger>
                <Link
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${active ? "bg-[#e87722] text-white shadow-lg shadow-orange-950/20" : "text-stone-300 hover:bg-white/10 hover:text-white"}`}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon className="shrink-0" size={18} />
                  <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className={`block truncate text-xs ${active ? "text-orange-100" : "text-stone-500"}`}>{description}</span></span>
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Content>{description}</Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>
      <div className="border-t border-white/10 p-4 text-xs leading-5 text-stone-500">ระบบติดตามและบริหารการจัดซื้อจัดจ้างอัจฉริยะ</div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f5f4f1] text-[#292724]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-[#292724] lg:block">{navigation}</aside>
      {isMenuOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#292724] transition-transform lg:hidden ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Button aria-label="ปิดเมนู" className="absolute right-3 top-3 text-white" isIconOnly onPress={() => setMenuOpen(false)} variant="ghost"><FiX /></Button>
        {navigation}
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-stone-200 bg-[#f5f4f1]/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <Button aria-label="เปิดเมนู" className="lg:hidden" isIconOnly onPress={() => setMenuOpen(true)} variant="ghost"><FiMenu /></Button>
            <div><p className="text-xs font-bold tracking-[0.16em] text-[#b95817]">FACULTY OF INTERDISCIPLINARY STUDIES</p><p className="text-sm font-semibold">มหาวิทยาลัยขอนแก่น</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-stone-500">{user.department ?? user.email}</p></div>
            <Chip className="hidden bg-orange-100 text-[#a64610] sm:inline-flex" size="sm">{roleLabel[user.role]}</Chip>
            <Tooltip><Tooltip.Trigger><Button aria-label="ออกจากระบบ" className="text-stone-600 hover:bg-orange-100 hover:text-[#b95817]" isDisabled={isPending} isIconOnly onPress={logout} variant="ghost"><FiLogOut /></Button></Tooltip.Trigger><Tooltip.Content>ออกจากระบบ</Tooltip.Content></Tooltip>
          </div>
        </header>
        <main className="p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
