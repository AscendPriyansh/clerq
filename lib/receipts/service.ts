import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type ReceiptSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_FILE_BYTES, MIME_EXTENSIONS, validateFile } from "@/lib/files";
import { AppError } from "@/lib/errors";

export const BUCKET = "receipts-vault";
export async function storeReceipt(input: { buffer: Buffer; mimeType: string; orgId: string; source: ReceiptSource; userId?: string; ingestionKey: string }) {
  validateFile(input.buffer, input.mimeType);
  const existing = await prisma.receipt.findUnique({ where: { orgId_ingestionKey: { orgId: input.orgId, ingestionKey: input.ingestionKey } } });
  if (existing) return existing;
  const id = randomUUID();
  const path = `${input.orgId}/${id}.${MIME_EXTENSIONS[input.mimeType]}`;
  const storage = createAdminClient().storage.from(BUCKET);
  const upload = await storage.upload(path, input.buffer, { contentType: input.mimeType, upsert: false });
  if (upload.error) throw new AppError("Unable to store receipt. Check the receipts-vault bucket.", "STORAGE_ERROR", 502);
  try {
    return await prisma.$transaction(async tx => {
      const receipt = await tx.receipt.create({ data: {
        id, orgId: input.orgId, source: input.source, uploadedByUserId: input.userId, rawFileUrl: path,
        mimeType: input.mimeType, fileSizeBytes: input.buffer.length, ingestionKey: input.ingestionKey,
      } });
      await tx.ingestionJob.create({ data: { key: `parse:${id}`, type: "RECEIPT_PARSE", payload: { receiptId: id, orgId: input.orgId } } });
      return receipt;
    });
  } catch (error) {
    await storage.remove([path]);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const receipt = await prisma.receipt.findUnique({ where: { orgId_ingestionKey: { orgId: input.orgId, ingestionKey: input.ingestionKey } } });
      if (receipt) return receipt;
    }
    throw error;
  }
}

export async function downloadReceipt(path: string, orgId: string) {
  if (!path.startsWith(`${orgId}/`) || path.includes("..")) throw new AppError("Invalid receipt storage path.", "INVALID_STORAGE_PATH");
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !data) throw new AppError("Receipt file is unavailable.", "STORAGE_ERROR", 502);
  if (data.size > MAX_FILE_BYTES) throw new AppError("Stored file exceeds the size limit.", "FILE_TOO_LARGE", 413);
  return Buffer.from(await data.arrayBuffer());
}
