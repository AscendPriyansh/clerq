import { AppError, errorResponse } from "@/lib/errors";
import { readLimitedBody } from "@/lib/files";
import { ReceivedEmailSchema, verifyResendWebhook } from "@/lib/email/resend";
import { enqueue } from "@/lib/jobs/queue";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) throw new AppError("Email webhook is not configured.", "WEBHOOK_NOT_CONFIGURED", 503);
    const payload = (await readLimitedBody(request, 1024 * 1024)).toString("utf8");
    let event;
    try { event = verifyResendWebhook(payload, request.headers, secret); }
    catch { throw new AppError("Invalid webhook signature.", "INVALID_SIGNATURE", 401); }
    if (event.type !== "email.received") return Response.json({ accepted: true });
    const parsed = ReceivedEmailSchema.safeParse(event);
    if (!parsed.success) throw new AppError("Invalid received-email payload.", "INVALID_PAYLOAD");
    // Persist before acknowledging: crashes cannot silently lose receipts.
    await enqueue("EMAIL_INGEST", `resend:${parsed.data.data.email_id}`, parsed.data.data);
    return Response.json({ accepted: true });
  } catch (error) { return errorResponse(error); }
}
