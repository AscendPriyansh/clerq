"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { retryReceipt, saveReceiptReview } from "@/app/(dashboard)/dashboard/[orgSlug]/receipts/actions";

export type ReceiptRow = { id: string; source: string; vendorName: string | null; date: string; amount: string; taxAmount: string; currency: string; category: string; status: string; confidenceScore: number; createdAt: string; notes: string | null; processingStatus?: string; processingAttempts?: number };
export function ReceiptsVault({ orgSlug, receipts }: { orgSlug: string; receipts: ReceiptRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const processing = receipts.some(row => row.status === "PROCESSING");
  useEffect(() => { if (!processing) return; const interval = setInterval(() => router.refresh(), 5000); return () => clearInterval(interval); }, [processing, router]);
  const { getRootProps, getInputProps } = useDropzone({ accept: { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] }, maxSize: 10 * 1024 * 1024, maxFiles: 10, disabled: progress !== null,
    onDropRejected: () => setMessage("Choose up to 10 PDF or image files, each no larger than 10 MB."),
    onDrop: async files => {
      for (const file of files) {
        setProgress(0); setMessage(`Uploading ${file.name}…`);
        try {
          const prepare = await fetch("/api/receipts/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgSlug, mimeType: file.type, size: file.size }) });
          const upload = await prepare.json();
          if (!prepare.ok) throw new Error(upload.error || "Unable to prepare upload.");
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", upload.signedUrl); xhr.timeout = 120000;
            xhr.setRequestHeader("Content-Type", file.type);
            xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
            xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
            xhr.ontimeout = () => reject(new Error("Upload timed out."));
            xhr.onload = () => { try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 400) reject(new Error(data.error || "Upload failed.")); else resolve(); } catch { reject(new Error("Unexpected upload response.")); } };
            xhr.send(file);
          });
          const complete = await fetch("/api/receipts/upload/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgSlug, path: upload.path, mimeType: file.type }) });
          const result = await complete.json();
          if (!complete.ok) throw new Error(result.error || "Unable to save receipt.");
          setMessage(`${file.name} saved. Extraction will appear below when ready.`);
        } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); break; }
        finally { setProgress(null); router.refresh(); }
      }
    },
  });
  return <section className="space-y-4"><div {...getRootProps()} className="cursor-pointer rounded border border-dashed p-6"><input {...getInputProps()} aria-label="Choose receipt files" />Drop PDF, PNG, JPEG or WebP receipts here (10 MB per file).</div>
    {progress !== null && <progress className="w-full" max={100} value={progress}>{progress}%</progress>}{message && <p role="status">{message}</p>}
    {processing && <p className="text-sm">Receipts are queued or processing. This view refreshes automatically.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Source", "Vendor", "Date", "Amount", "Status", "Confidence", "Created", "Review"].map(title => <th key={title} className="border-b p-2">{title}</th>)}</tr></thead><tbody>{receipts.map(row => <tr key={row.id} className="border-b"><td className="p-2">{row.source}</td><td className="p-2">{row.vendorName ?? "Awaiting extraction"}</td><td className="p-2">{row.date || "—"}</td><td className="p-2">{row.amount ? `${row.currency} ${row.amount}` : "—"}</td><td className="p-2">{row.status}{row.status === "PROCESSING" && <p className="text-xs text-muted-foreground">{row.processingStatus === "RUNNING" ? "Reading receipt" : (row.processingAttempts ?? 0) > 0 ? "Waiting to retry" : "Queued"}{(row.processingAttempts ?? 0) > 0 ? ` · Attempt ${row.processingAttempts} of 5` : ""}</p>}</td><td className="p-2">{Math.round(row.confidenceScore * 100)}%</td><td className="p-2">{row.createdAt}</td><td className="p-2"><details><summary className="cursor-pointer">Open / review</summary><div className="min-w-72 space-y-3 p-3"><a className="underline" href={`/api/receipts/${row.id}?orgSlug=${encodeURIComponent(orgSlug)}`} target="_blank" rel="noreferrer">View original file</a>{row.notes && <p>{row.notes}</p>}{row.status !== "MATCHED" && <form className="space-y-2" action={form => startTransition(async () => {
      const result = await saveReceiptReview(orgSlug, row.id, form); setMessage("error" in result ? result.error ?? "Save failed." : "Receipt reviewed and saved."); router.refresh();
    })}>
      <label className="block">Vendor<input required name="vendorName" defaultValue={row.vendorName ?? ""} className="block w-full rounded border p-2" /></label>
      <label className="block">Date<input required name="transactionDate" type="date" defaultValue={row.date} className="block w-full rounded border p-2" /></label>
      <label className="block">Total<input required name="totalAmount" type="number" min="0" step="0.0001" defaultValue={row.amount} className="block w-full rounded border p-2" /></label>
      <label className="block">Tax<input name="taxAmount" type="number" min="0" step="0.0001" defaultValue={row.taxAmount} className="block w-full rounded border p-2" /></label>
      <label className="block">Currency<input required name="currency" maxLength={3} pattern="[A-Za-z]{3}" defaultValue={row.currency} className="block w-full rounded border p-2" /></label>
      <label className="block">Category<select name="category" defaultValue={row.category} className="block w-full rounded border p-2">{["SOFTWARE", "MEALS", "TRAVEL", "OFFICE", "CONTRACTOR", "EQUIPMENT", "OTHER"].map(category => <option key={category}>{category}</option>)}</select></label>
      <Button disabled={pending} type="submit">Save reviewed data</Button>
    </form>}{row.status === "FLAGGED" && <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await retryReceipt(orgSlug, row.id); setMessage("error" in result ? result.error ?? "Retry failed." : "Extraction queued again."); router.refresh(); })}>Retry extraction</Button>}</div></details></td></tr>)}</tbody></table></div>{!receipts.length && <p>No receipts yet. Upload your first receipt above.</p>}</section>;
}
