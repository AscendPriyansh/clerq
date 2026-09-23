import JSZip from "jszip";
import Papa from "papaparse";
import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, errorResponse } from "@/lib/errors";
import { downloadReceipt } from "@/lib/receipts/service";
import { MIME_EXTENSIONS } from "@/lib/files";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const { organization } = await requireMembership(search.get("orgSlug") ?? "");
    const month = search.get("month") ?? "";
    if (!/^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(month)) throw new AppError("Choose a month in YYYY-MM format.", "INVALID_MONTH");
    const start = new Date(`${month}-01T00:00:00Z`), end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const records = await prisma.reconciliationRecord.findMany({ where: { orgId: organization.id, reconciledAt: { gte: start, lt: end } }, include: { receipt: true, bankTransaction: true }, orderBy: { reconciledAt: "asc" }, take: 201 });
    if (records.length > 200 || records.reduce((sum, record) => sum + record.receipt.fileSizeBytes, 0) > 100 * 1024 * 1024) throw new AppError("This export exceeds 200 receipts or 100 MB. A larger export requires a background export job.", "EXPORT_TOO_LARGE", 413);
    const zip = new JSZip();
    const rows: string[][] = [];
    for (const { receipt, bankTransaction, matchType } of records) {
      const vendor = (receipt.vendorName ?? "receipt").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "receipt";
      const date = receipt.transactionDate?.toISOString().slice(0, 10) ?? "undated";
      const extension = MIME_EXTENSIONS[receipt.mimeType];
      if (!extension) throw new AppError("A receipt has an unsupported file type.", "INVALID_RECEIPT");
      const filename = `${date}_${vendor}_${receipt.totalAmount?.toString() ?? "unknown"}_${receipt.id}.${extension}`;
      const reference = `receipts/${filename}`;
      zip.file(reference, await downloadReceipt(receipt.rawFileUrl, organization.id));
      rows.push([bankTransaction.transactionDate.toISOString().slice(0, 10), bankTransaction.counterpartyName, receipt.vendorName ?? "", receipt.category, receipt.totalAmount?.toString() ?? "", receipt.taxAmount?.toString() ?? "", receipt.currency, reference, matchType]);
    }
    const csv = Papa.unparse({ fields: ["Transaction Date", "Bank Payee", "Receipt Vendor", "Category", "Total Amount", "Tax Amount", "Currency", "File Reference", "Match Type"], data: rows }, { escapeFormulae: true });
    zip.file(`Reconciliation_Report_${month}.csv`, csv);
    const stream = Readable.toWeb(zip.generateNodeStream({ type: "nodebuffer", compression: "DEFLATE", streamFiles: true }) as Readable) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="clerq-taxpack-${month}.zip"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
