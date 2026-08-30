"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Card,
  Chip,
  Alert,
  Modal,
  ScrollShadow,
  useOverlayState,
} from "@heroui/react";
import {
  FiActivity,
  FiClock,
  FiCpu,
  FiSearch,
  FiUser,
  FiFileText,
  FiInfo,
  FiAlertCircle,
} from "react-icons/fi";
import {
  getAuditLogDetail,
  type AdminAuditLogDetail,
} from "@/app/admin/audit-log/actions";

export type AuditLogSummary = {
  id: string;
  action: string;
  userName: string | null;
  userEmail: string | null;
  modelName: string | null;
  timestamp: string;
};

type DetailState =
  | { loading: boolean; error?: string; log?: AdminAuditLogDetail }
  | null;

function formatThaiDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function shortDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function truncate(text: string | null, max: number): string {
  if (!text) return "—";
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

const ACTION_COLORS: Record<string, "default" | "success" | "warning" | "danger" | "accent"> = {
  consult: "accent",
  ocr: "success",
  tor: "warning",
  knowledge: "default",
};

function actionColor(action: string): "default" | "success" | "warning" | "danger" | "accent" {
  const key = action.toLowerCase();
  for (const [prefix, color] of Object.entries(ACTION_COLORS)) {
    if (key.includes(prefix)) return color;
  }
  return "default";
}

export function AuditLogManager({
  logs,
  totalLogs,
  uniqueUserCount,
  last24hCount,
}: {
  logs: AuditLogSummary[];
  totalLogs: number;
  uniqueUserCount: number;
  last24hCount: number;
}) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [, startTransition] = useTransition();
  const detailModal = useOverlayState();

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) set.add(log.action);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      if (!q) return true;
      const haystack = [
        log.action,
        log.userName ?? "",
        log.userEmail ?? "",
        log.modelName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, query, actionFilter]);

  const openDetail = (log: AuditLogSummary) => {
    setSelectedId(log.id);
    detailModal.open();
    if (!details[log.id]) {
      setDetails((prev) => ({ ...prev, [log.id]: { loading: true } }));
      startTransition(async () => {
        const result = await getAuditLogDetail(log.id);
        setDetails((prev) => ({
          ...prev,
          [log.id]: result.success
            ? { loading: false, log: result.log }
            : { loading: false, error: result.error },
        }));
      });
    }
  };

  const selectedDetail = selectedId ? details[selectedId] : null;
  const selectedLog = selectedId ? logs.find((l) => l.id === selectedId) : null;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-[#b95817]">
              <FiActivity size={18} />
            </div>
            <div>
              <p className="text-xs text-stone-500">บันทึกทั้งหมด</p>
              <p className="text-xl font-extrabold text-slate-800">{totalLogs.toLocaleString("th-TH")}</p>
            </div>
          </div>
        </Card>
        <Card className="border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-[#8B0000]">
              <FiUser size={18} />
            </div>
            <div>
              <p className="text-xs text-stone-500">ผู้ใช้ที่เรียก AI</p>
              <p className="text-xl font-extrabold text-slate-800">{uniqueUserCount}</p>
            </div>
          </div>
        </Card>
        <Card className="border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <FiClock size={18} />
            </div>
            <div>
              <p className="text-xs text-stone-500">เรียกใช้ใน 24 ชม.</p>
              <p className="text-xl font-extrabold text-slate-800">{last24hCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาจากชื่อผู้ใช้ อีเมล การกระทำ หรือโมเดล..."
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-[#e87722] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-stone-600">การกระทำ:</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs focus:border-[#e87722] focus:outline-none"
            >
              <option value="ALL">ทั้งหมด</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border border-stone-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-400 mb-3">
            <FiActivity size={28} />
          </div>
          <h3 className="text-base font-bold text-[#272522]">ไม่พบบันทึกที่ตรงกับเงื่อนไข</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            ลองปรับคำค้นหาหรือตัวกรองการกระทำใหม่อีกครั้ง
          </p>
        </Card>
      ) : (
        <Card className="border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/60">
                  <th className="p-3 font-bold text-stone-600">เวลา</th>
                  <th className="p-3 font-bold text-stone-600">การกระทำ</th>
                  <th className="p-3 font-bold text-stone-600">ผู้ใช้</th>
                  <th className="p-3 font-bold text-stone-600">โมเดล</th>
                  <th className="p-3 font-bold text-stone-600 text-right">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b border-stone-100 hover:bg-stone-50/60 transition">
                    <td className="p-3 whitespace-nowrap text-stone-600">
                      {shortDateTime(log.timestamp)}
                    </td>
                    <td className="p-3">
                      <Chip size="sm" variant="soft" color={actionColor(log.action)}>
                        {log.action}
                      </Chip>
                    </td>
                    <td className="p-3">
                      {log.userName ? (
                        <div>
                          <p className="font-semibold text-slate-800">{log.userName}</p>
                          <p className="text-[0.65rem] text-stone-500">{log.userEmail}</p>
                        </div>
                      ) : (
                        <span className="text-stone-400">ระบบ</span>
                      )}
                    </td>
                    <td className="p-3">
                      {log.modelName ? (
                        <span className="inline-flex items-center gap-1 text-stone-600">
                          <FiCpu size={11} /> {log.modelName}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(log)}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1 text-[0.65rem] font-semibold text-stone-600 hover:bg-stone-100"
                      >
                        <FiInfo size={11} /> ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Modal */}
      <Modal state={detailModal}>
        <Modal.Backdrop>
          <Modal.Container size="lg" className="max-h-[90vh]">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2 text-slate-800">
                  <FiActivity className="text-[#8B0000]" /> รายละเอียดการเรียกใช้ AI
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {selectedLog && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs">
                      <div>
                        <p className="font-bold text-stone-500">การกระทำ</p>
                        <Chip size="sm" variant="soft" color={actionColor(selectedLog.action)} className="mt-1">
                          {selectedLog.action}
                        </Chip>
                      </div>
                      <div>
                        <p className="font-bold text-stone-500">เวลา</p>
                        <p className="mt-1 text-slate-800">{formatThaiDateTime(selectedLog.timestamp)}</p>
                      </div>
                      <div>
                        <p className="font-bold text-stone-500">ผู้ใช้</p>
                        <p className="mt-1 text-slate-800">
                          {selectedLog.userName ?? "ระบบ"}
                          {selectedLog.userEmail && (
                            <span className="block text-[0.65rem] text-stone-500">
                              {selectedLog.userEmail}
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-stone-500">โมเดล</p>
                        <p className="mt-1 text-slate-800">{selectedLog.modelName ?? "—"}</p>
                      </div>
                    </div>

                    {selectedDetail?.loading && (
                      <p className="text-xs text-stone-500 flex items-center gap-2">
                        <span className="inline-block h-3 w-3 animate-ping rounded-full bg-[#e87722]" />
                        กำลังโหลดรายละเอียด...
                      </p>
                    )}
                    {selectedDetail?.error && (
                      <Alert status="danger" className="rounded-xl">
                        <Alert.Description className="text-xs">{selectedDetail.error}</Alert.Description>
                      </Alert>
                    )}
                    {selectedDetail?.log && (
                      <div className="space-y-4">
                        <section>
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#8B0000]">
                            <FiFileText size={12} /> Prompt ที่ส่งให้ AI
                          </h4>
                          <ScrollShadow className="mt-2 max-h-48 rounded-xl border border-stone-200 bg-white p-3 text-xs leading-relaxed text-slate-700">
                            {selectedDetail.log.prompt ? (
                              <pre className="whitespace-pre-wrap font-sans">
                                {selectedDetail.log.prompt}
                              </pre>
                            ) : (
                              <span className="text-stone-400">ไม่มีข้อมูล Prompt</span>
                            )}
                          </ScrollShadow>
                        </section>

                        <section>
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#8B0000]">
                            <FiAlertCircle size={12} /> แหล่งอ้างอิงที่ AI ดึงมา
                          </h4>
                          {selectedDetail.log.retrievedSources &&
                          selectedDetail.log.retrievedSources.length > 0 ? (
                            <div className="mt-2 space-y-1.5">
                              {selectedDetail.log.retrievedSources.map((source, idx) => {
                                const title =
                                  typeof source.documentTitle === "string"
                                    ? source.documentTitle
                                    : typeof source.title === "string"
                                      ? source.title
                                      : "เอกสาร";
                                const section =
                                  typeof source.section === "string" ? source.section : null;
                                const score =
                                  typeof source.relevanceScore === "number"
                                    ? source.relevanceScore
                                    : null;
                                return (
                                  <div
                                    key={idx}
                                    className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[0.7rem] text-stone-600"
                                  >
                                    <p className="font-semibold text-slate-800">
                                      {title}
                                      {section && (
                                        <span className="text-stone-400 font-normal">
                                          {" "}
                                          ({section})
                                        </span>
                                      )}
                                    </p>
                                    {score != null && (
                                      <p className="text-stone-400">
                                        คะแนนความเกี่ยวข้อง {(score * 100).toFixed(0)}%
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-stone-400">ไม่มีการดึงแหล่งอ้างอิง</p>
                          )}
                        </section>

                        <section>
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-[#8B0000]">
                            <FiCpu size={12} /> คำตอบจาก AI
                          </h4>
                          <ScrollShadow className="mt-2 max-h-56 rounded-xl border border-stone-200 bg-white p-3 text-xs leading-relaxed text-slate-700">
                            {selectedDetail.log.output ? (
                              <pre className="whitespace-pre-wrap font-sans">
                                {truncate(selectedDetail.log.output, 4000)}
                              </pre>
                            ) : (
                              <span className="text-stone-400">ไม่มีข้อมูลคำตอบ</span>
                            )}
                          </ScrollShadow>
                        </section>
                      </div>
                    )}
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <button
                  type="button"
                  onClick={() => {
                    detailModal.close();
                    setSelectedId(null);
                  }}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  ปิด
                </button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}