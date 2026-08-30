"use server";

import { getAiSettings } from "@/lib/ai/settings";
import {
  generateLocalEmbeddings,
  LOCAL_EMBEDDING_MODEL,
} from "@/lib/ai/localEmbedding";
interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  timeoutMs?: number;
}

interface AIImageGenerationOptions extends AIGenerationOptions {
  mimeType?: string;
}

type AIDocumentInput = {
  base64: string;
  filename: string;
  mimeType: string;
};

export type EmbeddingBatch = {
  model: string;
  vectors: number[][];
};

const AI_REQUEST_TIMEOUT_MS = 240_000;

function resolveChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl}/chat/completions`;
}

async function getResolvedAiSettings() {
  const settings = await getAiSettings();

  if (!settings.apiKey) {
    console.error(
      "AI API key is missing. Please set it in the admin settings (Settings -> AI) or KKU_GENAI_API_KEY in .env.",
    );
    throw new Error("API Key not configured");
  }

  return settings;
}

function getBaseHeaders(apiKey: string) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"));
}

async function parseChatResponse(response: Response): Promise<string> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`AI API error: ${response.status}`, errorData);

    const upstream = errorData?.error?.message || errorData?.error || "";

    if (response.status === 401) {
      if (typeof upstream === "string" && upstream.includes("daily limit")) {
        throw new Error("Model นี้หมดโควตารายวัน (daily limit) กรุณาเปลี่ยน Model ในตั้งค่า AI");
      }
      if (typeof upstream === "string" && upstream.includes("Invalid model")) {
        throw new Error("รุ่น Model ที่ระบุไม่ถูกต้อง กรุณาตรวจสอบในตั้งค่า AI");
      }
      throw new Error("Invalid API Key - please check AI settings");
    } else if (response.status === 403) {
      throw new Error("AI API access denied - please check your key permissions");
    } else if (response.status === 429) {
      throw new Error("Rate limit exceeded - please try again later");
    } else if (response.status === 500) {
      throw new Error("AI API server error - please try again later");
    }

    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error("Unexpected API response format:", data);
    const isEmpty = !data || Object.keys(data).length === 0;
    throw new Error(
      isEmpty
        ? "AI API returned an empty response (ไฟล์อาจใหญ่เกินไปหรือ model ตอบสนองช้า) - please retry"
        : "Invalid response format from AI API",
    );
  }

  const message = data.choices[0].message;
  const content = typeof message.content === "string" ? message.content : "";
  const reasoning = typeof message.reasoning === "string" ? message.reasoning : "";

  if (!content) {
    if (reasoning) {
      return reasoning;
    }
    throw new Error("AI returned empty response");
  }

  return content;
}

function buildMessages(prompt: string, system?: string) {
  const messages: Array<{ role: string; content: string }> = [];
  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: prompt });
  return messages;
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || start >= end) {
    throw new Error("AI did not return valid JSON");
  }

  return text.slice(start, end + 1);
}

export async function generateText(
  prompt: string,
  options: AIGenerationOptions = {},
): Promise<string> {
  const settings = await getResolvedAiSettings();

  const {
    model = settings.model,
    temperature = 0.7,
    maxTokens = 2000,
    system,
    timeoutMs = AI_REQUEST_TIMEOUT_MS,
  } = options;

  try {
    const response = await fetchWithTimeout(
      resolveChatCompletionsUrl(settings.baseUrl),
      {
        method: "POST",
        headers: getBaseHeaders(settings.apiKey),
        body: JSON.stringify({
          model,
          messages: buildMessages(prompt, system),
          temperature,
          max_tokens: maxTokens,
        }),
      },
      timeoutMs,
    );

    return await parseChatResponse(response);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        timeoutMs >= 120_000
          ? "AI ตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง"
          : `AI ตอบสนองช้าเกินไป (เกิน ${Math.round(timeoutMs / 1000)} วินาที) กรุณาลองใหม่อีกครั้ง`,
      );
    }

    console.error("AI Generation Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("fetch failed")) {
        throw new Error("Network error - unable to connect to AI service");
      }
      throw error;
    }

    throw new Error("An unexpected error occurred during AI generation");
  }
}

export async function generateTextWithRetry(
  prompt: string,
  options: AIGenerationOptions = {},
  maxRetries: number = 2,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateText(prompt, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (
        lastError.message.includes("Invalid API Key") ||
        lastError.message.includes("Invalid response format") ||
        lastError.message.includes("API Key not configured")
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Failed to generate text after retries");
}

export async function generateThaiContent(
  basePrompt: string,
  context: Record<string, string> = {},
): Promise<string> {
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const thaiPrompt = `
${basePrompt}

