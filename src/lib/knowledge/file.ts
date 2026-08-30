import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

export const KNOWLEDGE_FILE_MAX_SIZE = 15 * 1024 * 1024;
export const KNOWLEDGE_FILE_ROOT = path.join(process.cwd(), "public", "media");

export interface KnowledgeFileValidation {
  valid: boolean;
  mimeType?: string;
  extension?: string;
  size?: number;
  error?: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAGIC_BYTES: Array<{ mimeType: string; offset: number; signature: readonly number[] }> = [
  { mimeType: "application/pdf", offset: 0, signature: [0x25, 0x50, 0x44, 0x46] },
  { mimeType: "image/png", offset: 0, signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: "image/jpeg", offset: 0, signature: [0xff, 0xd8, 0xff] },
];

export function detectKnowledgeMimeType(buffer: Buffer): string | null {
  for (const { mimeType, offset, signature } of MAGIC_BYTES) {
    const slice = buffer.subarray(offset, offset + signature.length);
    if (Buffer.compare(slice, Buffer.from(signature)) === 0) return mimeType;
  }
  if (
    buffer.subarray(0, 4).equals(Buffer.from("RIFF")) &&
    buffer.subarray(8, 12).equals(Buffer.from("WEBP"))
  ) {
    return "image/webp";
  }
  return null;
}

export function validateKnowledgeFile(
  buffer: Buffer,
  declaredMimeType: string | null,
): KnowledgeFileValidation {
  if (buffer.length === 0) {
    return { valid: false, error: "ไฟล์ว่างเปล่า" };
  }
  if (buffer.length > KNOWLEDGE_FILE_MAX_SIZE) {
    return {
      valid: false,
      error: `ไฟล์ใหญ่เกินไป (สูงสุด 15MB)`,
      size: buffer.length,
    };
  }
  const detected = detectKnowledgeMimeType(buffer);
  if (!detected) {
    return { valid: false, error: "ประเภทไฟล์ไม่รองรับ (รองรับ PDF, JPG, PNG, WebP)" };
  }
  if (declaredMimeType && detected !== declaredMimeType.split(";")[0].trim()) {
    return {
      valid: false,
      error: "เนื้อหาไฟล์ไม่ตรงกับประเภทที่ระบุ",
      mimeType: detected,
    };
  }
  return {
    valid: true,
    mimeType: detected,
    extension: MIME_EXTENSIONS[detected],
    size: buffer.length,
  };
}

export function computeKnowledgeFileChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function isSafeKnowledgeStoragePath(candidate: string): boolean {
  const root = path.resolve(KNOWLEDGE_FILE_ROOT);
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(root + path.sep);
}

export function resolveKnowledgeFilePath(storedName: string): string {
  if (
    typeof storedName !== "string" ||
    storedName.length === 0 ||
    storedName.includes("/") ||
    storedName.includes("\\") ||
    storedName.includes("..")
  ) {
    throw new Error("ชื่อไฟล์ไม่ถูกต้อง");
  }
  const target = path.join(KNOWLEDGE_FILE_ROOT, storedName);
  if (!isSafeKnowledgeStoragePath(target)) {
    throw new Error("เส้นทางไฟล์ไม่ปลอดภัย");
  }
  return target;
}

export async function storeKnowledgeFile(buffer: Buffer, extension: string): Promise<string> {
  const storedName = `${randomUUID()}${extension}`;
  const target = resolveKnowledgeFilePath(storedName);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return storedName;
}

export async function removeKnowledgeFile(storedName: string): Promise<void> {
  const target = resolveKnowledgeFilePath(storedName);
  await fs.unlink(target);
}

export async function quarantineKnowledgeFile(storedName: string): Promise<void> {
  const source = resolveKnowledgeFilePath(storedName);
  const quarantined = `${source}.quarantined`;
  await fs.mkdir(path.dirname(quarantined), { recursive: true });
  try {
    await fs.rename(source, quarantined);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function restoreQuarantinedFile(storedName: string): Promise<void> {
  const target = resolveKnowledgeFilePath(storedName);
  const quarantined = `${target}.quarantined`;
  try {
    await fs.rename(quarantined, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function removeQuarantinedFile(storedName: string): Promise<void> {
  const target = resolveKnowledgeFilePath(storedName);
  await fs.unlink(`${target}.quarantined`);
}
