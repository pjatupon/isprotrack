"use client";

import { useState, useTransition } from "react";
import { Button, Card, Table, Chip, Alert } from "@heroui/react";
import { FiUploadCloud, FiFileText, FiCheckSquare, FiAlertTriangle, FiCheck, FiRefreshCw, FiArrowRight } from "react-icons/fi";

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
};

export default function QuotationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OCRResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(false);

  const [checklist, setChecklist] = useState<{ id: string; label: string; checked: boolean }[]>([
    { id: "c1", label: "มีชื่อและที่อยู่ผู้เสนอราคาชัดเจน", checked: false },
    { id: "c2", label: "มีเลขประจำตัวผู้เสียภาษี 13 หลัก", checked: false },
    { id: "c3", label: "มีวันที่ออกเอกสารและกำหนดวันยืนราคา", checked: false },
    { id: "c4", label: "ระบุรายการสินค้า จำนวน และราคาต่อหน่วยครบถ้วน", checked: false },
    { id: "c5", label: "คำนวณภาษีมูลค่าเพิ่ม (VAT 7%) ถูกต้อง", checked: false },
  ]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setOcrData(null);
      setIsSaved(false);
    }
  };

  const runOCR = () => {
    if (!file) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/ai/ocr", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) throw new Error("ไม่สามารถประมวลผล OCR ได้");
        const data: OCRResult = await res.json();
        setOcrData(data);

        // Auto update checklist based on OCR
        setChecklist((prev) =>
          prev.map((item) => {
            if (item.id === "c1") return { ...item, checked: !!data.vendorName };
            if (item.id === "c2") return { ...item, checked: data.taxId?.length === 13 };
            if (item.id === "c3") return { ...item, checked: !!data.documentDate && !!data.priceValidityDays };
            if (item.id === "c4") return { ...item, checked: data.items?.length > 0 };
            if (item.id === "c5") return { ...item, checked: data.warnings?.length === 0 };
            return item;
          })
        );
      } catch (err) {
        alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการตรวจสอบ");
      }
    });
  };

  const handleItemChange = (index: number, field: keyof QuotationItem, value: string | number) => {
    if (!ocrData) return;
    const newItems = [...ocrData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].totalPrice = Number(newItems[index].quantity) * Number(newItems[index].unitPrice);
    }
    const newSubtotal = newItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const newVat = Math.round(newSubtotal * (ocrData.vatRate || 0.07) * 100) / 100;
    const newGrandTotal = newSubtotal + newVat;

    setOcrData({
      ...ocrData,
      items: newItems,
      subtotal: newSubtotal,
      vatAmount: newVat,
      grandTotal: newGrandTotal,
    });
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const handleSaveConfirmed = () => {
    setIsSaved(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-[#b95817]">QUOTATION INSPECTOR</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#272522]">ตรวจและวิเคราะห์ใบเสนอราคา</h1>
          <p className="text-sm text-stone-500">ใช้ Gemini Flash Vision สกัดข้อมูล เทียบยอดภาษี และตรวจจับเงื่อนไขการล็อกสเปก</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left: Upload & Document Preview */}
        <div className="space-y-6">
          <Card className="border border-dashed border-stone-300 bg-white p-6 text-center shadow-sm">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer space-y-3 block">
              {previewUrl && file?.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob: preview URL, not an optimizable remote/static asset
                <img
                  src={previewUrl}
                  alt="ตัวอย่างเอกสารที่อัปโหลด"
                  className="mx-auto h-32 w-auto rounded-xl border border-stone-200 object-contain"
                />
              ) : (
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-[#b95817]">
                  <FiUploadCloud size={28} />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-[#272522]">
                  {file ? file.name : "คลิกเพื่ออัปโหลดใบเสนอราคา"}
                </p>
                <p className="text-xs text-stone-400 mt-1">รองรับ PDF, PNG, JPG ขนาดไม่เกิน 10MB</p>
              </div>
            </label>

            {file && (
              <div className="mt-4 pt-4 border-t border-stone-100 flex justify-center gap-2">
                <Button
                  onPress={runOCR}
                  isDisabled={isPending}
                  className="bg-[#e87722] font-semibold text-white hover:bg-[#c85f13]"
                >
                  {isPending ? (
                    <>
                      <FiRefreshCw className="animate-spin" /> กำลังประมวลผล OCR...
                    </>
                  ) : (
                    <>
                      <FiFileText /> ประมวลผลเอกสารด้วย AI
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>

          {/* Checklist Box */}
          <Card className="border border-stone-200 bg-white p-5 shadow-sm">
            <Card.Header className="px-0 pt-0">
              <Card.Title className="text-base font-bold text-[#272522] flex items-center gap-2">
                <FiCheckSquare className="text-[#b95817]" /> Checklist ความครบถ้วนของเอกสาร
              </Card.Title>
            </Card.Header>
            <Card.Content className="px-0 pt-3 space-y-2.5">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  onClick={() => toggleChecklist(item.id)}
                  className="flex items-center gap-3 cursor-pointer rounded-xl p-2 hover:bg-stone-50 transition"
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-md border ${
                      item.checked
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-stone-300 bg-white"
                    }`}
                  >
                    {item.checked && <FiCheck size={14} />}
                  </span>
                  <span className={`text-xs ${item.checked ? "text-stone-800 font-medium" : "text-stone-500"}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </Card.Content>
          </Card>
        </div>

        {/* Right: Extracted Data Table & Warnings */}
        <div className="space-y-6">
          {ocrData ? (
            <Card className="border border-stone-200 bg-white p-5 shadow-sm space-y-5">
              <Card.Header className="px-0 pt-0 flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-emerald-600">ผลการสกัดข้อมูล (OCR EXTRACTED)</p>
                  <Card.Title className="text-lg font-bold text-[#272522]">
                    {ocrData.vendorName || "ไม่ระบุชื่อผู้ขาย"}
                  </Card.Title>
                  <p className="text-xs text-stone-500">เลขประจำตัวผู้เสียภาษี: {ocrData.taxId || "—"}</p>
                </div>
                <Chip color="success" size="sm" variant="soft">
                  ตรวจสอบแล้ว
                </Chip>
              </Card.Header>

              {/* Warnings */}
              {ocrData.warnings && ocrData.warnings.length > 0 && (
                <Alert status="warning" className="rounded-2xl">
                  <Alert.Title className="text-xs font-bold flex items-center gap-1.5">
                    <FiAlertTriangle /> ข้อควรระวังในการตรวจสอบ:
                  </Alert.Title>
                  <Alert.Description className="text-xs space-y-1 block mt-1">
                    {ocrData.warnings.map((w, idx) => (
                      <span key={idx} className="block">• {w}</span>
                    ))}
                  </Alert.Description>
                </Alert>
              )}

              {/* Items Table */}
              <div className="overflow-x-auto">
                <Table className="w-full text-left text-xs">
                  <Table.Header>
                    <Table.Column className="p-2 font-bold text-stone-600">รายการ</Table.Column>
                    <Table.Column className="p-2 font-bold text-stone-600 w-16">จำนวน</Table.Column>
                    <Table.Column className="p-2 font-bold text-stone-600 w-16">หน่วย</Table.Column>
                    <Table.Column className="p-2 font-bold text-stone-600 w-24">ราคา/หน่วย</Table.Column>
                    <Table.Column className="p-2 font-bold text-stone-600 w-24">รวม (บาท)</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {ocrData.items.map((it, idx) => (
                      <Table.Row key={idx} className="border-t border-stone-100">
                        <Table.Cell className="p-2">
                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                            className="w-full rounded border border-stone-200 px-1.5 py-1 text-xs"
                          />
                        </Table.Cell>
                        <Table.Cell className="p-2">
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                            className="w-14 rounded border border-stone-200 px-1.5 py-1 text-xs text-center"
                          />
                        </Table.Cell>
                        <Table.Cell className="p-2 text-stone-500">{it.unit}</Table.Cell>
                        <Table.Cell className="p-2">
                          <input
                            type="number"
                            value={it.unitPrice}
                            onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value))}
                            className="w-20 rounded border border-stone-200 px-1.5 py-1 text-xs text-right"
                          />
                        </Table.Cell>
                        <Table.Cell className="p-2 font-semibold text-right">
                          {Number(it.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>

              {/* Summary Totals */}
              <div className="rounded-2xl bg-stone-50 p-4 space-y-2 text-xs border border-stone-200">
                <div className="flex justify-between text-stone-600">
                  <span>ยอดรวมก่อนภาษี (Subtotal):</span>
                  <span>{ocrData.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                  <span>{ocrData.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#272522] border-t border-stone-200 pt-2">
                  <span>ยอดสุทธิ (Grand Total):</span>
                  <span className="text-[#b95817]">
                    {ocrData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} บาท
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  onPress={handleSaveConfirmed}
                  className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                >
                  <FiCheck /> ยืนยันข้อมูลใบเสนอราคา
                </Button>

                {isSaved && (
                  <a
                    href="/tor"
                    className="flex items-center gap-2 rounded-xl bg-[#e87722] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#c85f13]"
                  >
                    นำข้อมูลไปสร้างร่าง TOR <FiArrowRight />
                  </a>
                )}
              </div>
            </Card>
          ) : (
            <Card className="border border-stone-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-400 mb-3">
                <FiFileText size={28} />
              </div>
              <h3 className="text-base font-bold text-[#272522]">ยังไม่มีข้อมูลที่สกัด</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                อัปโหลดเอกสารใบเสนอราคาที่แผงซ้าย เพื่อให้ AI ทำการตรวจความถูกต้องและวิเคราะห์ตัวเลข
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
