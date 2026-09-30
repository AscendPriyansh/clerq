"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { ChevronDown, ExternalLink, FileText, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryReceipt, saveReceiptReview } from "@/app/(dashboard)/dashboard/[orgSlug]/receipts/actions";

export type ReceiptRow = { id: string; source: string; vendorName: string | null; date: string; amount: string; taxAmount: string; currency: string; category: string; status: string; confidenceScore: number; createdAt: string; notes: string | null; processingStatus?: string; processingAttempts?: number };

const statusDetails: Record<string, { label: string; tone: string }> = {
  MATCHED: { label: "Matched", tone: "receipt-badge-matched" },
  UNMATCHED: { label: "Unmatched", tone: "receipt-badge-unmatched" },
  FLAGGED: { label: "Flagged", tone: "receipt-badge-flagged" },
  PROCESSING: { label: "Processing", tone: "receipt-badge-processing" },
  PARSED: { label: "Ready to review", tone: "receipt-badge-ready" },
};

function displayStatus(row: ReceiptRow) {
  if (row.status === "PROCESSING") {
    if (row.processingStatus === "RUNNING") return "Reading receipt";
    if ((row.processingAttempts ?? 0) > 0) return "Waiting to retry";
    return "Queued for extraction";
  }
  return statusDetails[row.status]?.label ?? row.status;
}

