import "server-only";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { canManageKnowledge } from "./policy";
import { USER_ROLES } from "@/lib/rbac";
import { can } from "@/lib/rbac-store";

export interface KnowledgeAccessResult {
  userId: string;
  role: string;
}

export async function requireKnowledgeAccess(): Promise<KnowledgeAccessResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!USER_ROLES.includes(role as never)) {
    throw new Error("คุณไม่มีสิทธิ์จัดการคลังความรู้");
  }
  const allowed = (await can(role, "manage_knowledge")) || canManageKnowledge(role);
  if (!allowed) {
    throw new Error("คุณไม่มีสิทธิ์จัดการคลังความรู้");
  }
  return { userId: session.user.id, role };
}

export async function getKnowledgeAccess(): Promise<KnowledgeAccessResult | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { role?: string }).role ?? "";
  if (!USER_ROLES.includes(role as never)) return null;
  const allowed = (await can(role, "manage_knowledge")) || canManageKnowledge(role);
  if (!allowed) return null;
  return { userId: session.user.id, role };
}
