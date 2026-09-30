"use client";
import { useState, useTransition, type ReactNode } from "react";
import { parseAsString, parseAsInteger, useQueryStates } from "nuqs";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Check, CircleAlert, Flag, Link2, Play, RotateCcw, X } from "lucide-react";
import type { Candidate } from "@/lib/reconciliation/core";
import { useSelection } from "@/lib/store/selection";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { dismissSuggestion, flagMissingReceipt, matchRecords, reconcileNow } from "@/app/(dashboard)/dashboard/[orgSlug]/reconcile/actions";

export type WorkbenchRow = { id: string; date: string; name: string; amount: string; currency: string; status: string; category?: string };
function Badge({ value }: { value: string }) {
  const tone = value === "RECONCILED" || value === "MATCHED" ? "reconcile-badge-positive" : value === "SUGGESTED" || value === "FLAGGED" ? "reconcile-badge-warning" : value === "PROCESSING" ? "reconcile-badge-processing" : "reconcile-badge-neutral";
  return <span className={`reconcile-badge ${tone}`}><span />{value.replaceAll("_", " ")}</span>;
}
const columns: ColumnDef<WorkbenchRow>[] = [{ accessorKey: "date", header: "Date" }, { accessorKey: "name", header: "Payee / vendor" }, { accessorKey: "amount", header: "Amount", cell: ({ row }) => `${row.original.currency} ${row.original.amount}` }, { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge value={row.original.status} /> }];
const receiptColumns: ColumnDef<WorkbenchRow>[] = [...columns.slice(0, 3), { accessorKey: "category", header: "Category" }, columns[3]];
export function ReconciliationCockpit({ orgSlug, transactions, receipts, suggestions, suggestionCount, bankPagination, receiptPagination, suggestionPagination }: { orgSlug: string; transactions: WorkbenchRow[]; receipts: WorkbenchRow[]; suggestions: (Candidate & { bankName: string; receiptName: string })[]; suggestionCount: number; bankPagination: ReactNode; receiptPagination: ReactNode; suggestionPagination: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [notes, setNotes] = useState("");
  const [{ bankStatus, receiptStatus }, setFilters] = useQueryStates({ bankStatus: parseAsString.withDefault("ALL"), receiptStatus: parseAsString.withDefault("ALL"), bankPage: parseAsInteger.withDefault(1), receiptPage: parseAsInteger.withDefault(1) }, { shallow: false, startTransition });
  const state = useSelection();
  const stored = state.selections[orgSlug] ?? {};
  const selected = {
    bankTransactionId: transactions.some(row => row.id === stored.bankTransactionId) ? stored.bankTransactionId : undefined,
    receiptId: receipts.some(row => row.id === stored.receiptId) ? stored.receiptId : undefined,
  };
  const selectedSuggestion = suggestions.find(pair => pair.bankTransactionId === selected.bankTransactionId && (!selected.receiptId || pair.receiptId === selected.receiptId));
  const action = (fn: () => Promise<{ error?: string }>, success: string) => startTransition(async () => {
    setMessage("");
    setFailed(false);
    try { const result = await fn(); setFailed(Boolean(result.error)); setMessage(result.error ?? success); if (!result.error) state.clear(orgSlug); }
    catch { setFailed(true); setMessage("The action failed. Refresh and try again."); }
  });
  return <div className="reconcile-cockpit" aria-busy={pending}>
    <div className="reconcile-toolbar"><div><p className="workspace-eyebrow">MATCHING WORKSPACE</p><h1>Reconcile</h1><p className="workspace-subtitle">Compare payments with receipts, then confirm what belongs together.</p></div><Button disabled={pending} className="reconcile-primary-action" onClick={() => startTransition(async () => { setMessage(""); setFailed(false); try { const result = await reconcileNow(orgSlug); setFailed("error" in result); setMessage("error" in result ? result.error ?? "Reconciliation failed." : `${result.exactMatches} exact matches; ${result.suggestions} suggestions.`); } catch { setFailed(true); setMessage("Reconciliation failed. Try again."); } })}><Play size={14} /> Run reconciliation</Button></div>
    {pending && <p role="status" className="reconcile-feedback reconcile-feedback-neutral"><RotateCcw size={14} />Updating reconciliation…</p>}
    {message && !pending && <p role={failed ? "alert" : "status"} className={`reconcile-feedback ${failed ? "reconcile-feedback-error" : "reconcile-feedback-success"}`}>{message}</p>}
    <div className="reconcile-workbench-grid">{(["bank", "receipt"] as const).map(side => {
      const bank = side === "bank", filter = bank ? bankStatus : receiptStatus, rows = bank ? transactions : receipts;
      const options = ["ALL", ...(bank ? ["RECONCILED", "MISSING_RECEIPT", "SUGGESTED"] : ["MATCHED", "UNMATCHED", "FLAGGED", "PROCESSING"])];
      return <section key={side} className="reconcile-panel"><div className="reconcile-panel-heading"><div><p className="workspace-eyebrow">{bank ? "BANK SIDE" : "RECEIPT SIDE"}</p><h2>{bank ? "Bank transactions" : "Receipts vault"}</h2></div><span className="reconcile-panel-count">{rows.length} visible</span></div><div className="reconcile-filter-row"><label>{bank ? "Bank status" : "Receipt status"}<select aria-label={bank ? "Bank status" : "Receipt status"} value={filter} disabled={pending} onChange={event => { state.clear(orgSlug); void setFilters(bank ? { bankStatus: event.target.value, bankPage: 1 } : { receiptStatus: event.target.value, receiptPage: 1 }); }}>{options.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><span className="reconcile-select-hint">Select one row</span></div><DataTable serverPaginated rows={rows} columns={bank ? columns : receiptColumns} selectedId={bank ? selected.bankTransactionId : selected.receiptId} onSelect={row => state.select(orgSlug, bank ? { bankTransactionId: row.id } : { receiptId: row.id })} />{bank ? bankPagination : receiptPagination}</section>;
    })}</div>
    <section className="reconcile-action-panel"><div className="reconcile-action-heading"><div><p className="workspace-eyebrow">SELECTION</p><h2>{selected.bankTransactionId || selected.receiptId ? "Review your selection" : "Choose a bank transaction and receipt"}</h2></div><Link2 size={18} className="reconcile-action-icon" /></div><div className="reconcile-action-body"><label className="reconcile-notes-field"><span>Match notes <small>optional</small></span><input maxLength={2000} placeholder="Add context for this match" value={notes} onChange={event => setNotes(event.target.value)} /></label><div className="reconcile-action-buttons">{selectedSuggestion && <Button disabled={pending} className="reconcile-primary-action" onClick={() => action(() => matchRecords(orgSlug, selectedSuggestion.receiptId, selectedSuggestion.bankTransactionId, false), "Suggestion confirmed.")}><Check size={14} /> Confirm match</Button>}{selected.receiptId && selected.bankTransactionId && <Button disabled={pending} className="reconcile-primary-action" onClick={() => action(() => matchRecords(orgSlug, selected.receiptId!, selected.bankTransactionId!, true, notes), "Manual match saved.")}><Link2 size={14} /> Manual match</Button>}{selected.bankTransactionId && <Button variant="outline" disabled={pending} className="reconcile-secondary-action" onClick={() => action(() => flagMissingReceipt(orgSlug, selected.bankTransactionId!), "Flagged as missing receipt.")}><Flag size={14} /> Flag missing receipt</Button>}<Button variant="outline" disabled={pending} className="reconcile-secondary-action" onClick={() => state.clear(orgSlug)}><X size={14} /> Clear selection</Button></div></div></section>
    <section className="reconcile-suggestions"><div className="reconcile-suggestions-heading"><div><p className="workspace-eyebrow">NEEDS CONFIRMATION</p><h2>Suggested matches <span>({suggestionCount})</span></h2></div><span className="reconcile-suggestion-note"><CircleAlert size={13} /> Suggestions need your review</span></div>{!suggestions.length && <div className="reconcile-empty-suggestions">No suggestions to review.</div>}{suggestions.map(pair => <div key={`${pair.receiptId}:${pair.bankTransactionId}`} className="reconcile-suggestion-card"><div className="reconcile-suggestion-main"><div className="reconcile-suggestion-icon"><Link2 size={16} /></div><div><p><strong>{pair.bankName}</strong><ArrowRight size={13} /><strong>{pair.receiptName}</strong></p><span>Amount difference {pair.amountDifference} · Date difference {pair.dateDifference} days · Vendor score {Math.round(pair.confidenceScore * 100)}%</span></div></div><div className="reconcile-suggestion-actions"><Button disabled={pending} className="reconcile-primary-action" onClick={() => action(() => matchRecords(orgSlug, pair.receiptId, pair.bankTransactionId, false), "Suggestion confirmed.")}><Check size={14} /> Confirm</Button><Button variant="outline" disabled={pending} className="reconcile-secondary-action" onClick={() => action(() => dismissSuggestion(orgSlug, pair.receiptId, pair.bankTransactionId), "Suggestion dismissed.")}><X size={14} /> Dismiss</Button></div></div>)}{suggestionPagination}</section>
  </div>;
}
