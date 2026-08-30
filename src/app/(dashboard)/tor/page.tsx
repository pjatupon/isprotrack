"use client";

import { useState, useActionState, useEffect, useTransition, useMemo, useRef } from "react";
import {
  Button,
  Card,
  TextField,
  Label,
  Input,
  Alert,
  Chip,
  Select,
  Badge,
  Toast,
} from "@heroui/react";
import {
  FiFileText,
  FiAlertOctagon,
  FiSave,
  FiDownload,
  FiCheck,
  FiClock,
  FiPlus,
  FiCpu,
  FiInfo,
  FiRotateCcw,
  FiShield,
} from "react-icons/fi";
import { ListBox, ListBoxItem } from "react-aria-components";
import { saveTorDraft } from "@/app/actions/procurement";
import { analyzeTorSpec, highlightTorText } from "@/lib/ai/tor-analysis";
import { loadTorVersions, type TorVersionView } from "./actions";
import { consumeTorPrefill } from "@/lib/ai/consult-handoff";

type Citation = {
  chunkId: string;
  content: string;
  section: string | null;
  documentTitle: string;
  relevanceScore: number;
};

type AiDraftResult = {
  sections: {
    objective: string;
    scope: string;
    specifications: string;
    deliverables: string;
    inspectionCriteria: string;
  };
  notes: string[];
  citations: Citation[];
  confidenceScore: number;
  usedKnowledgeBase: boolean;
} | null;

type AiReviewIssue = {
  type: "lockin" | "ambiguous" | "noncompliant" | "missing";
  quote: string;
  detail: string;
  suggestion: string;
};

type AiReviewResult = {
  issues: AiReviewIssue[];
  summary: string;
  citations: Citation[];
  confidenceScore: number;
  usedKnowledgeBase: boolean;
} | null;

type TorData = {
  requestId: string;
  projectTitle: string;
  objective: string;
  scope: string;
  specifications: string;
  deliverables: string;
  inspectionCriteria: string;
  isLockInRisk: boolean;
};

type WizardKind = "ครุภัณฑ์" | "จ้างเหมา" | "สิ่งก่อสร้าง" | "จำเพาะเจาะจง";

const WIZARD_SECTIONS: Record<WizardKind, { objective: string; scope: string; deliverables: string; inspectionCriteria: string }> = {
  "ครุภัณฑ์": {
    objective: "เพื่อใช้ใน... (ระบุวัตถุประสงค์การใช้พัสดุ) สนับสนุนการดำเนินงานของ...",
    scope: "จัดหา {รายการครุภัณฑ์} จำนวน {N} รายการ พร้อมติดตั้ง ทดสอบการใช้งาน และฝึกอบรมการใช้งานแก่ผู้ปฏิบัติงาน",
    deliverables: "ส่งมอบพัสดุครบถ้วนตามรายการ พร้อมคู่มือการใช้งานและใบรับประกันสินค้า ภายใน {N} วัน นับถัดจากวันลงนามในสัญญา",
    inspectionCriteria: "คณะกรรมการตรวจรับพัสดุจะดำเนินการทดสอบการทำงานของพัสดุ ตรวจสอบเอกสารการรับประกัน และรายงานผลการตรวจรับตามระเบียบ",
  },
  "จ้างเหมา": {
    objective: "เพื่อให้ได้ผู้รับจ้างดำเนินงานบริการ/เหมาจ้าง... (ระบุขอบเขตงานบริการ) อย่างมีคุณภาพตามกำหนดเวลา",
    scope: "ผู้รับจ้างต้องดำเนินงานตามขอบเขตดังนี้: (1) ... (2) ... พร้อมส่งมอบรายงานผลการดำเนินงานตามระยะเวลาที่กำหนด",
    deliverables: "ผู้รับจ้างต้องส่งมอบงานแล้วเสร็จภายใน {N} วัน นับถัดจากวันลงนามในสัญญา พร้อมรายงานสรุปผลการดำเนินงาน",
    inspectionCriteria: "คณะกรรมการตรวจรับงานจ้างจะตรวจสอบผลงานตามข้อกำหนด ขอบเขตงาน และหลักฐานการส่งมอบงานตามสัญญา",
  },
  "สิ่งก่อสร้าง": {
    objective: "เพื่อดำเนินการก่อสร้าง/ปรับปรุง/ซ่อมแซม... (ระบุรายละเอียดงานก่อสร้าง) ให้ได้มาตรฐานตามแบบรูปรายการ",
    scope: "ดำเนินการก่อสร้าง/ปรับปรุง ตามแบบรูปรายการและรายละเอียดประกอบแบบแนบท้ายสัญญา พร้อมทั้งจัดการพื้นที่หน้างานให้ปลอดภัยตามกฎหมาย",
    deliverables: "ผู้รับจ้างต้องดำเนินการให้แล้วเสร็จภายใน {N} วัน นับถัดจากวันลงนามในสัญญา พร้อมทำความสะอาดพื้นที่ส่งมอบงาน",
    inspectionCriteria: "คณะกรรมการตรวจรับงานจ้างตรวจรับงานตามแบบรูปรายการ สัญญา และข้อกำหนด ประกอบการตรวจสอบงานที่ซ่อนเร้นตามหลักวิชาชีพ",
  },
  "จำเพาะเจาะจง": {
    objective: "เพื่อจัดหาพัสดุ/บริการ... (ระบุรายการ) ตามความจำเป็นเร่งด่วน/มีผู้ประกอบการรายเดียวที่ตรงตามความต้องการ",
    scope: "จัดหา {รายการ} จำนวน {N} รายการ ตามคุณลักษณะที่กำหนดโดยวิธีเฉพาะเจาะจง",
    deliverables: "ส่งมอบพัสดุครบถ้วนภายใน {N} วัน นับถัดจากวันลงนาม",
    inspectionCriteria: "ตรวจรับพัสดุตามรายการที่สั่งซื้อ พร้อมตรวจสอบความถูกต้องครบถ้วนของเอกสาร",
  },
};

