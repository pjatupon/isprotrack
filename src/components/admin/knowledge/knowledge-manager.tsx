"use client";

import React, { useState, useActionState, useTransition } from "react";
import Link from "next/link";
import { Button, Card, Chip, Alert, TextField, Label, Input, Modal, useOverlayState } from "@heroui/react";
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
} from "react-icons/fi";
import {
  saveKnowledgeCategory,
  deleteKnowledgeCategory,
  uploadKnowledgeDocument,
  updateKnowledgeDocument,
  retryKnowledgeDocumentAction,
  reindexKnowledgeDocumentAction,
  deleteKnowledgeDocument,
  setKnowledgeDocumentArchived,
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

export function KnowledgeManager({
  categories,
  documents,
}: {
  categories: KnowledgeCategoryView[];
  documents: KnowledgeDocumentView[];
}) {
  const [uploadState, uploadAction, isUploadPending] = useActionState(uploadKnowledgeDocument, null);
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategoryView | null>(null);
  const [editingDocument, setEditingDocument] = useState<KnowledgeDocumentView | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isMutating, startTransition] = useTransition();
  const categoryModal = useOverlayState();
  const uploadModal = useOverlayState();
  const documentModal = useOverlayState();

  const runMutation = (action: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) alert(result.error);
    });
  };

  const submitCategory = async (formData: FormData) => {
    if (editingCategory) formData.set("id", editingCategory.id);
    startTransition(async () => {
      const result = await saveKnowledgeCategory(null, formData);
      if (!result.success && result.error) alert(result.error);
      if (result.success) {
        setEditingCategory(null);
        categoryModal.close();
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
      </div>

      {/* Alerts */}
      {uploadState?.error && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Description className="text-xs">{uploadState.error}</Alert.Description>
        </Alert>
      )}
      {uploadState?.success && (
        <Alert status="success" className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold flex items-center gap-1.5">
            <FiCheck /> {uploadState.message}
          </Alert.Description>
        </Alert>
      )}

      {/* Category Management */}
      <Card className="border border-slate-200/80 bg-white p-5 shadow-xs rounded-xl">
        <Card.Header className="px-0 pt-0">
          <div className="flex items-center justify-between w-full">
            <div>
              <Card.Title className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FiTag className="text-[#8B0000]" /> หมวดหมู่ความรู้
              </Card.Title>
              <Card.Description className="text-xs text-slate-500">
                จัดกลุ่มเอกสารสำหรับการค้นหาและสิทธิ์การเข้าถึง
              </Card.Description>
            </div>
            <Button
              onPress={() => {
                setEditingCategory(null);
                categoryModal.open();
              }}
              className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
            >
              <FiPlus /> เพิ่มหมวดหมู่
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
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
                  <td className="p-2.5 text-slate-500 max-w-xs truncate">{category.description || "—"}</td>
                  <td className="p-2.5 text-slate-600">{category.documentCount}</td>
                  <td className="p-2.5">
                    {category.isActive ? (
                      <Chip size="sm" variant="soft" color="success">ใช้งาน</Chip>
                    ) : (
                      <Chip size="sm" variant="soft" color="default">ปิด</Chip>
                    )}
                  </td>
                  <td className="p-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(category);
                        categoryModal.open();
                      }}
                      className="text-[#8B0000] font-semibold hover:underline cursor-pointer mr-3"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`ลบหมวดหมู่ "${category.name}" หรือไม่?`)) {
                          runMutation(() => deleteKnowledgeCategory(category.id));
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 font-semibold cursor-pointer"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">
                    ยังไม่มีหมวดหมู่ — เพิ่มหมวดหมู่แรกได้เลย
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card.Content>
      </Card>

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
              <FiUploadCloud /> อัปโหลดเอกสาร
            </Button>
          </div>
        </Card.Header>

      </Card>

      <Modal state={categoryModal}>
        <Modal.Backdrop />
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiTag className="text-[#8B0000]" />
                {editingCategory ? "แก้ไขหมวดหมู่ความรู้" : "เพิ่มหมวดหมู่ความรู้"}
              </Modal.Heading>
            </Modal.Header>
            <form action={submitCategory}>
              <Modal.Body>
                <div className="space-y-4">
                  <TextField isRequired name="name">
                    <Label className="text-xs font-bold text-slate-700">ชื่อหมวดหมู่</Label>
                    <Input
                      key={editingCategory?.id ?? "new-category"}
                      placeholder="เช่น ระเบียบพัสดุ, เอกสารตัวอย่าง, Workflow"
                      defaultValue={editingCategory?.name ?? ""}
                    />
                  </TextField>
                  <TextField name="description">
                    <Label className="text-xs font-bold text-slate-700">คำอธิบาย</Label>
                    <Input
                      key={`${editingCategory?.id ?? "new-category"}-description`}
                      placeholder="รายละเอียดหมวดหมู่ (ไม่บังคับ)"
                      defaultValue={editingCategory?.description ?? ""}
                    />
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
                  onPress={categoryModal.close}
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
          </Modal.Dialog>
        </Modal.Container>
      </Modal>

      <Modal state={uploadModal}>
        <Modal.Backdrop />
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiUploadCloud className="text-[#8B0000]" /> อัปโหลดเอกสารเข้าสู่คลังความรู้
              </Modal.Heading>
            </Modal.Header>
            <form action={uploadAction}>
              <Modal.Body>
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-slate-500">
                    รองรับ PDF, JPG, PNG และ WebP ขนาดสูงสุด 15MB ระบบจะทำ Vision OCR, Semantic Chunking และ Embedding อัตโนมัติ
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField isRequired name="title">
                      <Label className="text-xs font-bold text-slate-700">ชื่อเอกสาร</Label>
                      <Input placeholder="เช่น ระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างฯ พ.ศ. 2560" />
                    </TextField>
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
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">ไฟล์เอกสาร</label>
                    <input
                      type="file"
                      name="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      required
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#8B0000] hover:file:bg-red-100 cursor-pointer"
                    />
                    {selectedFile && (
                      <p className="text-[0.68rem] text-slate-400">{selectedFile.name} · {formatFileSize(selectedFile.size)}</p>
                    )}
                  </div>
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
                  isDisabled={isUploadPending}
                  className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
                >
                  {isUploadPending ? (
                    <><FiRefreshCw className="animate-spin" /> กำลัง OCR + Chunking + Embedding...</>
                  ) : (
                    <><FiUploadCloud /> อัปโหลดและประมวลผล</>
                  )}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>

      <Modal state={documentModal}>
        <Modal.Backdrop />
        <Modal.Container size="md">
          <Modal.Dialog>
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
                    <TextField isRequired name="title">
                      <Label className="text-xs font-bold text-slate-700">ชื่อเอกสาร</Label>
                      <Input key={`${editingDocument.id}-title`} defaultValue={editingDocument.title} />
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
                          <Link href={`/admin/knowledge-base/${doc.id}/file`} target="_blank" title="ดาวน์โหลดไฟล์ต้นฉบับ">
                            <Button size="sm" variant="secondary" className="border border-slate-300 p-1.5 min-w-0 h-7 w-7">
                              <FiDownload size={12} />
                            </Button>
                          </Link>
                        )}
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
                        {doc.status === "FAILED" && (
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
                        )}
                        {doc.status === "ACTIVE" && (
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
                        )}
                        {doc.status === "ARCHIVED" ? (
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
                        ) : (
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
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={isMutating}
                          onPress={() => {
                            if (confirm(`ลบเอกสาร "${doc.title}" แบบถาวรหรือไม่?`)) {
                              runMutation(() => deleteKnowledgeDocument(doc.id));
                            }
                          }}
                          className="border border-red-200 p-1.5 min-w-0 h-7 w-7 text-red-600 hover:bg-red-50"
                          aria-label="ลบเอกสาร"
                        >
                          <FiTrash2 size={12} />
                        </Button>
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
