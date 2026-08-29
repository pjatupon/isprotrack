"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/ai/rag";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { RegulationStatus, ProcurementStatus } from "@prisma/client";

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  return session;
}

// 1. Create or Update Procurement Request
export async function saveProcurementRequest(prevState: unknown, formData: FormData) {
  try {
    const session = await requireSession();
    const id = formData.get("id") as string | null;
    const title = (formData.get("title") as string)?.trim();
    const objective = (formData.get("objective") as string)?.trim();
    const budgetStr = formData.get("budget") as string;
    const budgetSource = (formData.get("budgetSource") as string)?.trim() || null;
    const procurementType = (formData.get("procurementType") as string)?.trim() || "ซื้อพัสดุ";
    const procurementMethod = (formData.get("procurementMethod") as string)?.trim() || "เฉพาะเจาะจง";

    if (!title || !objective || !budgetStr) {
      return { success: false, error: "กรุณากรอกข้อมูลที่จำเป็น (ชื่อโครงการ, วัตถุประสงค์, งบประมาณ)" };
    }

    const budget = parseFloat(budgetStr);
    if (isNaN(budget) || budget <= 0) {
      return { success: false, error: "กรุณาระบุจำนวนงบประมาณที่ถูกต้อง" };
    }

    let request;
    if (id) {
      request = await prisma.procurementRequest.update({
        where: { id },
        data: {
          title,
          objective,
          budget,
          budgetSource,
          procurementType,
          procurementMethod,
        },
      });
    } else {
      request = await prisma.procurementRequest.create({
        data: {
          title,
          objective,
          budget,
          budgetSource,
          procurementType,
          procurementMethod,
          requesterId: session.user.id,
          status: "DRAFT",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: id ? "update_procurement_request" : "create_procurement_request",
        prompt: `บันทึกคำขอ: ${title} (งบประมาณ ${budget} บาท)`,
        output: JSON.stringify({ requestId: request.id, status: request.status }),
      },
    });

    revalidatePath("/requests");
    revalidatePath("/dashboard");
    return { success: true, requestId: request.id, message: "บันทึกคำขอเรียบร้อยแล้ว" };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก" };
  }
}

// 2. Save TOR Draft with versioning
export async function saveTorDraft(prevState: unknown, formData: FormData) {
  try {
    const session = await requireSession();
    const requestId = formData.get("requestId") as string;
    const objective = (formData.get("objective") as string)?.trim() || "";
    const scope = (formData.get("scope") as string)?.trim() || "";
    const specifications = (formData.get("specifications") as string)?.trim() || "";
    const deliverables = (formData.get("deliverables") as string)?.trim() || "";
    const inspectionCriteria = (formData.get("inspectionCriteria") as string)?.trim() || "";
    const isLockInRisk = formData.get("isLockInRisk") === "true";

    if (!requestId) {
      return { success: false, error: "ไม่พบรหัสคำขอจัดซื้อจัดจ้าง" };
    }

    // Find highest version
    const lastDraft = await prisma.torDraft.findFirst({
      where: { requestId },
      orderBy: { version: "desc" },
    });

    const nextVersion = (lastDraft?.version ?? 0) + 1;

    const draft = await prisma.torDraft.create({
      data: {
        requestId,
        objective,
        scope,
        specifications,
        deliverables,
        inspectionCriteria,
        version: nextVersion,
        isLockInRisk,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "save_tor_draft",
        prompt: `บันทึกร่าง TOR Version ${nextVersion} สำหรับคำขอ ${requestId}`,
        output: JSON.stringify({ draftId: draft.id, version: draft.version, isLockInRisk }),
      },
    });

    revalidatePath("/tor");
    revalidatePath("/requests");
    return { success: true, draftId: draft.id, version: draft.version, message: `บันทึกร่าง TOR ฉบับที่ ${nextVersion} สำเร็จ` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก TOR" };
  }
}

// 3. Update Request Status (Staff / Approver Action)
export async function updateRequestStatus(requestId: string, status: ProcurementStatus) {
  try {
    const session = await requireSession();
    const role = (session.user as { role?: string }).role;

    if (role !== "STAFF" && role !== "APPROVER" && role !== "ADMIN") {
      return { success: false, error: "เฉพาะเจ้าหน้าที่หรือผู้มีอำนาจเท่านั้นที่สามารถปรับสถานะได้" };
    }

    const updated = await prisma.procurementRequest.update({
      where: { id: requestId },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "update_request_status",
        prompt: `ปรับสถานะคำขอ ${requestId} เป็น ${status}`,
        output: JSON.stringify({ requestId: updated.id, status: updated.status }),
      },
    });

    revalidatePath("/requests");
    revalidatePath("/dashboard");
    return { success: true, message: `อัปเดตสถานะเป็น ${status} เรียบร้อยแล้ว` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" };
  }
}

// 4. Save Regulation Document and auto-chunk
export async function createRegulationDocument(prevState: unknown, formData: FormData) {
  try {
    const session = await requireSession();
    const role = (session.user as { role?: string }).role;
    if (role !== "STAFF" && role !== "ADMIN") {
      return { success: false, error: "เฉพาะเจ้าหน้าที่พัสดุหรือผู้ดูแลระบบเท่านั้น" };
    }

    const title = (formData.get("title") as string)?.trim();
    const issueNo = (formData.get("issueNo") as string)?.trim() || null;
    const effectiveFromStr = formData.get("effectiveFrom") as string;
    const effectiveToStr = formData.get("effectiveTo") as string;
    const fileUrl = (formData.get("fileUrl") as string)?.trim() || null;
    const contentText = (formData.get("content") as string)?.trim();

    if (!title || !contentText) {
      return { success: false, error: "กรุณาระบุชื่อระเบียบและเนื้อหาข้อความ" };
    }

    const effectiveFrom = effectiveFromStr ? new Date(effectiveFromStr) : new Date();
    const effectiveTo = effectiveToStr ? new Date(effectiveToStr) : null;

    const doc = await prisma.regulationDocument.create({
      data: {
        title,
        issueNo,
        effectiveFrom,
        effectiveTo,
        status: "ACTIVE",
        fileUrl,
      },
    });

    // Simple paragraph/section chunking
    const rawSections = contentText.split(/\n\s*\n/).filter((s) => s.trim().length > 20);
    const chunksData = [];

    for (let i = 0; i < rawSections.length; i++) {
      const chunkText = rawSections[i].trim();
      let embeddingStr: string | null = null;
      try {
        const emb = await generateEmbedding(chunkText);
        embeddingStr = JSON.stringify(emb);
      } catch (err) {
        console.warn("Embedding generation warning:", err);
      }

      const checksum = `chk_${doc.id}_${i}_${Date.now()}`;
      chunksData.push({
        documentId: doc.id,
        content: chunkText,
        embedding: embeddingStr,
        section: `ข้อ/หมวดที่ ${i + 1}`,
        page: Math.floor(i / 3) + 1,
        checksum,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      });
    }

    if (chunksData.length > 0) {
      await prisma.regulationChunk.createMany({
        data: chunksData,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "create_regulation_document",
        prompt: `สร้างเอกสารระเบียบ: ${title} (แบ่ง ${chunksData.length} Chunks)`,
        output: JSON.stringify({ documentId: doc.id, chunkCount: chunksData.length }),
      },
    });

    revalidatePath("/staff/regulations");
    return { success: true, documentId: doc.id, message: `เพิ่มระเบียบและประมวลผล ${chunksData.length} chunks สำเร็จ` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกระเบียบ" };
  }
}

// 5. Toggle Regulation Status
export async function toggleRegulationStatus(documentId: string, newStatus: RegulationStatus) {
  try {
    const session = await requireSession();
    const role = (session.user as { role?: string }).role;
    if (role !== "STAFF" && role !== "ADMIN") {
      return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };
    }

    const updated = await prisma.regulationDocument.update({
      where: { id: documentId },
      data: { status: newStatus },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "toggle_regulation_status",
        prompt: `เปลี่ยนสถานะระเบียบ ${documentId} เป็น ${newStatus}`,
        output: JSON.stringify({ documentId: updated.id, status: updated.status }),
      },
    });

    revalidatePath("/staff/regulations");
    return { success: true, message: `เปลี่ยนสถานะเป็น ${newStatus} สำเร็จ` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" };
  }
}
