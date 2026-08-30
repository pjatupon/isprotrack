import { generateEmbeddings as genaiEmbeddings, generateText, generateTextWithImage } from "@/lib/genai";
import { type Chunk, type Citation, type ConsultationResult } from "./index";
import {
  AI_PROMPT_KEYS,
  getAiPrompts,
  renderPromptTemplate,
} from "./prompts";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { KnowledgeDocumentType } from "@/generated/prisma/enums";
import {
  KNOWLEDGE_EMBEDDING_BATCH_SIZE,
  KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT,
  KNOWLEDGE_RETRIEVAL_MAX_LIMIT,
  KNOWLEDGE_RETRIEVAL_THRESHOLD,
  KNOWLEDGE_QUERY_MAX_LENGTH,
  parseKnowledgeEmbedding,
  validateEmbeddingBatch,
} from "@/lib/knowledge/embedding";

export async function generateEmbedding(text: string): Promise<number[]> {
  const { vectors } = await genaiEmbeddings([text]);
  return vectors[0] ?? [];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += KNOWLEDGE_EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + KNOWLEDGE_EMBEDDING_BATCH_SIZE);
    const { vectors: batchVectors } = await genaiEmbeddings(batch);
    vectors.push(...batchVectors);
  }
  return vectors;
}

