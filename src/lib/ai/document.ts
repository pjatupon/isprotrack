import { generateJsonFromImage } from "@/lib/genai";
import { prepareDocumentForVision, VISION_IMAGE_MIME } from "@/lib/knowledge/media";

export interface ExtractedDocumentText {
  text: string;
  suggestedTitle?: string;
}

const DOCUMENT_EXTRACT_PROMPT = `คุณคือผู้เชี่ยวชาญด้านการอ่านเอกสารราชการ ระเบียบพัสดุ และเอกสารการจัดซื้อจัดจ้างภาครัฐ
อ่านเอกสารที่แนบมา (PDF/ภาพ) แล้วทำสิ่งต่อไปนี้:

1. แปลงข้อความในเอกสารทั้งหมดเป็นภาษาไทยตามต้นฉบับ ระวังภาษาไทยปนอังกฤษ/เลขไทยปนเลขอารบิก
2. รักษาหัวข้อ/หมวด/ข้อ/มาตรา ให้อยู่คนละบรรทัดตามต้นฉบับ
3. บันทึกหมายเลขหน้า (ถ้ามี) ไว้ในข้อความด้วยรูปแบบ [หน้า N] ก่อนเริ่มหน้าใหม่
4. ระบุชื่อเรื่องโดยสังเขปของเอกสาร

ให้ตอบเฉพาะ JSON ในรูปแบบ:
{
  "text": "ข้อความทั้งหมดของเอกสาร",
  "suggestedTitle": "ชื่อเรื่องโดยสังเขป"
}
ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON`;

const PAGE_EXTRACT_PROMPT = `คุณคือผู้เชี่ยวชาญด้านการอ่านเอกสารราชการ ระเบียบพัสดุ และเอกสารการจัดซื้อจัดจ้างภาครัฐ
อ่านหน้าของเอกสารที่แนบมา แล้วแปลงข้อความทั้งหมดเป็นภาษาไทยตามต้นฉบับ รักษาหัวข้อ/หมวด/ข้อ/มาตรา/ตาราง ให้อยู่คนละบรรทัดตามต้นฉบับ

ให้ตอบเฉพาะ JSON ในรูปแบบ:
{
  "text": "ข้อความในหน้านี้เท่านั้น"
}
ห้ามใส่ข้อความอื่นนอกเหนือจาก JSON`;

const MAX_EXTRACT_RETRIES = 2;

async function extractWithRetry<T>(
  runner: () => Promise<T>,
  retries = MAX_EXTRACT_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await runner();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export async function extractDocumentText(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractedDocumentText> {
  const pages = await prepareDocumentForVision(fileBuffer, mimeType);

  if (pages.length === 0) {
    throw new Error("ไม่พบหน้าที่ประมวลผลได้ในเอกสาร");
  }

  if (pages.length === 1) {
    const page = pages[0];
    const base64Data = page.buffer.toString("base64");
    const parsed = await extractWithRetry(() =>
      generateJsonFromImage<{ text?: string; suggestedTitle?: string }>(
        DOCUMENT_EXTRACT_PROMPT,
        base64Data,
        {
          temperature: 0.1,
          maxTokens: 12000,
          mimeType: page.mimeType,
        },
      ),
    );

    const text = (parsed.text ?? "").trim();
    if (!text) {
      throw new Error("ไม่พบข้อความในเอกสาร");
    }

    return {
      text,
      suggestedTitle: parsed.suggestedTitle?.trim() || undefined,
    };
  }

  const pageTexts: string[] = [];
  for (const page of pages) {
    const base64Data = page.buffer.toString("base64");
    const parsed = await extractWithRetry(() =>
      generateJsonFromImage<{ text?: string }>(PAGE_EXTRACT_PROMPT, base64Data, {
        temperature: 0.1,
        maxTokens: 12000,
        mimeType: VISION_IMAGE_MIME,
      }),
    );
    pageTexts.push(`[หน้า ${page.pageNumber}]\n${(parsed.text ?? "").trim()}`);
  }

  const combined = pageTexts.filter((text) => text.trim().length > 0).join("\n\n");
  if (!combined) {
    throw new Error("ไม่พบข้อความในเอกสาร");
  }

  return { text: combined };
}
