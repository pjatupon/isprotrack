import "server-only";

import { generateTextWithRetry } from "@/lib/genai";
import {
  AI_PROMPT_KEYS,
  getAiPrompts,
  renderPromptTemplate,
} from "./prompts";
import {
  retrieveRelevantChunks,
  buildContextText,
  computeConfidence,
  buildCitations,
} from "./rag";
import type { Citation } from "./index";
import { parseAiJson } from "./json";

const TOR_AI_TIMEOUT_MS = 300_000;
const TOR_AI_MAX_RETRIES = 2;

export interface TorDraftInput {
  projectTitle?: string;
  objective: string;
  scope?: string;
  budget?: number;
  procurementType?: string;
  quantity?: string;
  usageDate?: string;
  aiSummary?: string;
}

export interface TorDraftResult {
  sections: {
    objective: string;
    scope: string;
    specifications: string;
    deliverables: string;
    inspectionCriteria: string;
  };
  notes: string[];
  citations: Citation[];
  confidenceScore: number;
  usedKnowledgeBase: boolean;
}

const TOR_SECTION_KEYS = [
  "objective",
  "scope",
  "specifications",
  "deliverables",
  "inspectionCriteria",
] as const;

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseDraftSections(raw: unknown): TorDraftResult["sections"] {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const sections = {} as TorDraftResult["sections"];
  for (const key of TOR_SECTION_KEYS) {
    sections[key] = asString(obj[key]).trim();
  }
  return sections;
}

export async function generateTorDraft(
  input: TorDraftInput,
): Promise<TorDraftResult> {
  const prompts = await getAiPrompts([
    AI_PROMPT_KEYS.torDraftSystem,
    AI_PROMPT_KEYS.torDraftUser,
  ]);

  const query = [
    input.projectTitle,
    input.objective,
    input.scope,
    input.quantity ? `จำนวน ${input.quantity}` : "",
    input.usageDate ? `กำหนดใช้งาน ${input.usageDate}` : "",
    input.budget ? `วงเงิน ${input.budget} บาท` : "",
    input.procurementType,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const chunks = await retrieveRelevantChunks(
    query || "ร่างข้อกำหนดและขอบเขตงาน (TOR)",
    {},
    6,
  );

  const prompt = renderPromptTemplate(
    prompts[AI_PROMPT_KEYS.torDraftUser],
    {
      projectTitle: input.projectTitle?.trim() || "ยังไม่ระบุชื่อโครงการ",
      objective: input.objective.trim() || "ยังไม่ระบุวัตถุประสงค์",
      scope: input.scope?.trim() || "ยังไม่ระบุ",
      budget: input.budget ? String(input.budget) : "ยังไม่ระบุ",
      procurementType: input.procurementType?.trim() || "ยังไม่ระบุ",
      quantity: input.quantity?.trim() || "ยังไม่ระบุ",
      usageDate: input.usageDate?.trim() || "ยังไม่ระบุ",
      aiSummary: input.aiSummary?.trim() || "",
      context: buildContextText(chunks),
    },
  );

  const answer = await generateTextWithRetry(
    prompt,
    {
      system: prompts[AI_PROMPT_KEYS.torDraftSystem],
      temperature: 0.3,
      maxTokens: 4000,
      timeoutMs: TOR_AI_TIMEOUT_MS,
    },
    TOR_AI_MAX_RETRIES,
  );

  const parsed = parseAiJson<Record<string, unknown>>(answer);
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes.map((note) => String(note)).filter(Boolean)
    : [];

  return {
    sections: parseDraftSections(parsed),
    notes,
    citations: buildCitations(chunks),
    confidenceScore: computeConfidence(chunks, answer),
    usedKnowledgeBase: chunks.length > 0,
  };
}

export type TorReviewIssueType = "lockin" | "ambiguous" | "noncompliant" | "missing";

export interface TorReviewIssue {
  type: TorReviewIssueType;
  quote: string;
  detail: string;
  suggestion: string;
}

export interface TorReviewInput {
  objective?: string;
  scope?: string;
  specifications?: string;
  deliverables?: string;
  inspectionCriteria?: string;
}

export interface TorReviewResult {
  issues: TorReviewIssue[];
  summary: string;
  citations: Citation[];
  confidenceScore: number;
  usedKnowledgeBase: boolean;
}

const TOR_REVIEW_TYPES: TorReviewIssueType[] = [
  "lockin",
  "ambiguous",
  "noncompliant",
  "missing",
];

function parseReviewIssues(raw: unknown): TorReviewIssue[] {
  if (!Array.isArray(raw)) return [];
  const issues: TorReviewIssue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const type = TOR_REVIEW_TYPES.includes(obj.type as never)
      ? (obj.type as TorReviewIssueType)
      : "noncompliant";
    issues.push({
      type,
      quote: asString(obj.quote).trim(),
      detail: asString(obj.detail).trim() || "ไม่มีคำอธิบาย",
      suggestion: asString(obj.suggestion).trim(),
    });
  }
  return issues;
}

export async function reviewTorDraft(
  input: TorReviewInput,
): Promise<TorReviewResult> {
  const prompts = await getAiPrompts([
    AI_PROMPT_KEYS.torReviewSystem,
    AI_PROMPT_KEYS.torReviewUser,
  ]);

  const torText = [
    input.objective ? `1. วัตถุประสงค์:\n${input.objective}` : "",
    input.scope ? `2. ขอบเขตของงาน:\n${input.scope}` : "",
    input.specifications ? `3. คุณลักษณะเฉพาะ:\n${input.specifications}` : "",
    input.deliverables ? `4. กำหนดเวลาส่งมอบ:\n${input.deliverables}` : "",
    input.inspectionCriteria ? `5. หลักเกณฑ์การตรวจรับ:\n${input.inspectionCriteria}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const chunks = await retrieveRelevantChunks(
    torText || "ตรวจสอบร่างข้อกำหนดและขอบเขตงาน (TOR)",
    {},
    6,
  );

  const prompt = renderPromptTemplate(
    prompts[AI_PROMPT_KEYS.torReviewUser],
    {
      torText: torText || "ไม่มีการกรอกเนื้อหา TOR",
      context: buildContextText(chunks),
    },
  );

  const answer = await generateTextWithRetry(
    prompt,
    {
      system: prompts[AI_PROMPT_KEYS.torReviewSystem],
      temperature: 0.2,
      maxTokens: 3000,
      timeoutMs: TOR_AI_TIMEOUT_MS,
    },
    TOR_AI_MAX_RETRIES,
  );

  const parsed = parseAiJson<Record<string, unknown>>(answer);

  return {
    issues: parseReviewIssues(parsed.issues),
    summary: asString(parsed.summary).trim(),
    citations: buildCitations(chunks),
    confidenceScore: computeConfidence(chunks, answer),
    usedKnowledgeBase: chunks.length > 0,
  };
}
