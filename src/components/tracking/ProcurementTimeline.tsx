import { Chip } from "@heroui/react";
import { FiClock, FiUser } from "react-icons/fi";
import { steps, statusConfig, type StepStatus } from "@/components/tracking/workflow-data";

const nodeStyles: Record<StepStatus, { bubble: string; icon: string }> = {
  COMPLETED: { bubble: "bg-emerald-500 ring-emerald-100", icon: "text-white" },
  IN_PROGRESS: { bubble: "bg-[#e87722] ring-orange-100", icon: "text-white" },
  PENDING: { bubble: "bg-stone-200 ring-stone-100", icon: "text-stone-400" },
  REVISION_NEEDED: { bubble: "bg-rose-500 ring-rose-100", icon: "text-white" },
};

export function ProcurementTimeline() {
  const total = steps.length;
  const completed = steps.filter((s) => s.status === "COMPLETED").length;
  const progress = Math.round((completed / total) * 100);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      {/* Header + overall progress */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#272522]">เส้นทางคำขอจัดซื้อ</h3>
          <p className="text-xs text-stone-500">สถานะปัจจุบันของกระบวนการจัดซื้อจัดจ้าง</p>
        </div>
        <div className="w-full sm:w-72">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-stone-500">ความคืบหน้ารวม</span>
            <span className="font-bold text-[#e87722]">{completed}/{total} ขั้นตอน · {progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#e87722] to-[#b95817] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs">
        <span className="font-semibold text-stone-500">สถานะ:</span>
        {(Object.entries(statusConfig) as [StepStatus, (typeof statusConfig)[StepStatus]][]).map(
          ([key, { color, icon: Icon, label }]) => (
            <span className="flex items-center gap-1.5" key={key}>
              <Icon
                className={
                  color === "success"
                    ? "text-emerald-500"
                    : color === "accent"
                      ? "text-[#e87722]"
                      : color === "danger"
                        ? "text-rose-500"
                        : "text-amber-500"
                }
                size={14}
              />
              <span className="text-stone-600">{label}</span>
            </span>
          ),
        )}
      </div>

      {/* Vertical timeline */}
      <ol className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isInProgress = step.status === "IN_PROGRESS";
          const isCompleted = step.status === "COMPLETED";
          const { icon: StatusIcon, label: statusLabel } = statusConfig[step.status];
          const node = nodeStyles[step.status];

          return (
            <li key={step.label} className="relative flex gap-4 sm:gap-5">
              {/* Node + connecting line */}
              <div className="flex flex-col items-center">
                <div className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4">
                  {isInProgress && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#e87722]/40" />
                  )}
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full ${node.bubble}`}
                  >
                    <StatusIcon size={15} className={node.icon} />
                  </span>
                </div>
                {!isLast && <div className="w-0.5 flex-1 bg-stone-200" />}
              </div>

              {/* Step content */}
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                <div
                  className={`rounded-2xl border p-4 transition ${
                    isInProgress
                      ? "border-[#e87722]/40 bg-orange-50/70"
                      : isCompleted
                        ? "border-stone-200 bg-white"
                        : "border-stone-200 bg-stone-50/60"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-bold tracking-wider text-stone-400 uppercase">
                        ขั้นตอนที่ {i + 1}
                      </p>
                      <h4 className="mt-0.5 text-sm font-bold text-[#272522]">{step.label}</h4>
                    </div>
                    <Chip
                      className={isInProgress ? "bg-[#e87722] text-white" : undefined}
                      color={statusConfig[step.status].color}
                      size="sm"
                      variant="soft"
                    >
                      {statusLabel}
                    </Chip>
                  </div>
                  <p className="text-xs leading-relaxed text-stone-500">{step.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-400">
                    {step.assignee && (
                      <span className="flex items-center gap-1.5">
                        <FiUser size={13} />
                        {step.assignee}
                      </span>
                    )}
                    {step.sla && (
                      <span className="flex items-center gap-1.5">
                        <FiClock size={13} />
                        SLA: {step.sla}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
