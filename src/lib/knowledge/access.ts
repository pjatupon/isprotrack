import "server-only";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { canManageKnowledge } from "./policy";

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
  if (!canManageKnowledge(role)) {
    throw new Error("คุณไม่มีสิทธิ์จัดการคลังความรู้");
  }
  return { userId: session.user.id, role };
}

export async function getKnowledgeAccess(): Promise<KnowledgeAccessResult | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = (session.user as { role?: string }).role ?? "";
  if (!canManageKnowledge(role)) return null;
  return { userId: session.user.id, role };
}
