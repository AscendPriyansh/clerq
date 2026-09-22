import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadReceipt } from "@/lib/receipts/service";
import { AppError, errorResponse } from "@/lib/errors";
import { MIME_EXTENSIONS } from "@/lib/files";

export async function GET(request: Request, context: { params: Promise<{ receiptId: string }> }) {
  try {
    const { organization } = await requireMembership(new URL(request.url).searchParams.get("orgSlug") ?? "");
    const { receiptId } = await context.params;
    const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, orgId: organization.id } });
    if (!receipt) throw new AppError("Receipt not found.", "NOT_FOUND", 404);
    const buffer = await downloadReceipt(receipt.rawFileUrl, organization.id);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": receipt.mimeType, "Content-Disposition": `inline; filename="receipt-${receipt.id}.${MIME_EXTENSIONS[receipt.mimeType] || "bin"}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
  } catch (error) { return errorResponse(error); }
}
