import { AppError } from "@/lib/errors";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MIME_EXTENSIONS: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function validateFile(buffer: Buffer, mimeType: string) {
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new AppError("Files must be between 1 byte and 10 MB.", "INVALID_FILE_SIZE", 413);
  const actual = buffer.subarray(0, 5).toString() === "%PDF-" ? "application/pdf"
    : buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? "image/png"
    : buffer.subarray(0, 3).toString("hex") === "ffd8ff" ? "image/jpeg"
    : buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
  if (!actual || actual !== mimeType) throw new AppError("Upload a valid PDF, PNG, JPEG or WebP file.", "INVALID_FILE_TYPE", 415);
}

export async function readLimitedBody(source: Request | Response, limit: number): Promise<Buffer> {
  if (Number(source.headers.get("content-length")) > limit) throw new AppError("File or request is too large.", "PAYLOAD_TOO_LARGE", 413);
  if (!source.body) throw new AppError("Empty request body.", "EMPTY_BODY");
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new AppError("File or request is too large.", "PAYLOAD_TOO_LARGE", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
