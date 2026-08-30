"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  return session;
}

export type TorVersionView = {
  version: number;
  objective: string;
  scope: string;
  specifications: string;
  deliverables: string;
  inspectionCriteria: string;
  isLockInRisk: boolean;
  createdAt: string;
};

export async function loadTorVersions(requestId: string): Promise<{
  success: boolean;
  versions?: TorVersionView[];
  error?: string;
}> {
  try {
    await requireSession();
    const drafts = await prisma.torDraft.findMany({
      where: { requestId },
      orderBy: { version: "desc" },
    });
    return {
      success: true,
      versions: drafts.map((d) => ({
        version: d.version,
        objective: d.objective,
        scope: d.scope,
        specifications: d.specifications,
        deliverables: d.deliverables,
        inspectionCriteria: d.inspectionCriteria,
        isLockInRisk: d.isLockInRisk,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "ไม่สามารถโหลดประวัติเวอร์ชันได้",
    };
  }
}
