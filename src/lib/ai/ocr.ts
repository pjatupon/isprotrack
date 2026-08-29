import { ai, CHAT_MODEL } from "./index";

export interface QuotationItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface QuotationExtract {
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
}

const OCR_PROMPT = `คุณคือผู้เชี่ยวชาญด้านการตรวจสอบเอกสารจัดซื้อจัดจ้าง
อ่านใบเสนอราคาที่แนบมาแล้ว extract ข้อมูลต่อไปนี้ในรูปแบบ JSON:

{
  "vendorName": "ชื่อผู้ขาย",
  "taxId": "เลขประจำตัวผู้เสียภาษี 13 หลัก",
  "documentDate": "วันที่ในเอกสาร (YYYY-MM-DD) หรือ null",
  "items": [
    {
      "name": "ชื่อสินค้า/บริการ",
      "quantity": จำนวน (number),
      "unit": "หน่วย",
      "unitPrice": ราคาต่อหน่วย (number),
      "totalPrice": ราคารวม (number)
    }
  ],
  "subtotal": ยอดรวมก่อนภาษี (number),
  "vatRate": อัตราภาษีในรูปแบบทศนิยม เช่น 7% = 0.07,
  "vatAmount": จำนวนภาษีมูลค่าเพิ่ม (number),
  "grandTotal": ยอดรวมสุทธิ (number),
  "priceValidityDays": จำนวนวันยืนราคา (number หรือ null),
  "warnings": ["รายการข้อควรระวัง เช่น ตัวเลขไม่ตรงกัน, ภาษีคำนวณผิด, หรือสงสัยการล็อกสเปก"]
}

ตรวจสอบความถูกต้องของตัวเลข:
1. vatAmount ควรเท่ากับ subtotal * vatRate
2. grandTotal ควรเท่ากับ subtotal + vatAmount
3. ถ้าตัวเลขไม่ตรงกัน ให้เพิ่มคำเตือนใน warnings
4. ดูว่ารายการสินค้ามีลักษณะเฉพาะเกินไปจนสงสัยว่ามีการล็อกสเปกหรือไม่

ให้ตอบเฉพาะ JSON เท่านั้น ไม่ต้องมีข้อความอื่น`;

export async function extractQuotationData(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<QuotationExtract> {
  const base64Data = fileBuffer.toString("base64");

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [
      { text: OCR_PROMPT },
      { inlineData: { mimeType, data: base64Data } },
    ],
    config: {
      temperature: 0.1,
    },
  });

  const text = response.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      vendorName: "",
      taxId: "",
      documentDate: null,
      items: [],
      subtotal: 0,
      vatRate: 0.07,
      vatAmount: 0,
      grandTotal: 0,
      priceValidityDays: null,
      warnings: ["ไม่สามารถอ่านข้อมูลจากเอกสารได้"],
    };
  }

  const parsed: QuotationExtract = JSON.parse(jsonMatch[0]);

  if (parsed.subtotal > 0 && parsed.vatRate > 0) {
    const expectedVat = Math.round(parsed.subtotal * parsed.vatRate * 100) / 100;
    if (Math.abs(expectedVat - parsed.vatAmount) > 0.5) {
      parsed.warnings.push(
        `ภาษีมูลค่าเพิ่มไม่ตรงตามที่คำนวณ (คาดว่า ${expectedVat.toFixed(2)} แต่ได้ ${parsed.vatAmount.toFixed(2)})`,
      );
    }
    const expectedTotal = Math.round((parsed.subtotal + parsed.vatAmount) * 100) / 100;
    if (Math.abs(expectedTotal - parsed.grandTotal) > 0.5) {
      parsed.warnings.push(
        `ยอดรวมสุทธิไม่ตรงกับผลรวม (subtotal + vat) (คาดว่า ${expectedTotal.toFixed(2)} แต่ได้ ${parsed.grandTotal.toFixed(2)})`,
      );
    }
  }

  return parsed;
}