import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiSend,
  FiSlash,
  FiXCircle,
} from "react-icons/fi";

export type StatusEntry = {
  status: string;
  count: number;
  budget?: number;
};

const ORDER: Record<string, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  IN_REVIEW: 2,
  NEEDS_REVISION: 3,
  APPROVED: 4,
  REJECTED: 5,
  COMPLETED: 6,
  CANCELLED: 7,
};

const STATUS_META: Record<
  string,
  { label: string; bar: string; chip: string; icon: typeof FiFileText }
> = {
  DRAFT: { label: "ร่าง", bar: "bg-stone-400", chip: "bg-stone-100 text-stone-600", icon: FiFileText },
  SUBMITTED: { label: "ยื่นคำขอแล้ว", bar: "bg-amber-400", chip: "bg-amber-50 text-amber-700", icon: FiSend },
  IN_REVIEW: { label: "กำลังตรวจสอบ", bar: "bg-[#e87722]", chip: "bg-orange-50 text-[#a64610]", icon: FiClock },
  NEEDS_REVISION: { label: "ต้องแก้ไข", bar: "bg-rose-500", chip: "bg-rose-50 text-rose-700", icon: FiAlertCircle },
  APPROVED: { label: "อนุมัติแล้ว", bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", icon: FiCheckCircle },
  REJECTED: { label: "ไม่อนุมัติ", bar: "bg-red-500", chip: "bg-red-50 text-red-700", icon: FiXCircle },
  COMPLETED: { label: "เสร็จสิ้น", bar: "bg-teal-600", chip: "bg-teal-50 text-teal-700", icon: FiCheck },
  CANCELLED: { label: "ยกเลิก", bar: "bg-stone-300", chip: "bg-stone-100 text-stone-500", icon: FiSlash },
};

function formatBudget(n: number): string {
  return n.toLocaleString("en-US");
}

export function StatusDistribution({ entries }: { entries: StatusEntry[] }) {
  const filtered = entries
    .filter((e) => e.count > 0)
    .sort((a, b) => (ORDER[a.status] ?? 99) - (ORDER[b.status] ?? 99));

  const total = filtered.reduce((sum, e) => sum + e.count, 0);
  const totalBudget = filtered.reduce((sum, e) => sum + (e.budget ?? 0), 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-stone-400">
        <FiFileText size={22} />
        <p>ยังไม่มีข้อมูลคำขอจัดซื้อ</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-stone-500">
            ทั้งหมด <span className="font-bold text-stone-700">{total}</span> คำขอ
          </span>
          {totalBudget > 0 && (
            <span className="font-semibold text-[#e87722]">
              งบรวม {formatBudget(totalBudget)} บาท
            </span>
          )}
        </div>
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-stone-100">
          {filtered.map((e) => {
            const meta = STATUS_META[e.status] ?? STATUS_META.DRAFT;
            return (
              <div
                key={e.status}
                className={`h-full ${meta.bar}`}
                style={{ width: `${(e.count / total) * 100}%` }}
                title={`${meta.label}: ${e.count} คำขอ`}
              />
            );
          })}
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {filtered.map((e) => {
          const meta = STATUS_META[e.status] ?? STATUS_META.DRAFT;
          const Icon = meta.icon;
          return (
            <li key={e.status} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2.5">
              <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
                <Icon size={13} />
                {meta.label}
              </span>
              <span className="text-sm font-bold text-stone-700">
                {e.count}
                <span className="ml-1 text-[0.68rem] font-medium text-stone-400">
                  ({Math.round((e.count / total) * 100)}%)
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
