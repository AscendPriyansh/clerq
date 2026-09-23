import { createHash } from "node:crypto";
import { z } from "zod";
import { requireMembership } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET, downloadReceipt, storeReceipt } from "@/lib/receipts/service";
import { readLimitedBody } from "@/lib/files";
import { AppError, errorResponse } from "@/lib/errors";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const input = z.object({ orgSlug: z.string(), path: z.string().max(250), mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]) }).parse(JSON.parse((await readLimitedBody(request, 4096)).toString()));
    const { organization, user } = await requireMembership(input.orgSlug);
    const prefix = `${organization.id}/staging/${user.id}/`;
    if (!input.path.startsWith(prefix) || !/^[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.test(input.path.slice(prefix.length))) throw new AppError("Upload access denied.", "FORBIDDEN", 403);
    const buffer = await downloadReceipt(input.path, organization.id);
    // storeReceipt checks actual file bytes and writes to a new immutable object.
    const receipt = await storeReceipt({ buffer, mimeType: input.mimeType, orgId: organization.id, userId: user.id, source: "WEB_UPLOAD", ingestionKey: `upload:${createHash("sha256").update(buffer).digest("hex")}` });
    await createAdminClient().storage.from(BUCKET).remove([input.path]);
    return Response.json({ receiptId: receipt.id, status: receipt.status }, { status: 202 });
  } catch (error) { return errorResponse(error); }
}
