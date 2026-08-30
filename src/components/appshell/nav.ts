import {
  LayoutDashboard,
  MessageCircle,
  FileText,
  PenTool,
  Shield,
  FilePlus2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type UserRole = "REQUESTER" | "STAFF" | "APPROVER" | "ADMIN";

export type UserMenuItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "ภาพรวม" | "AI PROCUREMENT" | "GOVERNANCE";
  badge?: string;
  roles?: UserRole[];
};

export const userMenuItems: UserMenuItem[] = [
  {
    href: "/",
    label: "แดชบอร์ด",
    description: "ภาพรวมการจัดซื้อจัดจ้าง",
    icon: LayoutDashboard,
    group: "ภาพรวม",
  },
  {
    href: "/consult",
    label: "AI Consult",
    description: "ปรึกษาความต้องการ & ระเบียบ",
    icon: MessageCircle,
    group: "AI PROCUREMENT",
    badge: "AI",
  },
  {
    href: "/quotation",
    label: "Quotation Inspector",
    description: "สแกน & ตรวจใบเสนอราคา",
    icon: FileText,
    group: "AI PROCUREMENT",
    badge: "OCR",
  },
  {
    href: "/tor",
    label: "TOR Generator",
    description: "ช่วยร่างและตรวจล็อคสเปก",
    icon: PenTool,
    group: "AI PROCUREMENT",
  },
  {
    href: "/forms",
    label: "แบบฟอร์มเอกสาร",
    description: "กรอกและดาวน์โหลดแบบฟอร์ม .docx",
    icon: FilePlus2,
    group: "AI PROCUREMENT",
    badge: "DOCX",
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    description: "ประวัติการใช้งานและ AI decisions",
    icon: Shield,
    group: "GOVERNANCE",
    roles: ["ADMIN"],
  },
  {
    href: "/admin",
    label: "แดชบอร์ดเจ้าหน้าที่",
    description: "ศูนย์บริหารจัดการ",
    icon: Settings,
    group: "GOVERNANCE",
    roles: ["STAFF", "ADMIN"],
  },
];

export const roleLabel: Record<UserRole, string> = {
  REQUESTER: "ผู้ขอจัดซื้อ",
  STAFF: "เจ้าหน้าที่พัสดุ",
  APPROVER: "ผู้มีอำนาจอนุมัติ",
  ADMIN: "ผู้ดูแลระบบ",
};

export function filterMenuForRole(items: UserMenuItem[], role: UserRole): UserMenuItem[] {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

export function isMenuActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
