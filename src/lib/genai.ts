"use server";

const DEFAULT_BASE_URL = "https://gen.ai.kku.ac.th/api/v1";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-004";

interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
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

const AI_REQUEST_TIMEOUT_MS = 120_000;

function resolveChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl}/chat/completions`;
}

function resolveEmbeddingsUrl(baseUrl: string): string {
  return `${baseUrl}/embeddings`;
}

function getApiKey(): string {
  return process.env.KKU_GENAI_API_KEY?.trim() ?? "";
}

function getBaseUrl(): string {
  return (process.env.KKU_GENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getDefaultModel(): string {
  return process.env.KKU_GENAI_MODEL?.trim() || DEFAULT_MODEL;
}

async function getResolvedAiSettings() {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.error("KKU GenAI API key is missing. Please set KKU_GENAI_API_KEY in .env.");
    throw new Error("API Key not configured");
  }

  return {
    apiKey,
    model: getDefaultModel(),
    apiUrl: resolveChatCompletionsUrl(getBaseUrl()),
  };
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
    console.error(`KKU GenAI API error: ${response.status}`, errorData);

    if (response.status === 401) {
      throw new Error("Invalid API Key - please check KKU_GENAI_API_KEY");
    } else if (response.status === 403) {
      throw new Error("KKU GenAI API access denied - please check your key permissions");
    } else if (response.status === 429) {
      throw new Error("Rate limit exceeded - please try again later");
    } else if (response.status === 500) {
      throw new Error("KKU GenAI API server error - please try again later");
    }

    throw new Error(`KKU GenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error("Unexpected API response format:", data);
    throw new Error("Invalid response format from AI API");
  }

  const content = data.choices[0].message.content;

  if (!content) {
    throw new Error("AI returned empty response");
  }

  return content;
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
  } = options;

  try {
    const response = await fetchWithTimeout(settings.apiUrl, {
      method: "POST",
      headers: getBaseHeaders(settings.apiKey),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    return await parseChatResponse(response);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("AI ตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง");
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
        lastError.message.includes("Invalid response format")
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
  } = options;

  try {
    const response = await fetchWithTimeout(settings.apiUrl, {
      method: "POST",
      headers: getBaseHeaders(settings.apiKey),
      body: JSON.stringify({
        model,
        messages: [
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

  const response = await fetchWithTimeout(settings.apiUrl, {
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
    return { model: DEFAULT_EMBEDDING_MODEL, vectors: [] };
  }

  const settings = await getResolvedAiSettings();
  const model = process.env.KKU_GENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const response = await fetchWithTimeout(resolveEmbeddingsUrl(getBaseUrl()), {
    method: "POST",
    headers: getBaseHeaders(settings.apiKey),
    body: JSON.stringify({ model, input, encoding_format: "float" }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`KKU GenAI embedding error: ${response.status}`, errorData);
    throw new Error(`ไม่สามารถสร้าง vector ได้ (${response.status})`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
    model?: string;
  };
  const vectors = [...(data.data ?? [])]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => item.embedding)
    .filter((embedding): embedding is number[] => Array.isArray(embedding));

  if (vectors.length !== input.length) {
    throw new Error("AI ส่ง vector กลับมาไม่ครบถ้วน");
  }

  const dimensions = vectors[0]?.length ?? 0;
  const isValid =
    dimensions > 0 &&
    vectors.every(
      (vector) =>
        vector.length === dimensions &&
        vector.every((value) => typeof value === "number" && Number.isFinite(value)),
    );
  if (!isValid) {
    throw new Error("AI ส่ง vector ที่ไม่ถูกต้อง (ขนาดหรือค่าผิดปกติ)");
  }

  return { model: data.model || model, vectors };
}
