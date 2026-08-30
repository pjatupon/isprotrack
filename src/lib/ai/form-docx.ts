import PizZip from "pizzip";
import type { FormFieldType } from "@/lib/ai/form-template-defs";

export interface FormPlaceholderField {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  matchText: string;
  anchor: "replace" | "after";
}

const PARAGRAPH_REGEX = /<w:p\b(?=[^>]*>)[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^/>]*\/>/g;
const TEXT_RUN_REGEX = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getDocumentXml(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("ไฟล์ไม่ใช่ .docx ที่ถูกต้อง (ไม่พบ word/document.xml)");
  }
  return document.asText();
}

export function extractDocxText(buffer: Buffer): string {
  const documentXml = getDocumentXml(buffer);
  const paragraphs: string[] = [];

  for (const match of documentXml.matchAll(PARAGRAPH_REGEX)) {
    const paragraphXml = match[0];
    const text = Array.from(paragraphXml.matchAll(TEXT_RUN_REGEX))
      .map((run) => run[1])
      .join("");
    paragraphs.push(text);
  }

  return paragraphs.join("\n").trim();
}

interface XmlToken {
  kind: "text" | "other";
  content: string;
  raw: string;
}

function tokenizeTextRuns(paragraphXml: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  let lastIndex = 0;
  for (const match of paragraphXml.matchAll(TEXT_RUN_REGEX)) {
    if (match.index !== undefined && match.index > lastIndex) {
      tokens.push({ kind: "other", content: "", raw: paragraphXml.slice(lastIndex, match.index) });
    }
    tokens.push({ kind: "text", content: match[1], raw: match[0] });
    lastIndex = match.index !== undefined ? match.index + match[0].length : lastIndex;
  }
  if (lastIndex < paragraphXml.length) {
    tokens.push({ kind: "other", content: "", raw: paragraphXml.slice(lastIndex) });
  }
  return tokens;
}

function replaceInParagraph(paragraphXml: string, search: string, replacement: string): { xml: string; count: number } {
  const tokens = tokenizeTextRuns(paragraphXml);
  const textTokens = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => token.kind === "text");

  if (textTokens.length === 0) return { xml: paragraphXml, count: 0 };

  const partStarts: number[] = [];
  let acc = 0;
  for (const { token } of textTokens) {
    partStarts.push(acc);
    acc += token.content.length;
  }
  const joined = textTokens.map(({ token }) => token.content).join("");

  const matches: number[] = [];
  let cursor = joined.indexOf(search);
  while (cursor !== -1) {
    matches.push(cursor);
    cursor = joined.indexOf(search, cursor + search.length);
  }
  if (matches.length === 0) return { xml: paragraphXml, count: 0 };

  function findPart(pos: number): { partIndex: number; offset: number } {
    let lo = 0;
    let hi = partStarts.length - 1;
    let answer = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (partStarts[mid] <= pos) {
        answer = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return { partIndex: answer, offset: pos - partStarts[answer] };
  }

  const edits = new Map<number, Array<{ start: number; len: number; text: string }>>();
  for (let i = 0; i < textTokens.length; i++) edits.set(i, []);

  for (const start of matches) {
    const end = start + search.length;
    const from = findPart(start);
    const to = findPart(end - 1);

    if (from.partIndex === to.partIndex) {
      edits.get(from.partIndex)!.push({ start: from.offset, len: end - start, text: replacement });
      continue;
    }

    edits.get(from.partIndex)!.push({ start: from.offset, len: textTokens[from.partIndex].token.content.length - from.offset, text: replacement });
    for (let p = from.partIndex + 1; p < to.partIndex; p++) {
      edits.get(p)!.push({ start: 0, len: textTokens[p].token.content.length, text: "" });
    }
    edits.get(to.partIndex)!.push({ start: 0, len: to.offset, text: "" });
  }

  const newContents = textTokens.map(({ token }) => token.content);
  for (const [partIndex, partEdits] of edits) {
    const original = newContents[partIndex];
    let result = "";
    let pos = 0;
    for (const edit of partEdits.sort((a, b) => a.start - b.start)) {
      if (edit.start > pos) result += original.slice(pos, edit.start);
      result += edit.text;
      pos = edit.start + edit.len;
    }
    result += original.slice(pos);
    newContents[partIndex] = result;
  }

  let output = "";
  let textCursor = 0;
  for (const token of tokens) {
    if (token.kind === "other") {
      output += token.raw;
      continue;
    }
    const newContent = newContents[textCursor];
    textCursor += 1;
    if (newContent === token.content) {
      output += token.raw;
      continue;
    }
    const closeTagIndex = token.raw.indexOf(">");
    let openTag = token.raw.slice(0, closeTagIndex + 1);
    if (!/xml:space/.test(openTag)) {
      openTag = openTag.replace(">", ' xml:space="preserve">');
    }
    output += `${openTag}${xmlEscape(newContent)}</w:t>`;
  }

  return { xml: output, count: matches.length };
}

