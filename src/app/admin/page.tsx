import React from "react";
import { Users, Folder, Clock } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { WelcomeBanner } from "@/components/admin/WelcomeBanner";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            ADMINISTRATION CENTER
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            ภาพรวมระบบ
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            จัดการข้อมูลพื้นฐาน ผู้ใช้งาน และสิทธิ์การเข้าถึงของคณะสหวิทยาการ
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            อัปเดตล่าสุด 28 สิงหาคม 2569
          </span>
        </div>
      </div>

      {/* 2. Stat Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Card 1: ผู้ใช้งาน */}
        <StatCard
          title="ผู้ใช้งานทั้งหมด"
          value="1,286"
          description="เพิ่มขึ้น 85% จากเดือนก่อน"
          icon={Users}
          iconBgColor="bg-red-50"
          iconTextColor="text-[#8B0000]"
          borderColor="border-l-4 border-l-[#8B0000]"
          descriptionColor="text-[#8B0000]"
        />

        {/* Card 2: หน่วยงาน */}
        <StatCard
          title="หน่วยงานในระบบ"
          value="24"
          description="สังกัดหลักและหน่วยงานย่อย"
          icon={Folder}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          borderColor="border-l-4 border-l-amber-500"
          descriptionColor="text-slate-500"
        />

        {/* Card 3: คำขอรอดำเนินการ */}
        <StatCard
          title="คำขอรอดำเนินการ"
          value="12"
          description="ต้องตรวจสอบภายในสัปดาห์นี้"
          icon={Clock}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-600"
          borderColor="border-l-4 border-l-slate-500"
          descriptionColor="text-slate-500"
        />
      </div>

      {/* 3. Hero Welcome Banner */}
      <WelcomeBanner />
    </div>
  );
}
