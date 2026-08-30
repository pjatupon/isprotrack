"use client";

import { useState, useTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  Input,
  Label,
  TextField,
  Chip,
  Alert,
  ProgressBar,
  Badge,
  Tooltip,
} from "@heroui/react";
import {
  FiSend,
  FiFileText,
  FiCheckCircle,
  FiHelpCircle,
  FiArrowRight,
  FiClock,
  FiDownload,
  FiCheck,
  FiAlertTriangle,
  FiSearch,
  FiPackage,
  FiRefreshCw,
  FiPaperclip,
  FiX,
  FiEdit3,
} from "react-icons/fi";
import {
  selectFormForConsult,
  fillAndDownloadDocx,
  submitConsultRequest,
  saveConsultSessionState,
  appendConsultMessages,
  type SelectFormResult,
  type ConsultSessionMessageView,
} from "./actions";
import { determineSla, type SlaInfo } from "@/lib/ai/sla";
import type { FormPlaceholderDef } from "@/lib/ai/form-router";
import { saveTorPrefill } from "@/lib/ai/consult-handoff";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024; // 6MB

type Citation = {
  chunkId: string;
  content: string;
  section: string | null;
  documentTitle: string;
  relevanceScore: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  confidence?: number;
  pending?: boolean;
  imagePreviewUrl?: string;
  showFollowUps?: boolean;
};

type AttachedImage = {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
};

const SUGGESTED_QUESTIONS = [
  "ขั้นตอนการจัดซื้อจัดจ้างทั้งหมดเป็นอย่างไร?",
  "จัดซื้อเครื่องคอมพิวเตอร์ 500,000 บาท ต้องทำอะไรบ้าง?",
  "วิธีเฉพาะเจาะจงต่างจาก e-bidding อย่างไร?",
  "ต้องเตรียมเอกสารอะไรบ้างก่อนขออนุมัติจัดซื้อ?",
  "วงเงินเท่าไรต้องประกวดราคาอิเล็กทรอนิกส์?",
  "ต้องการจัดซื้ออุปกรณ์สำหรับห้องแล็บ ควรเริ่มยังไง?",
];

type Step = 1 | 2 | 3 | 4 | 5;
type StepData = {
  objective: string;
  quantity: string;
  budget: string;
  usageDate: string;
  procurementType: string;
  procurementMethod: string;
};

type FillResult = { success: boolean; error?: string; fileName?: string; base64?: string } | null;
type SubmitResult = { success: boolean; error?: string; requestId?: string } | null;

const GREETING_MESSAGE: ChatMessage = {
  role: "assistant",
  text: "สวัสดีครับ — ยินดีต้อนรับสู่ระบบปรึกษาการจัดซื้อจัดจ้างอัจฉริยะ คณะสหวิทยาการ มข.\nผมคือ AI ที่ปรึกษาพัสดุ ค้นระเบียบจากคลังความรู้และระเบียบกระทรวงการคลัง เพื่อให้คำแนะนำที่ถูกต้อง\nพิมพ์คำถามได้เลย หรือกด **เริ่ม Wizard ตามขั้นตอน** ทางขวา",
};

const INITIAL_FORM_DATA: StepData = {
  objective: "",
  quantity: "",
  budget: "",
  usageDate: "",
  procurementType: "ซื้อพัสดุ",
  procurementMethod: "เฉพาะเจาะจง",
};

function mapSavedMessage(message: ConsultSessionMessageView): ChatMessage {
  return {
    role: message.role === "user" ? "user" : "assistant",
    text: message.content,
    citations: (message.citations ?? []) as Citation[],
    confidence: message.confidence ?? undefined,
  };
}

function mapAutofill(data: StepData): Record<string, string> {
  return {
    itemType: data.procurementType || data.objective,
    itemDetails: data.objective,
    quantity: data.quantity,
    budget: data.budget,
    reason: data.objective,
    dateNeeded: data.usageDate,
    objective: data.objective,
  };
}

type WizardSnapshot = {
  step: Step;
  formData: StepData;
  sla: SlaInfo | null;
  formResult: SelectFormResult | null;
  formValues: Record<string, string>;
};

