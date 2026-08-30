"use client";

import React, { useState, useActionState, useTransition } from "react";
import { Button, Card, Chip, Alert, TextField, Label, Input, Modal, Popover, Tooltip, useOverlayState } from "@heroui/react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiFileText,
  FiAlertTriangle,
  FiCheck,
  FiCheckCircle,
  FiDownload,
  FiCpu,
} from "react-icons/fi";
import { saveFormTemplate, deleteFormTemplate, toggleFormTemplate } from "@/app/admin/form-templates/actions";
import { FORM_CATEGORIES, FORM_PLACEHOLDER_DEFS, type FormPlaceholderDef } from "@/lib/ai/form-template-defs";
import { AiFormTemplateWizard, type AiFormTemplateEdit } from "@/components/admin/form-templates/ai-form-template-wizard";

export type FormTemplateView = {
  id: string;
  fileName: string;
  category: string;
  budgetMin: number;
  budgetMax: number | null;
  filePath: string;
  placeholders: string[];
  placeholderDefs: FormPlaceholderDef[];
  description: string | null;
  isActive: boolean;
  createdAt: string;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatBudget(min: number, max: number | null): string {
  if (max === null) return `≥ ${min.toLocaleString()}`;
  return `${min.toLocaleString()} – ${max.toLocaleString()}`;
}

function ActionTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger className="inline-flex">{children}</Tooltip.Trigger>
      <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white">
        {label}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

function DeleteTemplateButton({
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
        aria-label={`ลบแบบฟอร์ม "${name}"`}
        className={`inline-flex h-7 w-7 min-w-0 items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 transition ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-red-50"
        }`}
      >
        <FiTrash2 size={12} />
      </Popover.Trigger>
      <Popover.Content
        placement="bottom end"
        className="z-50 max-w-72 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"
      >
        <Popover.Dialog className="outline-none">
          <Popover.Heading className="flex items-center gap-1.5 text-sm font-bold text-red-600">
            <FiAlertTriangle size={14} />
            ยืนยันการลบแบบฟอร์ม
          </Popover.Heading>
          <p className="mt-2 text-xs leading-relaxed text-stone-600 [overflow-wrap:anywhere]">
            ต้องการลบแบบฟอร์ม{" "}
            <span className="font-semibold text-stone-800 line-clamp-2">&quot;{name}&quot;</span>{" "}
            แบบถาวรหรือไม่?
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onPress={popover.close} className="border border-stone-300 text-xs">
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

type SaveState = { success?: boolean; message?: string; error?: string } | null;

export function FormTemplateManager({ templates }: { templates: FormTemplateView[] }) {
  const [saveState, saveAction, isSavePending] = useActionState<SaveState, FormData>(saveFormTemplate, null);
  const [editing, setEditing] = useState<FormTemplateView | null>(null);
  const [aiEditing, setAiEditing] = useState<AiFormTemplateEdit | null>(null);
  const [isMutating, startTransition] = useTransition();
  const modal = useOverlayState();
  const aiModal = useOverlayState();

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    // Keep the record identity explicit. This avoids relying on the hidden
    // field being preserved by HeroUI's form controls when editing.
    if (editing) {
      data.set("id", editing.id);
    } else {
      data.delete("id");
    }

    // Close after the payload has been captured, not before FormData is read.
    modal.close();
    setEditing(null);
    startTransition(() => saveAction(data));
  };

  const runMutation = (action: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) alert(result.error);
    });
  };

  const openCreate = () => {
    setEditing(null);
    modal.open();
  };

  const openEdit = (template: FormTemplateView) => {
    setEditing(template);
    modal.open();
  };

  const openAiWizard = () => {
    setEditing(null);
    setAiEditing(null);
    aiModal.open();
  };

  const openAiEdit = (template: FormTemplateView) => {
    setEditing(null);
    setAiEditing({
      id: template.id,
      fileName: template.fileName,
      category: template.category,
      budgetMin: template.budgetMin,
      budgetMax: template.budgetMax,
      description: template.description,
      isActive: template.isActive,
    });
    aiModal.open();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            FORM TEMPLATE LIBRARY
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            คลังแบบฟอร์มเอกสาร
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            จัดการไฟล์แบบฟอร์ม .docx มาตรฐานที่ใช้ในคลังความรู้ AI เพื่อ Auto Form Selection ตามประเภทและวงเงิน
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onPress={openAiWizard}
            className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
          >
            <FiPlus /> เพิ่มด้วย AI Analysis
          </Button>
          <Button
            onPress={openCreate}
            variant="secondary"
            className="border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 text-xs"
          >
            <FiPlus /> เพิ่มแบบฟอร์ม (กำหนดเอง)
          </Button>
        </div>
      </div>

      {saveState?.error && (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Description className="text-xs">{saveState.error}</Alert.Description>
        </Alert>
      )}
      {saveState?.success && (
        <Alert status="success" className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold">{saveState.message}</Alert.Description>
        </Alert>
      )}

      <Card className="border border-slate-200/80 bg-white p-5 shadow-xs rounded-xl">
        <Card.Header className="px-0 pt-0">
          <Card.Title className="text-base font-bold text-slate-800">
            รายการแบบฟอร์มทั้งหมด ({templates.length})
          </Card.Title>
        </Card.Header>
        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2.5 font-bold text-slate-600">ชื่อแบบฟอร์ม</th>
                <th className="p-2.5 font-bold text-slate-600">หมวดหมู่</th>
                <th className="p-2.5 font-bold text-slate-600">วงเงิน (บาท)</th>
                <th className="p-2.5 font-bold text-slate-600">ตัวแปร (Placeholders)</th>
                <th className="p-2.5 font-bold text-slate-600">สถานะ</th>
                <th className="p-2.5 font-bold text-slate-600">สร้างเมื่อ</th>
                <th className="p-2.5 font-bold text-slate-600 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <FiFileText className="text-[#8B0000] shrink-0" size={14} />
                      <span className="font-semibold text-slate-800">{template.fileName}</span>
                    </div>
                  </td>
                  <td className="p-2.5">
                    <Chip size="sm" variant="soft" color="accent">{template.category}</Chip>
                  </td>
                  <td className="p-2.5 text-slate-600">{formatBudget(template.budgetMin, template.budgetMax)}</td>
                  <td className="p-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                      {template.placeholderDefs.map((def) => (
                        <Chip key={def.key} size="sm" variant="tertiary" className="text-[0.6rem]" title={def.key}>
                          {def.label}
                          {def.required && <span className="ml-0.5 text-red-500">*</span>}
                        </Chip>
                      ))}
                    </div>
                  </td>
                  <td className="p-2.5">
                    <Chip size="sm" variant="soft" color={template.isActive ? "success" : "default"}>
                      {template.isActive ? "ใช้งาน" : "ปิด"}
                    </Chip>
                  </td>
                  <td className="p-2.5 text-slate-500 whitespace-nowrap">{formatDate(template.createdAt)}</td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <ActionTooltip label="เปิดไฟล์แม่แบบ">
                        <a href={`/media/${template.filePath}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="secondary" className="border border-slate-300 p-1.5 min-w-0 h-7 w-7">
                            <FiDownload size={12} />
                          </Button>
                        </a>
                      </ActionTooltip>
                      <ActionTooltip label="แก้ไขไฟล์ด้วย AI Analysis">
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={isMutating}
                          onPress={() => openAiEdit(template)}
                          className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                          aria-label="แก้ไขไฟล์ด้วย AI Analysis"
                        >
                          <FiCpu size={12} />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="แก้ไขแบบฟอร์ม">
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={isMutating}
                          onPress={() => openEdit(template)}
                          className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                          aria-label="แก้ไขแบบฟอร์ม"
                        >
                          <FiEdit2 size={12} />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label={template.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={isMutating}
                          onPress={() => runMutation(() => toggleFormTemplate(template.id, !template.isActive))}
                          className="border border-slate-300 p-1.5 min-w-0 h-7 w-7"
                        >
                          <FiCheck size={12} />
                        </Button>
                      </ActionTooltip>
                      <DeleteTemplateButton
                        name={template.fileName}
                        disabled={isMutating}
                        onConfirm={() => runMutation(() => deleteFormTemplate(template.id))}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    ยังไม่มีแบบฟอร์ม — กด &quot;เพิ่มแบบฟอร์ม&quot; เพื่อเริ่มต้น
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card.Content>
      </Card>

      {/* Create/Edit modal */}
      <Modal state={modal}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiFileText className="text-[#8B0000]" />
                {editing ? "แก้ไขแบบฟอร์ม" : "เพิ่มแบบฟอร์มใหม่"}
              </Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSave}>
              <input type="hidden" name="id" value={editing?.id ?? ""} readOnly />
              <Modal.Body>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      isRequired
                      name="fileName"
                      key={editing ? `${editing.id}-name` : "new-name"}
                      defaultValue={editing?.fileName ?? ""}
                    >
                      <Label className="text-xs font-bold text-slate-700">ชื่อแบบฟอร์ม</Label>
                      <Input placeholder="เช่น แบบขอจัดซื้อครุภัณฑ์ (วงเงินไม่เกิน 100,000 บาท)" />
                    </TextField>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">หมวดหมู่</label>
                      <select
                        key={editing ? `${editing.id}-category` : "new-category"}
                        name="category"
                        defaultValue={editing?.category ?? FORM_CATEGORIES[0]}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#8B0000] focus:outline-none"
                      >
                        {FORM_CATEGORIES.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      name="budgetMin"
                      type="number"
                      key={editing ? `${editing.id}-min` : "new-min"}
                      defaultValue={String(editing?.budgetMin ?? 0)}
                    >
                      <Label className="text-xs font-bold text-slate-700">วงเงินขั้นต่ำ (บาท)</Label>
                      <Input />
                    </TextField>
                    <TextField
                      name="budgetMax"
                      type="number"
                      key={editing ? `${editing.id}-max` : "new-max"}
                      defaultValue={editing?.budgetMax !== null && editing?.budgetMax !== undefined ? String(editing.budgetMax) : ""}
                    >
                      <Label className="text-xs font-bold text-slate-700">วงเงินสูงสุด (บาท) — เว้นว่าง = ไม่จำกัด</Label>
                      <Input />
                    </TextField>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">ตัวแปร (Placeholders)</label>
                    <Input
                      key={editing ? `${editing.id}-placeholders` : "new-placeholders"}
                      name="placeholders"
                      defaultValue={editing?.placeholders.join(", ") ?? ""}
                      placeholder="เช่น requesterName, department, reason, itemDetails, totalBudget"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.values(FORM_PLACEHOLDER_DEFS).map((def) => (
                        <Chip key={def.key} size="sm" variant="tertiary" className="text-[0.6rem]">
                          {def.key}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">ไฟล์แม่แบบ .docx</label>
                    <input
                      type="file"
                      name="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#8B0000] hover:file:bg-red-100 cursor-pointer"
                    />
                    {editing && (
                      <p className="text-[0.68rem] text-slate-400">
                        ไฟล์เดิม: {editing.fileName}.docx — อัปโหลดไฟล์ใหม่เพื่อแทนที่ (หรือเว้นว่างไว้คงเดิม)
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">คำอธิบาย</label>
                    <Input
                      key={editing ? `${editing.id}-desc` : "new-desc"}
                      name="description"
                      defaultValue={editing?.description ?? ""}
                      placeholder="รายละเอียดแบบฟอร์ม (ไม่บังคับ)"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      key={editing ? `${editing.id}-active` : "new-active"}
                      type="checkbox"
                      name="isActive"
                      defaultChecked={editing ? editing.isActive : true}
                      className="h-4 w-4 rounded border-slate-300 text-[#8B0000] focus:ring-[#8B0000]"
                    />
                    ใช้งานอยู่ (Active)
                  </label>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button type="button" variant="secondary" className="border border-slate-300 text-xs" onPress={modal.close}>
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  isDisabled={isSavePending}
                  className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
                >
                  <FiCheckCircle /> {isSavePending ? "กำลังบันทึก..." : "บันทึกแบบฟอร์ม"}
                </Button>
              </Modal.Footer>
            </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* AI Analysis Wizard */}
      {aiModal.isOpen && (
        <AiFormTemplateWizard
          key={aiEditing?.id ?? "create"}
          state={aiModal}
          onClose={() => aiModal.close()}
          template={aiEditing}
        />
      )}
    </div>
  );
}
