export const USER_ROLES = ["REQUESTER", "STAFF", "APPROVER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  REQUESTER: "ผู้ขอจัดซื้อ",
  STAFF: "เจ้าหน้าที่พัสดุ",
  APPROVER: "ผู้อนุมัติ",
  ADMIN: "ผู้ดูแลระบบ",
};

export const PERMISSION_IDS = [
  "consult_ai",
  "manage_knowledge",
  "manage_regulations",
  "ocr_quotation",
  "tor_draft",
  "approve_requests",
  "manage_users",
  "manage_rbac",
] as const;
export type PermissionId = (typeof PERMISSION_IDS)[number];

export const PERMISSION_LABELS: Record<PermissionId, string> = {
  consult_ai: "ปรึกษา AI / วิเคราะห์การจัดซื้อ",
  manage_knowledge: "จัดการคลังความรู้ AI",
  manage_regulations: "จัดการเอกสารระเบียบ",
  ocr_quotation: "ตรวจใบเสนอราคา (OCR)",
  tor_draft: "ร่างข้อกำหนด TOR",
  approve_requests: "อนุมัติคำขอจัดซื้อ",
  manage_users: "จัดการข้อมูลผู้ใช้",
  manage_rbac: "จัดการสิทธิ์ (RBAC)",
};

export type RbacMatrix = Record<UserRole, Record<PermissionId, boolean>>;

export const DEFAULT_MATRIX: RbacMatrix = {
  ADMIN: {
    consult_ai: true,
    manage_knowledge: true,
    manage_regulations: true,
    ocr_quotation: true,
    tor_draft: true,
    approve_requests: true,
    manage_users: true,
    manage_rbac: true,
  },
  STAFF: {
    consult_ai: true,
    manage_knowledge: true,
    manage_regulations: true,
    ocr_quotation: true,
    tor_draft: true,
    approve_requests: false,
    manage_users: false,
    manage_rbac: false,
  },
  APPROVER: {
    consult_ai: true,
    manage_knowledge: false,
    manage_regulations: false,
    ocr_quotation: false,
    tor_draft: false,
    approve_requests: true,
    manage_users: false,
    manage_rbac: false,
  },
  REQUESTER: {
    consult_ai: true,
    manage_knowledge: false,
    manage_regulations: false,
    ocr_quotation: true,
    tor_draft: true,
    approve_requests: false,
    manage_users: false,
    manage_rbac: false,
  },
};

export function isRbacMatrix(value: unknown): value is RbacMatrix {
  if (!value || typeof value !== "object") return false;
  const matrix = value as Record<string, unknown>;
  return USER_ROLES.every((role) => {
    const perms = matrix[role] as Record<string, unknown> | undefined;
    return (
      perms &&
      typeof perms === "object" &&
      PERMISSION_IDS.every((id) => typeof perms[id] === "boolean")
    );
  });
}

export function mergeMatrix(
  base: RbacMatrix,
  incoming: Partial<RbacMatrix>,
): RbacMatrix {
  const next: RbacMatrix = structuredClone(base);
  for (const role of USER_ROLES) {
    const rolePerms = incoming[role];
    if (!rolePerms) continue;
    for (const id of PERMISSION_IDS) {
      if (typeof rolePerms[id] === "boolean") {
        next[role][id] = rolePerms[id];
      }
    }
  }
  return next;
}
