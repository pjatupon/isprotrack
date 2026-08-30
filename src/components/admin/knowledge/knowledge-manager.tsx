"use client";

import React, { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { Button, Card, Chip, TextField, Label, Input, Modal, Popover, Tooltip, Toast, useOverlayState } from "@heroui/react";
import {
  FiPlus,
  FiCheck,
  FiRefreshCw,
  FiLayers,
  FiFileText,
  FiDownload,
  FiEdit2,
  FiArchive,
  FiTrash2,
  FiTag,
  FiUploadCloud,
  FiAlertTriangle,
  FiEye,
} from "react-icons/fi";
import {
  saveKnowledgeCategory,
  deleteKnowledgeCategory,
  uploadKnowledgeDocument,
  createKnowledgeText,
  updateKnowledgeDocument,
  retryKnowledgeDocumentAction,
  reindexKnowledgeDocumentAction,
  deleteKnowledgeDocument,
  setKnowledgeDocumentArchived,
  getKnowledgeDocumentContent,
} from "@/app/admin/knowledge-base/actions";
import type { KnowledgeDocumentType, RegulationStatus } from "@/generated/prisma/enums";

export type KnowledgeCategoryView = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  documentCount: number;
};

export type KnowledgeDocumentView = {
  id: string;
  title: string;
  issueNo: string | null;
  status: RegulationStatus;
  documentType: KnowledgeDocumentType;
  originalName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileUrl: string | null;
  dimensions: number | null;
  chunkCount: number;
  processingNote: string | null;
  categoryName: string | null;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
};

const DOCUMENT_TYPE_LABELS: Record<KnowledgeDocumentType, string> = {
  REGULATION: "ระเบียบ/กฎหมาย",
  EXAMPLE: "เอกสารตัวอย่าง",
  WORKFLOW: "Workflow",
  OTHER: "อื่นๆ",
};

