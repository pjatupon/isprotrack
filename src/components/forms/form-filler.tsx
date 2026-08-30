"use client";

import { useState, useTransition, useEffect } from "react";
import { Button, Card, Chip, Alert } from "@heroui/react";
import { FiDownload, FiCheck, FiAlertTriangle, FiFileText, FiInfo } from "react-icons/fi";
import type { FormPlaceholderDef } from "@/lib/ai/form-router";

type FormFillerTemplate = {
  id: string;
  fileName: string;
  category: string;
  description: string | null;
  budgetMin: number;
  budgetMax: number | null;
};

function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1] ?? null;
}

export function FormFiller({
  template,
  defs,
}: {
  template: FormFillerTemplate;
  defs: FormPlaceholderDef[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const requiredKeys = defs.filter((def) => def.required).map((def) => def.key);

  useEffect(() => {
    const stored = sessionStorage.getItem("quotation_draft");
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      const itemsText = (data.items || [])
        .map((item: { name: string; quantity: number; unit: string; unitPrice: number }) => 
          `${item.name} จำนวน ${item.quantity} ${item.unit}`
        )
        .join("\n");
      const grandTotal = Number(data.grandTotal || 0).toLocaleString();
      const initialValues: Record<string, string> = {};
      for (const def of defs) {
        const key = def.key.toLowerCase();
        if (key.includes("vendor") || key.includes("supplier") || key.includes("ผู้ขาย") || key.includes("ผู้เสนอ")) {
          initialValues[def.key] = data.vendorName || "";
        } else if (key.includes("amount") || key.includes("total") || key.includes("budget") || key.includes("วงเงิน") || key.includes("ราคา") || key.includes("งบประมาณ")) {
          initialValues[def.key] = grandTotal;
        } else if (key.includes("item") || key.includes("รายการ") || key.includes("scope")) {
          initialValues[def.key] = itemsText;
        }
      }
      if (Object.keys(initialValues).length > 0) {
        queueMicrotask(() => {
          setValues((prev) => ({ ...prev, ...initialValues }));
        });
      }
    } catch {
    }
  }, [defs]);

  const handleDownload = () => {
    const missing = requiredKeys.filter((key) => !String(values[key] ?? "").trim());
    if (missing.length > 0) {
      setError(`กรุณากรอกข้อมูลให้ครบช่องที่จำเป็น (${missing.join(", ")})`);
      setSuccess(null);
      return;
    }
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/forms/fill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: template.id, values }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "ไม่สามารถสร้างไฟล์ .docx ได้");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          fileNameFromDisposition(res.headers.get("Content-Disposition")) ||
          `${template.fileName}.docx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setSuccess(`สร้างไฟล์ ${template.fileName}.docx เรียบร้อย (ตรวจสอบในโฟลเดอร์ดาวน์โหลด)`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  };

  const budgetRange =
    template.budgetMax === null
      ? `ตั้งแต่ ${template.budgetMin.toLocaleString()} บาทขึ้นไป`
      : `${template.budgetMin.toLocaleString()} – ${template.budgetMax.toLocaleString()} บาท`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">DOCX FORM FILLER</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">กรอกข้อมูลและดาวน์โหลดแบบฟอร์ม</h1>
          <p className="text-sm text-stone-500">กรอกข้อมูลในช่องด้านล่าง ระบบจะเติมลงในไฟล์ .docx โดยอัตโนมัติ</p>
        </div>
        <Chip color="accent" size="sm" variant="soft">{template.category}</Chip>
      </div>

      <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <Card.Header className="px-0 pt-0">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#b95817]">
              <FiFileText size={20} />
            </div>
            <div className="min-w-0">
              <Card.Title className="text-base font-bold text-[#272522]">{template.fileName}</Card.Title>
              <Card.Description className="text-xs text-stone-500">
                {template.description || `วงเงิน: ${budgetRange}`}
              </Card.Description>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="px-0 space-y-3">
          {error && (
            <Alert status="danger" className="rounded-xl">
              <Alert.Description className="text-xs">{error}</Alert.Description>
            </Alert>
          )}
          {success && (
            <Alert status="success" className="rounded-xl">
              <Alert.Description className="text-xs font-semibold flex items-center gap-1.5">
                <FiCheck /> {success}
              </Alert.Description>
            </Alert>
          )}

          {defs.length === 0 ? (
            <Alert status="warning" className="rounded-xl">
              <Alert.Description className="text-xs">
                แบบฟอร์มนี้ยังไม่มีช่องกรอกข้อมูลที่กำหนดไว้
              </Alert.Description>
            </Alert>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {defs.map((def) => (
                <div key={def.key} className={`space-y-1 ${def.type === "textarea" ? "sm:col-span-2" : ""}`}>
                  <label className="text-xs font-bold text-stone-600">
                    {def.label}
                    {def.required && <span className="text-red-500"> *</span>}
                  </label>
                  {def.type === "textarea" ? (
                    <textarea
                      value={values[def.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
                      rows={3}
                      className="w-full rounded-xl border border-stone-200 p-2.5 text-sm focus:border-[#e87722] focus:outline-none"
                    />
                  ) : (
                    <input
                      type={def.type === "date" ? "date" : def.type === "number" ? "number" : "text"}
                      value={values[def.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [def.key]: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-[#e87722] focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-stone-500">
          <FiInfo size={14} className="text-[#b95817]" />
          ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก ไฟล์ที่ดาวน์โหลดจะถูกเติมค่าอัตโนมัติ
        </p>
        <Button
          onPress={handleDownload}
          isDisabled={isPending || defs.length === 0}
          className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
        >
          {isPending ? (
            "กำลังสร้างไฟล์..."
          ) : (
            <>
              <FiDownload /> ดาวน์โหลดไฟล์ (.docx)
            </>
          )}
        </Button>
      </div>

      {isPending && (
        <Alert status="accent" className="rounded-xl">
          <Alert.Description className="text-xs">
            <span className="flex items-center gap-1.5">
              <FiAlertTriangle size={13} /> ระบบกำลังสร้างเอกสารและเติมข้อมูลลงในไฟล์ .docx กรุณารอสักครู่...
            </span>
          </Alert.Description>
        </Alert>
      )}
    </div>
  );
}
