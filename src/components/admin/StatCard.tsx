import React from "react";
import { Card } from "@heroui/react";
import { ArrowUpRight } from "lucide-react";

export type StatCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
  iconTextColor: string;
  borderColor: string;
  descriptionColor?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconBgColor,
  iconTextColor,
  borderColor,
  descriptionColor = "text-slate-500",
}: StatCardProps) {
  return (
    <Card
      className={`relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md ${borderColor}`}
    >
      {/* Top right external link icon */}
      <button
        type="button"
        aria-label="ดูรายละเอียดเพิ่มเติม"
        className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors cursor-pointer"
      >
        <ArrowUpRight className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-4">
        {/* Left Circular Icon */}
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${iconBgColor} ${iconTextColor}`}
        >
          <Icon className="h-6 w-6 stroke-[2]" />
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 truncate">{title}</p>
          <p className="mt-0.5 text-2xl font-black tracking-tight text-slate-800">
            {value}
          </p>
          <p className={`mt-1 text-xs font-medium truncate ${descriptionColor}`}>
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}
