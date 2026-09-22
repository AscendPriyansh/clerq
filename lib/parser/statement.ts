import Papa from "papaparse";
import { createHash } from "node:crypto";
import { cleanCounterpartyName, parseDate, parseMoney, type ColumnMap } from "./csv-mapper";

export function parseStatement(text: string, mapping: ColumnMap, options: { dateOrder: "DMY" | "MDY"; currency: string; negativeIsCredit: boolean }) {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: value => value.trim() });
  if (parsed.errors.length) throw new Error(`CSV format error near row ${(parsed.errors[0].row ?? 0) + 2}.`);
  if (!parsed.data.length || parsed.data.length > 10000) throw new Error("Choose a CSV with between 1 and 10,000 rows.");
  const columns = Object.values(mapping).filter((value): value is string => !!value);
  if (!mapping.dateCol || !mapping.descriptionCol || !mapping.amountCol || new Set(columns).size !== columns.length || columns.some(column => !parsed.meta.fields?.includes(column))) throw new Error("Select distinct date, description and amount columns.");
  if (!/^[A-Z]{3}$/.test(options.currency)) throw new Error("Choose a three-letter currency code.");
  const occurrences = new Map<string, number>();
  const rows = [];
  const errors: { row: number; error: string }[] = [];
  for (const [index, row] of parsed.data.entries()) {
    try {
      const transactionDate = parseDate(row[mapping.dateCol] ?? "", options.dateOrder);
      const rawDescription = (row[mapping.descriptionCol] ?? "").trim();
      if (!rawDescription || rawDescription.length > 2000) throw new Error("Description is missing or too long.");
      const debit = parseMoney(row[mapping.amountCol] ?? "");
      const credit = mapping.creditCol ? parseMoney(row[mapping.creditCol] ?? "") : null;
      let type: "DEBIT" | "CREDIT", amount: string;
      if (mapping.creditCol) {
        if (debit?.negative || credit?.negative) throw new Error("Separate debit and credit columns must contain positive amounts.");
        if (Number(debit?.amount ?? 0) > 0 && Number(credit?.amount ?? 0) > 0) throw new Error("Both debit and credit are populated.");
        type = Number(credit?.amount ?? 0) > 0 ? "CREDIT" : "DEBIT";
        amount = type === "CREDIT" ? credit!.amount : debit?.amount ?? "0";
      } else {
        if (!debit) throw new Error("Amount is missing.");
        type = debit.negative === options.negativeIsCredit ? "CREDIT" : "DEBIT";
        amount = debit.amount;
      }
      if (Number(amount) === 0) throw new Error("Zero-value row.");
      const canonicalAmount = amount.replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
      const canonical = JSON.stringify([transactionDate.toISOString().slice(0, 10), rawDescription, canonicalAmount, type, options.currency]);
      const occurrence = (occurrences.get(canonical) ?? 0) + 1;
      occurrences.set(canonical, occurrence);
      const importKey = createHash("sha256").update(`${canonical}:${occurrence}`).digest("hex");
      rows.push({ transactionDate, rawDescription, counterpartyName: cleanCounterpartyName(rawDescription) || rawDescription, amount, type, currency: options.currency, importKey });
    } catch (error) { errors.push({ row: index + 2, error: error instanceof Error ? error.message : "Invalid row." }); }
  }
  return { rows, errors, total: parsed.data.length };
}
