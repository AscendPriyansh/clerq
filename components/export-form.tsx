"use client";

import { useState } from "react";
import { ArrowRight, Download } from "lucide-react";

export function ExportForm({ orgSlug }: { orgSlug: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return <form className="export-form" aria-busy={busy} onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const month = String(form.get("month"));
      const response = await fetch(`/api/export/tax-pack?orgSlug=${encodeURIComponent(orgSlug)}&month=${encodeURIComponent(month)}`);
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Export failed."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `clerq-taxpack-${month}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Tax pack downloaded.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally { setBusy(false); }
  }}>
    <label className="export-month-field"><span>Reconciliation month</span><input name="month" type="month" required disabled={busy} defaultValue={new Date().toISOString().slice(0, 7)} /></label>
    <button type="submit" disabled={busy} className="workspace-primary-action export-button"><Download size={15} aria-hidden="true" />{busy ? "Preparing…" : "Download tax pack"}<ArrowRight size={14} aria-hidden="true" /></button>
    {message && <p role={failed ? "alert" : "status"} className={`export-message ${failed ? "export-message-error" : "export-message-success"}`}>{message}</p>}
  </form>;
}
