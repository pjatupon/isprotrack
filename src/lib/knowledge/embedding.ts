export const KNOWLEDGE_EMBEDDING_BATCH_SIZE = 64;
export const KNOWLEDGE_RETRIEVAL_CANDIDATE_LIMIT = 200;
export const KNOWLEDGE_RETRIEVAL_THRESHOLD = 0.2;
export const KNOWLEDGE_QUERY_MAX_LENGTH = 500;
export const KNOWLEDGE_RETRIEVAL_MAX_LIMIT = 50;

export function parseKnowledgeEmbedding(raw: unknown): number[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      return null;
    }
    return parsed as number[];
  } catch {
    return null;
  }
}

export function validateEmbeddingVector(vector: number[], dimensions: number): boolean {
  return (
    Array.isArray(vector) &&
    vector.length === dimensions &&
    vector.every((value) => Number.isFinite(value))
  );
}

export function validateEmbeddingBatch(
  vectors: number[][],
  dimensions: number,
): { valid: boolean; expected: number; received: number; invalidIndex: number } {
  for (let index = 0; index < vectors.length; index++) {
    if (!validateEmbeddingVector(vectors[index], dimensions)) {
      return {
        valid: false,
        expected: dimensions,
        received: vectors[index]?.length ?? 0,
        invalidIndex: index,
      };
    }
  }
  return { valid: true, expected: dimensions, received: dimensions, invalidIndex: -1 };
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < length; i++) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denom === 0 ? 0 : dot / denom;
}
