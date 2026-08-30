"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Table,
  Chip,
  Alert,
  Accordion,
} from "@heroui/react";
import {
  FiUploadCloud,
  FiFileText,
  FiCheckSquare,
  FiAlertTriangle,
  FiCheck,
  FiRefreshCw,
  FiArrowRight,
  FiX,
  FiStar,
  FiCpu,
  FiSearch,
} from "react-icons/fi";

type Citation = {
  chunkId: string;
  content: string;
  section: string | null;
  documentTitle: string;
  relevanceScore: number;
};

type AiAnalysisResult = {
  analysis: string;
  citations: Citation[];
  confidenceScore: number;
  usedKnowledgeBase: boolean;
} | null;

type QuotationItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
};

type OCRResult = {
  vendorName: string;
  taxId: string;
  documentDate: string | null;
  items: QuotationItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  priceValidityDays: number | null;
  warnings: string[];
  brandsDetected: string[];
  savedIntakeId?: string | null;
};

type VendorQuotation = {
  id: string;
  fileName: string;
  file: File;
  previewUrl: string | null;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  data?: OCRResult;
};

type CheckItem = {
  id: string;
  label: string;
  description: string;
  hint: string;
  checked: boolean;
  auto: "vendorName" | "taxId" | "validity" | "vat" | "noLockIn";
};

const CHECKLIST: CheckItem[] = [
  {
    id: "c1",
    label: "เลขประจำตัวผู้เสียภาษี / ชื่อผู้ขาย",
    description: "ต้องมีชื่อและที่อยู่ผู้เสนอราคาพร้อมเลขประจำตัวผู้เสียภาษี 13 หลัก",
    hint: "ยืนยันตัวตนผู้ขายก่อนพิจารณาราคา",
    checked: false,
    auto: "vendorName",
  },
  {
    id: "c2",
    label: "กำหนดยืนราคาตามระเบียบ",
    description: "เอกสารต้องระบุวันที่ออกและกำหนดวันยืนราคา",
    hint: "ยืนราคาไม่น้อยกว่า 30-60 วันตามระเบียบ",
    checked: false,
    auto: "validity",
  },
  {
    id: "c3",
    label: "ยอดรวมภาษี VAT 7% และการคำนวณถูกต้อง",
    description: "Subtotal × 7% = VAT และ Grand Total = Subtotal + VAT",
    hint: "ระบบตรวจสอบความถูกต้องของตัวเลขอัตโนมัติ",
    checked: false,
    auto: "vat",
  },
  {
    id: "c4",
    label: "คุณลักษณะไม่ระบุยี่ห้อเฉพาะเจาะจง",
    description: "รายการสินค้าไม่ระบุยี่ห้อ/รุ่นที่อาจเข้าข่ายล็อกสเปก",
    hint: "ระบุสเปกกลางแบบใช้เกณฑ์สมรรถนะแทนยี่ห้อ",
    checked: false,
    auto: "noLockIn",
  },
];

const DEFAULT_CHECKLIST = CHECKLIST.map((c) => ({ ...c }));

function evalCheck(check: CheckItem, data?: OCRResult): boolean {
  if (!data) return check.checked;
  switch (check.auto) {
    case "vendorName":
      return !!data.vendorName && (data.taxId?.length === 13 || !data.taxId);
    case "validity":
      return !!data.documentDate && (data.priceValidityDays ?? 0) > 0;
    case "vat":
      return data.warnings.filter((w) => w.includes("ภาษี") || w.includes("ยอดรวม")).length === 0;
    case "noLockIn":
      return (data.brandsDetected ?? []).length === 0;
    default:
      return check.checked;
  }
}

function allChecked(items: CheckItem[]): boolean {
  return items.every((c) => c.checked);
}

