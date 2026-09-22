"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import type { ColumnDef } from "@tanstack/react-table";
import type { Candidate } from "@/lib/reconciliation/core";
import { useSelection } from "@/lib/store/selection";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { dismissSuggestion, flagMissingReceipt, matchRecords, reconcileNow } from "@/app/(dashboard)/dashboard/[orgSlug]/reconcile/actions";

export type WorkbenchRow = { id: string; date: string; name: string; amount: string; currency: string; status: string; category?: string };
function Badge({ value }: { value: string }) { return <span className={`rounded px-2 py-1 text-xs ${value === "RECONCILED" || value === "MATCHED" ? "bg-green-100 text-green-900" : value === "SUGGESTED" || value === "FLAGGED" ? "bg-yellow-100 text-yellow-900" : "bg-red-100 text-red-900"}`}>{value}</span>; }
const columns: ColumnDef<WorkbenchRow>[] = [{ accessorKey: "date", header: "Date" }, { accessorKey: "name", header: "Payee / vendor" }, { accessorKey: "amount", header: "Amount", cell: ({ row }) => `${row.original.currency} ${row.original.amount}` }, { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge value={row.original.status} /> }];
const receiptColumns: ColumnDef<WorkbenchRow>[] = [...columns.slice(0, 3), { accessorKey: "category", header: "Category" }, columns[3]];
export function ReconciliationCockpit({ orgSlug, transactions, receipts, suggestions }: { orgSlug: string; transactions: WorkbenchRow[]; receipts: WorkbenchRow[]; suggestions: Candidate[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [bankStatus, setBankStatus] = useQueryState("bankStatus", parseAsString.withDefault("ALL"));
  const [receiptStatus, setReceiptStatus] = useQueryState("receiptStatus", parseAsString.withDefault("ALL"));
  const state = useSelection();
  const selected = state.selections[orgSlug] ?? {};
  const selectedSuggestion = suggestions.find(pair => pair.bankTransactionId === selected.bankTransactionId && (!selected.receiptId || pair.receiptId === selected.receiptId));
  const action = (fn: () => Promise<{ error?: string }>, success: string) => startTransition(async () => {
    try { const result = await fn(); setMessage(result.error ?? success); if (!result.error) state.clear(orgSlug); router.refresh(); }
    catch { setMessage("The action failed. Refresh and try again."); }
  });
  return <div className="space-y-5"><Button disabled={pending} onClick={() => startTransition(async () => { const result = await reconcileNow(orgSlug); setMessage("error" in result ? result.error ?? "Reconciliation failed." : `${result.exactMatches} exact matches; ${result.suggestions} suggestions.`); router.refresh(); })}>Run reconciliation</Button>
    {message && <p role="status" className="rounded border p-3">{message}</p>}
    <div className="grid gap-5 xl:grid-cols-2">{(["bank", "receipt"] as const).map(side => {
      const bank = side === "bank", filter = bank ? bankStatus : receiptStatus, rows = bank ? transactions : receipts;
      return <section key={side} className="min-w-0 space-y-3 rounded border p-3"><h3 className="text-lg font-semibold">{bank ? "Bank transactions" : "Receipts vault"}</h3><label>Status <select className="rounded border p-2" value={filter} onChange={event => void (bank ? setBankStatus : setReceiptStatus)(event.target.value)}>{["ALL", ...(bank ? ["RECONCILED", "MISSING_RECEIPT", "SUGGESTED"] : ["MATCHED", "UNMATCHED", "FLAGGED", "PROCESSING"])].map(status => <option key={status}>{status}</option>)}</select></label><DataTable rows={rows.filter(row => filter === "ALL" || row.status === filter)} columns={bank ? columns : receiptColumns} selectedId={bank ? selected.bankTransactionId : selected.receiptId} onSelect={row => state.select(orgSlug, bank ? { bankTransactionId: row.id } : { receiptId: row.id })} /></section>;
    })}</div>
    <div className="flex flex-wrap items-center gap-3"><label>Match notes<input className="ml-2 rounded border p-2" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label>{selectedSuggestion && <Button disabled={pending} onClick={() => action(() => matchRecords(orgSlug, selectedSuggestion.receiptId, selectedSuggestion.bankTransactionId, false), "Suggestion confirmed.")}>Confirm match</Button>}{selected.receiptId && selected.bankTransactionId && <Button disabled={pending} onClick={() => action(() => matchRecords(orgSlug, selected.receiptId!, selected.bankTransactionId!, true, notes), "Manual match saved.")}>Manual match</Button>}{selected.bankTransactionId && <Button variant="outline" disabled={pending} onClick={() => action(() => flagMissingReceipt(orgSlug, selected.bankTransactionId!), "Flagged as missing receipt.")}>Flag as missing receipt</Button>}<Button variant="outline" onClick={() => state.clear(orgSlug)}>Clear selection</Button></div>
    <section className="space-y-3"><h3 className="text-lg font-semibold">Suggested matches ({suggestions.length})</h3>{!suggestions.length && <p>No suggestions to review.</p>}{suggestions.slice(0, 100).map(pair => <div key={`${pair.receiptId}:${pair.bankTransactionId}`} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"><div><p>{transactions.find(row => row.id === pair.bankTransactionId)?.name ?? "Bank transaction"} ↔ {receipts.find(row => row.id === pair.receiptId)?.name ?? "Receipt"}</p><p className="text-sm">Amount difference {pair.amountDifference}; date difference {pair.dateDifference} days; vendor score {Math.round(pair.confidenceScore * 100)}%</p></div><div className="flex gap-2"><Button disabled={pending} onClick={() => action(() => matchRecords(orgSlug, pair.receiptId, pair.bankTransactionId, false), "Suggestion confirmed.")}>Confirm</Button><Button variant="outline" disabled={pending} onClick={() => action(() => dismissSuggestion(orgSlug, pair.receiptId, pair.bankTransactionId), "Suggestion dismissed.")}>Dismiss</Button></div></div>)}{suggestions.length > 100 && <p>Showing the first 100 suggestions. Review these to reveal more.</p>}</section>
  </div>;
}