${contextStr ? `ข้อมูลเพิ่มเติม:\n${contextStr}` : ""}

โปรดตอบเป็นภาษาไทยราชการ กระชับและชัดเจน
    `.trim();

  return generateTextWithRetry(thaiPrompt, {
    temperature: 0.7,
    maxTokens: 1500,
  });
}

export async function translateThaiToEnglish(thaiText: string): Promise<string> {
  const prompt = `
Please translate the following Thai text to English. Maintain the professional tone and structure:

Thai text:
${thaiText}

Please provide only the English translation without any additional explanation.
    `.trim();

  return generateTextWithRetry(prompt, {
    temperature: 0.3,
    maxTokens: 1500,
  });
}

export async function generateTextWithImage(
  prompt: string,
  imageBase64: string,
  options: AIImageGenerationOptions = {},
): Promise<string> {
  const settings = await getResolvedAiSettings();
  const {
    model = settings.model,
    temperature = 0.2,
    maxTokens = 3000,
    mimeType = "image/jpeg",
    system,
    timeoutMs = AI_REQUEST_TIMEOUT_MS,
  } = options;

  try {
    const response = await fetchWithTimeout(
      resolveChatCompletionsUrl(settings.baseUrl),
      {
        method: "POST",
        headers: getBaseHeaders(settings.apiKey),
        body: JSON.stringify({
          model,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      },
      timeoutMs,
    );

    return await parseChatResponse(response);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("AI ตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง");
    }

    console.error("AI Text With Image Generation Error:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("An unexpected error occurred during image consultation");
  }
}

export async function generateJsonFromImage<T>(
  prompt: string,
  imageBase64: string,
  options: AIImageGenerationOptions = {},
): Promise<T> {
  const settings = await getResolvedAiSettings();
  const {
    model = settings.model,
    temperature = 0.1,
    maxTokens = 1200,
    mimeType = "image/jpeg",
    system,
  } = options;

  try {
    const response = await fetchWithTimeout(resolveChatCompletionsUrl(settings.baseUrl), {
      method: "POST",
      headers: getBaseHeaders(settings.apiKey),
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    const content = await parseChatResponse(response);
    const jsonText = extractJsonObject(content);

    return JSON.parse(jsonText) as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("AI ตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง");
    }

    console.error("AI Image Generation Error:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("An unexpected error occurred during image extraction");
  }
}

export async function extractTextFromDocument(input: AIDocumentInput): Promise<string> {
  const settings = await getResolvedAiSettings();
  const dataUrl = `data:${input.mimeType};base64,${input.base64}`;

  const response = await fetchWithTimeout(resolveChatCompletionsUrl(settings.baseUrl), {
    method: "POST",
    headers: getBaseHeaders(settings.apiKey),
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "สกัดข้อความทั้งหมดจากเอกสารนี้เป็นภาษาเดิม รักษาหัวข้อ เลขข้อ ตาราง ลำดับขั้นตอน และเลขหน้าเท่าที่ระบุได้ ตอบเฉพาะข้อความเอกสารในรูปแบบ Markdown ห้ามสรุป ห้ามเติมข้อมูล และให้ระบุ [หน้า N] เมื่อเปลี่ยนหน้า",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 12000,
    }),
  });

  return parseChatResponse(response);
}

export async function generateEmbeddings(input: string[]): Promise<EmbeddingBatch> {
  if (!input.length) {
    return { model: LOCAL_EMBEDDING_MODEL, vectors: [] };
  }

  return { model: LOCAL_EMBEDDING_MODEL, vectors: generateLocalEmbeddings(input) };
}