export default function ConsultPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState<StepData>(INITIAL_FORM_DATA);

  const [chatLog, setChatLog] = useState<ChatMessage[]>([GREETING_MESSAGE]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customQuery, setCustomQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef(false);

  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const lastExchangeRef = useRef<{ query: string; answer: string } | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [isSessionLoading, startSessionLoad] = useTransition();
  const [sessionReady, setSessionReady] = useState(false);

  const [sla, setSla] = useState<SlaInfo | null>(null);

  const [formResult, setFormResult] = useState<SelectFormResult | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isSelectingForm, startSelectForm] = useTransition();
  const [isFormError, setIsFormError] = useState(false);

  const [fillState, fillAction, isFilling] = useActionState<FillResult, FormData>(fillAndDownloadDocx, null);
  const [submitState, submitAction, isSubmitting] = useActionState<SubmitResult, FormData>(submitConsultRequest, null);

  useEffect(() => {
    if (fillState?.success && fillState.base64 && fillState.fileName) {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${fillState.base64}`;
      link.download = fillState.fileName;
      link.click();
    }
  }, [fillState]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog, isPending]);

  // Load (or create) the current session on mount and restore conversation + wizard state.
  useEffect(() => {
    let cancelled = false;
    startSessionLoad(async () => {
      try {
        const response = await fetch("/api/ai/consult/session", { cache: "no-store" });
        const result = (await response.json().catch(() => ({}))) as {
          session?: {
            id: string;
            messages: ConsultSessionMessageView[];
            wizardState: unknown;
          };
          error?: string;
        };
        if (!response.ok || !result.session) {
          throw new Error(result.error || "ไม่สามารถโหลดการสนทนาได้");
        }
        if (cancelled) return;
        const session = result.session;
        sessionIdRef.current = session.id;
        setSessionId(session.id);
        if (session.messages.length > 0) {
          setChatLog(session.messages.map(mapSavedMessage));
        }
        const ws = session.wizardState as WizardSnapshot | null;
        if (ws) {
          if (typeof ws.step === "number" && ws.step >= 1 && ws.step <= 5) {
            setStep(ws.step as Step);
          }
          if (ws.formData && typeof ws.formData === "object") {
            setFormData({ ...INITIAL_FORM_DATA, ...(ws.formData as Partial<StepData>) });
          }
          if (ws.sla) setSla(ws.sla);
          if (ws.formResult) setFormResult(ws.formResult as SelectFormResult);
          if (ws.formValues) setFormValues(ws.formValues);
        }
        setSessionReady(true);
      } catch (error) {
        if (!cancelled) {
          setChatLog((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `ไม่สามารถโหลดประวัติการสนทนาได้: ${error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"}`,
            },
          ]);
          setSessionReady(false);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persist of wizard state so users can resume after navigating away.
  useEffect(() => {
    if (!sessionId || !sessionReady) return;
    const snapshot: WizardSnapshot = {
      step,
      formData,
      sla,
      formResult,
      formValues,
    };
    const timer = setTimeout(() => {
      void saveConsultSessionState(sessionId, snapshot as unknown as Record<string, unknown>);
    }, 1000);
    return () => clearTimeout(timer);
  }, [sessionId, sessionReady, step, formData, sla, formResult, formValues]);

  const ensureSessionId = async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const response = await fetch("/api/ai/consult/session", { cache: "no-store" });
    const result = (await response.json().catch(() => ({}))) as {
      session?: { id: string };
      error?: string;
    };
    if (!response.ok || !result.session) {
      throw new Error(result.error || "ไม่สามารถเปิดการสนทนาได้");
    }
    sessionIdRef.current = result.session.id;
    setSessionId(result.session.id);
    setSessionReady(true);
    return result.session.id;
  };

  const pushLocalMessages = async (messages: ChatMessage[]) => {
    setChatLog((prev) => [...prev, ...messages]);
    const sid = sessionIdRef.current;
    if (sid) {
      const saveable = messages
        .filter((m) => !m.pending)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.text }));
      if (saveable.length > 0) {
        void appendConsultMessages(sid, saveable);
      }
    }
  };

  const handleNewSession = () => {
    if (isPending || isSessionLoading) return;
    startTransition(async () => {
      try {
        const response = await fetch("/api/ai/consult/session", { method: "POST" });
        const result = (await response.json().catch(() => ({}))) as {
          sessionId?: string;
          error?: string;
        };
        if (!response.ok || !result.sessionId) {
          throw new Error(result.error || "ไม่สามารถสร้างการสนทนาใหม่ได้");
        }
        sessionIdRef.current = result.sessionId;
        setSessionId(result.sessionId);
        setSessionReady(true);
      setChatLog([GREETING_MESSAGE]);
      setStep(1);
      setFormData(INITIAL_FORM_DATA);
      setSla(null);
      setFormResult(null);
      setFormValues({});
      setIsFormError(false);
        setCustomQuery("");
      } catch (error) {
        setChatLog((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `ไม่สามารถเริ่มการสนทนาใหม่ได้: ${error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"}`,
          },
        ]);
      }
    });
  };

  const handleStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && !formData.objective.trim()) return;
    if (step === 2 && !formData.quantity.trim()) return;
    if (step === 3 && !formData.budget.trim()) return;
    if (step === 4 && !formData.usageDate.trim()) return;

    if (step === 1) {
      void pushLocalMessages([
        { role: "user", text: `วัตถุประสงค์: ${formData.objective}` },
        { role: "assistant", text: "รับทราบวัตถุประสงค์ครับ ขั้นต่อไปกรุณาระบุ **จำนวนหรือขอบเขตงาน** ที่ต้องการ (เช่น 10 เครื่อง, 1 ระบบงาน)" },
      ]);
      setStep(2);
    } else if (step === 2) {
      void pushLocalMessages([
        { role: "user", text: `จำนวน/ขอบเขต: ${formData.quantity}` },
        { role: "assistant", text: "ต่อไปกรุณาระบุ **วงเงินงบประมาณโดยประมาณ (บาท)** ครับ" },
      ]);
      setStep(3);
    } else if (step === 3) {
      void pushLocalMessages([
        { role: "user", text: `งบประมาณ: ${Number(formData.budget).toLocaleString()} บาท` },
        { role: "assistant", text: "สุดท้าย กรุณาระบุ **กำหนดวันที่ต้องการใช้งานพัสดุ/เริ่มโครงการ** ครับ" },
      ]);
      setStep(4);
    } else if (step === 4) {
      const summaryQuery = `ต้องการจัดซื้อ/จ้าง: ${formData.objective} จำนวน: ${formData.quantity} วงเงินงบประมาณ: ${formData.budget} บาท กำหนดใช้งาน: ${formData.usageDate} ขอคำแนะนำวิธีจัดซื้อจัดจ้างและเอกสารที่ต้องเตรียมตามระเบียบ พ.ร.บ. จัดซื้อจัดจ้างฯ`;

      setStep(5);

      setSla(
        determineSla({
          budget: Number(formData.budget) || 0,
          itemType: `${formData.objective} ${formData.procurementType}`,
          dateNeeded: formData.usageDate,
        }),
      );

      void runConsultation(summaryQuery);
    }
  };

  const runConsultation = (query: string, image?: AttachedImage) => {
    if (pendingRef.current) return;
    pendingRef.current = true;

    startTransition(async () => {
      try {
        const sid = await ensureSessionId();
        if (!sid) {
          throw new Error("ไม่สามารถเปิดการสนทนาได้ กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง");
        }

        const history = chatLog
          .filter((m) => !m.pending)
          .map((m) => ({ role: m.role, content: m.text }))
          .slice(-10);

        setChatLog((prev) => [
          ...prev.filter((m) => !m.pending),
          {
            role: "user",
            text: query || "(แนบรูปภาพวัสดุ/อุปกรณ์เพื่อขอคำแนะนำ)",
            pending: false,
            imagePreviewUrl: image?.previewUrl,
          },
          {
            role: "assistant",
            text: image
              ? "กำลังวิเคราะห์รูปภาพและค้นหาข้อระเบียบที่เกี่ยวข้อง..."
              : "กำลังค้นหาข้อระเบียบจากคลังความรู้ในระบบ และวิเคราะห์คำแนะนำตามระเบียบพัสดุ...",
            pending: true,
          },
        ]);

        const res = await fetch("/api/ai/consult", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            history,
            sessionId: sid,
            image: image ? { base64: image.base64, mimeType: image.mimeType } : undefined,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "ไม่สามารถเชื่อมต่อระบบ AI ได้");
        }
        const data = await res.json();

        lastExchangeRef.current = {
          query: query || "วิเคราะห์วัสดุ/อุปกรณ์จากรูปภาพที่แนบ",
          answer: data.answer,
        };

        setChatLog((prev) => {
          const base = prev.filter((m) => !m.pending);
          return [
            ...base,
            {
              role: "assistant",
              text: data.answer,
              citations: data.citations,
              confidence: data.confidenceScore,
              showFollowUps: true,
            },
          ];
        });
      } catch (err: unknown) {
        setChatLog((prev) => {
          const base = prev.filter((m) => !m.pending);
          return [
            ...base,
            {
              role: "assistant",
              text: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "ระบบไม่สามารถตอบกลับได้ชั่วคราว"}`,
            },
          ];
        });
      } finally {
        pendingRef.current = false;
        if (image) {
          URL.revokeObjectURL(image.previewUrl);
        }
      }
    });
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!customQuery.trim() && !attachedImage) || isPending) return;
    const q = customQuery.trim();
    const image = attachedImage;
    setCustomQuery("");
    setAttachedImage(null);
    runConsultation(q, image ?? undefined);
  };

  const handleSuggestion = (question: string) => {
    if (isPending) return;
    setCustomQuery("");
    runConsultation(question);
  };

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    setImageError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WEBP");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError("ไฟล์รูปภาพมีขนาดใหญ่เกินไป (จำกัดไม่เกิน 6MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setImageError("ไม่สามารถอ่านไฟล์รูปภาพได้");
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      setAttachedImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return {
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType: file.type,
        };
      });
    };
    reader.onerror = () => setImageError("ไม่สามารถอ่านไฟล์รูปภาพได้");
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachedImage = () => {
    setAttachedImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGoDraftTor = () => {
    const exchange = lastExchangeRef.current;
    saveTorPrefill({
      objective: formData.objective || exchange?.query || "",
      scope: exchange?.answer || "",
      quantity: formData.quantity,
      budget: formData.budget,
      usageDate: formData.usageDate,
      procurementType: formData.procurementType,
      procurementMethod: formData.procurementMethod,
      aiSummary: exchange?.answer ?? "",
    });
    router.push("/tor");
  };

  const handleSelectForm = () => {
    setIsFormError(false);
    setFormResult(null);
    const fd = new FormData();
    fd.append("itemType", formData.objective || formData.procurementType);
    fd.append("budget", formData.budget || "0");
    fd.append("note", formData.quantity || "");
    startSelectForm(async () => {
      const result = await selectFormForConsult(null, fd);
      setFormResult(result);
      if (!result.success) setIsFormError(true);
      if (result.success && result.template) {
        const autofill = mapAutofill(formData);
        const initial: Record<string, string> = {};
        for (const def of result.template.placeholders) {
          initial[def.key] = autofill[def.key] ?? "";
        }
        setFormValues(initial);
      }
    });
  };

  const handleFillDownload = (templateId: string) => {
    const fd = new FormData();
    fd.append("templateId", templateId);
    for (const [key, value] of Object.entries(formValues)) {
      if (value) fd.append(key, value);
    }
    fillAction(fd);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    fd.set("title", `คำขอจัดซื้อจัดจ้าง: ${formData.objective}`);
    fd.set("objective", formData.objective);
    fd.set("budget", formData.budget || "0");
    fd.set("procurementType", formData.procurementType);
    fd.set("itemType", formData.objective);
    submitAction(fd);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">SMART PROCUREMENT ADVISOR</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ปรึกษาความต้องการจัดซื้อจัดจ้าง</h1>
          <p className="text-sm text-stone-500">แชทปรึกษากับที่ปรึกษาพัสดุ AI — ค้นหา สรุป และแนะนำจากคลังความรู้ระเบียบ + ความรู้กระทรวงการคลัง เน้นความถูกต้องตามระเบียบ</p>
        </div>
        {step < 5 && (
          <div className="flex items-center gap-2">
            <Chip color="accent" size="sm" variant="soft">
              ขั้นตอนที่ {Math.min(step, 4)} / 4
            </Chip>
          </div>
        )}
      </div>

      {step < 5 && (
        <ProgressBar aria-label="ความคืบหน้าการกรอกข้อมูล" className="h-1.5" value={(Math.min(step, 4) / 4) * 100} />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Chat Interaction */}
        <Card className="flex flex-col border border-stone-200 bg-white shadow-sm">
          <Card.Header className="border-b border-stone-100 bg-stone-50/50 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <Card.Title className="text-base font-bold text-[#272522]">แชทปรึกษากับที่ปรึกษาพัสดุ AI</Card.Title>
                <Card.Description className="text-xs text-stone-500">
                  ถาม-ตอบเรื่องระเบียบพัสดุและ workflow ได้ทุกเรื่อง AI จะค้นหาคลังความรู้ในระบบก่อน แล้วเสริมด้วยความรู้กระทรวงการคลัง
                </Card.Description>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSessionLoading && (
                  <Chip size="sm" variant="soft" color="default" className="text-[0.6rem]">
                    <span className="flex items-center gap-1"><FiRefreshCw className="animate-spin" size={10} /> กำลังโหลด...</span>
                  </Chip>
                )}
                <Tooltip.Root>
                  <Tooltip.Trigger className="inline-flex">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={handleNewSession}
                      isDisabled={isSessionLoading || isPending}
                      className="border-stone-300 text-stone-600 text-xs"
                    >
                      <FiRefreshCw size={13} /> เริ่มใหม่
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white">
                    เริ่มบทสนทนาใหม่ (ล้างประวัติสนทนาและเริ่ม Wizard ใหม่)
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
            </div>
          </Card.Header>

          <Card.Content ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 max-h-[550px]">
            {chatLog
              .filter((msg, i) => !(i === 0 && msg.role === "assistant" && chatLog.length > 1))
              .map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[90%] rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#e87722] text-white"
                      : "border border-stone-200 bg-stone-50 text-stone-800"
                  }`}
                >
                  {msg.imagePreviewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.imagePreviewUrl}
                      alt="รูปภาพวัสดุ/อุปกรณ์ที่แนบ"
                      className="mb-2 max-h-48 w-auto rounded-xl border border-white/30 object-cover"
                    />
                  )}

                  {msg.pending ? (
                    <div className="flex items-center gap-2 text-stone-500">
                      <FiRefreshCw className="animate-spin text-[#e87722]" size={16} />
                      <span>{msg.text}</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {!msg.pending && msg.confidence !== undefined && (
                    <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-2 text-xs text-stone-600">
                      <span>ความมั่นใจของ AI:</span>
                      <Chip color={msg.confidence > 0.7 ? "success" : "warning"} size="sm" variant="soft">
                        {(msg.confidence * 100).toFixed(0)}%
                      </Chip>
                      {msg.confidence <= 0.5 && (
                        <span className="text-[0.65rem] text-amber-600">ควรตรวจสอบกับเจ้าหน้าที่พัสดุ</span>
                      )}
                    </div>
                  )}

                  {!msg.pending && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-stone-200 pt-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-[#b95817]">
                        <FiFileText size={13} /> แหล่งอ้างอิงระเบียบที่เกี่ยวข้อง:
                      </p>
                      <div className="space-y-1.5">
                        {msg.citations.map((cite, idx) => (
                          <div key={idx} className="rounded-xl border border-stone-200/80 bg-white p-2.5 text-xs text-stone-700 shadow-2xs">
                            <div className="flex items-center justify-between font-semibold text-[#272522]">
                              <span>{cite.documentTitle} {cite.section ? `(${cite.section})` : ""}</span>
                              <span className="text-[0.65rem] text-stone-400">Match: {(cite.relevanceScore * 100).toFixed(0)}%</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-stone-500">{cite.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!msg.pending && msg.role === "assistant" && msg.showFollowUps && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-200 pt-2.5">
                      <button
                        type="button"
                        onClick={handleGoDraftTor}
                        className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-[#b95817] transition hover:bg-orange-50"
                      >
                        <FiEdit3 size={12} /> ไปร่าง TOR ต่อ
                      </button>
                      <Link
                        href="/forms"
                        className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-stone-600 transition hover:bg-stone-50"
                      >
                        <FiFileText size={12} /> ไปกรอกแบบฟอร์มจัดซื้อ
                      </Link>
                      <Link
                        href="/quotation"
                        className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-stone-600 transition hover:bg-stone-50"
                      >
                        <FiSearch size={12} /> ไปตรวจใบเสนอราคา
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}


          </Card.Content>

          <div className="border-t border-stone-100 p-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                handleFileSelected(file);
              }}
            />

            {attachedImage && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImage.previewUrl}
                  alt="ภาพที่เลือก"
                  className="h-14 w-14 rounded-lg border border-stone-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#272522]">{attachedImage.file.name}</p>
                  <p className="text-[0.65rem] text-stone-500">
                    {(attachedImage.file.size / 1024).toFixed(0)} KB — AI จะวิเคราะห์ภาพนี้พร้อมคำถามของคุณ
                  </p>
                </div>
                <Button
                  type="button"
                  isIconOnly
                  size="sm"
                  variant="outline"
                  onPress={handleRemoveAttachedImage}
                  className="text-stone-500"
                >
                  <FiX size={14} />
                </Button>
              </div>
            )}

            {imageError && (
              <Alert status="danger" className="mb-2 rounded-xl">
                <Alert.Description className="text-xs">{imageError}</Alert.Description>
              </Alert>
            )}

            <form onSubmit={handleCustomSend} className="flex gap-2">
              <Button
                type="button"
                isIconOnly
                isDisabled={isPending}
                variant="outline"
                onPress={() => fileInputRef.current?.click()}
                className="shrink-0 text-stone-500"
              >
                <FiPaperclip size={16} />
              </Button>
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="พิมพ์คำถาม หรือแนบรูปภาพวัสดุ/อุปกรณ์เพื่อให้ AI วิเคราะห์และแนะนำวิธีจัดซื้อ..."
                className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-[#e87722]"
                disabled={isPending}
              />
              <Button
                isIconOnly
                type="submit"
                isDisabled={isPending || (!customQuery.trim() && !attachedImage)}
                className="bg-[#e87722] text-white"
              >
                <FiSend size={16} />
              </Button>
            </form>
            <p className="mt-1.5 text-[0.6rem] text-stone-400">
              AI ค้นหาและอ้างอิงจากคลังความรู้ระเบียบในระบบก่อน หากไม่มี จะใช้ความรู้ระเบียบพัสดุของกระทรวงการคลัง และควรตรวจสอบกับเจ้าหน้าที่พัสดุก่อนดำเนินการ
            </p>

            {chatLog.length <= 1 && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <p className="mb-2 text-[0.7rem] font-bold text-stone-500 flex items-center gap-1.5">
                  <FiHelpCircle size={13} /> คำถามแนะนำที่สอบถามได้บ่อย:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSuggestion(q)}
                      disabled={isPending}
                      className="rounded-full border border-orange-200 bg-orange-50/60 px-3 py-1.5 text-left text-[0.7rem] font-medium text-[#71320c] transition hover:bg-orange-100 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Summary, SLA, Roadmap, Form Router */}
        <div className="space-y-6">
          {step < 5 ? (
            <Card className="border border-stone-200 bg-white p-5 shadow-sm">
              <Card.Header className="px-0 pt-0">
                <p className="text-xs font-bold text-[#b95817]">ขั้นตอนที่ {step} จาก 4</p>
                <Card.Title className="text-lg font-bold text-[#272522]">
                  {step === 1 && "1. วัตถุประสงค์ความต้องการ"}
                  {step === 2 && "2. จำนวนและขอบเขต"}
                  {step === 3 && "3. ประมาณการงบประมาณ"}
                  {step === 4 && "4. ระยะเวลาการใช้งาน"}
                </Card.Title>
              </Card.Header>

              <Card.Content className="px-0 pt-3">
                <form onSubmit={handleStepSubmit} className="space-y-4">
                  {step === 1 && (
                    <TextField isRequired name="objective">
                      <Label>ต้องการจัดซื้อจัดจ้างอะไร และเพื่ออะไร?</Label>
                      <Input
                        value={formData.objective}
                        onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                        placeholder="เช่น จัดซื้อเครื่องคอมพิวเตอร์พร้อมอุปกรณ์ สำหรับห้องปฏิบัติการ AI"
                      />
                    </TextField>
                  )}

                  {step === 2 && (
                    <TextField isRequired name="quantity">
                      <Label>จำนวน / ปริมาณงาน</Label>
                      <Input
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="เช่น 20 เครื่อง พร้อมติดตั้งระบบเครือข่าย"
                      />
                    </TextField>
                  )}

                  {step === 3 && (
                    <TextField isRequired name="budget" type="number">
                      <Label>วงเงินงบประมาณ (บาท)</Label>
                      <Input
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        placeholder="เช่น 500000"
                        min={1}
                      />
                    </TextField>
                  )}

                  {step === 4 && (
                    <TextField isRequired name="usageDate" type="date">
                      <Label>วันที่ต้องการเริ่มใช้งาน</Label>
                      <Input
                        value={formData.usageDate}
                        onChange={(e) => setFormData({ ...formData, usageDate: e.target.value })}
                      />
                    </TextField>
                  )}

                  <Button type="submit" fullWidth className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]">
                    ถัดไป <FiArrowRight />
                  </Button>
                </form>
              </Card.Content>
            </Card>
          ) : (
            <>
              {/* Summary Card */}
              <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
                <Card.Header className="px-0 pt-0">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold">
                    <FiCheckCircle size={20} />
                    <span>สรุปคำแนะนำการจัดหา</span>
                  </div>
                </Card.Header>

                <Card.Content className="px-0 space-y-4 text-sm">
                  <div className="rounded-2xl bg-stone-50 p-4 space-y-2 border border-stone-200">
                    <div className="flex justify-between">
                      <span className="text-stone-500">ประเภทการจัดหา:</span>
                      <span className="font-semibold">{Number(formData.budget) <= 500000 ? "วิธีเฉพาะเจาะจง" : "วิธี e-Bidding (ประกวดราคาอิเล็กทรอนิกส์)"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">วงเงินงบประมาณ:</span>
                      <span className="font-semibold">{Number(formData.budget).toLocaleString()} บาท</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">ผู้มีอำนาจอนุมัติ:</span>
                      <span className="font-semibold">{Number(formData.budget) <= 2000000 ? "คณบดีคณะสหวิทยาการ" : "อธิการบดีมหาวิทยาลัยขอนแก่น"}</span>
                    </div>
                  </div>

                  <Alert status="accent" className="rounded-2xl">
                    <Alert.Title className="text-xs font-bold">เอกสารขั้นตอนถัดไปที่ต้องเตรียม:</Alert.Title>
                    <Alert.Description className="text-xs">
                      1. ใบเสนอราคาอย่างน้อย 1 รายการ (กรณีเฉพาะเจาะจง)<br />
                      2. ร่างข้อกำหนดและขอบเขตงาน (TOR)<br />
                      3. บันทึกข้อความขออนุมัติจัดซื้อจัดจ้าง
                    </Alert.Description>
                  </Alert>

                  <div className="pt-2 flex flex-col gap-2">
                    <a
                      href="/quotation"
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#e87722] py-2.5 text-sm font-bold text-white transition hover:bg-[#c85f13]"
                    >
                      ไปหน้าตรวจใบเสนอราคา (Quotation Inspector) <FiArrowRight />
                    </a>
                    <a
                      href="/tor"
                      className="flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-2.5 text-sm font-semibold text-[#272522] hover:bg-stone-50"
                    >
                      ไปหน้าร่าง TOR (TOR Generator)
                    </a>
                  </div>
                </Card.Content>
              </Card>

              {/* SLA Lead-Time Calculator */}
              {sla && (
                <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-3">
                  <Card.Header className="px-0 pt-0 flex items-center justify-between">
                    <Card.Title className="text-sm font-bold text-[#272522] flex items-center gap-2">
                      <FiClock className="text-[#b95817]" /> SLA ระยะเวลาดำเนินการ
                    </Card.Title>
                    <Badge
                      variant="primary"
                      color={sla.urgency === "ok" ? "success" : sla.urgency === "risk" ? "warning" : "danger"}
                      className="text-[0.65rem]"
                    >
                      {sla.kind}
                    </Badge>
                  </Card.Header>
                  <Card.Content className="px-0 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-xs border border-stone-200">
                      <span className="text-stone-500">เวลามาตรฐาน (SLA):</span>
                      <span className="font-bold text-[#272522]">{sla.slaText}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-xs border border-stone-200">
                      <span className="text-stone-500">เริ่มดำเนินการ:</span>
                      <span className="font-semibold">{sla.startDate}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3 text-xs border border-stone-200">
                      <span className="text-stone-500">คาดว่าดำเนินการแล้วเสร็จ:</span>
                      <span className="font-semibold">{sla.endDate}</span>
                    </div>

                    {sla.urgency !== "ok" && (
                      <Alert status={sla.urgency === "critical" ? "danger" : "warning"} className="rounded-xl">
                        <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
                          <FiAlertTriangle /> ความเสี่ยงจัดซื้อไม่ทันแผนงาน
                        </Alert.Title>
                        <Alert.Description className="text-xs">
                          {sla.urgency === "critical"
                            ? `กำหนดใช้งาน ${formData.usageDate} สั้นกว่า SLA มาก (${sla.slaText}) ควรพิจารณาเร่งรัดหรือแจ้งหน่วยงานที่เกี่ยวข้องเพื่อวางแผนล่วงหน้า`
                            : `กำหนดใช้งาน ${formData.usageDate} ใกล้เคียงกับ SLA (${sla.slaText}) แนะนำให้เริ่มดำเนินการโดยเร็วเพื่อลดความเสี่ยง`}
                        </Alert.Description>
                      </Alert>
                    )}
                  </Card.Content>
                </Card>
              )}

              {/* Visual Process Roadmap */}
              {sla && (
                <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-3">
                  <Card.Header className="px-0 pt-0">
                    <Card.Title className="text-sm font-bold text-[#272522] flex items-center gap-2">
                      <FiPackage className="text-[#b95817]" /> ขั้นตอนกระบวนการ (Roadmap)
                    </Card.Title>
                  </Card.Header>
                  <Card.Content className="px-0">
                    <ol className="relative space-y-4 border-l-2 border-orange-100 pl-5 ml-1">
                      {sla.steps.map((s, idx) => (
                        <li key={idx} className="relative">
                          <span className="absolute -left-[29px] top-0 grid h-5 w-5 place-items-center rounded-full bg-[#e87722] text-[0.6rem] font-bold text-white ring-4 ring-orange-50">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-bold text-[#272522]">{s.title}</p>
                          <p className="text-[0.7rem] text-stone-500">{s.description}</p>
                          <span className="text-[0.65rem] font-semibold text-[#b95817]">{s.days}</span>
                        </li>
                      ))}
                    </ol>
                  </Card.Content>
                </Card>
              )}

              {/* Form Router & Auto-Filler */}
              <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
                <Card.Header className="px-0 pt-0">
                  <Card.Title className="text-sm font-bold text-[#272522] flex items-center gap-2">
                    <FiFileText className="text-[#b95817]" /> เลือกแบบฟอร์มเอกสารอัตโนมัติ
                  </Card.Title>
                  <Card.Description className="text-xs text-stone-500">
                    ระบบจับคู่ประเภทพัสดุ + วงเงิน กับแบบฟอร์ม .docx ในคลังแบบฟอร์มโดยอัตโนมัติ
                  </Card.Description>
                </Card.Header>

                <Card.Content className="px-0 space-y-4">
                  {!formResult && (
                    <div className="flex items-center gap-2">
                      <Button
                        onPress={handleSelectForm}
                        isDisabled={isSelectingForm}
                        className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13] text-xs"
                      >
                        <FiSearch /> {isSelectingForm ? "กำลังค้นหาแบบฟอร์ม..." : "ค้นหาแบบฟอร์มที่ต้องใช้"}
                      </Button>
                    </div>
                  )}

                  {isFormError && formResult && !formResult.success && (
                    <Alert status="danger" className="rounded-xl">
                      <Alert.Description className="text-xs">{formResult.error}</Alert.Description>
                    </Alert>
                  )}

                  {formResult?.success && formResult.template && (
                    <>
                      <div className="flex items-start justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FiFileText className="text-[#e87722] shrink-0" size={18} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#272522]">{formResult.template.fileName}</p>
                            <p className="text-[0.68rem] text-stone-500">หมวด: {formResult.template.category}</p>
                          </div>
                        </div>
                        <Chip color="success" size="sm" variant="soft">
                          จับคู่แล้ว
                        </Chip>
                      </div>

                      <div className="rounded-xl border border-stone-200 p-3 space-y-3">
                        <p className="text-xs font-bold text-stone-600">
                          กรอกข้อมูล (Pre-fill จากบทสนทนาแล้ว — แก้ไขได้)
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {formResult.template.placeholders.map((def: FormPlaceholderDef) => (
                            <div key={def.key} className="space-y-1">
                              <label className="text-[0.68rem] font-bold text-stone-500">
                                {def.label}
                                {def.required && <span className="text-red-500"> *</span>}
                              </label>
                              {def.type === "textarea" ? (
                                <textarea
                                  value={formValues[def.key] ?? ""}
                                  onChange={(e) => setFormValues({ ...formValues, [def.key]: e.target.value })}
                                  rows={2}
                                  className="w-full rounded-lg border border-stone-200 p-2 text-xs focus:border-[#e87722] focus:outline-none"
                                />
                              ) : (
                                <input
                                  type={def.type === "date" ? "date" : def.type === "number" ? "number" : "text"}
                                  value={formValues[def.key] ?? ""}
                                  onChange={(e) => setFormValues({ ...formValues, [def.key]: e.target.value })}
                                  className="w-full rounded-lg border border-stone-200 px-2 py-2 text-xs focus:border-[#e87722] focus:outline-none"
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                          <Button
                            onPress={() => handleFillDownload(formResult.template!.id)}
                            isDisabled={isFilling}
                            className="bg-[#272522] font-semibold text-white hover:bg-black text-xs"
                          >
                            <FiDownload /> {isFilling ? "กำลังสร้างไฟล์..." : "ดาวน์โหลดเอกสาร (.docx)"}
                          </Button>

                          {fillState?.error && (
                            <Alert status="danger" className="rounded-xl">
                              <Alert.Description className="text-xs">{fillState.error}</Alert.Description>
                            </Alert>
                          )}
                          {fillState?.success && (
                            <Alert status="success" className="rounded-xl">
                              <Alert.Description className="text-xs font-semibold flex items-center gap-1.5">
                                <FiCheck /> สร้างไฟล์ {fillState.fileName} เรียบร้อย (ตรวจสอบในโฟลเดอร์ดาวน์โหลด)
                              </Alert.Description>
                            </Alert>
                          )}

                          <form onSubmit={handleSubmitRequest} className="flex flex-col gap-2 pt-1">
                            <input type="hidden" name="title" />
                            <input type="hidden" name="objective" value={formData.objective} />
                            <input type="hidden" name="budget" value={formData.budget} />
                            <input type="hidden" name="procurementType" value={formData.procurementType} />
                            <input type="hidden" name="itemType" value={formData.objective} />
                            <Button
                              type="submit"
                              isDisabled={isSubmitting}
                              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700 text-xs"
                            >
                              <FiCheckCircle /> {isSubmitting ? "กำลังส่งคำขอ..." : "ส่งคำขอไปยังเจ้าหน้าที่พัสดุ"}
                            </Button>
                          </form>

                          {submitState?.error && (
                            <Alert status="danger" className="rounded-xl">
                              <Alert.Description className="text-xs">{submitState.error}</Alert.Description>
                            </Alert>
                          )}
                          {submitState?.success && (
                            <Alert status="success" className="rounded-xl">
                              <Alert.Description className="text-xs font-semibold">
                                ส่งคำขอสำเร็จ รหัสคำขอ: <span className="font-bold">#{submitState.requestId}</span> — เจ้าหน้าที่พัสดุจะตรวจสอบและติดต่อกลับ
                              </Alert.Description>
                            </Alert>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </Card.Content>
              </Card>

              {/* Guidelines Box */}
              <div className="rounded-2xl border border-stone-200 bg-orange-50/50 p-4 text-xs text-[#71320c]">
                <p className="font-bold flex items-center gap-1.5 mb-1.5">
                  <FiHelpCircle /> ข้อพิจารณาตามระเบียบ มข.
                </p>
                <ul className="list-disc list-inside space-y-1 text-stone-600">
                  <li>งบประมาณไม่เกิน 500,000 บาท สามารถจัดซื้อโดยวิธีเฉพาะเจาะจงได้</li>
                  <li>การซื้อเครื่องคอมพิวเตอร์ต้องอิงตามเกณฑ์ราคากลาง ICT ประจำปี</li>
                  <li>การขอจัดซื้อต้องดำเนินการล่วงหน้าอย่างน้อย 15-30 วันทำการ</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
