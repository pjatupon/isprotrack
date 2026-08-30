import { generateJsonFromImage } from "@/lib/genai";
import { prepareDocumentForVision } from "@/lib/knowledge/media";
import { AI_PROMPT_KEYS, getAiPrompt } from "./prompts";

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
  brandsDetected: string[];
}

export async function extractQuotationData(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<QuotationExtract> {
  const prompt = await getAiPrompt(AI_PROMPT_KEYS.quotationExtract);
  try {
    const pages = await prepareDocumentForVision(fileBuffer, mimeType);
    const page = pages[0];
    if (!page) {
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
        brandsDetected: [],
      };
    }

    const base64Data = page.buffer.toString("base64");

    const parsed = await generateJsonFromImage<QuotationExtract>(prompt, base64Data, {
      temperature: 0.1,
      maxTokens: 2000,
      mimeType: page.mimeType,
    });

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
  } catch (error) {
    console.error("OCR extraction error:", error);

    if (error instanceof Error && error.message.includes("JSON")) {
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
        warnings: [error.message],
        brandsDetected: [],
      };
    }

    throw error;
  }
}