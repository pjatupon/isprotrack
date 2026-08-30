import "server-only";

import { prisma } from "@/lib/prisma";

export const AI_SETTING_NAMES = {
  baseUrl: "ai.baseUrl",
  apiKey: "ai.apiKey",
  model: "ai.model",
  embeddingModel: "ai.embeddingModel",
} as const;

export const DEFAULT_AI_BASE_URL = "https://gen.ai.kku.ac.th/api/v1";
export const DEFAULT_AI_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_AI_EMBEDDING_MODEL = "text-embedding-004";

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
}

export async function getAiSettings(): Promise<AiSettings> {
  const rows = await prisma.setting.findMany({
    where: { name: { in: Object.values(AI_SETTING_NAMES) } },
  });
  const map = new Map(rows.map((row) => [row.name, row.value?.trim() ?? ""]));

  const baseUrl =
    map.get(AI_SETTING_NAMES.baseUrl) ||
    process.env.KKU_GENAI_BASE_URL ||
    DEFAULT_AI_BASE_URL;
  const apiKey = map.get(AI_SETTING_NAMES.apiKey) || process.env.KKU_GENAI_API_KEY || "";
  const model = map.get(AI_SETTING_NAMES.model) || process.env.KKU_GENAI_MODEL || DEFAULT_AI_MODEL;
  const embeddingModel =
    map.get(AI_SETTING_NAMES.embeddingModel) ||
    process.env.KKU_GENAI_EMBEDDING_MODEL ||
    DEFAULT_AI_EMBEDDING_MODEL;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model,
    embeddingModel,
  };
}

export interface AiSettingUpdates {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
}

export async function saveAiSettings(input: AiSettingUpdates): Promise<void> {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { name: AI_SETTING_NAMES[key as keyof typeof AI_SETTING_NAMES] },
        update: { value: (value as string).trim() },
        create: {
          name: AI_SETTING_NAMES[key as keyof typeof AI_SETTING_NAMES],
          value: (value as string).trim(),
        },
      }),
    ),
  );
}
