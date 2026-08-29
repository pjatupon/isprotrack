/* The fake Prisma client intentionally models only the methods used by these unit tests. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prepareDocumentKnowledge,
  processKnowledgeDocument,
  retryKnowledgeDocument,
  reindexKnowledgeDocument,
  type KnowledgeProcessDeps,
} from "../src/lib/knowledge/pipeline";

const SAMPLE_TEXT = `หมวด 1 การจัดซื้อจัดจ้าง
ข้อ 1 การจัดซื้อจัดจ้างของหน่วยงานของรัฐต้องดำเนินการตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560
ข้อ 2 หัวหน้าหน่วยงานของรัฐมีอำนาจแต่งตั้งคณะกรรมการดำเนินการจัดซื้อจัดจ้างตามที่เห็นสมควร`;

function makeFakeClient() {
  const documents = new Map<string, any>();
  const chunks: any[] = [];
  return {
    documents,
    chunks,
    client: {
      regulationDocument: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const doc = documents.get(where.id);
          if (!doc) return null;
          return {
            ...doc,
            chunks: chunks.filter((c) => c.documentId === doc.id),
          };
        },
        update: async ({ where, data }: any) => {
          const doc = documents.get(where.id);
          Object.assign(doc, data);
          return doc;
        },
      },
      regulationChunk: {
        deleteMany: async () => {
          chunks.length = 0;
          return { count: 0 };
        },
        create: async ({ data }: any) => {
          chunks.push(data);
          return { id: `chunk_${chunks.length}`, ...data };
        },
      },
      $transaction: async (ops: any[]) => {
        for (const op of ops) {
          if (op instanceof Promise) await op;
        }
      },
    },
  };
}

function makeDeps(client: any, overrides: Partial<KnowledgeProcessDeps> = {}): KnowledgeProcessDeps {
  return {
    client,
    extractText: async () => ({ text: SAMPLE_TEXT, suggestedTitle: "ระเบียบทดสอบ" }),
    embedTexts: async (texts: string[]) => ({
      vectors: texts.map(() => [0.1, 0.2, 0.3]),
      dimensions: 3,
    }),
    readFile: async () => Buffer.from("%PDF-1.4"),
    resolveFilePath: (name: string) => `/tmp/storage/knowledge/${name}`,
    audit: async () => {},
    embeddingModelName: "text-embedding-004",
    skipClaim: true,
    ...overrides,
  };
}

test("prepareDocumentKnowledge extracts text and chunks it", async () => {
  const deps = makeDeps(null as never);
  const result = await prepareDocumentKnowledge(Buffer.from("%PDF-1.4"), "application/pdf", deps);
  assert.ok(result.text.includes("ข้อ 1"));
  assert.ok(result.chunks.length >= 1);
  assert.ok(result.chunks.every((chunk) => typeof chunk.content === "string"));
});

test("prepareDocumentKnowledge throws on empty OCR text", async () => {
  const deps = makeDeps(null as never, {
    extractText: async () => ({ text: "" }),
  });
  await assert.rejects(
    () => prepareDocumentKnowledge(Buffer.from("x"), "application/pdf", deps),
    /ไม่พบข้อความ/,
  );
});

test("processKnowledgeDocument sets READY and creates chunks", async () => {
  const fake = makeFakeClient();
  fake.documents.set("doc-1", {
    id: "doc-1",
    title: "เอกสารทดสอบ",
    filePath: "abc.pdf",
    mimeType: "application/pdf",
    status: "DRAFT",
    dimensions: 3,
  });

  const result = await processKnowledgeDocument("doc-1", makeDeps(fake.client));

  assert.equal(result.status, "ACTIVE");
  assert.ok(result.chunkCount >= 1);
  assert.equal(result.dimensions, 3);
  assert.equal(fake.documents.get("doc-1")?.status, "ACTIVE");
  assert.equal(fake.documents.get("doc-1")?.title, "ระเบียบทดสอบ");
  assert.ok(fake.chunks.length >= 1);
  assert.ok(fake.chunks.every((chunk) => chunk.embedding && chunk.checksum));
});

test("processKnowledgeDocument sets FAILED on OCR error and preserves old chunks", async () => {
  const fake = makeFakeClient();
  fake.documents.set("doc-1", {
    id: "doc-1",
    title: "เอกสารทดสอบ",
    filePath: "abc.pdf",
    mimeType: "application/pdf",
    status: "DRAFT",
    dimensions: 3,
  });

  const deps = makeDeps(fake.client, {
    extractText: async () => {
      throw new Error("Embedding API down");
    },
  });

  await assert.rejects(() => processKnowledgeDocument("doc-1", deps), /Embedding API down/);
  assert.equal(fake.documents.get("doc-1")?.status, "FAILED");
  assert.match(fake.documents.get("doc-1")?.processingNote ?? "", /Embedding API down/);
});

test("processKnowledgeDocument skips claim when already processing and skipClaim set", async () => {
  const fake = makeFakeClient();
  fake.documents.set("doc-1", {
    id: "doc-1",
    title: "เอกสารทดสอบ",
    filePath: "abc.pdf",
    mimeType: "application/pdf",
    status: "PROCESSING",
    dimensions: 3,
  });

  const result = await processKnowledgeDocument("doc-1", makeDeps(fake.client));
  assert.equal(result.status, "PROCESSING");
  assert.equal(fake.chunks.length, 0);
});

test("retryKnowledgeDocument reprocesses a failed document", async () => {
  const fake = makeFakeClient();
  fake.documents.set("doc-1", {
    id: "doc-1",
    title: "เอกสารทดสอบ",
    filePath: "abc.pdf",
    mimeType: "application/pdf",
    status: "FAILED",
    dimensions: 3,
  });

  const result = await retryKnowledgeDocument("doc-1", makeDeps(fake.client));
  assert.equal(result.status, "ACTIVE");
  assert.ok(fake.chunks.length >= 1);
});

test("reindexKnowledgeDocument regenerates embeddings without re-running OCR", async () => {
  const fake = makeFakeClient();
  let ocrCalls = 0;
  fake.documents.set("doc-1", {
    id: "doc-1",
    title: "เอกสารทดสอบ",
    filePath: "abc.pdf",
    mimeType: "application/pdf",
    status: "ACTIVE",
    dimensions: 3,
    extractedText: SAMPLE_TEXT,
  });

  const deps = makeDeps(fake.client, {
    extractText: async () => {
      ocrCalls++;
      return { text: SAMPLE_TEXT };
    },
  });

  const result = await reindexKnowledgeDocument("doc-1", deps);
  assert.equal(ocrCalls, 0);
  assert.ok(result.chunkCount >= 1);
  assert.ok(fake.chunks.length >= 1);
});

test("reindexKnowledgeDocument throws when no extracted text", async () => {
  const fake = makeFakeClient();
  fake.documents.set("doc-1", {
    id: "doc-1",
    title: "เอกสารทดสอบ",
    filePath: "abc.pdf",
    mimeType: "application/pdf",
    status: "ACTIVE",
    dimensions: 3,
    extractedText: null,
  });

  await assert.rejects(() => reindexKnowledgeDocument("doc-1", makeDeps(fake.client)), /ยังไม่มีข้อความ/);
});

test("processKnowledgeDocument throws when document not found", async () => {
  const fake = makeFakeClient();
  await assert.rejects(
    () => processKnowledgeDocument("missing", makeDeps(fake.client)),
    /ไม่พบเอกสาร/,
  );
});

test("processKnowledgeDocument throws when document has no file", async () => {
  const fake = makeFakeClient();
  fake.documents.set("doc-1", {
    id: "doc-1",
    title: "เอกสารทดสอบ",
    filePath: null,
    mimeType: null,
    status: "DRAFT",
  });

  await assert.rejects(
    () => processKnowledgeDocument("doc-1", makeDeps(fake.client)),
    /ไม่มีไฟล์ต้นฉบับ/,
  );
});
