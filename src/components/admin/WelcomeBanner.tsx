import React from "react";
import { Card } from "@heroui/react";

export function WelcomeBanner() {
  return (
    <Card className="w-full rounded-2xl border border-red-100/80 bg-[#FAF5F3] p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        {/* Left content */}
        <div className="max-w-2xl space-y-2">
          <span className="inline-block text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            SMART OFFICE CONTROL
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">
            ยินดีต้อนรับสู่ศูนย์จัดการระบบ
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            เริ่มต้นจากเมนูด้านซ้ายเพื่อจัดการหน่วยงาน ผู้ใช้งาน และบทบาทสิทธิ์ให้สอดคล้องกับโครงสร้างของคณะ
          </p>
        </div>

        {/* Right content: Minimalist emblem circle */}
        <div className="shrink-0 flex items-center justify-start sm:justify-end">
          <div className="relative grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-full bg-white/90 shadow-md border border-red-100">
            <span className="text-2xl sm:text-3xl font-black tracking-tighter text-[#8B0000]">
              IS
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
