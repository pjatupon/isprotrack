import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const EMBEDDING_MODEL = "text-embedding-004";
export const CHAT_MODEL = "gemini-2.5-flash";

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  section: string | null;
  page: number | null;
  documentTitle: string;
  documentIssueNo: string | null;
}

export interface Citation {
  chunkId: string;
  content: string;
  section: string | null;
  documentTitle: string;
  relevanceScore: number;
}

export interface ConsultationResult {
  answer: string;
  citations: Citation[];
  confidenceScore: number;
}