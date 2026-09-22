import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
export const ExtractedReceiptSchema = z.object({
  vendorName: z.string().trim().min(1).max(200),
  transactionDate: isoDate,
  totalAmount: z.number().finite().nonnegative().max(1e12),
  taxAmount: z.number().finite().nonnegative().max(1e12).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  category: z.enum(["SOFTWARE", "MEALS", "TRAVEL", "OFFICE", "CONTRACTOR", "EQUIPMENT", "OTHER"]),
  confidenceScore: z.number().min(0).max(1),
}).refine(value => value.taxAmount === null || value.taxAmount <= value.totalAmount, "Tax exceeds total");
export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;
