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
import type { QuotationExtract } from "./ocr";

const QUOTATION_ANALYSIS_TIMEOUT_MS = 300_000;
const QUOTATION_ANALYSIS_MAX_RETRIES = 2;

export interface QuotationAnalysisInput {
  quotation: QuotationExtract;
  objective?: string;
}

export interface QuotationAnalysisResult {
  analysis: string;
  citations: Citation[];
  confidenceScore: number;
  usedKnowledgeBase: boolean;
}

function buildSearchQuery(input: QuotationAnalysisInput): string {
  const vendor = input.quotation.vendorName ?? "";
  const items = (input.quotation.items ?? [])
    .map((item) => item.name)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
  const grandTotal = Number(input.quotation.grandTotal ?? 0);
  return [
    input.objective?.trim(),
    `ตรวจใบเสนอราคาจาก ${vendor}`,
    items,
    grandTotal > 0 ? `วงเงิน ${grandTotal} บาท` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export async function analyzeQuotation(
  input: QuotationAnalysisInput,
): Promise<QuotationAnalysisResult> {
  const prompts = await getAiPrompts([
    AI_PROMPT_KEYS.quotationAnalyzeSystem,
    AI_PROMPT_KEYS.quotationAnalyzeUser,
  ]);

  const query = buildSearchQuery(input) || "ตรวจสอบและวิเคราะห์ใบเสนอราคาตามระเบียบพัสดุ";
  const chunks = await retrieveRelevantChunks(query, {}, 6);

  const quotationText = JSON.stringify(input.quotation, null, 2);
  const prompt = renderPromptTemplate(
    prompts[AI_PROMPT_KEYS.quotationAnalyzeUser],
    {
      quotation: quotationText,
      objective: input.objective?.trim() || "ไม่ระบุ",
      context: buildContextText(chunks),
    },
  );

  const answer = await generateTextWithRetry(
    prompt,
    {
      system: prompts[AI_PROMPT_KEYS.quotationAnalyzeSystem],
      temperature: 0.2,
      maxTokens: 3000,
      timeoutMs: QUOTATION_ANALYSIS_TIMEOUT_MS,
    },
    QUOTATION_ANALYSIS_MAX_RETRIES,
  );

  return {
    analysis: answer,
    citations: buildCitations(chunks),
    confidenceScore: computeConfidence(chunks, answer),
    usedKnowledgeBase: chunks.length > 0,
  };
}
