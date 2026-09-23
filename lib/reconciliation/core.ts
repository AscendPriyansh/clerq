import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal | string | number;
export type MatchReceipt = { id: string; vendorName: string | null; transactionDate: Date | null; totalAmount: Money | null; currency: string; confidenceScore: number };
export type MatchTransaction = { id: string; counterpartyName: string; transactionDate: Date; amount: Money; currency: string };
export type Candidate = { receiptId: string; bankTransactionId: string; confidenceScore: number; reasons: string[]; amountDifference: string; dateDifference: number };

export function normalizeVendorName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\b(?:the|inc|llc|co|ltd)\b/g, " ").replace(/\s+/g, " ").trim();
}
export function jaroWinklerSimilarity(left: string, right: string): number {
  const a = normalizeVendorName(left), b = normalizeVendorName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = Array(a.length).fill(false), bMatches = Array(b.length).fill(false);
  let matches = 0, transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - distance); j < Math.min(b.length, i + distance + 1); j++) {
      if (!bMatches[j] && a[i] === b[j]) { aMatches[i] = true; bMatches[j] = true; matches++; break; }
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro > 0.7 ? jaro + prefix * 0.1 * (1 - jaro) : jaro;
}
export function daysBetween(a: Date, b: Date) { return Math.abs(a.getTime() - b.getTime()) / 86400000; }
export function comparePair(receipt: MatchReceipt, transaction: MatchTransaction) {
  if (!receipt.vendorName || !receipt.transactionDate || receipt.totalAmount === null || receipt.currency !== transaction.currency) return null;
  const difference = new Prisma.Decimal(receipt.totalAmount).sub(transaction.amount).abs();
  const days = daysBetween(receipt.transactionDate, transaction.transactionDate);
  const similarity = jaroWinklerSimilarity(receipt.vendorName, transaction.counterpartyName);
  if (difference.gt("0.02") || days > 5 || similarity <= 0.75) return null;
  const exact = difference.isZero() && days <= 3 && similarity >= 0.95 && receipt.confidenceScore >= 0.85;
  return { exact, receiptId: receipt.id, bankTransactionId: transaction.id, confidenceScore: exact ? 1 : similarity,
    reasons: [difference.isZero() ? "Amount matches" : `Amount differs by ${difference.toFixed(4)}`, `Date difference: ${days} days`, `Vendor similarity: ${similarity.toFixed(2)}`],
    amountDifference: difference.toFixed(4), dateDifference: days,
  };
}

export function planMatches(receipts: MatchReceipt[], transactions: MatchTransaction[], dismissed = new Set<string>()) {
  // Index by currency and minor-unit bucket rather than a full Cartesian scan.
  const buckets = new Map<string, MatchTransaction[]>();
  for (const transaction of transactions) {
    const key = `${transaction.currency}:${new Prisma.Decimal(transaction.amount).mul(100).floor().toFixed(0)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(transaction);
    else buckets.set(key, [transaction]);
  }
  const candidates: NonNullable<ReturnType<typeof comparePair>>[] = [];
  for (const receipt of receipts) {
    if (receipt.totalAmount === null) continue;
    const bucket = new Prisma.Decimal(receipt.totalAmount).mul(100).floor().toNumber();
    for (let offset = -3; offset <= 3; offset++) {
      for (const transaction of buckets.get(`${receipt.currency}:${bucket + offset}`) ?? []) {
        if (dismissed.has(`${receipt.id}:${transaction.id}`)) continue;
        const candidate = comparePair(receipt, transaction);
        if (candidate) candidates.push(candidate);
      }
    }
  }
  const exactCandidates = candidates.filter(pair => pair.exact);
  const receiptCounts = new Map<string, number>(), transactionCounts = new Map<string, number>();
  for (const pair of exactCandidates) {
    receiptCounts.set(pair.receiptId, (receiptCounts.get(pair.receiptId) ?? 0) + 1);
    transactionCounts.set(pair.bankTransactionId, (transactionCounts.get(pair.bankTransactionId) ?? 0) + 1);
  }
  // An ambiguous exact pair requires review instead of arbitrary first-match wins.
  const exact = exactCandidates.filter(pair => receiptCounts.get(pair.receiptId) === 1 && transactionCounts.get(pair.bankTransactionId) === 1);
  const usedReceipts = new Set(exact.map(pair => pair.receiptId)), usedTransactions = new Set(exact.map(pair => pair.bankTransactionId));
  const suggestions = candidates.filter(pair => !usedReceipts.has(pair.receiptId) && !usedTransactions.has(pair.bankTransactionId))
    .sort((a, b) => b.confidenceScore - a.confidenceScore || a.dateDifference - b.dateDifference || a.receiptId.localeCompare(b.receiptId));
  return { exact, suggestions, unmatchedTransactions: transactions.length - usedTransactions.size, unmatchedReceipts: receipts.length - usedReceipts.size };
}
