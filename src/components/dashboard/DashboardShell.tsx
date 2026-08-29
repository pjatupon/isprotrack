"use client";

import { Button, Tooltip, Input, Chip } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import {
  FiBell,
  FiBookOpen,
  FiChevronRight,
  FiClipboard,
  FiFileText,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiPenTool,
  FiSearch,
  FiShield,
  FiX,
  FiZap,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
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

type MenuItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof FiMessageCircle;
  group: "AI PROCUREMENT" | "TRACKING & OPS" | "GOVERNANCE";
  badge?: string;
  roles?: Role[];
};

const menuItems: MenuItem[] = [
  {
    href: "/consult",
    label: "AI Consult",
    description: "ปรึกษาความต้องการ & ระเบียบ",
    icon: FiMessageCircle,
    group: "AI PROCUREMENT",
    badge: "AI",
  },
  {
    href: "/quotation",
    label: "Quotation Inspector",
    description: "สแกน & ตรวจใบเสนอราคา",
    icon: FiFileText,
    group: "AI PROCUREMENT",
    badge: "OCR",
  },
  {
    href: "/tor",
    label: "TOR Generator",
    description: "ช่วยร่างและตรวจล็อคสเปก",
    icon: FiPenTool,
    group: "AI PROCUREMENT",
  },
  {
    href: "/requests",
    label: "Request Tracking",
    description: "ติดตามสถานะและผังกระบวนการ",
    icon: FiClipboard,
    group: "TRACKING & OPS",
  },
  {
    href: "/staff/regulations",
    label: "Regulation Hub",
    description: "จัดการคลังระเบียบพัสดุ",
    icon: FiBookOpen,
    group: "GOVERNANCE",
    roles: ["STAFF", "ADMIN"],
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    description: "ประวัติการใช้งานและ AI decisions",
    icon: FiShield,
    group: "GOVERNANCE",
    roles: ["ADMIN"],
  },
];

const roleLabel: Record<Role, string> = {
  REQUESTER: "ผู้ขอจัดซื้อ",
  STAFF: "เจ้าหน้าที่พัสดุ",
  APPROVER: "ผู้มีอำนาจอนุมัติ",
  ADMIN: "ผู้ดูแลระบบ",
};

