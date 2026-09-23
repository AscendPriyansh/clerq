jest.mock("@/lib/auth", () => ({ requireMembership: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { bankTransaction: { findMany: jest.fn() }, receipt: { findMany: jest.fn() } } }));
jest.mock("@/lib/reconciliation/matcher", () => ({ getSuggestions: jest.fn() }));
jest.mock("@/components/reconciliation-cockpit", () => ({ ReconciliationCockpit: () => null }));
jest.mock("@/components/page-links", () => ({ PageLinks: () => null }));
import Reconcile from "@/app/(dashboard)/dashboard/[orgSlug]/reconcile/page";
import { requireMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSuggestions } from "@/lib/reconciliation/matcher";
beforeEach(() => {
  jest.resetAllMocks();
  (requireMembership as jest.Mock).mockResolvedValue({ organization: { id: "org" } });
  (getSuggestions as jest.Mock).mockResolvedValue([{ bankTransactionId: "bank", receiptId: "receipt" }]);
  (prisma.bankTransaction.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.receipt.findMany as jest.Mock).mockResolvedValue([]);
});
test("reconciliation applies tenant, status and pagination in the database", async () => {
  await Reconcile({ params: Promise.resolve({ orgSlug: "test" }), searchParams: Promise.resolve({ bankPage: "2", receiptPage: "3", bankStatus: "SUGGESTED", receiptStatus: "FLAGGED" }) });
  expect(prisma.bankTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org", type: "DEBIT", isReconciled: false, id: { in: ["bank"] } }, skip: 50, take: 51 }));
  expect(prisma.receipt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org", status: "FLAGGED" }, skip: 100, take: 51 }));
  expect(getSuggestions).toHaveBeenCalledWith("org");
});
test("missing receipt filter excludes suggested and reconciled transactions", async () => {
  await Reconcile({ params: Promise.resolve({ orgSlug: "test" }), searchParams: Promise.resolve({ bankStatus: "MISSING_RECEIPT" }) });
  expect(prisma.bankTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org", type: "DEBIT", isReconciled: false, id: { notIn: ["bank"] } }, take: 51 }));
});
