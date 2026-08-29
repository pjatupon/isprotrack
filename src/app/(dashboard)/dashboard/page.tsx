import { Chip } from "@heroui/react";
import { FiArrowUpRight, FiCheckCircle, FiClock, FiFileText } from "react-icons/fi";
import { WorkflowDiagram } from "@/components/tracking/WorkflowDiagram";

const metrics = [
  { label: "คำขอทั้งหมด", value: "24", icon: FiFileText, tone: "text-blue-600 bg-blue-50" },
  { label: "รอตรวจสอบ", value: "08", icon: FiClock, tone: "text-amber-600 bg-amber-50" },
  { label: "อนุมัติแล้ว", value: "12", icon: FiCheckCircle, tone: "text-emerald-600 bg-emerald-50" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ภาพรวม</h1>
          <p className="text-sm text-stone-500">แดชบอร์ดติดตามสถานะการจัดซื้อจัดจ้าง</p>
        </div>
        <Chip className="bg-orange-100 text-[#a64610] text-xs" size="sm">วันนี้ 29 ส.ค. 2569</Chip>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" key={label}>
            <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={19} />
            </div>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="mt-0.5 text-3xl font-bold tracking-tight text-[#272522]">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#272522]">เส้นทางคำขอจัดซื้อ</h2>
            <p className="text-xs text-stone-500">สถานะปัจจุบันของกระบวนการจัดซื้อจัดจ้าง</p>
          </div>
          <button className="flex items-center gap-2 rounded-full bg-[#e87722] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#c85f13]">
            สร้างคำขอใหม่ <FiArrowUpRight />
          </button>
        </div>
        <WorkflowDiagram />
      </div>
    </div>
  );
}