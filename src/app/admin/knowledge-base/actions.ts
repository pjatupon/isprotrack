"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  validateKnowledgeFile,
  computeKnowledgeFileChecksum,
  storeKnowledgeFile,
  quarantineKnowledgeFile,
  removeKnowledgeFile,
  restoreQuarantinedFile,
  removeQuarantinedFile,
  resolveKnowledgeFilePath,
} from "@/lib/knowledge/file";
import { processKnowledgeDocument, retryKnowledgeDocument, reindexKnowledgeDocument } from "@/lib/knowledge/pipeline";
import { extractDocumentText } from "@/lib/ai/document";
import { embedTexts } from "@/lib/ai/rag";
import { EMBEDDING_MODEL } from "@/lib/ai";
import { requireKnowledgeAccess } from "@/lib/knowledge/access";
import fs from "node:fs/promises";
import type { KnowledgeDocumentType, RegulationStatus } from "@/generated/prisma/enums";

function errorResult(error: unknown): { success: false; error: string } {
  return {
    success: false,
    error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
  };
}

async function writeAudit(userId: string, action: string, prompt: string, output: unknown) {
  await prisma.auditLog.create({
    data: { userId, action, prompt, output: JSON.stringify(output) },
  });
}

// ---------- Categories ----------

export async function saveKnowledgeCategory(prevState: unknown, formData: FormData) {
  try {
    const { userId } = await requireKnowledgeAccess();
    const id = (formData.get("id") as string) || undefined;
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const isActive = (formData.get("isActive") as string) === "on";

    if (!name) {
      return { success: false, error: "กรุณาระบุชื่อหมวดหมู่" };
    }

    if (id) {
      await prisma.knowledgeCategory.update({
        where: { id },
        data: { name, description, isActive },
      });
      await writeAudit(userId, "knowledge.category.updated", `แก้ไขหมวดหมู่: ${name}`, { categoryId: id });
    } else {
      const existing = await prisma.knowledgeCategory.findUnique({ where: { name } });
      if (existing) {
        return { success: false, error: "มีหมวดหมู่นี้อยู่แล้ว" };
      }
      const created = await prisma.knowledgeCategory.create({
        data: { name, description, isActive },
      });
      await writeAudit(userId, "knowledge.category.created", `สร้างหมวดหมู่: ${name}`, {
        categoryId: created.id,
      });
    }

    revalidatePath("/admin/knowledge");
    return { success: true, message: "บันทึกหมวดหมู่เรียบร้อย" };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteKnowledgeCategory(id: string) {
  try {
    const { userId } = await requireKnowledgeAccess();
    const category = await prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!category) return { success: false, error: "ไม่พบหมวดหมู่" };

    await prisma.knowledgeCategory.delete({ where: { id } });
    await writeAudit(userId, "knowledge.category.deleted", `ลบหมวดหมู่: ${category.name}`, { categoryId: id });
    revalidatePath("/admin/knowledge");
    return { success: true, message: "ลบหมวดหมู่เรียบร้อย" };
  } catch (error) {
    return errorResult(error);
  }
}

// ---------- Documents ----------

export async function uploadKnowledgeDocument(prevState: unknown, formData: FormData) {
  try {
    const { userId } = await requireKnowledgeAccess();

    const title = (formData.get("title") as string)?.trim();
    const categoryId = (formData.get("categoryId") as string) || null;
    const documentType = (formData.get("documentType") as KnowledgeDocumentType) || "REGULATION";
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return { success: false, error: "กรุณาเลือกไฟล์เอกสาร" };
    }
    if (!title) {
      return { success: false, error: "กรุณาระบุชื่อเอกสาร" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateKnowledgeFile(buffer, file.type);
    if (!validation.valid) {
      return { success: false, error: validation.error ?? "ไฟล์ไม่ถูกต้อง" };
    }

    const checksum = computeKnowledgeFileChecksum(buffer);
    const existing = await prisma.regulationDocument.findFirst({
      where: { checksum, status: { not: "ARCHIVED" } },
    });
    if (existing) {
      return { success: false, error: "ไฟล์นี้มีอยู่ในระบบแล้ว (ซ้ำ)" };
    }

    let storedName: string | null = null;
    let documentId: string | null = null;
    try {
      storedName = await storeKnowledgeFile(buffer, validation.extension!);

      const created = await prisma.regulationDocument.create({
        data: {
          title,
          status: "DRAFT",
          categoryId,
          documentType,
          originalName: file.name,
          storedName,
          filePath: storedName,
          mimeType: validation.mimeType,
          fileSize: buffer.length,
          checksum,
          dimensions: 768,
        },
      });
      documentId = created.id;

      await writeAudit(userId, "knowledge.document.uploaded", `อัปโหลดเอกสาร: ${title}`, {
        documentId,
        originalName: file.name,
      });

      try {
        await processKnowledgeDocument(
          documentId,
          {
            client: prisma,
            extractText: extractDocumentText,
            embedTexts,
            readFile: async (name) => fs.readFile(resolveKnowledgeFilePath(name)),
            resolveFilePath: resolveKnowledgeFilePath,
            audit: async (action, prompt, output) => {
              await prisma.auditLog.create({
                data: { userId, action, prompt, output: JSON.stringify(output) },
              });
            },
            embeddingModelName: EMBEDDING_MODEL,
          },
        );
      } catch (processingError) {
        return {
          success: false,
          error: `อัปโหลดไฟล์สำเร็จ แต่การประมวลผลล้มเหลว: ${processingError instanceof Error ? processingError.message : "เกิดข้อผิดพลาด"}`,
          documentId,
        };
      }

      revalidatePath("/admin/knowledge");
      return { success: true, message: "อัปโหลดและประมวลผลเอกสารเรียบร้อย", documentId };
    } catch (error) {
      if (documentId) {
        await quarantineKnowledgeFile(storedName!).catch(() => {});
        await prisma.regulationDocument.delete({ where: { id: documentId } }).catch(() => {});
      } else if (storedName) {
        await removeKnowledgeFile(storedName).catch(() => {});
      }
      return errorResult(error);
    }
  } catch (error) {
    return errorResult(error);
  }
}

export async function retryKnowledgeDocumentAction(documentId: string) {
  try {
    const { userId } = await requireKnowledgeAccess();
    const result = await retryKnowledgeDocument(documentId, {
      client: prisma,
      extractText: extractDocumentText,
      embedTexts,
      readFile: async (name) => fs.readFile(resolveKnowledgeFilePath(name)),
      resolveFilePath: resolveKnowledgeFilePath,
      audit: async (action, prompt, output) => {
        await prisma.auditLog.create({
          data: { userId, action, prompt, output: JSON.stringify(output) },
        });
      },
      embeddingModelName: EMBEDDING_MODEL,
    });
    revalidatePath("/admin/knowledge-base");
    return { success: true, message: `ประมวลผลใหม่สำเร็จ (${result.chunkCount} chunks)` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateKnowledgeDocument(documentId: string, formData: FormData) {
  try {
    const { userId } = await requireKnowledgeAccess();
    const title = (formData.get("title") as string)?.trim();
    const categoryId = (formData.get("categoryId") as string) || null;
    const documentType = (formData.get("documentType") as KnowledgeDocumentType) || "REGULATION";

    if (!title) return { success: false, error: "กรุณาระบุชื่อเอกสาร" };

    const document = await prisma.regulationDocument.update({
      where: { id: documentId },
      data: { title, categoryId, documentType },
    });
    await writeAudit(userId, "knowledge.document.updated", `แก้ไขเอกสาร: ${document.title}`, { documentId });
    revalidatePath("/admin/knowledge-base");
    return { success: true, message: "บันทึกข้อมูลเอกสารเรียบร้อย" };
  } catch (error) {
    return errorResult(error);
  }
}

export async function reindexKnowledgeDocumentAction(documentId: string) {
  try {
    const { userId } = await requireKnowledgeAccess();
    const result = await reindexKnowledgeDocument(documentId, {
      client: prisma,
      extractText: extractDocumentText,
      embedTexts,
      readFile: async (name) => fs.readFile(resolveKnowledgeFilePath(name)),
      resolveFilePath: resolveKnowledgeFilePath,
      audit: async (action, prompt, output) => {
        await prisma.auditLog.create({
          data: { userId, action, prompt, output: JSON.stringify(output) },
        });
      },
      embeddingModelName: EMBEDDING_MODEL,
    });
    revalidatePath("/admin/knowledge-base");
    return { success: true, message: `สร้าง Embedding ใหม่สำเร็จ (${result.chunkCount} chunks)` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteKnowledgeDocument(documentId: string) {
  try {
    const { userId } = await requireKnowledgeAccess();
    const doc = await prisma.regulationDocument.findUnique({ where: { id: documentId } });
    if (!doc) return { success: false, error: "ไม่พบเอกสาร" };

    if (doc.storedName) {
      await quarantineKnowledgeFile(doc.storedName);
    }
    try {
      await prisma.regulationDocument.delete({ where: { id: documentId } });
    } catch (error) {
      if (doc.storedName) await restoreQuarantinedFile(doc.storedName).catch(() => {});
      throw error;
    }
    if (doc.storedName) {
      await removeQuarantinedFile(doc.storedName).catch(() => {});
    }

    await writeAudit(userId, "knowledge.document.deleted", `ลบเอกสาร: ${doc.title}`, { documentId });
    revalidatePath("/admin/knowledge-base");
    return { success: true, message: "ลบเอกสารเรียบร้อย" };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setKnowledgeDocumentArchived(documentId: string, archived: boolean) {
  try {
    const { userId } = await requireKnowledgeAccess();
    const doc = await prisma.regulationDocument.findUnique({ where: { id: documentId } });
    if (!doc) return { success: false, error: "ไม่พบเอกสาร" };

    const nextStatus: RegulationStatus = archived ? "ARCHIVED" : "ACTIVE";
    await prisma.regulationDocument.update({
      where: { id: documentId },
      data: { status: nextStatus },
    });

    await writeAudit(
      userId,
      archived ? "knowledge.document.archived" : "knowledge.document.restored",
      `${archived ? "เก็บถาวร" : "กู้คืน"}: ${doc.title}`,
      { documentId },
    );
    revalidatePath("/admin/knowledge-base");
    return { success: true, message: archived ? "เก็บถาวรเรียบร้อย" : "กู้คืนเรียบร้อย" };
  } catch (error) {
    return errorResult(error);
  }
}
