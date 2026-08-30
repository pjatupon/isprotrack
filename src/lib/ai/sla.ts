export type ProcurementKind =
  | "เฉพาะเจาะจง"
  | "จ้างเหมาบริการ"
  | "จัดซื้อครุภัณฑ์"
  | "สิ่งก่อสร้าง";

export interface SlaInfo {
  kind: ProcurementKind;
  slaText: string;
  slaDays: number;
  startDate: string;
  endDate: string;
  urgency: "ok" | "risk" | "critical";
  steps: { title: string; description: string; days: string; done: boolean }[];
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return result;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function determineSla(input: {
  budget?: number;
  itemType?: string;
  dateNeeded?: string;
}): SlaInfo {
  const text = `${input.itemType ?? ""}`.toLowerCase();
  const budget = input.budget ?? 0;

  let kind: ProcurementKind = "เฉพาะเจาะจง";
  let slaDays = 3;

  if (text.includes("ก่อสร้าง") || text.includes("ปรับปรุง") || text.includes("อาคาร")) {
    kind = "สิ่งก่อสร้าง";
    slaDays = 45;
  } else if (text.includes("จ้าง") || text.includes("เหมา") || text.includes("บริการ")) {
    kind = "จ้างเหมาบริการ";
    slaDays = 7;
  } else if (text.includes("ครุภัณฑ์") || text.includes("เครื่อง") || budget > 100000) {
    kind = "จัดซื้อครุภัณฑ์";
    slaDays = 22;
  }

  const startDate = new Date();
  const endDate = addBusinessDays(startDate, slaDays);

  let urgency: SlaInfo["urgency"] = "ok";
  if (input.dateNeeded) {
    const needed = new Date(input.dateNeeded);
    if (needed < endDate) {
      urgency = needed < addBusinessDays(startDate, Math.ceil(slaDays / 2)) ? "critical" : "risk";
    }
  }

  const slaText =
    kind === "เฉพาะเจาะจง"
      ? "~3 วันทำการ"
      : kind === "จ้างเหมาบริการ"
        ? "อย่างน้อย 7 วันทำการ"
        : kind === "จัดซื้อครุภัณฑ์"
          ? "อย่างน้อย 1 เดือน"
          : "อย่างน้อย 1-2 เดือน";

  const steps = buildRoadmap(kind);

  return { kind, slaText, slaDays, startDate: formatDate(startDate), endDate: formatDate(endDate), urgency, steps };
}

function buildRoadmap(kind: ProcurementKind): SlaInfo["steps"] {
  if (kind === "เฉพาะเจาะจง") {
    return [
      { title: "ขอใบเสนอราคา", description: "ติดต่อผู้ขายอย่างน้อย 1 ราย", days: "1-2 วันทำการ", done: false },
      { title: "ตรวจใบเสนอราคา", description: "เปรียบเทียบราคาและความครบถ้วน", days: "1 วันทำการ", done: false },
      { title: "อนุมัติจัดซื้อ", description: "ผู้มีอำนาจอนุมัติตามวงเงิน", days: "1 วันทำการ", done: false },
      { title: "สั่งซื้อ/ส่งมอบ", description: "ออกใบสั่งซื้อและรับมอบพัสดุ", days: "ตามเงื่อนไขผู้ขาย", done: false },
    ];
  }
  if (kind === "จ้างเหมาบริการ") {
    return [
      { title: "จัดทำ TOR", description: "ร่างข้อกำหนดและขอบเขตงาน", days: "2-3 วันทำการ", done: false },
      { title: "ประกาศเชิญชวน", description: "เผยแพร่ประกาศเชิญชวนผู้ประกอบการ", days: "5 วันทำการ", done: false },
      { title: "เปิดซอง/พิจารณา", description: "คณะกรรมการพิจารณาผล", days: "3-5 วันทำการ", done: false },
      { title: "อนุมัติและทำสัญญา", description: "ลงนามสัญญาจ้าง", days: "ตามขั้นตอน", done: false },
    ];
  }
  if (kind === "จัดซื้อครุภัณฑ์") {
    return [
      { title: "จัดทำ TOR/ราคากลาง", description: "ตั้งคณะกรรมการราคากลาง", days: "1 สัปดาห์", done: false },
      { title: "ประกาศเชิญชวน", description: "เผยแพร่ประกาศ (e-Market/e-Bidding)", days: "5-15 วันทำการ", done: false },
      { title: "เปิดซอง/พิจารณา", description: "คณะกรรมการตรวจสอบคุณสมบัติ", days: "1 สัปดาห์", done: false },
      { title: "อนุมัติจัดซื้อและสัญญา", description: "ผู้มีอำนาจอนุมัติ ลงนามสัญญา", days: "ตามขั้นตอน", done: false },
    ];
  }
  return [
    { title: "จัดทำ TOR และแบบแปลน", description: "ตั้งคณะกรรมการราคากลาง/แบบรูปรายการ", days: "2 สัปดาห์", done: false },
    { title: "ประกาศเชิญชวน", description: "เผยแพร่ประกาศ e-Bidding", days: "15 วันทำการ", done: false },
    { title: "เปิดซอง/พิจารณา", description: "คณะกรรมการพิจารณาผล", days: "2 สัปดาห์", done: false },
    { title: "ทำสัญญาและก่อสร้าง", description: "ลงนามสัญญา เริ่มดำเนินการ", days: "ตามสัญญา", done: false },
  ];
}
