"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseStatement } from "@/lib/parser/statement";
import { type ColumnMap } from "@/lib/parser/csv-mapper";
import { AppError } from "@/lib/errors";
import { dispatchPendingJobs } from "@/lib/jobs/dispatch";

export async function importBankStatementCSV(form: FormData, orgSlug: string) {
  try {
    const { organization } = await requireMembership(orgSlug);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || file.size > 4 * 1024 * 1024) throw new AppError("Choose a CSV file no larger than 4 MB.", "INVALID_CSV");
    const mapping: ColumnMap = { dateCol: String(form.get("dateCol") || "") || null, descriptionCol: String(form.get("descriptionCol") || "") || null, amountCol: String(form.get("amountCol") || "") || null, creditCol: String(form.get("creditCol") || "") || null };
    let parsed;
    try { parsed = parseStatement(await file.text(), mapping, { dateOrder: form.get("dateOrder") === "MDY" ? "MDY" : "DMY", currency: String(form.get("currency") || organization.baseCurrency).toUpperCase(), negativeIsCredit: form.get("negativeIsCredit") !== "false" }); }
    catch (error) { throw new AppError(error instanceof Error ? error.message : "Invalid CSV.", "INVALID_CSV"); }
    let imported = 0;
    await prisma.$transaction(async tx => {
      for (let offset = 0; offset < parsed.rows.length; offset += 500) {
        const result = await tx.bankTransaction.createMany({ data: parsed.rows.slice(offset, offset + 500).map(row => ({ ...row, orgId: organization.id })), skipDuplicates: true });
        imported += result.count;
      }
      if (imported) await tx.ingestionJob.create({ data: { type: "RECONCILE", key: `csv:${randomUUID()}`, payload: { orgId: organization.id } } });
    }, { timeout: 60000 });
    await dispatchPendingJobs(organization.id);
    revalidatePath(`/dashboard/${orgSlug}`);
    return { imported, skipped: parsed.rows.length - imported, invalid: parsed.errors.length, errors: parsed.errors.slice(0, 20) };
  } catch (error) { return { error: error instanceof AppError ? error.message : "CSV import failed. Please try again." }; }
}
