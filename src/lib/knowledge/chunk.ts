export const KNOWLEDGE_CHUNK_TARGET_SIZE = 900;
export const KNOWLEDGE_CHUNK_MAX_SIZE = 1200;
export const KNOWLEDGE_CHUNK_OVERLAP = 120;
export const KNOWLEDGE_CHUNK_MAX_PAGES = 50;

export interface KnowledgeTextChunk {
  content: string;
  section: string | null;
  page: number | null;
  chunkIndex: number;
}

export function normalizeKnowledgeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const PAGE_MARKER = /\[?\s*หน้า\s*[:：]?\s*([0-9]+)\s*\]?\s*(?:ของ\s*[0-9]+)?\s*/g;
const SECTION_HEADING = /^(หมวด|หมวดที่|ส่วนที่|ภาคที่|บทที่|เรื่อง|หลักเกณฑ์)\s*[0-9๑-๙ก-ฮ]+\s*(.+)?$/;
const CLAUSE_HEADING = /^(ข้อ|มาตรา|ข้อที่)\s*[0-9๑-๙]+\s*$/;

function isHeadingLine(line: string): boolean {
  if (line.length > 60) return false;
  if (CLAUSE_HEADING.test(line)) return true;
  return SECTION_HEADING.test(line);
}

function splitParagraphs(text: string): string[] {
  const paragraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length === 0 && text.trim()) {
    paragraphs.push(text.trim());
  }
  return paragraphs;
}

function joinWithBlank(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[\.\;\:\!\?\u0E46\u0E3A])\s+/).filter(Boolean);
  if (sentences.length < 2) return [paragraph];
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (
      current &&
      (current + " " + sentence).length > KNOWLEDGE_CHUNK_MAX_SIZE &&
      current.length >= KNOWLEDGE_CHUNK_TARGET_SIZE
    ) {
      parts.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function splitIntoKnowledgeChunks(
  text: string,
  options: { maxPages?: number } = {},
): KnowledgeTextChunk[] {
  const maxPages = options.maxPages ?? KNOWLEDGE_CHUNK_MAX_PAGES;
  const normalized = normalizeKnowledgeText(text);
  if (!normalized) return [];

  let section: string | null = null;
  let page: number | null = null;
  const buffer: string[] = [];
  let runningLength = 0;
  const result: KnowledgeTextChunk[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const content = joinWithBlank(buffer);
    result.push({ content, section, page, chunkIndex: result.length });
    const tail = buffer[buffer.length - 1] ?? "";
    const tailLength = tail.length;
    buffer.length = 0;
    buffer.push(tail);
    runningLength = tailLength;
  };

  const appendParagraph = (paragraph: string) => {
    for (const part of splitLongParagraph(paragraph)) {
      if (buffer.length > 0 && runningLength + part.length > KNOWLEDGE_CHUNK_MAX_SIZE) {
        flush();
      }
      buffer.push(part);
      runningLength += part.length;
    }
  };

  const paragraphs = splitParagraphs(normalized);
  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph.trim();

    if (/^\d{1,3}\s*(?:ของ\s*\d{1,3})?\s*$/.test(paragraph)) {
      if (page === null) {
        page = parseInt(paragraph.replace(/[^0-9]/g, ""), 10);
      }
      continue;
    }

    const pageMatches = [...paragraph.matchAll(PAGE_MARKER)];
    if (pageMatches.length > 0) {
      if (buffer.length > 0) flush();
      for (const match of pageMatches) {
        page = parseInt(match[1], 10);
      }
      const stripped = paragraph.replace(PAGE_MARKER, " ").trim();
      if (stripped) {
        appendParagraph(stripped);
      }
      continue;
    }

    if (isHeadingLine(paragraph)) {
      if (buffer.length > 0) flush();
      section = paragraph;
      continue;
    }

    appendParagraph(paragraph);
  }

  flush();

  if (maxPages > 0) {
    const pageToKeep = new Set<number | null>();
    for (const chunk of result) {
      if (chunk.page !== null) pageToKeep.add(chunk.page);
    }
    if (pageToKeep.size > maxPages) {
      const keptPages = new Set([...pageToKeep].sort((a, b) => (a ?? 0) - (b ?? 0)).slice(-maxPages));
      return result.filter((chunk) => chunk.page === null || keptPages.has(chunk.page));
    }
  }

  return result;
}
