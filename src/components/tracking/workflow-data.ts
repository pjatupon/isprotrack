import { FiAlertCircle, FiCheck, FiClock, FiRefreshCw } from "react-icons/fi";

export type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REVISION_NEEDED";

export type WorkflowStepData = {
  label: string;
  description: string;
  status: StepStatus;
  assignee?: string;
  sla?: string;
  auditLog?: { action: string; timestamp: string }[];
};

export const steps: WorkflowStepData[] = [
  { label: "บอกความต้องการ", description: "ผู้ใช้ระบุความต้องการจัดซื้อ", status: "COMPLETED", assignee: "สมชาย ใจดี", sla: "1 วัน", auditLog: [{ action: "สร้างคำขอ", timestamp: "28 ส.ค. 2569 09:15" }] },
  { label: "AI แยกข้อมูล", description: "ระบบแยกข้อมูลความต้องการอัตโนมัติ", status: "COMPLETED", assignee: "AI System", sla: "30 นาที", auditLog: [{ action: "วิเคราะห์ข้อมูลเสร็จสิ้น", timestamp: "28 ส.ค. 2569 09:17" }] },
  { label: "RAG ค้นระเบียบ", description: "ค้นหาระเบียบพัสดุที่เกี่ยวข้อง", status: "IN_PROGRESS", assignee: "AI System", sla: "1 ชั่วโมง", auditLog: [{ action: "กำลังค้นหาระเบียบ", timestamp: "28 ส.ค. 2569 09:20" }] },
  { label: "คำแนะนำ", description: "AI สรุปคำแนะนำตามระเบียบ", status: "PENDING", sla: "2 ชั่วโมง" },
  { label: "แนบใบเสนอราคา", description: "ผู้ใช้แนบใบเสนอราคาจากผู้ขาย", status: "PENDING", assignee: "สมชาย ใจดี", sla: "2 วัน" },
  { label: "ตรวจความครบถ้วน", description: "ตรวจสอบเอกสารและร่าง TOR เบื้องต้น", status: "PENDING", sla: "1 วัน" },
  { label: "เจ้าหน้าที่ตรวจทาน", description: "เจ้าหน้าที่พัสดุตรวจสอบร่าง TOR", status: "PENDING", assignee: "อนงค์ พัสดุ", sla: "3 วัน" },
  { label: "สร้างคำขอ", description: "สร้างคำขอจัดซื้อจัดจ้างในระบบ", status: "PENDING", sla: "1 วัน" },
  { label: "ติดตามสถานะ", description: "ติดตามสถานะการอนุมัติ", status: "PENDING", sla: "ต่อเนื่อง" },
];

export const statusConfig: Record<StepStatus, { color: "warning" | "accent" | "success" | "danger"; icon: typeof FiClock; label: string }> = {
  PENDING: { color: "warning", icon: FiClock, label: "รอดำเนินการ" },
  IN_PROGRESS: { color: "accent", icon: FiRefreshCw, label: "กำลังดำเนินการ" },
  COMPLETED: { color: "success", icon: FiCheck, label: "เสร็จสิ้น" },
  REVISION_NEEDED: { color: "danger", icon: FiAlertCircle, label: "ต้องแก้ไข" },
};
