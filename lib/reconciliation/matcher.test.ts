import { comparePair, daysBetween, jaroWinklerSimilarity, normalizeVendorName, planMatches, type MatchReceipt, type MatchTransaction } from "./core";
import { parseDate } from "@/lib/parser/csv-mapper";

const receipt = (extra: Partial<MatchReceipt> = {}): MatchReceipt => ({ id: "r1", vendorName: "Stripe", totalAmount: "100", transactionDate: new Date("2026-01-02"), currency: "USD", confidenceScore: 0.99, ...extra });
const transaction = (extra: Partial<MatchTransaction> = {}): MatchTransaction => ({ id: "t1", counterpartyName: "Stripe", amount: "100", transactionDate: new Date("2026-01-02"), currency: "USD", ...extra });
test("same amount, date and vendor is an exact automatic candidate", () => expect(planMatches([receipt()], [transaction()]).exact).toHaveLength(1));
test("one cent difference and two days produces a suggestion", () => {
  const plan = planMatches([receipt()], [transaction({ amount: "100.01", transactionDate: new Date("2026-01-04"), counterpartyName: "Stripe Payments" })]);
  expect(plan.exact).toHaveLength(0); expect(plan.suggestions).toHaveLength(1);
});
test("five dollars and ten days remains unmatched", () => {
  const plan = planMatches([receipt()], [transaction({ amount: "105", transactionDate: new Date("2026-01-12") })]);
  expect(plan.exact).toHaveLength(0); expect(plan.suggestions).toHaveLength(0); expect(plan.unmatchedTransactions).toBe(1);
});
test("normalised vendor similarity", () => expect(jaroWinklerSimilarity("Stripe Inc", "STRIPE")).toBeGreaterThan(0.75));
test("unrelated abbreviation does not match", () => expect(jaroWinklerSimilarity("Amazon Web Services", "AWS")).toBeLessThan(0.75));
test("vendor normalisation removes legal suffix", () => expect(normalizeVendorName("ZOOM VIDEO COMMUNICATIONS LLC")).toBe("zoom video communications"));
test("US and Australian dates", () => { expect(parseDate("12/31/2025", "MDY").toISOString().slice(0, 10)).toBe("2025-12-31"); expect(parseDate("31/12/2025", "DMY").toISOString().slice(0, 10)).toBe("2025-12-31"); });
test("invalid calendar dates are rejected", () => expect(() => parseDate("31/02/2025")).toThrow());
test("currency mismatch is never a candidate", () => expect(comparePair(receipt(), transaction({ currency: "AUD" }))).toBeNull());
test("decimal tolerance is exact at two cents", () => { expect(comparePair(receipt(), transaction({ amount: "100.02" }))).not.toBeNull(); expect(comparePair(receipt(), transaction({ amount: "100.0201" }))).toBeNull(); });
test("low extraction confidence cannot auto-match", () => expect(planMatches([receipt({ confidenceScore: 0.3 })], [transaction()]).exact).toHaveLength(0));
test("two indistinguishable transactions require confirmation", () => { const plan = planMatches([receipt()], [transaction(), transaction({ id: "t2" })]); expect(plan.exact).toHaveLength(0); expect(plan.suggestions).toHaveLength(2); });
test("dismissed pair stays dismissed on subsequent runs", () => expect(planMatches([receipt()], [transaction()], new Set(["r1:t1"])).suggestions).toHaveLength(0));
test("empty vendors never match", () => expect(jaroWinklerSimilarity("", "")).toBe(0));
test("date distance is symmetric", () => expect(daysBetween(new Date("2026-01-05"), new Date("2026-01-02"))).toBe(3));
