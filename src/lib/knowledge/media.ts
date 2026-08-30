import "server-only";

import sharp from "sharp";

const VISION_IMAGE_MAX_WIDTH = 1800;
const VISION_IMAGE_QUALITY = 80;
const VISION_PDF_DPI_SCALE = 2;

export const VISION_IMAGE_MIME = "image/jpeg";

export async function compressImageForVision(
  buffer: Buffer,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: VISION_IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: VISION_IMAGE_QUALITY })
    .toBuffer();

  return { buffer: resized, mimeType: VISION_IMAGE_MIME };
}

export async function rasterizePdfForVision(
  buffer: Buffer,
  options: { maxPages?: number } = {},
): Promise<Array<{ buffer: Buffer; mimeType: string; pageNumber: number }>> {
  const { maxPages = 30 } = options;
  const Mupdf = await import("mupdf");
  const { Document, ColorSpace } = Mupdf;

  const doc = Document.openDocument(new Uint8Array(buffer), "application/pdf");
  const pageCount = doc.countPages();
  const pagesToProcess = Math.min(pageCount, maxPages);

  const results: Array<{ buffer: Buffer; mimeType: string; pageNumber: number }> = [];
  for (let i = 0; i < pagesToProcess; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      [VISION_PDF_DPI_SCALE, 0, 0, VISION_PDF_DPI_SCALE, 0, 0],
      ColorSpace.DeviceRGB,
      false,
    );
    const pngBuffer = Buffer.from(pixmap.asPNG());
    const { buffer: jpegBuffer, mimeType } = await compressImageForVision(pngBuffer);
    results.push({ buffer: jpegBuffer, mimeType, pageNumber: i + 1 });
    page.destroy();
    pixmap.destroy();
  }
  doc.destroy();

  return results;
}

export async function prepareDocumentForVision(
  buffer: Buffer,
  mimeType: string,
): Promise<
  Array<{ buffer: Buffer; mimeType: string; pageNumber?: number }>
> {
  if (mimeType === "application/pdf") {
    return rasterizePdfForVision(buffer);
  }
  const { buffer: imageBuffer, mimeType: imageMime } = await compressImageForVision(buffer);
  return [{ buffer: imageBuffer, mimeType: imageMime }];
}
