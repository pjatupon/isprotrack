"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { FiX } from "react-icons/fi";
import { UserNavbar } from "@/components/appshell/UserNavbar";
import { UserSidebar } from "@/components/appshell/UserSidebar";
import type { UserRole } from "@/components/appshell/nav";

type DashboardShellProps = {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: UserRole;
    department?: string | null;
  };
};

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-slate-800 antialiased">
      {/* Top Fixed Navbar */}
      <UserNavbar user={user} onMenuToggle={() => setMenuOpen(true)} />

      {/* Main Workspace: Sidebar + Content */}
      <div className="flex flex-1">
        {/* Left Fixed Sidebar (desktop) */}
        <aside className="hidden md:block sticky top-16 h-[calc(100vh-4rem)] shrink-0">
          <UserSidebar role={user.role} />
        </aside>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Mobile Backdrop & Drawer */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transition-transform duration-300 md:hidden shadow-2xl ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Button
          aria-label="ปิดเมนู"
          className="absolute right-3 top-3 z-10 text-slate-500 hover:text-slate-800"
          isIconOnly
          onPress={() => setMenuOpen(false)}
          variant="ghost"
        >
          <FiX size={18} />
        </Button>
        <UserSidebar role={user.role} onNavigate={() => setMenuOpen(false)} />
      </aside>
    </div>
  );
}