const STATUS_STYLES: Record<RegulationStatus, { label: string; className: string }> = {
  DRAFT: { label: "ร่าง", className: "bg-slate-100 text-slate-600" },
  PROCESSING: { label: "กำลังประมวลผล", className: "bg-amber-50 text-amber-700" },
  ACTIVE: { label: "ใช้งานอยู่", className: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "ประมวลผลไม่สำเร็จ", className: "bg-red-50 text-red-700" },
  SUPERSEDED: { label: "มีฉบับใหม่", className: "bg-orange-50 text-orange-700" },
  ARCHIVED: { label: "ถาวร", className: "bg-slate-100 text-slate-500" },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ActionTooltip({
  label,
  placement = "top",
  children,
}: {
  label: string;
  placement?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className="inline-flex">{children}</Tooltip.Trigger>
      <Tooltip.Content
        placement={placement}
        className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white"
      >
        {label}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

function DeleteDocumentButton({
  title,
  disabled,
  onConfirm,
}: {
  title: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const popover = useOverlayState();

  return (
    <Popover.Root
      isOpen={popover.isOpen}
      onOpenChange={(open) => {
        if (open && disabled) return;
        popover.setOpen(open);
      }}
    >
      <Popover.Trigger
        aria-label={`ลบเอกสาร "${title}"`}
        className={`inline-flex h-7 w-7 min-w-0 items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 transition ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-red-50"
        }`}
      >
        <ActionTooltip label="ลบเอกสาร">
          <span className="inline-flex items-center justify-center">
            <FiTrash2 size={12} />
          </span>
        </ActionTooltip>
      </Popover.Trigger>

      <Popover.Content
        placement="bottom end"
        className="z-50 max-w-72 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"
      >
        <Popover.Dialog className="outline-none">
          <Popover.Heading className="flex items-center gap-1.5 text-sm font-bold text-red-600">
            <FiAlertTriangle size={14} />
            ยืนยันการลบเอกสาร
          </Popover.Heading>
          <p className="mt-2 text-xs leading-relaxed text-stone-600 [overflow-wrap:anywhere]">
            ต้องการลบเอกสาร{" "}
            <span className="font-semibold text-stone-800 line-clamp-2">&quot;{title}&quot;</span>{" "}
            แบบถาวรหรือไม่? ไฟล์ต้นฉบับและ Embedding ทั้งหมดจะถูกลบ และไม่สามารถกู้คืนได้
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={popover.close}
              className="border border-stone-300 text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onPress={() => {
                popover.close();
                onConfirm();
              }}
              className="bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
            >
              ลบถาวร
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

function DeleteCategoryButton({
  name,
  disabled,
  onConfirm,
}: {
  name: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const popover = useOverlayState();

  return (
    <Popover.Root
      isOpen={popover.isOpen}
      onOpenChange={(open) => {
        if (open && disabled) return;
        popover.setOpen(open);
      }}
    >
      <Popover.Trigger
        aria-label={`ลบหมวดหมู่ "${name}"`}
        className={`inline-flex h-7 w-7 min-w-0 items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 transition ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-red-50"
        }`}
      >
        <ActionTooltip label="ลบหมวดหมู่">
          <span className="inline-flex items-center justify-center">
            <FiTrash2 size={12} />
          </span>
        </ActionTooltip>
      </Popover.Trigger>

      <Popover.Content
        placement="bottom end"
        className="z-50 max-w-72 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"
      >
        <Popover.Dialog className="outline-none">
          <Popover.Heading className="flex items-center gap-1.5 text-sm font-bold text-red-600">
            <FiAlertTriangle size={14} />
            ยืนยันการลบหมวดหมู่
          </Popover.Heading>
          <p className="mt-2 text-xs leading-relaxed text-stone-600 [overflow-wrap:anywhere]">
            ต้องการลบหมวดหมู่{" "}
            <span className="font-semibold text-stone-800">&quot;{name}&quot;</span>{" "}
            หรือไม่? เอกสารที่อยู่ในหมวดหมู่นี้จะยังคงอยู่ แต่จะไม่ถูกจัดกลุ่มอีกต่อไป
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={popover.close}
              className="border border-stone-300 text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onPress={() => {
                popover.close();
                onConfirm();
              }}
              className="bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
            >
              ลบหมวดหมู่
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

export function KnowledgeManager({
  categories,
  documents,
}: {
  categories: KnowledgeCategoryView[];
  documents: KnowledgeDocumentView[];
}) {
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategoryView | null>(null);
  const [categoryView, setCategoryView] = useState<"list" | "form">("list");
  const [editingDocument, setEditingDocument] = useState<KnowledgeDocumentView | null>(null);
  const [viewingContent, setViewingContent] = useState<{
    title: string;
    extractedText: string | null;
    chunks: { id: string; chunkIndex: number | null; content: string; section: string | null; page: number | null }[];
  } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isMutating, startTransition] = useTransition();
  const categoryModal = useOverlayState();
  const uploadModal = useOverlayState();
  const documentModal = useOverlayState();
  const viewContentModal = useOverlayState();

  const runMutation = (action: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) alert(result.error);
    });
  };

  const openCategoryManager = () => {
    setEditingCategory(null);
    setCategoryView("list");
    categoryModal.open();
  };

  const openViewContent = async (doc: KnowledgeDocumentView) => {
    setIsLoadingContent(true);
    viewContentModal.open();
    try {
      const result = await getKnowledgeDocumentContent(doc.id);
      if (result.success && result.data) {
        setViewingContent(result.data);
      } else {
        setViewingContent(null);
      }
    } catch {
      setViewingContent(null);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const openCategoryForm = (category: KnowledgeCategoryView | null) => {
    setEditingCategory(category);
    setCategoryView("form");
  };

  const submitCategory = async (formData: FormData) => {
    if (editingCategory) formData.set("id", editingCategory.id);
    startTransition(async () => {
      const result = await saveKnowledgeCategory(null, formData);
      if (!result.success && result.error) alert(result.error);
      if (result.success) {
        setEditingCategory(null);
        setCategoryView("list");
      }
    });
  };

  const activeCategories = categories.filter((category) => category.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            KNOWLEDGE BASE
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            คลังความรู้ AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            จัดการเอกสารระเบียบ/กฎหมาย ตัวอย่าง และ Workflow พร้อมระบบ Vision OCR + Embedding สำหรับการค้นหาแบบ RAG
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onPress={openCategoryManager}
            variant="secondary"
            className="border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FiTag /> จัดการหมวดหมู่
          </Button>
                     </div>
       </div>

      {/* Upload */}
      <Card className="border border-slate-200/80 bg-white p-5 shadow-xs rounded-xl">
        <Card.Header className="px-0 pt-0">
          <div className="flex items-center justify-between w-full">
            <div>
             <Card.Title className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FiUploadCloud className="text-[#8B0000]" /> อัปโหลดเอกสารเข้าสู่คลังความรู้
              </Card.Title>
              <Card.Description className="text-xs text-slate-500">
                รองรับ PDF, JPG, PNG, WebP (สูงสุด 15MB) — ระบบจะทำ Vision OCR, ตัดแบ่ง Chunks และคำนวณ Embedding อัตโนมัติ
              </Card.Description>
            </div>
            <Button
              onPress={() => uploadModal.open()}
              className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
            >
                 <FiUploadCloud /> เพิ่มข้อมูลความรู้
            </Button>
          </div>
        </Card.Header>

      </Card>

      <Modal state={categoryModal}>
        <Modal.Backdrop variant="opaque" className="bg-black/50">
          <Modal.Container size="cover" scroll="inside" className="max-w-5xl sm:max-w-4xl md:max-w-5xl w-full">
            <Modal.Dialog className="w-full max-w-5xl bg-white text-slate-800 shadow-2xl">
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiTag className="text-[#8B0000]" />
                {categoryView === "form"
                  ? editingCategory
                    ? "แก้ไขหมวดหมู่ความรู้"
                    : "เพิ่มหมวดหมู่ความรู้"
                  : "จัดการหมวดหมู่ความรู้"}
              </Modal.Heading>
            </Modal.Header>

            {categoryView === "list" ? (
              <>
                <Modal.Body>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      หมวดหมู่ทั้งหมด {categories.length} รายการ
                    </p>
                    <Button
                      onPress={() => openCategoryForm(null)}
                      className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
                    >
                      <FiPlus /> เพิ่มหมวดหมู่
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="p-2.5 font-bold text-slate-600">ชื่อหมวดหมู่</th>
                          <th className="p-2.5 font-bold text-slate-600">คำอธิบาย</th>
                          <th className="p-2.5 font-bold text-slate-600">จำนวนเอกสาร</th>
                          <th className="p-2.5 font-bold text-slate-600">สถานะ</th>
                          <th className="p-2.5 font-bold text-slate-600 text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((category) => (
                          <tr key={category.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <td className="p-2.5 font-semibold text-slate-800">{category.name}</td>
                            <td className="p-2.5 text-slate-500 max-w-[240px] truncate">{category.description || "—"}</td>
                            <td className="p-2.5 text-slate-600">{category.documentCount}</td>
                            <td className="p-2.5">
                              {category.isActive ? (
                                <Chip size="sm" variant="soft" color="success">ใช้งาน</Chip>
                              ) : (
                                <Chip size="sm" variant="soft" color="default">ปิด</Chip>
                              )}
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                <ActionTooltip label="แก้ไขหมวดหมู่">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    isDisabled={isMutating}
                                    onPress={() => openCategoryForm(category)}
                                    className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                                    aria-label={`แก้ไขหมวดหมู่ "${category.name}"`}
                                  >
                                    <FiEdit2 size={12} />
                                  </Button>
                                </ActionTooltip>
                                <DeleteCategoryButton
                                  name={category.name}
                                  disabled={isMutating}
                                  onConfirm={() => runMutation(() => deleteKnowledgeCategory(category.id))}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {categories.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400">
                              ยังไม่มีหมวดหมู่ — กด &quot;เพิ่มหมวดหมู่&quot; เพื่อสร้างหมวดหมู่แรก
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-slate-300 text-xs"
                    onPress={categoryModal.close}
                  >
                    ปิด
                  </Button>
                </Modal.Footer>
              </>
            ) : (
              <form action={submitCategory}>
                <Modal.Body>
                  <div className="space-y-4">
                    <TextField
                      isRequired
                      name="name"
                      key={`${editingCategory?.id ?? "new-category"}-name`}
                      defaultValue={editingCategory?.name ?? ""}
                    >
                      <Label className="text-xs font-bold text-slate-700">ชื่อหมวดหมู่</Label>
                      <Input placeholder="เช่น ระเบียบพัสดุ, เอกสารตัวอย่าง, Workflow" />
                    </TextField>
                    <TextField
                      name="description"
                      key={`${editingCategory?.id ?? "new-category"}-description`}
                      defaultValue={editingCategory?.description ?? ""}
                    >
                      <Label className="text-xs font-bold text-slate-700">คำอธิบาย</Label>
                      <Input placeholder="รายละเอียดหมวดหมู่ (ไม่บังคับ)" />
                    </TextField>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        key={`${editingCategory?.id ?? "new-category"}-active`}
                        type="checkbox"
                        name="isActive"
                        defaultChecked={editingCategory?.isActive ?? true}
                        className="h-4 w-4 rounded border-slate-300 text-[#8B0000] focus:ring-[#8B0000]"
                      />
                      ใช้งานอยู่ (Active)
                    </label>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-slate-300 text-xs"
                    onPress={() => {
                      setEditingCategory(null);
                      setCategoryView("list");
                    }}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    isDisabled={isMutating}
                    className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
                  >
                    {isMutating ? (
                      <><FiRefreshCw className="animate-spin" /> กำลังบันทึก...</>
                    ) : (
                      <><FiCheck /> {editingCategory ? "บันทึกการแก้ไข" : "สร้างหมวดหมู่"}</>
                    )}
                  </Button>
                </Modal.Footer>
              </form>
            )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={uploadModal}>
        <Modal.Backdrop variant="opaque" className="bg-black/50">
          <Modal.Container size="lg" scroll="inside" className="max-h-[90vh]">
            <Modal.Dialog className="bg-white text-slate-800 shadow-2xl">
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                 <FiUploadCloud className="text-[#8B0000]" /> เพิ่มข้อมูลเข้าสู่คลังความรู้
              </Modal.Heading>
            </Modal.Header>
             <form
               action={async (formData) => {
                setIsUploading(true);
                try {
                   const result = inputMode === "file"
                     ? await uploadKnowledgeDocument(null, formData)
                     : await createKnowledgeText(null, formData);
                  if (result.success) {
                     Toast.toast.success(result.message || "เพิ่มข้อมูลและประมวลผลสำเร็จ");
                    setSelectedFile(null);
                    uploadModal.close();
                  } else if (result.error) {
                    Toast.toast.danger(result.error);
                  }
                } finally {
                  setIsUploading(false);
                }
              }}
            >
              <Modal.Body className="max-h-[calc(90vh-180px)] overflow-y-auto">
                <div className="space-y-4">
                   <div className="flex rounded-xl bg-slate-100 p-1">
                     <button type="button" onClick={() => setInputMode("file")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${inputMode === "file" ? "bg-white text-[#8B0000] shadow-sm" : "text-slate-500"}`}>อัปโหลดไฟล์</button>
                     <button type="button" onClick={() => setInputMode("text")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${inputMode === "text" ? "bg-white text-[#8B0000] shadow-sm" : "text-slate-500"}`}>เพิ่มข้อความ</button>
                   </div>
                    {inputMode === "file" ? (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">ไฟล์เอกสาร</label>
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files?.[0] ?? null;
                            setSelectedFile(file);
                            if (file && titleInputRef.current && !titleInputRef.current.value) titleInputRef.current.value = file.name.replace(/\.[^.]+$/, "");
                          }}
                          onClick={() => document.getElementById("file-upload-input")?.click()}
                          className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${isDragging ? "border-[#8B0000] bg-red-50/80" : "border-slate-300 bg-slate-50 hover:border-[#8B0000] hover:bg-red-50/40"}`}
                        >
                          <input id="file-upload-input" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required={inputMode === "file"} className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
                          <FiUploadCloud className="mb-3 h-10 w-10 text-slate-400" />
                          <p className="text-sm font-semibold text-slate-600">ลากและวางไฟล์ที่นี่ หรือ <span className="text-[#8B0000]">คลิกเพื่อเลือกไฟล์</span></p>
                          <p className="mt-1 text-[0.68rem] text-slate-400">รองรับ PDF, JPG, PNG และ WebP ขนาดสูงสุด 15MB</p>
                          {selectedFile && <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm"><FiFileText className="h-4 w-4 text-[#8B0000]" /><span className="text-xs font-medium text-slate-700">{selectedFile.name}</span><span className="text-[0.68rem] text-slate-400">· {formatFileSize(selectedFile.size)}</span></div>}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">ข้อความความรู้</label>
                        <textarea name="content" required className="min-h-[210px] max-h-[70vh] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed focus:border-[#8B0000] focus:outline-none" placeholder="วางข้อความถาม/ตอบ หรือเนื้อหาความรู้ที่ต้องการให้ AI ค้นหา..." />
                        <p className="text-[0.68rem] text-slate-400">รองรับข้อความยาว ระบบจะตัดเป็น Chunks และสร้าง Embedding อัตโนมัติ</p>
                      </div>
                    )}
                   <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-700">{inputMode === "file" ? "ชื่อเอกสาร" : "ชื่อรายการความรู้"}</label>
                    <input
                      ref={titleInputRef}
                      type="text"
                      name="title"
                       placeholder={inputMode === "file" ? "ไม่พิมพ์จะใช้ชื่อไฟล์แทน" : "เช่น คำถามที่พบบ่อยเรื่องการจัดซื้อ"}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">หมวดหมู่</label>
                    <select
                      name="categoryId"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      defaultValue=""
                    >
                      <option value="">— ไม่ระบุหมวดหมู่ —</option>
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">ประเภทเอกสาร</label>
                    <select
                      name="documentType"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      defaultValue="REGULATION"
                    >
                      {(Object.keys(DOCUMENT_TYPE_LABELS) as KnowledgeDocumentType[]).map((type) => (
                        <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>
                      ))}
                    </select>
                  </div>
                   <p className="text-xs leading-relaxed text-slate-400">
                      {inputMode === "file" ? "ระบบจะทำ Vision OCR, Semantic Chunking และ Embedding อัตโนมัติหลังอัปโหลด" : "ระบบจะทำ Semantic Chunking และ Embedding อัตโนมัติหลังบันทึกข้อความ"}
                   </p>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  type="button"
                  variant="secondary"
                  className="border border-slate-300 text-xs"
                  onPress={() => {
                    setSelectedFile(null);
                    uploadModal.close();
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  isDisabled={isUploading}
                  className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
                >
                  {isUploading ? (
                    <><FiRefreshCw className="animate-spin" /> กำลัง OCR + Chunking + Embedding...</>
                  ) : (
                     <><FiUploadCloud /> {inputMode === "file" ? "อัปโหลดและประมวลผล" : "เพิ่มข้อความและประมวลผล"}</>
                  )}
                </Button>
              </Modal.Footer>
            </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={documentModal}>
        <Modal.Backdrop variant="opaque" className="bg-black/50">
          <Modal.Container size="md">
            <Modal.Dialog className="bg-white text-slate-800 shadow-2xl">
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiEdit2 className="text-[#8B0000]" /> แก้ไขข้อมูลเอกสาร
              </Modal.Heading>
            </Modal.Header>
            {editingDocument && (
              <form
                action={async (formData) => {
                  const result = await updateKnowledgeDocument(editingDocument.id, formData);
                  if (!result.success && result.error) alert(result.error);
                  if (result.success) documentModal.close();
                }}
              >
                <Modal.Body>
                  <div className="space-y-4">
                    <TextField
                      isRequired
                      name="title"
                      key={`${editingDocument.id}-title`}
                      defaultValue={editingDocument.title}
                    >
                      <Label className="text-xs font-bold text-slate-700">ชื่อเอกสาร</Label>
                      <Input />
                    </TextField>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">หมวดหมู่</label>
                      <select
                        key={`${editingDocument.id}-category`}
                        name="categoryId"
                        defaultValue={editingDocument.categoryId ?? ""}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      >
                        <option value="">— ไม่ระบุหมวดหมู่ —</option>
                        {activeCategories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">ประเภทเอกสาร</label>
                      <select
                        key={`${editingDocument.id}-type`}
                        name="documentType"
                        defaultValue={editingDocument.documentType}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      >
                        {(Object.keys(DOCUMENT_TYPE_LABELS) as KnowledgeDocumentType[]).map((type) => (
                          <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="secondary" className="border border-slate-300 text-xs" onPress={documentModal.close}>
                    ยกเลิก
                  </Button>
                  <Button type="submit" className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs">
                    <FiCheck /> บันทึกการแก้ไข
                  </Button>
                </Modal.Footer>
              </form>
            )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={viewContentModal}>
        <Modal.Backdrop variant="opaque" className="bg-black/50">
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="bg-white text-slate-800 shadow-2xl">
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiEye className="text-[#8B0000]" /> เนื้อหาที่ AI ใช้ค้นหา (RAG)
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <FiRefreshCw className="animate-spin text-[#8B0000]" size={24} />
                  <span className="ml-2 text-sm text-slate-500">กำลังโหลดเนื้อหา...</span>
                </div>
              ) : viewingContent ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{viewingContent.title}</h3>
                    <p className="text-xs text-slate-500">
                      {viewingContent.chunks.length} chunks
                      {viewingContent.extractedText ? ` · ข้อความที่ OCR ${viewingContent.extractedText.length.toLocaleString()} ตัวอักษร` : ""}
                    </p>
                  </div>

                  {viewingContent.extractedText && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <FiFileText className="text-[#8B0000]" size={12} />
                        ข้อความที่ Vision OCR ดึงได้
                      </h4>
                      <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                        {viewingContent.extractedText}
                      </div>
                    </div>
                  )}

                  {viewingContent.chunks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <FiLayers className="text-[#8B0000]" size={12} />
                        Chunks ที่ใช้ค้นหา ({viewingContent.chunks.length} รายการ)
                      </h4>
                      <div className="max-h-[320px] overflow-y-auto space-y-2">
                        {viewingContent.chunks.map((chunk) => (
                          <div key={chunk.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="inline-block rounded-md bg-[#8B0000]/10 px-1.5 py-0.5 text-[0.65rem] font-bold text-[#8B0000]">
                                #{chunk.chunkIndex ?? "?"}
                              </span>
                              {chunk.section && (
                                <span className="text-[0.65rem] text-slate-500">{chunk.section}</span>
                              )}
                              {chunk.page != null && (
                                <span className="text-[0.65rem] text-slate-400">หน้า {chunk.page}</span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{chunk.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!viewingContent.extractedText && viewingContent.chunks.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-8">
                      ยังไม่มีเนื้อหา — เอกสารอาจยังไม่ผ่านการประมวลผล
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400 py-8">ไม่พบข้อมูล</p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="secondary"
                className="border border-slate-300 text-xs"
                onPress={() => {
                  setViewingContent(null);
                  viewContentModal.close();
                }}
              >
                ปิด
              </Button>
            </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Document Table */}
      <Card className="border border-slate-200/80 bg-white p-5 shadow-xs rounded-xl">
        <Card.Header className="px-0 pt-0">
          <Card.Title className="text-base font-bold text-slate-800">เอกสารในคลังความรู้</Card.Title>
          <Card.Description className="text-xs text-slate-500">
            เอกสารทั้งหมด {documents.length} รายการ — เฉพาะเอกสารสถานะ &quot;ใช้งานอยู่&quot; จะถูกค้นหาผ่าน RAG
          </Card.Description>
        </Card.Header>

        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2.5 font-bold text-slate-600">เอกสาร</th>
                <th className="p-2.5 font-bold text-slate-600">หมวดหมู่</th>
                <th className="p-2.5 font-bold text-slate-600">ประเภท</th>
                <th className="p-2.5 font-bold text-slate-600">Chunks / Dims</th>
                <th className="p-2.5 font-bold text-slate-600">ไฟล์</th>
                <th className="p-2.5 font-bold text-slate-600">สถานะ</th>
                <th className="p-2.5 font-bold text-slate-600">อัปเดตล่าสุด</th>
                <th className="p-2.5 font-bold text-slate-600 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const statusStyle = STATUS_STYLES[doc.status] ?? STATUS_STYLES.DRAFT;
                return (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition align-top">
                    <td className="p-2.5">
                      <div className="flex items-start gap-2 min-w-[180px]">
                        <FiFileText className="mt-0.5 text-[#8B0000] shrink-0" size={14} />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 leading-snug">{doc.title}</p>
                          {doc.processingNote && doc.status === "FAILED" && (
                            <p className="mt-1 text-[0.68rem] text-red-600 leading-snug">{doc.processingNote}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5 text-slate-500">{doc.categoryName || "—"}</td>
                    <td className="p-2.5 text-slate-600">{DOCUMENT_TYPE_LABELS[doc.documentType]}</td>
                    <td className="p-2.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                        {doc.chunkCount} chunks · {doc.dimensions ?? "?"} dims
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        {doc.mimeType && <span className="text-[0.68rem] text-slate-400">{doc.mimeType.split("/")[1]?.toUpperCase()}</span>}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${statusStyle.className}`}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(doc.updatedAt)}</td>
                    <td className="p-2.5">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {doc.originalName && (
                          <ActionTooltip label="เปิดไฟล์ต้นฉบับ">
                            <Link
                              href={doc.fileUrl ?? `/admin/knowledge-base/${doc.id}/file`}
                              target="_blank"
                            >
                              <Button size="sm" variant="secondary" className="border border-slate-300 p-1.5 min-w-0 h-7 w-7">
                                <FiDownload size={12} />
                              </Button>
                            </Link>
                          </ActionTooltip>
                        )}
                        <ActionTooltip label="ดูเนื้อหาที่ AI ใช้">
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={isMutating}
                            onPress={() => openViewContent(doc)}
                            className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                            aria-label="ดูเนื้อหาที่ AI ใช้"
                          >
                            <FiEye size={12} />
                          </Button>
                        </ActionTooltip>
                        <ActionTooltip label="แก้ไขข้อมูลเอกสาร">
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={isMutating}
                            onPress={() => {
                              setEditingDocument(doc);
                              documentModal.open();
                            }}
                            className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                            aria-label="แก้ไขข้อมูลเอกสาร"
                          >
                            <FiEdit2 size={12} />
                          </Button>
                        </ActionTooltip>
                        {doc.status === "FAILED" && (
                          <ActionTooltip label="ประมวลผลใหม่">
                            <Button
                              size="sm"
                              variant="secondary"
                              isDisabled={isMutating}
                              onPress={() => runMutation(() => retryKnowledgeDocumentAction(doc.id))}
                              className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                              aria-label="ประมวลผลใหม่"
                            >
                              <FiRefreshCw size={12} />
                            </Button>
                          </ActionTooltip>
                        )}
                        {doc.status === "ACTIVE" && (
                          <ActionTooltip label="สร้าง Embedding ใหม่">
                            <Button
                              size="sm"
                              variant="secondary"
                              isDisabled={isMutating}
                              onPress={() => runMutation(() => reindexKnowledgeDocumentAction(doc.id))}
                              className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                              aria-label="สร้าง Embedding ใหม่"
                            >
                              <FiLayers size={12} />
                            </Button>
                          </ActionTooltip>
                        )}
                        {doc.status === "ARCHIVED" ? (
                          <ActionTooltip label="กู้คืนเอกสาร">
                            <Button
                              size="sm"
                              variant="secondary"
                              isDisabled={isMutating}
                              onPress={() => runMutation(() => setKnowledgeDocumentArchived(doc.id, false))}
                              className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                              aria-label="กู้คืนเอกสาร"
                            >
                              <FiCheck size={12} />
                            </Button>
                          </ActionTooltip>
                        ) : (
                          <ActionTooltip label="เก็บถาวร">
                            <Button
                              size="sm"
                              variant="secondary"
                              isDisabled={isMutating}
                              onPress={() => runMutation(() => setKnowledgeDocumentArchived(doc.id, true))}
                              className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                              aria-label="เก็บถาวร"
                            >
                              <FiArchive size={12} />
                            </Button>
                          </ActionTooltip>
                        )}
                        <DeleteDocumentButton
                          title={doc.title}
                          disabled={isMutating}
                          onConfirm={() => runMutation(() => deleteKnowledgeDocument(doc.id))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    ยังไม่มีเอกสารในคลังความรู้ — กด &quot;อัปโหลดเอกสาร&quot; เพื่อเริ่มต้น
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card.Content>
      </Card>
    </div>
  );
}
