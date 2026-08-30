"use client";

import { useState, useRef } from "react";
import { Button, Chip, Alert, Modal, Toast, useOverlayState } from "@heroui/react";
import {
  FiCpu,
  FiAlertTriangle,
  FiX,
  FiSave,
  FiPlus,
  FiRefreshCw,
  FiFileText,
} from "react-icons/fi";
import { saveAiFormTemplate } from "@/app/admin/form-templates/actions";
import { FORM_CATEGORIES, type FormFieldType } from "@/lib/ai/form-template-defs";

type Field = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  matchText: string;
  anchor: "replace" | "after";
};

type AnalyzeResult = {
  title: string;
  category: string;
  fields: Field[];
  warnings: string[];
  applied: Record<string, number>;
  documentText?: string;
};

type OverlayState = ReturnType<typeof useOverlayState>;

const FIELD_TYPES: FormFieldType[] = ["text", "number", "date", "textarea"];

function emptyField(): Field {
  return { key: "", label: "", type: "text", required: false, matchText: "", anchor: "replace" };
}

export type AiFormTemplateEdit = {
  id: string;
  fileName: string;
  category: string;
  budgetMin: number;
  budgetMax: number | null;
  description: string | null;
  isActive: boolean;
};

export function AiFormTemplateWizard({
  state,
  onClose,
  template,
}: {
  state: OverlayState;
  onClose: () => void;
  template?: AiFormTemplateEdit | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(template?.fileName ?? "");
  const [category, setCategory] = useState<string>(template?.category ?? FORM_CATEGORIES[0]);
  const [budgetMin, setBudgetMin] = useState(String(template?.budgetMin ?? 0));
  const [budgetMax, setBudgetMax] = useState(template?.budgetMax != null ? String(template.budgetMax) : "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);

  const [phase, setPhase] = useState<"upload" | "review">("upload");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [applied, setApplied] = useState<Record<string, number>>({});
  const [documentText, setDocumentText] = useState<string>("");

  const [isSavePending, setIsSavePending] = useState(false);

  const handleFileChange = (selected: File | null) => {
    setFile(selected);
    setFileName(selected ? selected.name.replace(/\.docx$/i, "").replace(/[\\/:*?"<>|]/g, "_") : "");
    setPhase("upload");
    setFields([]);
    setWarnings([]);
    setApplied({});
    setDocumentText("");
    setAnalyzeError(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/ai/form-analyze", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "ไม่สามารถวิเคราะห์แบบฟอร์มได้");
      }
      const data = (await res.json()) as AnalyzeResult;
      setFields(data.fields);
      setWarnings(data.warnings ?? []);
      setApplied(data.applied ?? {});
      setDocumentText(data.documentText ?? "");
      setCategory(data.category || FORM_CATEGORIES[0]);
      if (!fileName && data.title) setFileName(data.title);
      setPhase("review");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการวิเคราะห์");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateField = (index: number, patch: Partial<Field>) => {
    setFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const addField = () => {
    setFields((prev) => [...prev, emptyField()]);
  };

  const handleSave = async () => {
    const invalidKeys = fields.filter((field) => !field.key.trim());
    if (invalidKeys.length > 0) {
      setAnalyzeError("กรุณาระบุ key ของตัวแปรให้ครบทุกช่อง");
      return;
    }
    const fd = new FormData();
    if (template) fd.append("id", template.id);
    if (file) fd.append("file", file);
    fd.append("fileName", fileName.trim());
    fd.append("category", category);
    fd.append("budgetMin", budgetMin || "0");
    if (budgetMax.trim()) fd.append("budgetMax", budgetMax.trim());
    fd.append("description", description.trim());
    if (isActive) fd.append("isActive", "on");
    fd.append("placeholderDefs", JSON.stringify(fields));

    setIsSavePending(true);
    setAnalyzeError(null);
    try {
      const result = await saveAiFormTemplate(null, fd);
      if (result.success) {
        Toast.toast.success(result.message || "บันทึกแบบฟอร์มเรียบร้อยแล้ว");
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning) => Toast.toast.warning(warning));
        }
        reset();
        onClose();
      } else {
        const message = result.error || "เกิดข้อผิดพลาดในการบันทึกแบบฟอร์ม";
        setAnalyzeError(message);
        Toast.toast.danger(message);
      }
    } finally {
      setIsSavePending(false);
    }
  };

  const reset = () => {
    setFile(null);
    setFileName(template?.fileName ?? "");
    setCategory(template?.category ?? FORM_CATEGORIES[0]);
    setBudgetMin(String(template?.budgetMin ?? 0));
    setBudgetMax(template?.budgetMax != null ? String(template.budgetMax) : "");
    setDescription(template?.description ?? "");
    setIsActive(template?.isActive ?? true);
    setPhase("upload");
    setFields([]);
    setWarnings([]);
    setApplied({});
    setDocumentText("");
    setAnalyzeError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiCpu className="text-[#8B0000]" />
                {template ? "แก้ไขแบบฟอร์มด้วย AI Analysis" : "เพิ่มแบบฟอร์มด้วย AI Analysis"}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body>
              <div className="space-y-4">
                {analyzeError && (
                  <Alert status="danger" className="rounded-xl">
                    <Alert.Description className="text-xs">{analyzeError}</Alert.Description>
                  </Alert>
                )}
                {warnings.length > 0 && (
                  <Alert status="warning" className="rounded-xl">
                    <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
                      <FiAlertTriangle size={13} /> ข้อควรตรวจสอบ
                    </Alert.Title>
                    <Alert.Description className="text-xs block mt-1 space-y-1">
                      {warnings.map((warning, i) => (
                        <span key={i} className="block">• {warning}</span>
                      ))}
                    </Alert.Description>
                  </Alert>
                )}
                {/* Step 1: File upload + analyze */}
                <div className="rounded-xl border border-stone-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">
                      {template ? "1. อัปโหลดไฟล์ .docx ใหม่เพื่อแทนที่ไฟล์เดิม" : "1. อัปโหลดไฟล์ .docx แบบฟอร์มต้นฉบับ"}
                    </p>
                    {phase === "review" && file && (
                      <Chip size="sm" variant="soft" color="success" className="text-[0.65rem]">วิเคราะห์แล้ว</Chip>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#8B0000] hover:file:bg-red-100 cursor-pointer"
                    />
                    <Button
                      onPress={handleAnalyze}
                      isDisabled={!file || isAnalyzing || phase === "review"}
                      className="shrink-0 bg-[#8B0000] text-xs font-semibold text-white hover:bg-[#6e0000]"
                    >
                      {isAnalyzing ? (
                        <>
                          <FiRefreshCw className="animate-spin" /> AI กำลังวิเคราะห์...
                        </>
                      ) : (
                        <>
                          <FiCpu /> วิเคราะห์ด้วย AI
                        </>
                      )}
                    </Button>
                  </div>
                  {isAnalyzing && (
                    <div className="flex items-center gap-2 text-[0.7rem] text-stone-500">
                      <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[#8B0000]" />
                      AI กำลังอ่านเอกสารและตรวจจับช่องกรอกข้อมูล กรุณารอสักครู่...
                    </div>
                  )}
                </div>

                {/* Step 2: Review fields */}
                {phase === "review" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-700">
                        2. ตรวจสอบและแก้ไขตัวแปร (Placeholders) ที่ AI ตรวจจับได้ ({fields.length} ช่อง)
                      </p>
                      <Button size="sm" variant="secondary" onPress={addField} className="border border-slate-300 text-xs">
                        <FiPlus /> เพิ่มช่อง
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {fields.map((field, index) => (                        <div key={index} className="rounded-xl border border-slate-200 bg-stone-50/60 p-3 space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-0.5">
                              <label className="text-[0.65rem] font-bold text-slate-500">key</label>
                              <input
                                value={field.key}
                                onChange={(e) => updateField(index, { key: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono focus:border-[#8B0000] focus:outline-none"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[0.65rem] font-bold text-slate-500">label (ภาษาไทย)</label>
                              <input
                                value={field.label}
                                onChange={(e) => updateField(index, { label: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-[#8B0000] focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-4">
                            <div className="space-y-0.5">
                              <label className="text-[0.65rem] font-bold text-slate-500">type</label>
                              <select
                                value={field.type}
                                onChange={(e) => updateField(index, { type: e.target.value as FormFieldType })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-[#8B0000] focus:outline-none"
                              >
                                {FIELD_TYPES.map((type) => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[0.65rem] font-bold text-slate-500">anchor</label>
                              <select
                                value={field.anchor}
                                onChange={(e) => updateField(index, { anchor: e.target.value as "replace" | "after" })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-[#8B0000] focus:outline-none"
                              >
                                <option value="replace">แทนที่ (เส้นขีด/จุด)</option>
                                <option value="after">ต่อท้ายป้ายชื่อ</option>
                              </select>
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[0.65rem] font-bold text-slate-500">matchText</label>
                              <input
                                value={field.matchText}
                                onChange={(e) => updateField(index, { matchText: e.target.value })}
                                placeholder="ข้อความในเอกสารที่ต้องตรงกัน"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-[#8B0000] focus:outline-none"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[0.65rem] font-bold text-slate-500">สถานะ</label>
                              <div className="flex items-center gap-2 pt-1">
                                <label className="flex items-center gap-1 text-[0.65rem] text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={(e) => updateField(index, { required: e.target.checked })}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#8B0000]"
                                  />
                                  จำเป็น
                                </label>
                                {(applied[field.key] ?? 0) > 0 ? (
                                  <Chip size="sm" variant="soft" color="success" className="text-[0.6rem]">
                                    เจอ {applied[field.key]} ตำแหน่ง
                                  </Chip>
                                ) : (
                                  <Chip size="sm" variant="soft" color="danger" className="text-[0.6rem]">
                                    ไม่เจอตำแหน่ง
                                  </Chip>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeField(index)}
                                  className="ml-auto grid h-5 w-5 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                                  aria-label="ลบช่อง"
                                >
                                  <FiX size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <details className="rounded-xl border border-slate-200 bg-stone-50/60 p-3">
                      <summary className="cursor-pointer text-[0.7rem] font-bold text-slate-600">
                        ดูข้อความในเอกสาร (ใช้ตรวจสอบ/ก๊อปปี้ matchText ที่ต้องตรงกับเอกสาร)
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-[0.68rem] leading-relaxed text-slate-600 font-mono">
                        {documentText || "ไม่พบข้อความ"}
                      </pre>
                    </details>
                  </div>
                )}

                {/* Metadata */}
                <div className="rounded-xl border border-stone-200 p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-700">3. ข้อมูลแบบฟอร์ม</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">ชื่อแบบฟอร์ม</label>
                      <input
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="เช่น แบบฟอร์มขอเบิกพัสดุ"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">หมวดหมู่</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      >
                        {FORM_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">วงเงินขั้นต่ำ (บาท)</label>
                      <input
                        type="number"
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">วงเงินสูงสุด (บาท) — เว้นว่าง = ไม่จำกัด</label>
                      <input
                        type="number"
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700">คำอธิบาย</label>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="รายละเอียดแบบฟอร์ม (ไม่บังคับ)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#8B0000] focus:ring-[#8B0000]"
                      />
                      เปิดใช้งานแบบฟอร์มทันที (Active)
                    </label>
                  </div>
                  {phase === "review" && (
                    <>
                      <p className="text-[0.68rem] text-slate-400 flex items-center gap-1">
                        <FiFileText size={12} /> เมื่อบันทึก ระบบจะฝังตัวแปร {`{key}`} ลงในไฟล์ .docx และบันทึกไว้บนเซิร์ฟเวอร์เพื่อให้ผู้ใช้กรอกข้อมูลและดาวน์โหลด
                      </p>
                      {template && (
                        <p className="text-[0.68rem] text-amber-600 flex items-center gap-1">
                          <FiAlertTriangle size={12} /> การบันทึกจะแทนที่ไฟล์แม่แบบเดิมของ &quot;{template.fileName}&quot; อย่างถาวร
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button type="button" variant="secondary" className="border border-slate-300 text-xs" onPress={close}>
                ยกเลิก
              </Button>
              {phase === "review" && (
                <Button
                  onPress={handleSave}
                  isDisabled={isSavePending || fields.length === 0 || !file}
                  className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
                >
                  {isSavePending ? (
                    <>
                      <FiRefreshCw className="animate-spin" /> กำลังบันทึก...
                    </>
                  ) : template ? (
                    <>
                      <FiSave /> แทนที่ไฟล์และบันทึกแบบฟอร์ม
                    </>
                  ) : (
                    <>
                      <FiSave /> ฝังตัวแปรและบันทึกแบบฟอร์ม
                    </>
                  )}
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
