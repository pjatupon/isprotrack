"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDocxFromSections } from "@/lib/docx";

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

export type ExportTorResult = {
  success: boolean;
  error?: string;
  fileName?: string;
  base64?: string;
};

export async function exportTorDocx(prevState: unknown, formData: FormData) {
  try {
    await requireSession();
    const title = (formData.get("title") as string)?.trim() || "ร่างข้อกำหนดและขอบเขตงาน (TOR)";
    const objective = (formData.get("objective") as string)?.trim() || "";
    const scope = (formData.get("scope") as string)?.trim() || "";
    const specifications = (formData.get("specifications") as string)?.trim() || "";
    const deliverables = (formData.get("deliverables") as string)?.trim() || "";
    const inspectionCriteria = (formData.get("inspectionCriteria") as string)?.trim() || "";

    if (!objective || !scope || !specifications) {
      return { success: false, error: "กรุณากรอกอย่างน้อยวัตถุประสงค์ ขอบเขต และคุณลักษณะเฉพาะ" };
    }

    const docx = buildDocxFromSections(
      [
        { heading: "1. วัตถุประสงค์", body: objective },
        { heading: "2. ขอบเขตของงาน (Scope of Work)", body: scope },
        { heading: "3. คุณลักษณะเฉพาะ (Specifications)", body: specifications },
        { heading: "4. กำหนดเวลาและสถานที่ส่งมอบ", body: deliverables },
        { heading: "5. หลักเกณฑ์การตรวจรับพัสดุ", body: inspectionCriteria },
      ],
      { title },
    );

    const base64 = docx.toString("base64");
    const safeName = title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);

    return { success: true, fileName: `${safeName}.docx`, base64 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "ไม่สามารถสร้างไฟล์ .docx ได้",
    };
  }
}
