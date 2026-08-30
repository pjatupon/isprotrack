export const LOCAL_EMBEDDING_MODEL = "local-hash-768";
export const LOCAL_EMBEDDING_DIMENSIONS = 768;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().normalize("NFKC");
  const sequences = normalized.match(/[\u0e00-\u0e7fa-z0-9]+/g) ?? [];
  const tokens: string[] = [];
  for (const sequence of sequences) {
    tokens.push(sequence);
    for (let i = 0; i < sequence.length - 1; i++) {
      tokens.push(sequence.slice(i, i + 2));
    }
  }
  return tokens;
}

export function generateLocalEmbedding(text: string): number[] {
  const vector = new Array<number>(LOCAL_EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const hash = hashString(token);
    const index = hash % LOCAL_EMBEDDING_DIMENSIONS;
    const sign = (hash & 0x80000000) === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

export function generateLocalEmbeddings(texts: string[]): number[][] {
  return texts.map(generateLocalEmbedding);
}