type SaveState = { success?: boolean; message?: string; error?: string } | null;

export default function TorPage() {
  const [torData, setTorData] = useState<TorData>({
    requestId: "req_demo_001",
    projectTitle: "",
    objective: "",
    scope: "",
    specifications: "",
    deliverables: "",
    inspectionCriteria: "",
    isLockInRisk: false,
  });
  const [wizardKind, setWizardKind] = useState<WizardKind>("ครุภัณฑ์");
  const [versions, setVersions] = useState<TorVersionView[]>([]);
  const [state, formAction, isPending] = useActionState<SaveState, FormData>(saveTorDraft, null);
  const [isLoadingVersions, startLoad] = useTransition();
  const [aiDraft, setAiDraft] = useState<AiDraftResult>(null);
  const [aiReview, setAiReview] = useState<AiReviewResult>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDrafting, startDraft] = useTransition();
  const [isReviewing, startReview] = useTransition();
  const [isExporting, startExport] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  const [consultPrefill, setConsultPrefill] = useState<{
    quantity: string;
    budget: string;
    usageDate: string;
    procurementType: string;
    aiSummary: string;
  } | null>(null);
  const [autoDraftRequested, setAutoDraftRequested] = useState(false);

  const analysis = useMemo(() => analyzeTorSpec(torData.specifications), [torData.specifications]);
  const isLockInRisk = analysis.lockInIssues.length > 0;

  useEffect(() => {
    if (torData.requestId.trim()) {
      startLoad(async () => {
        const result = await loadTorVersions(torData.requestId.trim());
        if (result.success && result.versions) setVersions(result.versions);
      });
    }
  }, [torData.requestId]);

  useEffect(() => {
    const stored = sessionStorage.getItem("quotation_draft");
    if (!stored) return;
    let data: {
      vendorName?: string;
      grandTotal?: number;
      items?: { name: string; quantity: number; unit: string; unitPrice: number }[];
    };
    try {
      data = JSON.parse(stored);
    } catch {
      return;
    }
    const itemsText = (data.items || [])
      .map((item) => `${item.name} จำนวน ${item.quantity} ${item.unit} ราคา ${item.unitPrice.toLocaleString()} บาท`)
      .join("\n");
    const objective = `จัดหาพัสดุตามใบเสนอราคาจาก ${data.vendorName || "ผู้ขาย"} วงเงิน ${Number(data.grandTotal || 0).toLocaleString()} บาท`;
    const scope = itemsText || "ตามรายการในใบเสนอราคา";
    queueMicrotask(() => {
      setTorData((prev) => ({ ...prev, objective, scope }));
    });
  }, []);

  useEffect(() => {
    const prefill = consumeTorPrefill();
    if (prefill && (prefill.objective || prefill.scope)) {
      const objective = prefill.objective;
      const scope = prefill.scope;
      const projectTitle = objective.split("\n")[0].slice(0, 80);
      const quantity = prefill.quantity || "";
      const budget = prefill.budget || "";
      const usageDate = prefill.usageDate || "";
      const procurementType = prefill.procurementType || "";
      const aiSummary = prefill.aiSummary || "";

      queueMicrotask(() => {
        setTorData((prev) => ({
          ...prev,
          objective: objective || prev.objective,
          scope: scope || prev.scope,
          projectTitle: prev.projectTitle || projectTitle,
        }));
        if (procurementType) {
          setConsultPrefill({ quantity, budget, usageDate, procurementType, aiSummary });
        }
        setAutoDraftRequested(!!aiSummary);
      });
    }
  }, []);

  const applyWizard = () => {
    const section = WIZARD_SECTIONS[wizardKind];
    setTorData((prev) => ({
      ...prev,
      objective: section.objective,
      scope: section.scope,
      deliverables: section.deliverables,
      inspectionCriteria: section.inspectionCriteria,
    }));
  };

  const highlightParts = highlightTorText(torData.specifications, analysis);
  const totalIssues = analysis.lockInIssues.length + analysis.ambiguityIssues.length;

  const handleExport = async () => {
    const fallback = aiDraft?.sections;
    const objective = torData.objective.trim() || fallback?.objective?.trim() || "";
    const scope = torData.scope.trim() || fallback?.scope?.trim() || "";
    const specifications = torData.specifications.trim() || fallback?.specifications?.trim() || "";
    const deliverables = torData.deliverables.trim() || fallback?.deliverables?.trim() || "";
    const inspectionCriteria = torData.inspectionCriteria.trim() || fallback?.inspectionCriteria?.trim() || "";

    if (!objective || !scope || !specifications) {
      setExportError("ยังไม่มีเนื้อหา TOR ให้ส่งออก — กรุณากรอกฟอร์มหรือให้ AI ร่าง TOR ก่อน แล้วกด \"นำไปใส่ในฟอร์ม\"");
      Toast.toast.danger("ยังไม่มีเนื้อหา TOR ให้ส่งออก กรุณากรอกฟอร์มหรือให้ AI ร่างก่อน");
      return;
    }
    setExportError(null);
    startExport(async () => {
      try {
        const res = await fetch("/api/tor/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: torData.projectTitle || "ร่างข้อกำหนดและขอบเขตงาน (TOR)",
            objective,
            scope,
            specifications,
            deliverables,
            inspectionCriteria,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "ไม่สามารถสร้างไฟล์ .docx ได้");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const disposition = res.headers.get("Content-Disposition") || "";
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        const fileName = utf8Match?.[1]
          ? decodeURIComponent(utf8Match[1])
          : "ร่างข้อกำหนดและขอบเขตงาน (TOR).docx";
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        Toast.toast.success(`สร้างไฟล์ ${fileName} เรียบร้อยแล้ว`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการสร้างไฟล์ .docx";
        setExportError(message);
        Toast.toast.danger(message);
      }
    });
  };

  const loadVersion = (v: TorVersionView) => {
    setTorData((prev) => ({
      ...prev,
      objective: v.objective,
      scope: v.scope,
      specifications: v.specifications,
      deliverables: v.deliverables,
      inspectionCriteria: v.inspectionCriteria,
    }));
  };

  const runAiDraft = () => {
    if (!torData.objective.trim()) {
      setAiError("กรุณากรอกชื่อโครงการ/วัตถุประสงค์อย่างย่อ ก่อนให้ AI ร่าง TOR");
      return;
    }
    setAiError(null);
    setAiDraft(null);
    const prefillBudget = consultPrefill?.budget;
    const draftInput: Record<string, unknown> = {
      projectTitle: torData.projectTitle,
      objective: torData.objective,
      scope: torData.scope,
      procurementType: consultPrefill?.procurementType || wizardKind,
    };
    if (prefillBudget) draftInput.budget = Number(prefillBudget) || 0;
    if (consultPrefill?.quantity) draftInput.quantity = consultPrefill.quantity;
    if (consultPrefill?.usageDate) draftInput.usageDate = consultPrefill.usageDate;
    if (consultPrefill?.aiSummary) draftInput.aiSummary = consultPrefill.aiSummary;

    startDraft(async () => {
      try {
        const res = await fetch("/api/ai/tor-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "draft",
            data: draftInput,
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "ไม่สามารถร่าง TOR ด้วย AI ได้");
        }
        const data = await res.json();
        setAiDraft(data);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการร่าง TOR");
      }
    });
  };

  const autoDraftTriggered = useRef(false);
  useEffect(() => {
    if (!autoDraftRequested || autoDraftTriggered.current) return;
    if (!torData.objective.trim()) return;
    autoDraftTriggered.current = true;
    queueMicrotask(() => runAiDraft());
  }, [autoDraftRequested, torData.objective]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyAiDraft = () => {
    if (!aiDraft) return;
    setTorData((prev) => ({
      ...prev,
      objective: aiDraft.sections.objective || prev.objective,
      scope: aiDraft.sections.scope || prev.scope,
      specifications: aiDraft.sections.specifications || prev.specifications,
      deliverables: aiDraft.sections.deliverables || prev.deliverables,
      inspectionCriteria: aiDraft.sections.inspectionCriteria || prev.inspectionCriteria,
    }));
  };

  const runAiReview = () => {
    const hasContent = [
      torData.objective,
      torData.scope,
      torData.specifications,
      torData.deliverables,
      torData.inspectionCriteria,
    ].some((value) => value.trim());
    if (!hasContent) {
      setAiError("กรุณากรอกเนื้อหา TOR ก่อนให้ AI ตรวจสอบ");
      return;
    }
    setAiError(null);
    setAiReview(null);
    startReview(async () => {
      try {
        const res = await fetch("/api/ai/tor-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "review",
            data: {
              objective: torData.objective,
              scope: torData.scope,
              specifications: torData.specifications,
              deliverables: torData.deliverables,
              inspectionCriteria: torData.inspectionCriteria,
            },
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "ไม่สามารถตรวจสอบ TOR ด้วย AI ได้");
        }
        const data = await res.json();
        setAiReview(data);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการตรวจสอบ TOR");
      }
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">TOR GENERATOR</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ระบบช่วยร่างข้อกำหนดพัสดุ (TOR)</h1>
          <p className="text-sm text-stone-500">สร้างร่าง TOR มาตรฐาน ตรวจสอบความเสี่ยงล็อกสเปกและข้อความกำกวมแบบ Real-time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onPress={runAiDraft}
            isDisabled={isDrafting}
            className="bg-[#272522] font-semibold text-white hover:bg-black text-xs"
          >
            <FiCpu /> {isDrafting ? "AI กำลังร่าง..." : "ร่าง TOR ด้วย AI"}
          </Button>
          <Button
            onPress={runAiReview}
            isDisabled={isReviewing}
            className="border border-stone-300 bg-white text-xs font-semibold text-[#272522] hover:bg-stone-50"
          >
            <FiShield /> {isReviewing ? "AI กำลังตรวจ..." : "ตรวจสอบด้วย AI"}
          </Button>
          <Button onPress={handleExport} isDisabled={isExporting} className="border border-stone-300 bg-white text-xs font-semibold text-[#272522] hover:bg-stone-50">
            <FiDownload /> {isExporting ? "กำลังสร้าง..." : "ส่งออกเป็น .docx"}
          </Button>        </div>
      </div>

      {aiError && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Description className="text-xs">{aiError}</Alert.Description>
        </Alert>
      )}

      {isDrafting && (
        <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
          <span className="inline-block h-3 w-3 animate-ping rounded-full bg-[#e87722]" />
          <span>AI กำลังค้นหาข้อระเบียบที่เกี่ยวข้องและร่าง TOR ตามคำขอของคุณ...</span>
        </div>
      )}

      {aiDraft && (
        <Card className="border border-orange-200 bg-orange-50/40 p-5 shadow-sm space-y-3">
          <Card.Header className="px-0 pt-0 flex items-start justify-between gap-2 flex-wrap">
            <Card.Title className="text-sm font-bold text-[#272522] flex items-center gap-2">
              <FiCpu className="text-[#b95817]" /> ร่าง TOR จาก AI
            </Card.Title>
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="soft" color="success">
                ความมั่นใจ {(aiDraft.confidenceScore * 100).toFixed(0)}%
              </Chip>
              <Button
                onPress={applyAiDraft}
                size="sm"
                className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13] text-xs"
              >
                <FiCheck /> นำไปใส่ในฟอร์ม
              </Button>
            </div>
          </Card.Header>
          <Card.Content className="px-0 space-y-3 text-xs">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="font-bold text-[#b95817] mb-1">1. วัตถุประสงค์</p>
                <p className="whitespace-pre-wrap text-stone-700">{aiDraft.sections.objective}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="font-bold text-[#b95817] mb-1">2. ขอบเขตของงาน</p>
                <p className="whitespace-pre-wrap text-stone-700">{aiDraft.sections.scope}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-3 sm:col-span-2">
                <p className="font-bold text-[#b95817] mb-1">3. คุณลักษณะเฉพาะ</p>
                <p className="whitespace-pre-wrap text-stone-700">{aiDraft.sections.specifications}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="font-bold text-[#b95817] mb-1">4. กำหนดเวลาส่งมอบ</p>
                <p className="whitespace-pre-wrap text-stone-700">{aiDraft.sections.deliverables}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="font-bold text-[#b95817] mb-1">5. หลักเกณฑ์การตรวจรับ</p>
                <p className="whitespace-pre-wrap text-stone-700">{aiDraft.sections.inspectionCriteria}</p>
              </div>
            </div>

            {aiDraft.notes.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="font-bold text-amber-800 mb-1">ข้อสังเกตสำหรับเจ้าหน้าที่:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                  {aiDraft.notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiDraft.citations.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[#b95817]">
                  <FiFileText size={13} /> แหล่งอ้างอิงระเบียบที่เกี่ยวข้อง:
                </p>
                {aiDraft.citations.map((cite, idx) => (
                  <div key={idx} className="rounded-xl border border-stone-200/80 bg-white p-2.5 text-xs text-stone-700">
                    <span className="font-semibold">{cite.documentTitle} {cite.section ? `(${cite.section})` : ""}</span>
                    <span className="text-[0.65rem] text-stone-400 ml-1">Match: {(cite.relevanceScore * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {isReviewing && (
        <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
          <span className="inline-block h-3 w-3 animate-ping rounded-full bg-[#e87722]" />
          <span>AI กำลังตรวจสอบร่าง TOR เทียบกับระเบียบในคลังความรู้...</span>
        </div>
      )}

      {aiReview && (
        <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-3">
          <Card.Header className="px-0 pt-0 flex items-start justify-between gap-2 flex-wrap">
            <Card.Title className="text-sm font-bold text-[#272522] flex items-center gap-2">
              <FiShield className="text-[#b95817]" /> ผลการตรวจสอบ TOR ด้วย AI
            </Card.Title>
            <Chip size="sm" variant="soft" color={aiReview.issues.length === 0 ? "success" : "warning"}>
              พบ {aiReview.issues.length} จุดที่ต้องพิจารณา
            </Chip>
          </Card.Header>
          <Card.Content className="px-0 space-y-3 text-xs">
            {aiReview.summary && (
              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-stone-700 whitespace-pre-wrap">
                {aiReview.summary}
              </div>
            )}

            {aiReview.issues.length > 0 && (
              <div className="space-y-2">
                {aiReview.issues.map((issue, idx) => {
                  const style =
                    issue.type === "lockin"
                      ? { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", label: "ล็อกสเปก" }
                      : issue.type === "ambiguous"
                        ? { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", label: "ข้อความกำกวม" }
                        : issue.type === "missing"
                          ? { border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-800", label: "ขาดองค์ประกอบ" }
                          : { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-800", label: "ไม่สอดคล้องระเบียบ" };
                  return (
                    <div key={idx} className={`rounded-xl border ${style.border} ${style.bg} p-3`}>
                      <div className="flex items-center gap-2">
                        <Chip size="sm" variant="soft" color={
                          issue.type === "lockin" ? "danger" : issue.type === "ambiguous" ? "warning" : "default"
                        } className="text-[0.6rem]">
                          {style.label}
                        </Chip>
                        {issue.quote && (
                          <span className="font-semibold text-stone-700">&quot;{issue.quote}&quot;</span>
                        )}
                      </div>
                      <p className={`mt-1 ${style.text}`}>{issue.detail}</p>
                      {issue.suggestion && (
                        <p className="mt-1 text-stone-600">
                          <span className="font-bold">ข้อเสนอแนะ:</span> {issue.suggestion}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {aiReview.issues.length === 0 && (
              <Alert status="success" className="rounded-xl">
                <Alert.Description className="text-xs font-semibold">
                  <FiCheck className="inline mr-1" /> ไม่พบประเด็นเสี่ยงที่ต้องแก้ไข
                </Alert.Description>
              </Alert>
            )}

            {aiReview.citations.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[#b95817]">
                  <FiFileText size={13} /> แหล่งอ้างอิงระเบียบที่เกี่ยวข้อง:
                </p>
                {aiReview.citations.map((cite, idx) => (
                  <div key={idx} className="rounded-xl border border-stone-200/80 bg-white p-2.5 text-xs text-stone-700">
                    <span className="font-semibold">{cite.documentTitle} {cite.section ? `(${cite.section})` : ""}</span>
                    <span className="text-[0.65rem] text-stone-400 ml-1">Match: {(cite.relevanceScore * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Wizard Template Selector */}
      <Card className="border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <FiFileText className="text-[#b95817]" />
            <span className="text-xs font-bold text-stone-700">แม่แบบตามประเภทงาน:</span>
          </div>
          <div className="flex-1">
            <Select.Root
              className="w-full sm:w-64"
              selectedKey={wizardKind}
              onSelectionChange={(key) => {
                if (key && (Object.keys(WIZARD_SECTIONS) as WizardKind[]).includes(key as WizardKind)) {
                  setWizardKind(key as WizardKind);
                }
              }}
            >
              <Select.Trigger className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs">
                <Select.Value />
              </Select.Trigger>
              <Select.Popover>
                <ListBox className="max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-lg" selectionMode="single">
                  {(Object.keys(WIZARD_SECTIONS) as WizardKind[]).map((kind) => (
                    <ListBoxItem
                      key={kind}
                      id={kind}
                      textValue={kind}
                      className="cursor-pointer rounded-lg px-3 py-2 text-xs text-stone-700 hover:bg-orange-50 data-[selected=true]:bg-orange-100 data-[selected=true]:font-bold data-[selected=true]:text-[#b95817]"
                    >
                      {kind}
                    </ListBoxItem>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select.Root>
          </div>
          <Button onPress={applyWizard} className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13] text-xs shrink-0">
            <FiPlus /> นำแม่แบบไปเติมในฟอร์ม
          </Button>
        </div>
      </Card>

      {/* Lock-in Risk Alert */}
      {analysis.lockInIssues.length > 0 && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
            <FiAlertOctagon size={16} /> ตรวจพบความเสี่ยงล็อกสเปก ({analysis.lockInIssues.length} จุด)
          </Alert.Title>
          <Alert.Description className="text-xs block mt-1">
            ตาม พ.ร.บ. การจัดซื้อจัดจ้างฯ พ.ศ. 2560 มาตรา 9 ห้ามกำหนดคุณลักษณะเฉพาะให้ใกล้เคียงหรือตรงกับยี่ห้อใดยี่ห้อหนึ่ง เว้นแต่มีเหตุผลความจำเป็น
            คำที่ตรวจพบ:{" "}
            <span className="font-semibold">{analysis.lockInIssues.map((i) => i.term).join(", ")}</span>
          </Alert.Description>
        </Alert>
      )}

      {/* Ambiguity Alert */}
      {analysis.ambiguityIssues.length > 0 && (
        <Alert status="warning" className="rounded-2xl">
          <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
            <FiInfo size={16} /> พบข้อความกำกวม ({analysis.ambiguityIssues.length} จุด)
          </Alert.Title>
          <Alert.Description className="text-xs block mt-1">
            ข้อความที่ไม่มีตัวชี้วัดที่วัดผลได้:{" "}
            <span className="font-semibold">{analysis.ambiguityIssues.map((i) => i.phrase).join(", ")}</span>
            <br />
            แนะนำให้ระบุเป็นข้อกำหนดที่วัดผลได้ตามมาตรฐาน
          </Alert.Description>
        </Alert>
      )}

      {state?.error && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Description className="text-xs">{state.error}</Alert.Description>
        </Alert>
      )}

      {state?.success && (
        <Alert status="success" className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold flex items-center gap-1.5">
            <FiCheck /> {state.message}
          </Alert.Description>
        </Alert>
      )}

      {exportError && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Description className="text-xs">{exportError}</Alert.Description>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left: TOR Editor Form */}
        <Card className="border border-stone-200 bg-white p-6 shadow-sm">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="requestId" value={torData.requestId} />
            <input type="hidden" name="isLockInRisk" value={String(isLockInRisk)} />

            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <TextField isRequired name="projectTitle">
                <Label className="text-xs font-bold">ชื่อโครงการ / รายการจัดหา</Label>
                <Input
                  value={torData.projectTitle}
                  onChange={(e) => setTorData({ ...torData, projectTitle: e.target.value })}
                  placeholder="เช่น จัดซื้อเครื่องคอมพิวเตอร์สำหรับห้องปฏิบัติการ AI"
                />
              </TextField>
              <TextField isRequired name="requestId">
                <Label className="text-xs font-bold">รหัสคำขอ</Label>
                <Input
                  value={torData.requestId}
                  onChange={(e) => setTorData({ ...torData, requestId: e.target.value })}
                />
              </TextField>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">1. วัตถุประสงค์</label>
              <textarea
                name="objective"
                rows={2}
                value={torData.objective}
                onChange={(e) => setTorData({ ...torData, objective: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">2. ขอบเขตของงาน (Scope of Work)</label>
              <textarea
                name="scope"
                rows={3}
                value={torData.scope}
                onChange={(e) => setTorData({ ...torData, scope: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-stone-700">3. คุณลักษณะเฉพาะ (Specifications)</label>
                <div className="flex items-center gap-1.5">
                  {analysis.lockInIssues.length > 0 ? (
                    <Chip size="sm" variant="soft" color="danger">เสี่ยงล็อกสเปก {analysis.lockInIssues.length}</Chip>
                  ) : (
                    <Chip size="sm" variant="soft" color="success">สเปกเป็นกลาง</Chip>
                  )}
                  {analysis.ambiguityIssues.length > 0 && (
                    <Chip size="sm" variant="soft" color="warning">กำกวม {analysis.ambiguityIssues.length}</Chip>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                <textarea
                  name="specifications"
                  rows={6}
                  value={torData.specifications}
                  onChange={(e) => setTorData({ ...torData, specifications: e.target.value })}
                  className="w-full p-3 text-xs focus:outline-none"
                  aria-label="คุณลักษณะเฉพาะ"
                />
                {highlightParts.parts.some((p) => p.type !== "normal") && (
                  <div className="border-t border-stone-100 px-3 py-2 bg-stone-50/60">
                    <p className="text-[0.65rem] font-bold text-stone-500 mb-1.5">ตัวอย่างการแสดงผลพร้อมไฮไลต์:</p>
                    <div className="rounded-lg bg-white border border-stone-200 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                      {highlightParts.parts.map((p, i) =>
                        p.type === "lockin" ? (
                          <mark key={i} className="rounded bg-red-100 px-0.5 text-red-800 font-semibold">{p.text}</mark>
                        ) : p.type === "ambiguous" ? (
                          <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-800 font-semibold">{p.text}</mark>
                        ) : (
                          <span key={i}>{p.text}</span>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Issues list with suggestions */}
              {(analysis.lockInIssues.length > 0 || analysis.ambiguityIssues.length > 0) && (
                <div className="rounded-xl border border-stone-200 p-3 space-y-2">
                  {analysis.lockInIssues.map((issue, idx) => (
                    <div key={`li-${idx}`} className="flex items-start gap-2 text-[0.7rem]">
                      <FiCpu className="text-red-600 shrink-0 mt-0.5" size={12} />
                      <div>
                        <span className="font-bold text-red-700">{issue.term}</span>
                        <span className="text-stone-600"> — {issue.suggestion}</span>
                      </div>
                    </div>
                  ))}
                  {analysis.ambiguityIssues.map((issue, idx) => (
                    <div key={`am-${idx}`} className="flex items-start gap-2 text-[0.7rem]">
                      <FiInfo className="text-amber-600 shrink-0 mt-0.5" size={12} />
                      <div>
                        <span className="font-bold text-amber-700">&quot;{issue.phrase}&quot;</span>
                        <span className="text-stone-600"> — แนะนำ: {issue.suggestion}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">4. กำหนดเวลาส่งมอบงาน</label>
              <textarea
                name="deliverables"
                rows={2}
                value={torData.deliverables}
                onChange={(e) => setTorData({ ...torData, deliverables: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">5. หลักเกณฑ์การตรวจรับ</label>
              <textarea
                name="inspectionCriteria"
                rows={3}
                value={torData.inspectionCriteria}
                onChange={(e) => setTorData({ ...torData, inspectionCriteria: e.target.value })}
                className="w-full rounded-xl border border-stone-200 p-3 text-xs focus:border-[#e87722] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
              <div className="flex items-center gap-2 text-[0.7rem] text-stone-500">
                <Badge variant="soft" color={totalIssues === 0 ? "success" : "danger"}>
                  {totalIssues === 0 ? "ผ่านการตรวจสอบ" : `${totalIssues} จุดที่ต้องแก้ไข`}
                </Badge>
              </div>
              <Button
                type="submit"
                isDisabled={isPending}
                className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
              >
                <FiSave /> {isPending ? "กำลังบันทึกฉบับใหม่..." : "บันทึกร่าง TOR (สร้าง Version ใหม่)"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Right: Version History & Standard Reference */}
        <div className="space-y-6">
          <Card className="border border-stone-200 bg-white p-5 shadow-sm">
            <Card.Header className="px-0 pt-0 flex justify-between items-center">
              <Card.Title className="text-base font-bold text-[#272522] flex items-center gap-2">
                <FiClock className="text-[#b95817]" /> ประวัติ Version
              </Card.Title>
              <Chip color="accent" size="sm" variant="soft">
                {isLoadingVersions ? "โหลด..." : `ทั้งหมด ${versions.length} ฉบับ`}
              </Chip>
            </Card.Header>

            <Card.Content className="px-0 pt-3 space-y-3">
              {versions.length === 0 && !isLoadingVersions && (
                <p className="text-xs text-stone-400">ยังไม่มีประวัติ — บันทึกครั้งแรกเพื่อสร้าง Version 1</p>
              )}
              {versions.map((vh) => (
                <div key={vh.version} className="flex items-start justify-between rounded-xl bg-stone-50 p-3 border border-stone-200/80">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#272522]">Version {vh.version}</p>
                    <p className="text-[0.7rem] text-stone-500">
                      {vh.isLockInRisk ? <span className="text-red-600 font-semibold">เสี่ยงล็อกสเปก</span> : <span className="text-emerald-600 font-semibold">สเปกเป็นกลาง</span>}
                    </p>
                    <p className="text-[0.65rem] text-stone-400">
                      {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(new Date(vh.createdAt))}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" className="text-xs border border-stone-300" onPress={() => loadVersion(vh)}>
                    <FiRotateCcw size={11} /> เปิดฉบับนี้
                  </Button>
                </div>
              ))}
            </Card.Content>
          </Card>

          {/* Standard Clauses */}
          <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-3">
            <Card.Title className="text-xs font-bold text-[#b95817] flex items-center gap-1.5">
              <FiFileText /> ข้อความมาตรฐานแนะนำ (Standard Clauses)
            </Card.Title>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setTorData((p) => ({
                    ...p,
                    deliverables: p.deliverables + "\n• ต้องแนบใบรับรองมาตรฐาน ISO 9001 ของโรงงานผู้ผลิต",
                  }))
                }
                className="w-full text-left rounded-xl border border-stone-200 p-2 text-xs hover:bg-stone-50 transition text-stone-700 flex items-center justify-between"
              >
                <span>+ ข้อกำหนดมาตรฐาน ISO</span>
                <FiPlus size={14} className="text-[#b95817]" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setTorData((p) => ({
                    ...p,
                    inspectionCriteria: p.inspectionCriteria + "\n• ผู้ขายต้องจัดฝึกอบรมการใช้งานระบบแก่บุคลากรอย่างน้อย 1 ครั้ง",
                  }))
                }
                className="w-full text-left rounded-xl border border-stone-200 p-2 text-xs hover:bg-stone-50 transition text-stone-700 flex items-center justify-between"
              >
                <span>+ ข้อกำหนดการฝึกอบรมการใช้งาน</span>
                <FiPlus size={14} className="text-[#b95817]" />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
