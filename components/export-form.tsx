"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function ExportForm({ orgSlug }: { orgSlug: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <form className="flex flex-wrap items-end gap-3 rounded border p-4" onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/export/tax-pack?orgSlug=${encodeURIComponent(orgSlug)}&month=${encodeURIComponent(String(form.get("month")))}`);
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `clerq-taxpack-${form.get("month")}.zip`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Tax pack downloaded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Export failed."); }
    finally { setBusy(false); }
  }}><label>Reconciliation month<input name="month" type="month" required defaultValue={new Date().toISOString().slice(0, 7)} className="ml-2 rounded border p-2" /></label><Button type="submit" disabled={busy}>{busy ? "Preparing…" : "Download tax pack"}</Button>{message && <p role="status">{message}</p>}</form>;
}
