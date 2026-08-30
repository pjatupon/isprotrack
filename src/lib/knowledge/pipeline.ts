import type { PrismaClient } from "@/generated/prisma/client";
import type { RegulationStatus } from "@/generated/prisma/enums";
import { splitIntoKnowledgeChunks, normalizeKnowledgeText, type KnowledgeTextChunk } from "./chunk";
import { validateEmbeddingBatch } from "./embedding";
import { createHash } from "node:crypto";

function chunkChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}

export interface KnowledgeProcessDeps {
  client: PrismaClient;
  extractText: (buffer: Buffer, mimeType: string) => Promise<{ text: string; suggestedTitle?: string }>;
  embedTexts: (texts: string[], dimensions: number) => Promise<{ vectors: number[][]; dimensions: number }>;
  readFile: (storedName: string) => Promise<Buffer>;
  resolveFilePath: (storedName: string) => string;
  audit: (action: string, prompt: string, output: unknown) => Promise<void>;
  skipClaim?: boolean;
  embeddingModelName?: string;
}

export interface KnowledgeProcessResult {
  documentId: string;
  chunkCount: number;
  dimensions: number;
  status: RegulationStatus;
}

export async function prepareDocumentKnowledge(
  fileBuffer: Buffer,
  mimeType: string,
  deps: KnowledgeProcessDeps,
): Promise<{ text: string; suggestedTitle?: string; chunks: KnowledgeTextChunk[] }> {
  const { text, suggestedTitle } = await deps.extractText(fileBuffer, mimeType);
  const normalized = normalizeKnowledgeText(text);
  if (!normalized) {
    throw new Error("ไม่พบข้อความในเอกสาร (OCR ไม่พบข้อมูล)");
  }
  const chunks = splitIntoKnowledgeChunks(normalized);
  if (chunks.length === 0) {
    throw new Error("ไม่สามารถตัดแบ่งข้อความเอกสารได้");
  }
  return { text: normalized, suggestedTitle, chunks };
}

export async function processKnowledgeDocument(
  documentId: string,
  deps: KnowledgeProcessDeps,
): Promise<KnowledgeProcessResult> {
  const { client, audit, skipClaim } = deps;
  const doc = await client.regulationDocument.findUnique({
    where: { id: documentId },
    include: { chunks: true },
  });

  if (!doc) throw new Error("ไม่พบเอกสาร");

  if (!doc.filePath || !doc.mimeType) {
    throw new Error("เอกสารไม่มีไฟล์ต้นฉบับในระบบ");
  }

  if (doc.status === "PROCESSING") {
    if (skipClaim) {
      await audit("knowledge.document.skip_claim", `ข้ามการประมวลผลซ้ำ: ${doc.title}`, {
        documentId,
      });
      return { documentId, chunkCount: doc.chunks.length, dimensions: doc.dimensions ?? 0, status: doc.status };
    }
    throw new Error("เอกสารกำลังถูกประมวลผลโดยงานอื่น");
  }

  await client.regulationDocument.update({
    where: { id: documentId },
    data: { status: "PROCESSING", processingNote: null },
  });

  try {
    const buffer = await deps.readFile(doc.filePath);
    const { text, suggestedTitle, chunks } = await prepareDocumentKnowledge(buffer, doc.mimeType, deps);
    return await storeKnowledgeContent(documentId, doc, text, chunks, deps, suggestedTitle);
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการประมวลผล";
    await client.regulationDocument.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        processingNote: message,
      },
    });
    await audit("knowledge.document.failed", `ประมวลผลเอกสารไม่สำเร็จ: ${doc.title}`, {
      documentId,
      error: message,
    });
    throw error;
  }
}

async function storeKnowledgeContent(
  documentId: string,
  doc: { title: string; dimensions: number | null },
  text: string,
  chunks: KnowledgeTextChunk[],
  deps: KnowledgeProcessDeps,
  suggestedTitle?: string,
): Promise<KnowledgeProcessResult> {
  const { client, audit } = deps;

  const dimensions = doc.dimensions ?? 768;
  const { vectors, dimensions: actualDimensions } = await deps.embedTexts(
    chunks.map((chunk) => chunk.content),
    dimensions,
  );
  const validation = validateEmbeddingBatch(vectors, actualDimensions);
  if (!validation.valid) {
    throw new Error(
      `Embedding คืนค่าไม่ตรงมิติ (คาด ${validation.expected} ได้รับ ${validation.received} ที่ดัชนี ${validation.invalidIndex})`,
    );
  }

  await client.$transaction([
    client.regulationChunk.deleteMany({ where: { documentId } }),
    client.regulationDocument.update({
      where: { id: documentId },
      data: {
        status: "ACTIVE",
        title: suggestedTitle ?? undefined,
        extractedText: text,
        embeddingModel: deps.embeddingModelName ?? "text-embedding-004",
        dimensions: actualDimensions,
        processingNote: null,
      },
    }),
    ...vectors.map((vector, index) =>
      client.regulationChunk.create({
        data: {
          documentId,
          chunkIndex: index,
          section: chunks[index].section,
          page: chunks[index].page,
          content: chunks[index].content,
          checksum: chunkChecksum(chunks[index].content),
          embedding: JSON.stringify(vector),
        },
      }),
    ),
  ]);

  await audit("knowledge.document.processed", `ประมวลผลเอกสารสำเร็จ: ${doc.title}`, {
    documentId,
    chunkCount: vectors.length,
    dimensions: actualDimensions,
  });

  return { documentId, chunkCount: vectors.length, dimensions: actualDimensions, status: "ACTIVE" };
}

