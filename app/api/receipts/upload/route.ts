import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/receipts/service";
import { MAX_FILE_BYTES, MIME_EXTENSIONS } from "@/lib/files";
import { readRequestJson } from "@/lib/request-json";
import { AppError, errorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const input = z.object({ orgSlug: z.string().min(1), mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]), size: z.number().int().min(1).max(MAX_FILE_BYTES) }).parse(await readRequestJson(request));
    const { organization, user } = await requireMembership(input.orgSlug);
    const path = `${organization.id}/staging/${user.id}/${randomUUID()}.${MIME_EXTENSIONS[input.mimeType]}`;
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new AppError("Unable to prepare upload.", "STORAGE_ERROR", 502);
    return Response.json({ path, signedUrl: data.signedUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
