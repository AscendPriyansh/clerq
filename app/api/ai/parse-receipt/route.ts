import { createHash } from "node:crypto";
import { requireMembership } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { MAX_FILE_BYTES, readLimitedBody } from "@/lib/files";
import { storeReceipt } from "@/lib/receipts/service";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readLimitedBody(request, MAX_FILE_BYTES + 65536);
    let form;
    try { form = await new Response(new Uint8Array(body), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData(); }
    catch { throw new AppError("Expected a multipart file upload.", "INVALID_FORM"); }
    const { organization, user } = await requireMembership(String(form.get("orgSlug") ?? ""));
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("Choose a receipt file.", "FILE_REQUIRED");
    const buffer = Buffer.from(await file.arrayBuffer());
    const receipt = await storeReceipt({ buffer, mimeType: file.type, orgId: organization.id, userId: user.id, source: "WEB_UPLOAD", ingestionKey: `upload:${createHash("sha256").update(buffer).digest("hex")}` });
    return Response.json({ receiptId: receipt.id, status: receipt.status, message: "Receipt saved and queued for extraction." }, { status: 202 });
  } catch (error) { return errorResponse(error); }
}
