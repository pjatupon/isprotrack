import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateKnowledgeFile,
  computeKnowledgeFileChecksum,
  resolveKnowledgeFilePath,
  isSafeKnowledgeStoragePath,
  KNOWLEDGE_FILE_ROOT,
} from "../src/lib/knowledge/file";

const PDF_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

test("validateKnowledgeFile accepts PDF", () => {
  const result = validateKnowledgeFile(PDF_BYTES, "application/pdf");
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.extension, ".pdf");
});

test("validateKnowledgeFile accepts PNG/JPEG/WebP", () => {
  assert.equal(validateKnowledgeFile(PNG_BYTES, "image/png").valid, true);
  assert.equal(validateKnowledgeFile(JPEG_BYTES, "image/jpeg").valid, true);
  assert.equal(validateKnowledgeFile(WEBP_BYTES, "image/webp").valid, true);
});

test("validateKnowledgeFile rejects empty file", () => {
  const result = validateKnowledgeFile(Buffer.alloc(0), null);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /ว่างเปล่า/);
});

test("validateKnowledgeFile rejects oversized file", () => {
  const big = Buffer.alloc(15 * 1024 * 1024 + 1, 0x25);
  const result = validateKnowledgeFile(big, null);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /ใหญ่เกินไป/);
});

test("validateKnowledgeFile rejects unknown magic bytes", () => {
  const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
  const result = validateKnowledgeFile(garbage, null);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /ไม่รองรับ/);
});

test("validateKnowledgeFile rejects mime mismatch", () => {
  const result = validateKnowledgeFile(PDF_BYTES, "image/png");
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /ไม่ตรงกับประเภท/);
});

test("computeKnowledgeFileChecksum is deterministic sha256", () => {
  const first = computeKnowledgeFileChecksum(Buffer.from("hello"));
  const second = computeKnowledgeFileChecksum(Buffer.from("hello"));
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("resolveKnowledgeFilePath rejects path traversal", () => {
  assert.throws(() => resolveKnowledgeFilePath("../evil.pdf"));
  assert.throws(() => resolveKnowledgeFilePath("a/b.pdf"));
  assert.throws(() => resolveKnowledgeFilePath("..\\evil.pdf"));
  assert.throws(() => resolveKnowledgeFilePath(""));
});

test("resolveKnowledgeFilePath returns path under storage root", () => {
  const target = resolveKnowledgeFilePath("abc-123.pdf");
  assert.equal(isSafeKnowledgeStoragePath(target), true);
  assert.ok(target.startsWith(KNOWLEDGE_FILE_ROOT));
});
