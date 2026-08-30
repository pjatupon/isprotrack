/**
 * ใช้ส่งข้อมูลความต้องการจากบทสนทนาที่ปรึกษา (/consult) ไปยังหน้าอื่น (เช่น /tor) ผ่าน sessionStorage
 * เพื่อให้ผู้ใช้ถามต่อ (เช่น "ช่วยร่าง TOR ให้หน่อย") แล้วนำข้อมูลความต้องการครบถ้วน
 * (วัตถุประสงค์ จำนวน วงเงิน กำหนดใช้งาน ประเภทการจัดหา + ผลวิเคราะห์ AI)
 * ไปให้ AI ร่าง TOR ที่ถูกต้องตรงตามระเบียบจากคลังความรู้ RAG ได้ทันที
 * ไม่ใช้ "use server"/"server-only" เพราะต้องเรียกจากฝั่ง client เท่านั้น
 */

export const TOR_PREFILL_STORAGE_KEY = "consult.torPrefill";

export interface TorPrefillPayload {
  objective: string;
  scope: string;
  quantity?: string;
  budget?: string;
  usageDate?: string;
  procurementType?: string;
  procurementMethod?: string;
  aiSummary?: string;
}

export function saveTorPrefill(payload: TorPrefillPayload) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TOR_PREFILL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors (เช่น private mode หรือ quota เต็ม)
  }
}

export function consumeTorPrefill(): TorPrefillPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TOR_PREFILL_STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(TOR_PREFILL_STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<TorPrefillPayload>;
    return {
      objective: typeof parsed.objective === "string" ? parsed.objective : "",
      scope: typeof parsed.scope === "string" ? parsed.scope : "",
      quantity: typeof parsed.quantity === "string" ? parsed.quantity : "",
      budget: typeof parsed.budget === "string" ? parsed.budget : "",
      usageDate: typeof parsed.usageDate === "string" ? parsed.usageDate : "",
      procurementType:
        typeof parsed.procurementType === "string" ? parsed.procurementType : "",
      procurementMethod:
        typeof parsed.procurementMethod === "string" ? parsed.procurementMethod : "",
      aiSummary: typeof parsed.aiSummary === "string" ? parsed.aiSummary : "",
    };
  } catch {
    return null;
  }
}
