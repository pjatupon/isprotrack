import { ai, CHAT_MODEL } from "./index";

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

export async function extractDocumentText(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractedDocumentText> {
  const base64Data = fileBuffer.toString("base64");

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: [
      { text: DOCUMENT_EXTRACT_PROMPT },
      { inlineData: { mimeType, data: base64Data } },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "";
  const parsed = JSON.parse(raw) as { text?: string; suggestedTitle?: string };
  const text = (parsed.text ?? "").trim();

  if (!text) {
    throw new Error("ไม่พบข้อความในเอกสาร");
  }

  return {
    text,
    suggestedTitle: parsed.suggestedTitle?.trim() || undefined,
  };
}