export default function QuotationPage() {
  const [files, setFiles] = useState<VendorQuotation[]>([]);
  const [, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(false);
  const [checklist, setChecklist] = useState<CheckItem[]>(DEFAULT_CHECKLIST);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult>(null);
  const [isAnalyzing, startAnalyze] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const incoming = Array.from(e.target.files).map((file) => ({
      id: `${Date.now()}-${file.name}-${file.size}`,
      fileName: file.name,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...incoming]);
    setChecklist(DEFAULT_CHECKLIST);
    setIsSaved(false);
    setAiAnalysis(null);
    setAiError(null);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const runOCR = (vendor: VendorQuotation) => {
    if (vendor.status === "processing") return;
    const fd = new FormData();
    fd.append("file", vendor.file);
    setFiles((prev) => prev.map((f) => f.id === vendor.id ? { ...f, status: "processing" } : f));

    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/ocr", { method: "POST", body: fd });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "ไม่สามารถประมวลผล OCR ได้");
        }
        const data = (await res.json()) as OCRResult;
        setFiles((prev) =>
          prev.map((f) => (f.id === vendor.id ? { ...f, status: "done", data } : f)),
        );
        setChecklist(DEFAULT_CHECKLIST.map((c) => ({ ...c, checked: evalCheck(c, data) })));
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === vendor.id
              ? { ...f, status: "error", error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" }
              : f,
          ),
        );
      }
    });
  };

  // Re-run OCR for all files
  const runAll = () => {
    files.forEach((f) => {
      if (f.status !== "done") runOCR(f);
    });
  };

  const runAiAnalysis = () => {
    if (doneVendors.length === 0) return;
    setAiError(null);
    setAiAnalysis(null);
    startAnalyze(async () => {
      try {
        const res = await fetch("/api/ai/quotation-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quotation: doneVendors[0].data,
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "ไม่สามารถวิเคราะห์ใบเสนอราคาได้");
        }
        const data = await res.json();
        setAiAnalysis(data);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์");
      }
    });
  };

  const doneVendors = files.filter((f) => f.status === "done" && f.data);
  const processing = files.filter((f) => f.status === "processing").length;
  const errorVendors = files.filter((f) => f.status === "error");

  const allBrands = doneVendors.flatMap((v) => v.data?.brandsDetected ?? []);
  const lockInVendors = doneVendors.filter((v) => (v.data?.brandsDetected ?? []).length > 0);

  const bestVendor = doneVendors.length > 0
    ? doneVendors.reduce((best, cur) =>
        (cur.data?.grandTotal ?? Infinity) < (best.data?.grandTotal ?? Infinity) ? cur : best,
      )
    : null;

  const mergedItems = useCallback((): { name: string; quantity: number; unit: string; prices: (number | null)[] }[] => {
    const map = new Map<string, { name: string; quantity: number; unit: string; prices: (number | null)[] }>();
    doneVendors.forEach((v, vi) => {
      (v.data?.items ?? []).forEach((item) => {
        const key = item.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            prices: doneVendors.map(() => null),
          });
        }
        const entry = map.get(key)!;
        entry.prices[vi] = item.unitPrice;
      });
    });
    return Array.from(map.values());
  }, [doneVendors]);

  const rows = mergedItems();

  const handleSaveConfirmed = () => {
    setIsSaved(true);
    if (doneVendors.length > 0 && doneVendors[0].data) {
      const quotationData = {
        vendorName: doneVendors[0].data.vendorName,
        grandTotal: doneVendors[0].data.grandTotal,
        items: doneVendors[0].data.items,
        documentDate: doneVendors[0].data.documentDate,
      };
      sessionStorage.setItem("quotation_draft", JSON.stringify(quotationData));
    }
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)));
  };

  const completenessCount = checklist.filter((c) => c.checked).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">QUOTATION INSPECTOR</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ตรวจและวิเคราะห์ใบเสนอราคา</h1>
          <p className="text-sm text-stone-500">เปรียบเทียบหลายผู้ขายในตารางเดียว ตรวจความครบถ้วน และตรวจจับความเสี่ยงล็อกสเปก</p>
        </div>
        {files.length > 0 && (
          <Button
            onPress={runAll}
            isDisabled={processing > 0}
            className="border border-stone-300 bg-white text-xs font-semibold text-[#272522] hover:bg-stone-50"
          >
            <FiRefreshCw className={processing > 0 ? "animate-spin" : ""} /> {processing > 0 ? "กำลังประมวลผล..." : "ประมวลผลทั้งหมด"}
          </Button>
        )}
      </div>

      {/* Pre-Lock-in Detection Alert */}
      {lockInVendors.length > 0 && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
            <FiCpu size={16} /> ความเสี่ยงการล็อกสเปก (Pre-Lock-in Detected)
          </Alert.Title>
          <Alert.Description className="text-xs block mt-1">
            ตรวจพบการระบุยี่ห้อ/รุ่นเฉพาะเจาะจงในใบเสนอราคา:{" "}
            <span className="font-semibold">{[...new Set(allBrands)].join(", ")}</span>
            <br />
            ตาม พ.ร.บ. การจัดซื้อจัดจ้างฯ พ.ศ. 2560 มาตรา 9 การกำหนดคุณลักษณะเฉพาะที่ใกล้เคียงหรือตรงกับยี่ห้อใดยี่ห้อหนึ่งถือเป็นการล็อกสเปก
            ควรแก้ไขใบเสนอราคาให้ระบุเป็นสเปกกลาง (เช่น สมรรถนะขั้นต่ำ) ก่อนส่งให้เจ้าหน้าที่พัสดุ
          </Alert.Description>
        </Alert>
      )}

      {errorVendors.length > 0 && (
        <Alert status="warning" className="rounded-2xl">
          <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
            <FiAlertTriangle size={14} /> เอกสารบางฉบับประมวลผลไม่สำเร็จ
          </Alert.Title>
          <Alert.Description className="text-xs block mt-1">
            {errorVendors.map((v) => (
              <span key={v.id} className="block">• {v.fileName}: {v.error}</span>
            ))}
          </Alert.Description>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left: Upload & Checklist */}
        <div className="space-y-6">
          <Card className="border border-dashed border-stone-300 bg-white p-6 text-center shadow-sm">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              multiple
              onChange={addFiles}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer space-y-3 block">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-[#b95817]">
                <FiUploadCloud size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#272522]">
                  {files.length > 0 ? `เพิ่มใบเสนอราคา (${files.length} ฉบับ)` : "คลิกเพื่ออัปโหลดใบเสนอราคา"}
                </p>
                <p className="text-xs text-stone-400 mt-1">รองรับ PDF, PNG, JPG ขนาดไม่เกิน 10MB/ไฟล์ — เลือกได้หลายฉบับ</p>
              </div>
            </label>

            {files.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col gap-2">
                {files.map((vendor) => (
                  <div key={vendor.id} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/60 p-2.5 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#272522]">{vendor.fileName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {vendor.status === "pending" && (
                          <>
                            <Chip size="sm" variant="tertiary" className="text-[0.6rem]">ยังไม่ประมวลผล</Chip>
                            <Button size="sm" variant="secondary" className="border border-stone-300 text-[0.65rem] min-h-6 h-6 px-2" onPress={() => runOCR(vendor)}>
                              <FiFileText size={11} /> ประมวลผล
                            </Button>
                          </>
                        )}
                        {vendor.status === "processing" && (
                          <Chip size="sm" variant="tertiary" className="text-[0.6rem]">
                            <span className="flex items-center gap-1"><FiRefreshCw className="animate-spin" size={10} /> กำลังประมวลผล...</span>
                          </Chip>
                        )}
                        {vendor.status === "done" && (
                          <Chip size="sm" variant="soft" color="success" className="text-[0.6rem]">
                            <span className="flex items-center gap-1"><FiCheck size={10} /> สำเร็จ</span>
                          </Chip>
                        )}
                        {vendor.status === "error" && (
                          <Chip size="sm" variant="soft" color="danger" className="text-[0.6rem]">ผิดพลาด</Chip>
                        )}
                        {vendor.data && (
                          <span className="text-[0.6rem] font-bold text-emerald-700">
                            {vendor.data.vendorName} — {Number(vendor.data.grandTotal).toLocaleString()} บาท
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(vendor.id)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 transition"
                      aria-label="ลบไฟล์"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Completeness Checklist Accordion */}
          <Card className="border border-stone-200 bg-white p-5 shadow-sm">
            <Card.Header className="px-0 pt-0">
              <Card.Title className="text-base font-bold text-[#272522] flex items-center gap-2">
                <FiCheckSquare className="text-[#b95817]" /> Checklist ความครบถ้วน
              </Card.Title>
              <Card.Description className="text-xs text-stone-500">
                ตรวจสอบ {completenessCount}/{checklist.length} รายการผ่านเกณฑ์
              </Card.Description>
            </Card.Header>
            <Card.Content className="px-0 pt-3">
              <Accordion.Root allowsMultipleExpanded defaultExpandedKeys={[]} className="space-y-2">
                {checklist.map((item) => {
                  const autoState = evalCheck(item, doneVendors[0]?.data);
                  return (
                    <Accordion.Item
                      key={item.id}
                      className="rounded-xl border border-stone-200 overflow-hidden"
                    >
                      <Accordion.Trigger className="p-2.5 hover:bg-stone-50">
                        <div className="flex items-center gap-3 w-full">
                          <span
                            role="checkbox"
                            aria-checked={item.checked}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleChecklist(item.id);
                            }}
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition cursor-pointer ${
                              item.checked
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-stone-300 bg-white hover:border-emerald-400"
                            }`}
                            aria-label={`ทำเครื่องหมาย ${item.label}`}
                          >
                            {item.checked && <FiCheck size={14} />}
                          </span>
                          <div className="min-w-0 flex-1 text-left">
                            <p className={`text-xs font-semibold ${item.checked ? "text-stone-800" : "text-stone-600"}`}>
                              {item.label}
                            </p>
                            {item.checked && (
                              <p className="text-[0.65rem] text-emerald-600">✓ ผ่านเกณฑ์</p>
                            )}
                          </div>
                          {autoState && (
                            <Chip size="sm" variant="soft" color="success" className="text-[0.6rem]">อัตโนมัติ</Chip>
                          )}
                        </div>
                      </Accordion.Trigger>
                      <Accordion.Panel className="px-4 pb-3 pt-1">
                        <Accordion.Body>
                          <p className="text-[0.7rem] text-stone-600">{item.description}</p>
                          <p className="text-[0.65rem] text-stone-400 mt-1">💡 {item.hint}</p>
                        </Accordion.Body>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion.Root>

              <div className="mt-3 pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${allChecked(checklist) ? "text-emerald-600" : "text-stone-500"}`}>
                    {allChecked(checklist) ? "ทุกข้อผ่านเกณฑ์ พร้อมส่งให้เจ้าหน้าที่ ✓" : "ยังมีรายการที่ต้องตรวจสอบ"}
                  </span>
                  <Chip size="sm" variant="soft" color={allChecked(checklist) ? "success" : "warning"}>
                    {completenessCount}/{checklist.length}
                  </Chip>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Right: Comparison Table & Details */}
        <div className="space-y-6">
          {doneVendors.length > 0 ? (
            <>
              {/* Comparison Table */}
              <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
                <Card.Header className="px-0 pt-0 flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-emerald-600">MULTI-VENDOR PRICE COMPARISON</p>
                    <Card.Title className="text-lg font-bold text-[#272522]">
                      เปรียบเทียบราคา {doneVendors.length} ราย
                    </Card.Title>
                  </div>
                </Card.Header>

                <div className="overflow-x-auto">
                  <Table className="w-full text-left text-xs">
                    <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader className="p-2 font-bold text-stone-600">รายการ</Table.Column>
                      {doneVendors.map((v) => (
                        <Table.Column key={v.id} className="p-2 font-bold text-stone-600">
                          <div className="flex items-center gap-1">
                            {v.id === bestVendor?.id && <FiStar size={11} className="text-amber-500" />}
                            <span className="max-w-[110px] truncate">{v.data?.vendorName || v.fileName}</span>
                          </div>
                        </Table.Column>
                      ))}
                    </Table.Header>
                    <Table.Body>
                      {rows.map((row, idx) => (
                        <Table.Row key={idx} className="border-t border-stone-100">
                          <Table.Cell className="p-2 font-semibold text-[#272522]">{row.name}</Table.Cell>
                          {row.prices.map((price, vi) => {
                            const bestPrice = Math.min(...row.prices.filter((p): p is number => p !== null));
                            const isBest = price !== null && price === bestPrice;
                            return (
                              <Table.Cell key={vi} className="p-2">
                                <span className={isBest ? "font-bold text-emerald-600" : "text-stone-600"}>
                                  {price !== null ? `${Number(price).toLocaleString()} บาท` : "—"}
                                  {isBest && <span className="ml-1 text-[0.6rem] text-emerald-500">(ถูกสุด)</span>}
                                </span>
                              </Table.Cell>
                            );
                          })}
                        </Table.Row>
                      ))}
                      <Table.Row className="border-t border-stone-200 bg-stone-50/60">
                        <Table.Cell className="p-2 font-bold text-[#272522]">ราคารวมสุทธิ (Grand Total)</Table.Cell>
                        {doneVendors.map((v) => (
                          <Table.Cell key={v.id} className="p-2">
                            <span className={`font-bold ${v.id === bestVendor?.id ? "text-emerald-600" : "text-stone-700"}`}>
                              {Number(v.data?.grandTotal ?? 0).toLocaleString()} บาท
                              {v.id === bestVendor?.id && (
                                <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] text-emerald-700">ราคาดีที่สุด</span>
                              )}
                            </span>
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    </Table.Body>
                    </Table.Content>
                  </Table>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-3 text-xs border border-emerald-100 flex items-center gap-2">
                  <FiStar className="text-emerald-600 shrink-0" />
                  <span className="text-emerald-800">
                    <b>ผู้ขายราคาดีที่สุด:</b> {bestVendor?.data?.vendorName || bestVendor?.fileName} —{" "}
                    {Number(bestVendor?.data?.grandTotal ?? 0).toLocaleString()} บาท
                    {bestVendor?.data?.priceValidityDays ? ` (ยืนราคา ${bestVendor.data.priceValidityDays} วัน)` : ""}
                  </span>
                </div>
              </Card>

              {/* AI Advisor Analysis */}
              <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
                <Card.Header className="px-0 pt-0 flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs font-bold text-[#b95817]">AI PROCUREMENT ADVISOR</p>
                    <Card.Title className="text-base font-bold text-[#272522] flex items-center gap-2">
                      <FiCpu className="text-[#b95817]" /> ที่ปรึกษาการวิเคราะห์ใบเสนอราคา
                    </Card.Title>
                    <Card.Description className="text-xs text-stone-500">
                      AI ตรวจความครบถ้วน ความเสี่ยงล็อกสเปก และแนะนำขั้นตอนถัดไป อ้างอิงจากคลังความรู้ระเบียบในระบบ
                    </Card.Description>
                  </div>
                  <Button
                    onPress={runAiAnalysis}
                    isDisabled={isAnalyzing || doneVendors.length === 0}
                    className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13] text-xs"
                  >
                    <FiSearch /> {isAnalyzing ? "AI กำลังวิเคราะห์..." : "วิเคราะห์ด้วย AI"}
                  </Button>
                </Card.Header>

                <Card.Content className="px-0 space-y-3">
                  {doneVendors.length === 0 && (
                    <p className="text-xs text-stone-400">
                      อัปโหลดและประมวลผลใบเสนอราคาก่อน เพื่อให้ AI วิเคราะห์
                    </p>
                  )}

                  {aiError && (
                    <Alert status="danger" className="rounded-xl">
                      <Alert.Description className="text-xs">{aiError}</Alert.Description>
                    </Alert>
                  )}

                  {isAnalyzing && (
                    <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                      <span className="inline-block h-3 w-3 animate-ping rounded-full bg-[#e87722]" />
                      <span>AI กำลังค้นหาข้อระเบียบที่เกี่ยวข้องและวิเคราะห์ใบเสนอราคา...</span>
                    </div>
                  )}

                  {aiAnalysis && (
                    <>
                      <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs leading-relaxed text-stone-700 whitespace-pre-wrap">
                        {aiAnalysis.analysis}
                      </div>

                      {aiAnalysis.usedKnowledgeBase && (
                        <Chip size="sm" variant="soft" color="success">
                          อ้างอิงจากคลังความรู้ระเบียบในระบบ
                        </Chip>
                      )}

                      <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span>ความมั่นใจของ AI:</span>
                        <Chip color={aiAnalysis.confidenceScore > 0.7 ? "success" : "warning"} size="sm" variant="soft">
                          {(aiAnalysis.confidenceScore * 100).toFixed(0)}%
                        </Chip>
                      </div>

                      {aiAnalysis.citations.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="flex items-center gap-1.5 text-xs font-bold text-[#b95817]">
                            <FiFileText size={13} /> แหล่งอ้างอิงระเบียบที่เกี่ยวข้อง:
                          </p>
                          {aiAnalysis.citations.map((cite, idx) => (
                            <div key={idx} className="rounded-xl border border-stone-200/80 bg-white p-2.5 text-xs text-stone-700 shadow-2xs">
                              <div className="flex items-center justify-between font-semibold text-[#272522]">
                                <span>{cite.documentTitle} {cite.section ? `(${cite.section})` : ""}</span>
                                <span className="text-[0.65rem] text-stone-400">Match: {(cite.relevanceScore * 100).toFixed(0)}%</span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-stone-500">{cite.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Card.Content>
              </Card>

              {/* Per-vendor detail cards */}
              <div className="space-y-4">
                {doneVendors.map((v) => (
                  <Card key={v.id} className="border border-stone-200 bg-white p-4 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#272522]">{v.data?.vendorName || "ไม่ระบุชื่อผู้ขาย"}</p>
                        <p className="text-[0.7rem] text-stone-500">ไฟล์: {v.fileName}</p>
                        <p className="text-[0.7rem] text-stone-500">เลขผู้เสียภาษี: {v.data?.taxId || "—"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Chip size="sm" variant="soft" color="success">
                          {Number(v.data?.grandTotal ?? 0).toLocaleString()} บาท
                        </Chip>
                        {v.data?.priceValidityDays && (
                          <span className="text-[0.65rem] text-stone-500">ยืนราคา {v.data.priceValidityDays} วัน</span>
                        )}
                      </div>
                    </div>

                    {(v.data?.brandsDetected ?? []).length > 0 && (
                      <div className="rounded-xl bg-red-50 border border-red-100 p-2.5">
                        <p className="text-[0.68rem] font-bold text-red-700 flex items-center gap-1">
                          <FiAlertTriangle size={11} /> พบยี่ห้อ/รุ่นที่ระบุในเอกสาร:
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {v.data!.brandsDetected!.map((b, i) => (
                            <Chip key={i} size="sm" variant="soft" color="danger" className="text-[0.6rem]">{b}</Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {(v.data?.warnings ?? []).length > 0 && (
                      <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5">
                        <p className="text-[0.68rem] font-bold text-amber-700">ข้อควรระวัง:</p>
                        <ul className="list-disc list-inside mt-1 text-[0.68rem] text-amber-800 space-y-0.5">
                          {v.data!.warnings!.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Actions */}
              <Card className="border border-stone-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <Button
                    onPress={handleSaveConfirmed}
                    isDisabled={isSaved}
                    className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700 text-xs"
                  >
                    <FiCheck /> {isSaved ? "ยืนยันข้อมูลแล้ว" : "ยืนยันข้อมูลใบเสนอราคา"}
                  </Button>
                </div>
                {isSaved && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3 space-y-2">
                    <p className="text-xs font-bold text-[#b95817] flex items-center gap-1.5">
                      <FiStar size={13} /> AI แนะนำขั้นตอนต่อไป:
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <a
                        href="/tor"
                        className="flex items-center gap-2 rounded-xl bg-[#e87722] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#c85f13]"
                      >
                        <FiFileText size={14} /> ร่างข้อกำหนดพัสดุ (TOR) <FiArrowRight />
                      </a>
                      <Link
                        href="/forms"
                        className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-[#272522] transition hover:bg-stone-50"
                      >
                        <FiFileText size={14} /> จัดทำแบบฟอร์มทางพัสดุ <FiArrowRight />
                      </Link>
                    </div>
                    <p className="text-[0.65rem] text-stone-500">
                      ข้อมูลใบเสนอราคาจะถูกส่งไปยังหน้าถัดไปโดยอัตโนมัติ
                    </p>
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card className="border border-stone-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-400 mb-3">
                <FiFileText size={28} />
              </div>
              <h3 className="text-base font-bold text-[#272522]">ยังไม่มีข้อมูลที่สกัด</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                อัปโหลดใบเสนอราคาจากผู้ขายหลายราย (PDF/JPG) เพื่อให้ AI เปรียบเทียบราคาในตารางเดียว
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