export async function embedTexts(
  texts: string[],
  dimensions: number,
): Promise<{ vectors: number[][]; dimensions: number }> {
  const vectors = await generateEmbeddings(texts);
  const validation = validateEmbeddingBatch(vectors, dimensions);
  if (!validation.valid) {
    throw new Error(
      `Embedding API คืนค่าไม่ตรงมิติ (คาด ${validation.expected} ได้รับ ${validation.received} ที่ดัชนี ${validation.invalidIndex})`,
    );
  }
  return { vectors, dimensions };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface KnowledgeSearchFilter {
  categoryIds?: string[];
  documentTypes?: KnowledgeDocumentType[];
  onlyActive?: boolean;
}

export async function searchKnowledgeChunks(
  queryVector: number[],
  filter: KnowledgeSearchFilter = {},
  topK = 5,
): Promise<(Chunk & { score: number; categoryName: string | null; documentType: string })[]> {
  const documentFilter: Prisma.RegulationDocumentWhereInput = {
    status: "ACTIVE",
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
  };
  if (filter.categoryIds?.length) {
    documentFilter.categoryId = { in: filter.categoryIds };
  }
  if (filter.documentTypes?.length) {
    documentFilter.documentType = { in: filter.documentTypes };
  }

  const where: Prisma.RegulationChunkWhereInput = {
    document: documentFilter,
    embedding: { not: null },
  };

  const chunks = await prisma.regulationChunk.findMany({
    where,
    include: {
      document: {
        select: {
          title: true,
          issueNo: true,
          documentType: true,
          category: { select: { name: true } },
          storedName: true,
        },
      },
    },
    take: KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT,
  });

  const scored = chunks
    .map((c) => {
      const embedding = parseKnowledgeEmbedding(c.embedding);
      if (!embedding || embedding.length === 0) return null;
      const score = cosineSimilarity(queryVector, embedding);
      if (score < KNOWLEDGE_RETRIEVAL_THRESHOLD) return null;
      return {
        id: c.id,
        documentId: c.documentId,
        content: c.content,
        section: c.section,
        page: c.page,
        documentTitle: c.document.title,
        documentIssueNo: c.document.issueNo,
        categoryName: c.document.category?.name ?? null,
        documentType: c.document.documentType,
        score,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export interface RetrievalResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  categoryName: string | null;
  documentType: string;
  section: string | null;
  page: number | null;
  content: string;
  similarity: number;
  fileUrl: string;
}

export type RelevantChunk = Chunk & {
  score: number;
  categoryName: string | null;
  documentType: string;
};

/** ค้นหาข้อความที่เกี่ยวข้องจากคลังความรู้ในระบบ (ผ่าน embedding + cosine similarity) */
export async function retrieveRelevantChunks(
  query: string,
  filter: KnowledgeSearchFilter = {},
  topK = 5,
): Promise<RelevantChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (trimmed.length > KNOWLEDGE_QUERY_MAX_LENGTH) {
    throw new Error(`คำค้นหายาวเกินไป (สูงสุด ${KNOWLEDGE_QUERY_MAX_LENGTH} ตัวอักษร)`);
  }
  const queryVector = await generateEmbedding(trimmed);
  return searchKnowledgeChunks(queryVector, filter, topK);
}

export async function retrieveKnowledge(
  query: string,
  limit = 5,
  filter: KnowledgeSearchFilter = {},
): Promise<{ results: RetrievalResult[]; queryVector: number[] }> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("คำค้นหาต้องไม่ว่างเปล่า");
  }
  if (trimmed.length > KNOWLEDGE_QUERY_MAX_LENGTH) {
    throw new Error(`คำค้นหายาวเกินไป (สูงสุด ${KNOWLEDGE_QUERY_MAX_LENGTH} ตัวอักษร)`);
  }
  const safeLimit = Math.min(Math.max(limit, 1), KNOWLEDGE_RETRIEVAL_MAX_LIMIT);

  const queryVector = await generateEmbedding(trimmed);
  const hits = await searchKnowledgeChunks(queryVector, filter, safeLimit);

  const results: RetrievalResult[] = hits.map((hit) => ({
    chunkId: hit.id,
    documentId: hit.documentId,
    documentTitle: hit.documentTitle,
    categoryName: hit.categoryName,
    documentType: hit.documentType,
    section: hit.section,
    page: hit.page,
    content: hit.content,
    similarity: hit.score,
    fileUrl: `/admin/knowledge-base/${hit.documentId}/file`,
  }));

  return { results, queryVector };
}

export function buildContextText(
  contextChunks: (Chunk & { score?: number })[],
): string {
  return contextChunks
    .map(
      (c, i) =>
        `[เอกสาร ${i + 1}]: ${c.documentTitle}${c.documentIssueNo ? ` (ฉบับที่ ${c.documentIssueNo})` : ""}${c.section ? ` - หมวด ${c.section}` : ""}\nเนื้อหา: ${c.content}`,
    )
    .join("\n\n");
}

export function computeConfidence(
  contextChunks: (Chunk & { score?: number })[],
  answer: string,
): number {
  if (contextChunks.length === 0) return 0.3;
  const citationCount = contextChunks.filter((c) =>
    answer.toLowerCase().includes(c.documentTitle.toLowerCase()),
  ).length;
  if (citationCount === 0) return 0.4;
  return Math.min(0.5 + citationCount * 0.12, 0.95);
}

export function buildCitations(
  contextChunks: (Chunk & { score?: number })[],
): Citation[] {
  return contextChunks.map((c) => ({
    chunkId: c.id,
    content: c.content.slice(0, 200),
    section: c.section,
    documentTitle: c.documentTitle,
    relevanceScore: c.score ?? 0.5,
  }));
}

export interface ConsultHistoryItem {
  role: "user" | "assistant";
  content: string;
}

function buildHistoryText(history?: ConsultHistoryItem[]): string {
  if (!history || history.length === 0) {
    return "(ยังไม่มีประวัติการสนทนา)";
  }
  return history
    .map(
      (item, i) =>
        `${i + 1}. [${item.role === "user" ? "ผู้ใช้" : "AI"}]: ${item.content}`,
    )
    .join("\n");
}

export interface ConsultImageInput {
  base64: string;
  mimeType: string;
}

export async function consultProcurement(
  userQuery: string,
  contextChunks: (Chunk & { score: number })[],
  history?: ConsultHistoryItem[],
  image?: ConsultImageInput,
): Promise<ConsultationResult> {
  const prompts = await getAiPrompts([
    AI_PROMPT_KEYS.consultSystem,
    AI_PROMPT_KEYS.consultUser,
  ]);

  const contextText = buildContextText(contextChunks);
  const imageNote = image
    ? "ผู้ใช้ได้แนบรูปภาพวัสดุ/อุปกรณ์ที่ต้องการจัดซื้อมาด้วย กรุณาวิเคราะห์รูปภาพนี้ประกอบคำแนะนำ (ระบุประเภทพัสดุ ลักษณะ/สเปกเบื้องต้นที่สังเกตได้จากภาพ และวิธีจัดซื้อจัดจ้างที่เหมาะสม)"
    : "";
  const prompt = renderPromptTemplate(
    prompts[AI_PROMPT_KEYS.consultUser],
    {
      history: buildHistoryText(history),
      context: contextText,
      imageNote,
      query: userQuery,
    },
  );

  const answer = image
    ? await generateTextWithImage(prompt, image.base64, {
        mimeType: image.mimeType,
        system: prompts[AI_PROMPT_KEYS.consultSystem],
        temperature: 0.2,
        maxTokens: 3000,
      })
    : await generateText(prompt, {
        system: prompts[AI_PROMPT_KEYS.consultSystem],
        temperature: 0.2,
        maxTokens: 3000,
      });

  const confidenceScore = computeConfidence(contextChunks, answer);
  const citations = buildCitations(contextChunks);

  return { answer, citations, confidenceScore };
}
