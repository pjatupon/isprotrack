"use client";

import { useState, useTransition } from "react";
import { Card, Chip, Alert, Badge } from "@heroui/react";
import {
  FiMessageSquare,
  FiUsers,
  FiSearch,
  FiChevronDown,
  FiFileText,
  FiUser,
  FiCpu,
} from "react-icons/fi";
import { getConsultSessionDetail, type AdminConsultSessionDetail } from "./actions";

export type ConsultSessionSummary = {
  id: string;
  title: string;
  userName: string;
  userEmail: string;
  messageCount: number;
  updatedAt: string;
};

type DetailState = { loading: boolean; error?: string; session?: AdminConsultSessionDetail } | null;

function formatThaiDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ConsultSessionsManager({
  sessions,
  totalSessions,
  totalMessages,
}: {
  sessions: ConsultSessionSummary[];
  totalSessions: number;
  totalMessages: number;
}) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [, startTransition] = useTransition();

  const filtered = sessions.filter((session) => {
    const text = `${session.title} ${session.userName} ${session.userEmail}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) {
      setDetails((prev) => ({ ...prev, [id]: { loading: true } }));
      startTransition(async () => {
        const result = await getConsultSessionDetail(id);
        setDetails((prev) => ({
          ...prev,
          [id]: result.success
            ? { loading: false, session: result.session }
            : { loading: false, error: result.error },
        }));
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-50 text-[#b95817]">
              <FiMessageSquare size={18} />
            </div>
            <div>
              <p className="text-xs text-stone-500">การสนทนาทั้งหมด</p>
              <p className="text-xl font-extrabold text-slate-800">{totalSessions}</p>
            </div>
          </div>
        </Card>
        <Card className="border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-[#8B0000]">
              <FiCpu size={18} />
            </div>
            <div>
              <p className="text-xs text-stone-500">ข้อความทั้งหมด</p>
              <p className="text-xl font-extrabold text-slate-800">{totalMessages}</p>
            </div>
          </div>
        </Card>
        <Card className="border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <FiUsers size={18} />
            </div>
            <div>
              <p className="text-xs text-stone-500">ผู้ใช้ที่สนทนา</p>
              <p className="text-xl font-extrabold text-slate-800">
                {new Set(sessions.map((s) => s.userEmail)).size}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาจากหัวข้อสนทนา ชื่อ หรืออีเมลผู้ใช้..."
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-[#e87722] focus:outline-none"
        />
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <Card className="border border-stone-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-400 mb-3">
            <FiMessageSquare size={28} />
          </div>
          <h3 className="text-base font-bold text-[#272522]">ยังไม่มีบันทึกการสนทนา</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            เมื่อผู้ใช้ใช้หน้าปรึกษาการจัดซื้อจัดจ้าง บทสนทนาจะถูกบันทึกไว้ที่นี่
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((session) => {
            const isOpen = expandedId === session.id;
            const detail = details[session.id];
            return (
              <Card key={session.id} className="border border-stone-200 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(session.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-stone-50 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#272522] truncate">{session.title}</p>
                      <Chip size="sm" variant="soft" color="default" className="text-[0.6rem]">
                        {session.messageCount} ข้อความ
                      </Chip>
                    </div>
                    <p className="mt-1 text-[0.7rem] text-stone-500 flex items-center gap-1.5">
                      <FiUser size={11} /> {session.userName} ({session.userEmail})
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[0.65rem] text-stone-400">{formatThaiDate(session.updatedAt)}</span>
                    <FiChevronDown
                      size={16}
                      className={`text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-stone-100 bg-stone-50/40 p-4">
                    {detail?.loading && (
                      <p className="text-xs text-stone-500 flex items-center gap-2">
                        <span className="inline-block h-3 w-3 animate-ping rounded-full bg-[#e87722]" />
                        กำลังโหลดบทสนทนา...
                      </p>
                    )}
                    {detail?.error && (
                      <Alert status="danger" className="rounded-xl">
                        <Alert.Description className="text-xs">{detail.error}</Alert.Description>
                      </Alert>
                    )}
                    {detail?.session && (
                      <div className="space-y-3">
                        {detail.session.messages.length === 0 && (
                          <p className="text-xs text-stone-400">ยังไม่มีข้อความในบทสนทนานี้</p>
                        )}
                        {detail.session.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                                message.role === "user"
                                  ? "bg-[#e87722] text-white"
                                  : "border border-stone-200 bg-white text-stone-800"
                              }`}
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <Chip size="sm" variant="soft" color={message.role === "user" ? "default" : "accent"} className="text-[0.55rem]">
                                  {message.role === "user" ? "ผู้ใช้" : "AI"}
                                </Chip>
                                <span className={`text-[0.6rem] ${message.role === "user" ? "text-orange-100" : "text-stone-400"}`}>
                                  {formatThaiDate(message.createdAt)}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap">{message.content}</p>

                              {message.role === "assistant" && message.confidence != null && (
                                <div className="mt-2 flex items-center gap-1.5 text-[0.65rem] text-stone-500">
                                  <span>ความมั่นใจ:</span>
                                  <Badge variant="soft" color={message.confidence > 0.7 ? "success" : "warning"}>
                                    {(message.confidence * 100).toFixed(0)}%
                                  </Badge>
                                </div>
                              )}

                              {message.role === "assistant" &&
                                message.citations &&
                                message.citations.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <p className="flex items-center gap-1 text-[0.65rem] font-bold text-[#b95817]">
                                      <FiFileText size={11} /> แหล่งอ้างอิง:
                                    </p>
                                    {message.citations.map((citation, idx) => {
                                      const cite = citation as {
                                        documentTitle?: string;
                                        section?: string | null;
                                        relevanceScore?: number;
                                      };
                                      return (
                                        <div key={idx} className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[0.65rem] text-stone-600">
                                          {cite.documentTitle ?? "เอกสาร"} {cite.section ? `(${cite.section})` : ""}
                                          {cite.relevanceScore != null && (
                                            <span className="text-stone-400"> — Match {(cite.relevanceScore * 100).toFixed(0)}%</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
