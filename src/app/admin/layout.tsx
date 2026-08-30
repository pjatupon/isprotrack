import React from "react";
import { Navbar } from "@/components/admin/Navbar";
import { Sidebar } from "@/components/admin/Sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-slate-800 antialiased">
      {/* Top Fixed Navbar */}
      <Navbar />

      {/* Main Workspace: Sidebar + Content */}
      <div className="flex flex-1">
        {/* Left Fixed Sidebar (hidden on mobile, can be toggled if needed) */}
        <aside className="hidden md:block sticky top-16 h-[calc(100vh-4rem)] shrink-0">
          <Sidebar />
        </aside>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
