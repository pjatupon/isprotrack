"use client";

import React from "react";
import { Input, Button, Dropdown, Avatar } from "@heroui/react";
import { Search, Bell, Settings, User, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export function Navbar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-xs">
      {/* Left Zone: Brand Logo & Title */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="flex items-center gap-2.5 group transition-transform hover:scale-[1.01]">
          <Image
            priority
            src="/Logo-ISKKU-transparent.png"
            alt="โลโก้คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น"
            width={2696}
            height={648}
            className="h-9 w-auto sm:h-10"
          />
          <div className="flex flex-col leading-tight border-l border-slate-300 pl-2.5">
            <span className="text-sm font-bold text-[#8B0000] tracking-tight">ระบบติดตามและบริหารการจัดซื้อจัดจ้างอัจฉริยะ (I-Smart ProTrack)</span>
            <span className="text-xs font-semibold text-slate-600">ของคณะสหวิทยาการ</span>
          </div>
        </Link>
      </div>

      {/* Right Zone: Search, Notification Bell, User Dropdown */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Rounded-full Search Input */}
        <div className="hidden md:block w-64 lg:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
          <Input
            aria-label="ค้นหาในระบบ"
            placeholder="ค้นหาในระบบ..."
            className="w-full rounded-full bg-slate-50 text-xs border border-slate-200 focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] pl-9 pr-3 py-1.5"
          />
        </div>

        {/* Notification Bell with Red Dot Badge */}
        <div className="relative">
          <Button
            aria-label="การแจ้งเตือน"
            isIconOnly
            variant="ghost"
            size="sm"
            className="relative text-slate-600 hover:bg-slate-100 hover:text-[#8B0000] rounded-full h-9 w-9"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#8B0000] ring-2 ring-white" />
          </Button>
        </div>

        {/* Profile Dropdown */}
        <Dropdown>
          <Dropdown.Trigger className="flex items-center gap-2.5 rounded-full p-1 pr-2.5 hover:bg-slate-100 transition focus:outline-none cursor-pointer">
            <Avatar className="h-8 w-8 bg-[#8B0000] text-white font-bold text-xs">
              <Avatar.Fallback className="bg-[#8B0000] text-white">ผู้</Avatar.Fallback>
            </Avatar>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-xs font-semibold text-slate-800">ผู้ดูแลระบบ Demo</p>
              <p className="text-[0.68rem] text-slate-500">ผู้ดูแลระบบ</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <Dropdown.Menu aria-label="เมนูโปรไฟล์ผู้ใช้งาน" className="space-y-0.5">
              <Dropdown.Item
                id="staff-menu"
                textValue="เมนูสำหรับเจ้าหน้าที่"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Settings className="h-4 w-4 text-slate-500" />
                <span>เมนูสำหรับเจ้าหน้าที่</span>
              </Dropdown.Item>
              <Dropdown.Item
                id="profile"
                textValue="ข้อมูลส่วนตัว"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <User className="h-4 w-4 text-slate-500" />
                <span>ข้อมูลส่วนตัว</span>
              </Dropdown.Item>
              <Dropdown.Item
                id="logout"
                textValue="ออกจากระบบ"
                isDisabled={isPending}
                onAction={logout}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[#8B0000] hover:bg-red-50 cursor-pointer border-t border-slate-100 mt-1"
              >
                <LogOut className="h-4 w-4 text-[#8B0000]" />
                <span>{isPending ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </header>
  );
}