const pageDetails = [
  { href: "/dashboard", title: "ภาพรวมการจัดซื้อจัดจ้าง", section: "WORKSPACE" },
  { href: "/consult", title: "ปรึกษาการจัดซื้อจัดจ้างด้วย AI", section: "AI PROCUREMENT" },
  { href: "/quotation", title: "ตรวจสอบใบเสนอราคา (OCR)", section: "AI PROCUREMENT" },
  { href: "/tor", title: "ผู้ช่วยร่างขอบเขตงาน TOR", section: "AI PROCUREMENT" },
  { href: "/requests", title: "ติดตามคำขอจัดซื้อจัดจ้าง", section: "TRACKING & OPS" },
  { href: "/staff/regulations", title: "คลังระเบียบพัสดุ", section: "GOVERNANCE" },
  { href: "/admin/audit-log", title: "ประวัติการดำเนินการ (Audit Log)", section: "GOVERNANCE" },
];

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNotifyOpen, setNotifyOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = useMemo(
    () => menuItems.filter((item) => !item.roles || item.roles.includes(user.role)),
    [user.role]
  );

  const currentPage = useMemo(() => {
    return (
      [...pageDetails]
        .sort((a, b) => b.href.length - a.href.length)
        .find(
          ({ href }) =>
            pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`))
        ) ?? pageDetails[0]
    );
  }, [pathname]);

  const initial = (user.name.trim().charAt(0) || "U").toUpperCase();

  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of visibleItems) {
      if (!map.has(item.group)) {
        map.set(item.group, []);
      }
      map.get(item.group)!.push(item);
    }
    return Array.from(map.entries());
  }, [visibleItems]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return visibleItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [searchQuery, visibleItems]);

  function logout() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  const navigation = (
    <nav className="flex h-full flex-col bg-[#272522] text-stone-300" aria-label="เมนูหลัก">
      {/* Brand Header */}
      <div className="border-b border-white/10 px-5 py-4">
        <Link
          className="flex items-center gap-3 group"
          href="/dashboard"
          onClick={() => setMenuOpen(false)}
        >
          <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e87722] to-[#b95817] text-sm font-black text-white shadow-lg shadow-orange-950/40 group-hover:scale-105 transition">
            <span className="absolute inset-1 rounded-xl border border-white/30" />
            <span className="relative tracking-tight font-black">IS</span>
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-black tracking-[0.18em] text-white">
              IS PROTRACK
            </span>
            <span className="block text-[0.68rem] font-semibold text-orange-200 truncate">
              คณะสหวิทยาการ · KKU
            </span>
          </span>
        </Link>
        <div className="mt-3 rounded-xl border border-orange-400/20 bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent px-3 py-2">
          <p className="text-[0.62rem] font-bold tracking-wider text-orange-200 uppercase">
            FACULTY OF INTERDISCIPLINARY STUDIES
          </p>
          <p className="text-xs text-stone-300 mt-0.5">
            ระบบจัดซื้อจัดจ้างอัจฉริยะ (RAG & OCR)
          </p>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 text-xs">
        {groups.map(([groupName, items]) => (
          <div key={groupName} className="space-y-1">
            <p className="px-3 pb-1.5 text-[0.65rem] font-bold tracking-[0.15em] text-stone-400">
              {groupName}
            </p>
            {items.map(({ href, label, description, icon: Icon, badge }) => {
              const active =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              return (
                <Tooltip key={href} delay={400}>
                  <Tooltip.Trigger>
                    <Link
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition ${
                        active
                          ? "bg-[#e87722] text-white font-medium shadow-md shadow-orange-950/30"
                          : "text-stone-300 hover:bg-white/10 hover:text-white"
                      }`}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="shrink-0 text-base" />
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold truncate">
                            {label}
                          </span>
                          <span
                            className={`block text-[0.7rem] truncate ${
                              active ? "text-orange-100" : "text-stone-400"
                            }`}
                          >
                            {description}
                          </span>
                        </div>
                      </div>
                      {badge && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold shrink-0 ${
                            active
                              ? "bg-white/25 text-white"
                              : "bg-orange-500/20 text-orange-300 border border-orange-400/30"
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{description}</Tooltip.Content>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Profile Footer */}
      <div className="border-t border-white/10 p-3 bg-black/10">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e87722] text-sm font-black text-white shadow-sm">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{user.name}</p>
            <p className="truncate text-[0.68rem] text-orange-200">
              {roleLabel[user.role]} · {user.department ?? "คณะสหวิทยาการ"}
            </p>
          </div>
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                aria-label="ออกจากระบบ"
                className="text-stone-400 hover:bg-red-500/20 hover:text-red-300"
                isDisabled={isPending}
                isIconOnly
                onPress={logout}
                size="sm"
                variant="ghost"
              >
                <FiLogOut size={15} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>ออกจากระบบ</Tooltip.Content>
          </Tooltip>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f5f4f1] text-[#272522]">
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block shadow-xl shadow-stone-900/10">
        {navigation}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 lg:hidden shadow-2xl ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Button
          aria-label="ปิดเมนู"
          className="absolute right-3 top-3 z-10 text-stone-300 hover:text-white"
          isIconOnly
          onPress={() => setMenuOpen(false)}
          variant="ghost"
        >
          <FiX size={18} />
        </Button>
        {navigation}
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Sticky Top Navbar */}
        <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-stone-200/90 bg-[#f5f4f1]/90 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              aria-label="เปิดเมนู"
              className="lg:hidden text-stone-700"
              isIconOnly
              onPress={() => setMenuOpen(true)}
              variant="ghost"
            >
              <FiMenu size={20} />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[0.68rem] font-bold tracking-wider text-stone-500">
                <FiHome size={12} className="text-[#b95817]" />
                <span className="hidden sm:inline">IS PROTRACK</span>
                <FiChevronRight size={11} className="hidden sm:inline text-stone-400" />
                <span className="text-[#b95817] font-semibold truncate">
                  {currentPage.section}
                </span>
              </div>
              <p className="text-sm font-bold text-[#272522] sm:text-base truncate">
                {currentPage.title}
              </p>
            </div>
          </div>

          {/* Right Navbar Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search Trigger */}
            <div className="relative">
              <Button
                aria-label="ค้นหาฟังก์ชัน"
                onPress={() => setSearchOpen((prev) => !prev)}
                className="hidden md:flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-500 hover:border-orange-300 hover:text-stone-800 shadow-sm"
                variant="ghost"
              >
                <FiSearch size={14} className="text-stone-400" />
                <span>ค้นหาเมนู & ฟังก์ชัน...</span>
                <kbd className="rounded bg-stone-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-stone-500 border border-stone-200">
                  Ctrl K
                </kbd>
              </Button>

              {/* Search Dropdown Panel */}
              {isSearchOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <FiSearch className="text-[#b95817]" />
                    <Input
                      autoFocus
                      placeholder="พิมพ์เพื่อค้นหาเมนู..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs"
                    />
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <FiX size={14} />
                    </Button>
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
                    {searchResults.length > 0 ? (
                      searchResults.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery("");
                          }}
                          className="flex items-center gap-2.5 rounded-xl p-2 text-xs hover:bg-orange-50 transition"
                        >
                          <item.icon className="text-[#b95817] shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-stone-800 truncate">
                              {item.label}
                            </p>
                            <p className="text-[0.68rem] text-stone-500 truncate">
                              {item.description}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p className="py-4 text-center text-xs text-stone-400">
                        {searchQuery ? "ไม่พบเมนูที่ตรงกัน" : "พิมพ์ชื่อเมนูที่ต้องการค้นหา"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    aria-label="การแจ้งเตือน"
                    className="relative text-stone-600 hover:bg-orange-50 hover:text-[#b95817] rounded-xl"
                    isIconOnly
                    variant="ghost"
                    onPress={() => setNotifyOpen((prev) => !prev)}
                  >
                    <FiBell size={18} />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#e87722] ring-2 ring-[#f5f4f1] animate-pulse" />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>การแจ้งเตือนระบบ</Tooltip.Content>
              </Tooltip>

              {isNotifyOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <p className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <FiBell className="text-[#b95817]" /> การแจ้งเตือนล่าสุด
                    </p>
                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-[#b95817]">
                      3 รายการ
                    </span>
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="rounded-xl bg-orange-50/50 p-2.5 border border-orange-100">
                      <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <FiCheckCircle className="text-emerald-600 shrink-0" /> ตรวจใบเสนอราคาเสร็จสมบูรณ์
                      </p>
                      <p className="text-[0.68rem] text-stone-500 mt-0.5">
                        ระบบ OCR ประมวลผลเอกสารของ บจก.สยามเน็ตเวิร์ก แล้ว
                      </p>
                      <span className="text-[0.62rem] text-stone-400 mt-1 block flex items-center gap-1">
                        <FiClock size={10} /> 10 นาทีที่แล้ว
                      </span>
                    </div>

                    <div className="rounded-xl bg-stone-50 p-2.5 border border-stone-100">
                      <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <FiZap className="text-amber-600 shrink-0" /> AI Consult พร้อมใช้งาน
                      </p>
                      <p className="text-[0.68rem] text-stone-500 mt-0.5">
                        อัปเดตระเบียบพัสดุ มข. ฉบับล่าสุดในคลัง RAG แล้ว
                      </p>
                      <span className="text-[0.62rem] text-stone-400 mt-1 block flex items-center gap-1">
                        <FiClock size={10} /> วันนี้ 09:30 น.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <span className="hidden h-6 w-px bg-stone-300 sm:block" />

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 rounded-xl bg-white/80 border border-stone-200/80 px-2 py-1 shadow-sm">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#272522] text-xs font-black text-white shadow-xs">
                {initial}
              </span>
              <div className="hidden text-left sm:block pr-1">
                <p className="text-xs font-bold text-[#272522] leading-tight truncate max-w-[120px]">
                  {user.name}
                </p>
                <Chip size="sm" className="h-4 text-[0.62rem] bg-orange-100 text-[#a64610] px-1 py-0 font-medium">
                  {roleLabel[user.role]}
                </Chip>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
