export type FormFieldType = "text" | "number" | "date" | "textarea";

export interface FormPlaceholderDef {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
}

export const FORM_PLACEHOLDER_DEFS: Record<string, FormPlaceholderDef> = {
  requesterName: { key: "requesterName", label: "ชื่อ-นามสกุลผู้ขอ", type: "text", required: true },
  department: { key: "department", label: "หน่วยงาน", type: "text", required: true },
  position: { key: "position", label: "ตำแหน่ง", type: "text" },
  telephone: { key: "telephone", label: "เบอร์โทรติดต่อ", type: "text" },
  itemType: { key: "itemType", label: "ประเภทพัสดุ/งาน", type: "text", required: true },
  itemDetails: { key: "itemDetails", label: "รายละเอียดสิ่งของ/งาน", type: "textarea", required: true },
  quantity: { key: "quantity", label: "จำนวน/ปริมาณ", type: "text" },
  unit: { key: "unit", label: "หน่วยนับ", type: "text" },
  budget: { key: "budget", label: "วงเงินงบประมาณ (บาท)", type: "number", required: true },
  budgetSource: { key: "budgetSource", label: "แหล่งที่มาของงบประมาณ", type: "text" },
  reason: { key: "reason", label: "เหตุผล/ความจำเป็น", type: "textarea", required: true },
  dateNeeded: { key: "dateNeeded", label: "วันที่ต้องใช้งาน", type: "date" },
  deliveryPlace: { key: "deliveryPlace", label: "สถานที่ส่งมอบ", type: "text" },
  assetName: { key: "assetName", label: "ชื่อครุภัณฑ์", type: "text" },
  assetCode: { key: "assetCode", label: "รหัสครุภัณฑ์", type: "text" },
  fromPlace: { key: "fromPlace", label: "สถานที่เดิม", type: "text" },
  toPlace: { key: "toPlace", label: "สถานที่ย้าย/ส่งคืน", type: "text" },
  defectDescription: { key: "defectDescription", label: "รายละเอียดความชำรุด", type: "textarea" },
};

export const FORM_CATEGORIES = [
  "วัสดุ",
  "ครุภัณฑ์",
  "จ้างบริการ/จ้างเหมา",
  "จ้างซ่อมทรัพย์สิน",
  "เบิก/คืน/เคลื่อนย้าย",
] as const;
