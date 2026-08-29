import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeKnowledgeText,
  splitIntoKnowledgeChunks,
  KNOWLEDGE_CHUNK_MAX_SIZE,
} from "../src/lib/knowledge/chunk";

test("normalizeKnowledgeText collapses whitespace and blank lines", () => {
  const text = "  หมวด  1\n\n\nข้อ 2 \t\n\n  เนื้อหา  ";
  const normalized = normalizeKnowledgeText(text);
  assert.ok(!normalized.includes("\t"));
  assert.ok(!normalized.includes("  "));
  assert.ok(!normalized.includes("\n\n\n"));
});

test("normalizeKnowledgeText strips null characters", () => {
  const normalized = normalizeKnowledgeText("ข้อ 1\u0000เนื้อหา");
  assert.ok(!normalized.includes("\u0000"));
});

test("splitIntoKnowledgeChunks splits long text into chunks", () => {
  const long = Array.from({ length: 30 }, (_, i) => `ข้อ ${i + 1} นี่คือเนื้อหาเกี่ยวกับการจัดซื้อจัดจ้างภาครัฐที่ต้องมีรายละเอียดเพียงพอ`)
    .join("\n");
  const chunks = splitIntoKnowledgeChunks(long);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.content.length <= KNOWLEDGE_CHUNK_MAX_SIZE + 10);
  }
});

test("splitIntoKnowledgeChunks tracks section headings", () => {
  const text = "หมวด 1 การจัดซื้อจัดจ้าง\nข้อ 1 เนื้อหาหมวดแรก\nข้อ 2 เนื้อหาต่อมา\n";
  const chunks = splitIntoKnowledgeChunks(text);
  assert.equal(chunks[0]?.section, "หมวด 1 การจัดซื้อจัดจ้าง");
});

test("splitIntoKnowledgeChunks tracks page markers", () => {
  const text = "[หน้า 1] ข้อ 1 เนื้อหาหน้าแรก\n[หน้า 2] ข้อ 2 เนื้อหาหน้าสอง\n";
  const chunks = splitIntoKnowledgeChunks(text);
  assert.ok(chunks.some((chunk) => chunk.page === 1));
});

test("splitIntoKnowledgeChunks returns empty for empty input", () => {
  assert.deepEqual(splitIntoKnowledgeChunks(""), []);
});

test("splitIntoKnowledgeChunks keeps chunk content within max size", () => {
  const paragraph = Array.from({ length: 60 }, () => "คำ").join("");
  const chunks = splitIntoKnowledgeChunks(paragraph);
  for (const chunk of chunks) {
    assert.ok(chunk.content.length <= KNOWLEDGE_CHUNK_MAX_SIZE + 10);
  }
});

test("splitIntoKnowledgeChunks respects maxPages option", () => {
  const text = Array.from({ length: 5 }, (_, i) => `[หน้า ${i + 1}] เนื้อหาหน้า ${i + 1}\n`).join("");
  const chunks = splitIntoKnowledgeChunks(text, { maxPages: 2 });
  const pages = new Set(chunks.map((chunk) => chunk.page));
  assert.ok(pages.size <= 2);
});