function replaceAcrossDocument(documentXml: string, search: string, replacement: string): { xml: string; count: number } {
  let output = "";
  let lastIndex = 0;
  let totalCount = 0;
  for (const match of documentXml.matchAll(PARAGRAPH_REGEX)) {
    if (match.index !== undefined) {
      output += documentXml.slice(lastIndex, match.index);
    }
    const replaced = replaceInParagraph(match[0], search, replacement);
    output += replaced.xml;
    totalCount += replaced.count;
    lastIndex = match.index !== undefined ? match.index + match[0].length : lastIndex;
  }
  output += documentXml.slice(lastIndex);
  return { xml: output, count: totalCount };
}

export function applyPlaceholdersToDocx(
  buffer: Buffer,
  fields: FormPlaceholderField[],
): { buffer: Buffer; applied: Record<string, number> } {
  const zip = new PizZip(buffer);
  const documentXml = getDocumentXml(buffer);
  const applied: Record<string, number> = {};

  let currentXml = documentXml;
  for (const field of fields) {
    if (!field.key || !field.matchText) continue;

    const searchCandidates = [field.matchText, field.matchText.trim()].filter((value, index, all) => all.indexOf(value) === index);
    let count = 0;
    let replacedXml = currentXml;

    for (const candidate of searchCandidates) {
      if (!candidate) continue;
      const replacement = field.anchor === "after" ? `${candidate} {${field.key}}` : `{${field.key}}`;
      const result = replaceAcrossDocument(currentXml, candidate, replacement);
      if (result.count > 0) {
        count = result.count;
        replacedXml = result.xml;
        break;
      }
    }

    if (count > 0) currentXml = replacedXml;
    applied[field.key] = count;
  }

  zip.file("word/document.xml", currentXml);
  const generated = zip.generate({ type: "nodebuffer" });
  return { buffer: Buffer.from(generated), applied };
}

export function validateFormPlaceholderFields(value: unknown): FormPlaceholderField[] {
  if (!Array.isArray(value)) {
    throw new Error("รูปแบบฟิลด์จาก AI ไม่ถูกต้อง");
  }
  const fields: FormPlaceholderField[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("รูปแบบฟิลด์จาก AI ไม่ถูกต้อง");
    }
    const raw = item as Record<string, unknown>;
    const key = String(raw.key ?? "").trim();
    if (!key) throw new Error("AI ตอบฟิลด์ที่ไม่มี key");
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      throw new Error(`key "${key}" ไม่ถูกต้อง (อนุญาตเฉพาะตัวอักษร ตัวเลข และ _)`);
    }
    if (seen.has(key)) throw new Error(`พบ key ซ้ำ: ${key}`);
    seen.add(key);
    const type = (["text", "number", "date", "textarea"] as FormFieldType[]).includes(raw.type as FormFieldType)
      ? (raw.type as FormFieldType)
      : "text";
    const anchor = raw.anchor === "after" ? "after" : "replace";
    fields.push({
      key,
      label: String(raw.label ?? key).trim() || key,
      type,
      required: Boolean(raw.required),
      matchText: String(raw.matchText ?? ""),
      anchor,
    });
  }
  return fields;
}