export function ReceiptsVault({ orgSlug, receipts }: { orgSlug: string; receipts: ReceiptRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "neutral">("neutral");
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshing, refresh] = useTransition();
  const processing = receipts.some(row => row.status === "PROCESSING");

  useEffect(() => {
    if (!processing || pending || refreshing || progress !== null) return;
    const interval = setInterval(() => {
      const editing = document.activeElement?.closest("form") || document.querySelector("details[open]");
      if (document.visibilityState === "visible" && !editing) refresh(() => router.refresh());
    }, 10000);
    return () => clearInterval(interval);
  }, [processing, pending, refreshing, progress, router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 10,
    disabled: progress !== null || pending,
    onDropRejected: () => { setMessageTone("error"); setMessage("Choose up to 10 PDF or image files, each no larger than 10 MB."); },
    onDrop: async files => {
      if (!files.length) return;
      setProgress(0);
      for (const file of files) {
        setProgress(0); setMessageTone("neutral"); setMessage(`Uploading ${file.name}…`);
        try {
          const prepare = await fetch("/api/receipts/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgSlug, mimeType: file.type, size: file.size }) });
          const upload = await prepare.json();
          if (!prepare.ok) throw new Error(upload.error || "Unable to prepare upload.");
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", upload.signedUrl); xhr.timeout = 120000; xhr.setRequestHeader("Content-Type", file.type);
            xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
            xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
            xhr.ontimeout = () => reject(new Error("Upload timed out."));
            xhr.onload = () => { try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 400) reject(new Error(data.error || "Upload failed.")); else resolve(); } catch { reject(new Error("Unexpected upload response.")); } };
            xhr.send(file);
          });
          const complete = await fetch("/api/receipts/upload/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgSlug, path: upload.path, mimeType: file.type }) });
          const result = await complete.json();
          if (!complete.ok) throw new Error(result.error || "Unable to save receipt.");
          setMessageTone("success");
          setMessage(`${file.name} saved. Extraction will appear below when ready.`);
        } catch (error) { setMessageTone("error"); setMessage(error instanceof Error ? error.message : "Upload failed."); break; }
      }
      setProgress(null); refresh(() => router.refresh());
    },
  });

  return <section className="receipts-vault">
    <div {...getRootProps()} className={`receipt-upload-zone ${isDragActive ? "receipt-upload-active" : ""}`}>
      <input {...getInputProps()} aria-label="Choose receipt files" />
      <span className="receipt-upload-icon"><UploadCloud size={21} /></span>
      <div><h2>{isDragActive ? "Drop receipts to upload" : "Upload your receipts"}</h2><p>Drag and drop files here, or <span>choose from your device</span></p><small>PDF, scanned PDF, PNG, JPEG or WebP · up to 10 files · 10 MB each</small></div>
    </div>
    {progress !== null && <div className="receipt-progress-wrap" role="status"><div className="receipt-progress-heading"><span>Uploading receipt</span><strong>{progress}%</strong></div><progress aria-label="Receipt upload progress" className="receipt-progress" max={100} value={progress}>{progress}%</progress></div>}
    {message && <p role={messageTone === "error" ? "alert" : "status"} className={`receipt-feedback ${`receipt-feedback-${messageTone}`}`}>{message}</p>}
    {pending && <p role="status" className="receipt-feedback receipt-feedback-neutral">Saving your changes…</p>}
    {processing && <div className="receipt-processing-note"><RefreshCw size={14} /><span>Receipts are queued or processing. This view refreshes automatically.</span></div>}

    <div className="receipt-table-heading"><div><p className="workspace-eyebrow">RECEIPT VAULT</p><h2>{receipts.length ? "Recent receipts" : "No receipts yet"}</h2></div><span className="receipt-count">{receipts.length} on this page</span></div>
    {receipts.length ? <div className="receipt-table-wrap"><table className="receipt-table"><thead><tr>{["Source", "Vendor", "Date", "Amount / currency", "Status", "Confidence", "Created", "Review"].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{receipts.map(row => {
      const status = statusDetails[row.status] ?? { label: row.status, tone: "receipt-badge-neutral" };
      return <tr key={row.id}>
        <td><span className="receipt-source"><FileText size={14} />{row.source.replace("WEB_UPLOAD", "Web upload")}</span></td>
        <td><strong className="receipt-vendor">{row.vendorName ?? "Awaiting extraction"}</strong>{row.notes && <span className="receipt-note">{row.notes}</span>}</td>
        <td>{row.date || <span className="receipt-muted">Pending</span>}</td>
        <td>{row.amount ? <><strong>{row.currency} {row.amount}</strong>{row.taxAmount && <span className="receipt-note">Tax {row.currency} {row.taxAmount}</span>}</> : <span className="receipt-muted">Pending</span>}</td>
        <td><span className={`receipt-status-badge ${status.tone}`}><span className="receipt-status-dot" />{status.label}</span>{row.status === "PROCESSING" && <span className="receipt-note">{displayStatus(row)}{(row.processingAttempts ?? 0) > 0 ? ` · Attempt ${row.processingAttempts} of 5` : ""}</span>}</td>
        <td><span className="receipt-confidence"><span className="receipt-confidence-bar"><span style={{ width: `${Math.round(row.confidenceScore * 100)}%` }} /></span>{row.status === "PROCESSING" ? "Pending" : `${Math.round(row.confidenceScore * 100)}%`}</span></td>
        <td className="receipt-muted">{row.createdAt}</td>
        <td><details className="receipt-review"><summary>Open <ChevronDown size={13} /></summary><div className="receipt-review-panel"><a href={`/api/receipts/${row.id}?orgSlug=${encodeURIComponent(orgSlug)}`} target="_blank" rel="noreferrer" className="receipt-original-link">View original file <ExternalLink size={13} /></a>{row.notes && <p className="receipt-review-note">{row.notes}</p>}{row.status !== "MATCHED" && <form className="receipt-review-form" action={form => startTransition(async () => { try { const result = await saveReceiptReview(orgSlug, row.id, form); setMessageTone("error" in result ? "error" : "success"); setMessage("error" in result ? result.error ?? "Save failed." : "Receipt reviewed and saved."); } catch { setMessageTone("error"); setMessage("Unable to save the receipt. Check your connection and try again."); } })}>
          <p className="workspace-eyebrow">REVIEW RECEIPT</p>
          <label>Vendor<input required name="vendorName" defaultValue={row.vendorName ?? ""} /></label>
          <div className="receipt-form-grid"><label>Date<input required name="transactionDate" type="date" defaultValue={row.date} /></label><label>Total<input required name="totalAmount" type="number" min="0" step="0.0001" defaultValue={row.amount} /></label></div>
          <div className="receipt-form-grid"><label>Tax<input name="taxAmount" type="number" min="0" step="0.0001" defaultValue={row.taxAmount} /></label><label>Currency<input required name="currency" maxLength={3} pattern="[A-Za-z]{3}" defaultValue={row.currency} /></label></div>
          <label>Category<select name="category" defaultValue={row.category}>{["SOFTWARE", "MEALS", "TRAVEL", "OFFICE", "CONTRACTOR", "EQUIPMENT", "OTHER"].map(category => <option key={category}>{category}</option>)}</select></label>
          <Button disabled={pending} type="submit" className="receipt-save-button">Save reviewed data</Button>
        </form>}{row.status === "FLAGGED" && <Button variant="outline" disabled={pending} className="receipt-retry-button" onClick={() => startTransition(async () => { try { const result = await retryReceipt(orgSlug, row.id); setMessageTone("error" in result ? "error" : "success"); setMessage("error" in result ? result.error ?? "Retry failed." : "Extraction queued again."); } catch { setMessageTone("error"); setMessage("Unable to queue extraction. Check your connection and try again."); } })}><RefreshCw size={14} /> Retry extraction</Button>}</div></details></td>
      </tr>;
    })}</tbody></table></div> : <div className="receipt-empty-state"><span className="receipt-upload-icon"><FileText size={20} /></span><h3>Your receipt vault is empty</h3><p>Upload a receipt above to start building your month-end record.</p></div>}
  </section>;
}
