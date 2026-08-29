import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseKnowledgeEmbedding,
  validateEmbeddingVector,
  validateEmbeddingBatch,
  cosineSimilarity,
  KNOWLEDGE_RETRIEVAL_THRESHOLD,
} from "../src/lib/knowledge/embedding";

test("parseKnowledgeEmbedding parses valid JSON vector", () => {
  const result = parseKnowledgeEmbedding("[1, 2, 3]");
  assert.deepEqual(result, [1, 2, 3]);
});

test("parseKnowledgeEmbedding rejects malformed JSON", () => {
  assert.equal(parseKnowledgeEmbedding("not-json"), null);
});

test("parseKnowledgeEmbedding rejects empty array", () => {
  assert.equal(parseKnowledgeEmbedding("[]"), null);
});

test("parseKnowledgeEmbedding rejects non-finite values", () => {
  assert.equal(parseKnowledgeEmbedding("[1, NaN, 3]"), null);
  assert.equal(parseKnowledgeEmbedding("[1, 2, Infinity]"), null);
});

test("parseKnowledgeEmbedding rejects non-array JSON", () => {
  assert.equal(parseKnowledgeEmbedding('{"a": 1}'), null);
});

test("validateEmbeddingVector checks length and finiteness", () => {
  assert.equal(validateEmbeddingVector([1, 2, 3], 3), true);
  assert.equal(validateEmbeddingVector([1, 2], 3), false);
  assert.equal(validateEmbeddingVector([1, NaN, 3], 3), false);
});

test("validateEmbeddingBatch reports invalid index", () => {
  const batch = [
    [1, 2, 3],
    [1, 2],
    [1, 2, 3],
  ];
  const result = validateEmbeddingBatch(batch, 3);
  assert.equal(result.valid, false);
  assert.equal(result.invalidIndex, 1);
  assert.equal(result.expected, 3);
  assert.equal(result.received, 2);
});

test("validateEmbeddingBatch passes when all valid", () => {
  const result = validateEmbeddingBatch(
    [
      [1, 2, 3],
      [4, 5, 6],
    ],
    3,
  );
  assert.equal(result.valid, true);
});

test("cosineSimilarity returns 1 for identical vectors", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
});

test("cosineSimilarity returns 0 for orthogonal vectors", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
});

test("cosineSimilarity returns -1 for opposite vectors", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [-1, 0, 0]), -1);
});

test("cosineSimilarity handles empty vectors", () => {
  assert.equal(cosineSimilarity([], []), 0);
});

test("cosineSimilarity ranks closer vectors higher", () => {
  const query = [1, 1];
  const closer = cosineSimilarity(query, [1.2, 0.8]);
  const farther = cosineSimilarity(query, [-1, -1]);
  assert.ok(closer > farther);
  assert.ok(closer > KNOWLEDGE_RETRIEVAL_THRESHOLD);
});

test("cosineSimilarity is symmetric", () => {
  const a = [1, 2, 3];
  const b = [4, -1, 2];
  assert.equal(cosineSimilarity(a, b), cosineSimilarity(b, a));
});
