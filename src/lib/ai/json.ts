/** สกัด JSON ออกจากข้อความตอบกลับของ AI (รองรับกรณี AI แทรกข้อความอธิบาย) */
export function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || start >= end) {
    throw new Error("AI ไม่ได้ตอบกลับเป็น JSON ที่ถูกต้อง");
  }

  return text.slice(start, end + 1);
}

/** แปลงข้อความตอบกลับของ AI เป็น JSON โดยไม่สนใจข้อความประกอบ */
export function parseAiJson<T>(text: string): T {
  return JSON.parse(extractJsonObject(text)) as T;
}

/** ตัดทอนข้อความให้มีความยาวตามที่กำหนด */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
