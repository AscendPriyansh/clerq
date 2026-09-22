export type ColumnMap = { dateCol: string | null; descriptionCol: string | null; amountCol: string | null; creditCol: string | null };
const aliases = {
  dateCol: ["date", "posting date", "txn date", "transaction date", "value date"],
  descriptionCol: ["description", "narration", "payee", "details", "particulars", "memo"],
  amountCol: ["amount", "debit", "outflow", "withdrawal", "dr"],
  creditCol: ["credit", "inflow", "deposit", "cr"],
};

export function detectColumns(headers: string[]): ColumnMap {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const result: ColumnMap = { dateCol: null, descriptionCol: null, amountCol: null, creditCol: null };
  for (const key of Object.keys(aliases) as (keyof ColumnMap)[]) {
    const matches = headers.filter(header => aliases[key].some(alias => ` ${normalise(header)} `.includes(` ${alias} `)));
    // "Credit amount" belongs to the credit column, not the debit column.
    const filtered = key === "amountCol" ? matches.filter(header => !aliases.creditCol.some(alias => ` ${normalise(header)} `.includes(` ${alias} `))) : matches;
    result[key] = filtered.length === 1 ? filtered[0] : null;
  }
  return result;
}

export function cleanCounterpartyName(raw: string) {
  return raw.replace(/^(?:DEBIT CARD PURCHASE\s*-?\s*|POS PURCHASE\s*|ACH PAYMENT\s*)/i, "")
    .replace(/\b(?=[A-Z0-9]{8,}\b)(?=[A-Z0-9]*\d)[A-Z0-9]+\b/g, "")
    .replace(/\s+(?:LLC|INC|LTD|CO)\.?\s*$/i, "").replace(/\s+/g, " ").trim()
    .toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

export function parseDate(value: string, order: "DMY" | "MDY" = "DMY"): Date {
  const input = value.trim();
  let year: number, month: number, day: number;
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (iso) { year = +iso[1]; month = +iso[2]; day = +iso[3]; }
  else if (local) {
    year = +local[3]; const a = +local[1], b = +local[2];
    const dmy = a > 12 || (b <= 12 && order === "DMY");
    day = dmy ? a : b; month = dmy ? b : a;
  } else throw new Error("Use YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY dates.");
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("Invalid calendar date.");
  return date;
}

export function parseMoney(value: string): { amount: string; negative: boolean } | null {
  let input = value.trim();
  if (!input) return null;
  const parentheses = /^\(.*\)$/.test(input);
  if (parentheses) input = input.slice(1, -1).trim();
  input = input.replace(/^(?:USD|AUD|EUR|GBP|INR)\s*/i, "").replace(/\p{Sc}/gu, "").trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,4})?$/.test(input)) throw new Error("Invalid amount.");
  const negative = parentheses || input.startsWith("-");
  const amount = input.replace(/^[+-]/, "").replace(/,/g, "");
  if (Number(amount) > 1e12) throw new Error("Amount exceeds limit.");
  return { amount, negative };
}