export async function processKnowledgeText(
  documentId: string,
  text: string,
  deps: KnowledgeProcessDeps,
): Promise<KnowledgeProcessResult> {
  const { client, audit } = deps;
  const doc = await client.regulationDocument.findUnique({
    where: { id: documentId },
    include: { chunks: true },
  });
  if (!doc) throw new Error("ไม่พบเอกสาร");
  if (doc.status === "PROCESSING") throw new Error("เอกสารกำลังถูกประมวลผลโดยงานอื่น");

  await client.regulationDocument.update({
    where: { id: documentId },
    data: { status: "PROCESSING", processingNote: null },
  });

  try {
    const normalized = normalizeKnowledgeText(text);
    if (!normalized) throw new Error("กรุณาระบุข้อความความรู้");
    const chunks = splitIntoKnowledgeChunks(normalized);
    if (chunks.length === 0) throw new Error("ไม่สามารถตัดแบ่งข้อความได้");
    return await storeKnowledgeContent(documentId, doc, normalized, chunks, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการประมวลผล";
    await client.regulationDocument.update({ where: { id: documentId }, data: { status: "FAILED", processingNote: message } });
    await audit("knowledge.document.failed", `ประมวลผลข้อความไม่สำเร็จ: ${doc.title}`, { documentId, error: message });
    throw error;
  }
}

export async function retryKnowledgeDocument(
  documentId: string,
  deps: KnowledgeProcessDeps,
): Promise<KnowledgeProcessResult> {
  return processKnowledgeDocument(documentId, deps);
}

export async function reindexKnowledgeDocument(
  documentId: string,
  deps: KnowledgeProcessDeps,
): Promise<KnowledgeProcessResult> {
  const { client, audit } = deps;
  const doc = await client.regulationDocument.findUnique({
    where: { id: documentId },
    include: { chunks: true },
  });

  if (!doc) throw new Error("ไม่พบเอกสาร");
  if (doc.status === "PROCESSING") throw new Error("เอกสารกำลังถูกประมวลผลโดยงานอื่น");
  if (!doc.extractedText) throw new Error("เอกสารยังไม่มีข้อความสำหรับ Reindex");

  const chunks = splitIntoKnowledgeChunks(doc.extractedText);
  const dimensions = doc.dimensions ?? 768;
  const { vectors, dimensions: actualDimensions } = await deps.embedTexts(
    chunks.map((chunk) => chunk.content),
    dimensions,
  );
  const validation = validateEmbeddingBatch(vectors, actualDimensions);
  if (!validation.valid) {
    throw new Error(
      `Embedding คืนค่าไม่ตรงมิติ (คาด ${validation.expected} ได้รับ ${validation.received} ที่ดัชนี ${validation.invalidIndex})`,
    );
  }

  await client.$transaction([
    client.regulationChunk.deleteMany({ where: { documentId } }),
    client.regulationDocument.update({
      where: { id: documentId },
      data: { dimensions: actualDimensions, processingNote: null },
    }),
    ...vectors.map((vector, index) =>
      client.regulationChunk.create({
        data: {
          documentId,
          chunkIndex: index,
          section: chunks[index].section,
          page: chunks[index].page,
          content: chunks[index].content,
          checksum: chunkChecksum(chunks[index].content),
          embedding: JSON.stringify(vector),
        },
      }),
    ),
  ]);

  await audit("knowledge.document.reindexed", `สร้าง Embedding ใหม่ให้เอกสาร: ${doc.title}`, {
    documentId,
    chunkCount: vectors.length,
    dimensions: actualDimensions,
  });

  return { documentId, chunkCount: vectors.length, dimensions: actualDimensions, status: doc.status };
}
