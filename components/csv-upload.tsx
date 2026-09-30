"use client";

import { useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { detectColumns, type ColumnMap } from "@/lib/parser/csv-mapper";
import { importBankStatementCSV } from "@/app/(dashboard)/dashboard/[orgSlug]/transactions/actions";
import { Button } from "@/components/ui/button";

const mappingLabels: Record<keyof ColumnMap, string> = { dateCol: "Date", descriptionCol: "Description", amountCol: "Amount / debit", creditCol: "Credit (optional)" };

export function CsvUpload({ orgSlug, currency }: { orgSlug: string; currency: string }) {
  const [file, setFile] = useState<File>();
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMap>({ dateCol: null, descriptionCol: null, amountCol: null, creditCol: null });
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "text/csv": [".csv"] }, maxSize: 4 * 1024 * 1024, multiple: false, disabled: pending,
    onDropRejected: () => setMessage("Choose one CSV file no larger than 4 MB."),
    onDrop: async files => {
      if (!files[0]) return;
      try {
      const parsed = Papa.parse<Record<string, string>>(await files[0].text(), { header: true, preview: 5, skipEmptyLines: true, transformHeader: value => value.trim() });
      if (parsed.errors.length || !parsed.meta.fields?.length) { setFile(undefined); setHeaders([]); setMessage("The CSV could not be read."); return; }
      setFile(files[0]); setHeaders(parsed.meta.fields); setMapping(detectColumns(parsed.meta.fields)); setMessage("");
      } catch { setFile(undefined); setHeaders([]); setMessage("Unable to read the CSV file. Choose it again."); }
    },
  });
  return <section className="transactions-import-panel">
    <div className="transactions-panel-heading"><div><p className="workspace-eyebrow">BANK CSV IMPORT</p><h2>Import your statement</h2><p>Bring in up to 10,000 rows from a CSV export, then confirm how Clerq should read the columns.</p></div><span className="workspace-panel-icon"><FileSpreadsheet size={17} /></span></div>
    <div {...getRootProps()} className={`transaction-upload-zone ${isDragActive ? "transaction-upload-active" : ""}`}><input {...getInputProps()} aria-label="Choose bank CSV" /><span className="receipt-upload-icon"><UploadCloud size={19} /></span><div><strong>{file?.name ?? (isDragActive ? "Drop your CSV here" : "Drop a CSV here or click to choose")}</strong><small>CSV only · up to 4 MB · maximum 10,000 rows</small></div></div>
    {file && <form className="csv-mapping-form" aria-busy={pending} onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      const form = new FormData(event.currentTarget);
      form.set("file", file); Object.entries(mapping).forEach(([key, value]) => form.set(key, value ?? ""));
      startTransition(async () => {
        try { const result = await importBankStatementCSV(form, orgSlug); setMessage("error" in result ? result.error ?? "Import failed." : `Imported ${result.imported} transactions, skipped ${result.skipped} duplicates, ${result.invalid} invalid rows. ${result.errors.map(row => `Row ${row.row}: ${row.error}`).join(" ")}`); }
        catch { setMessage("Unable to import the statement. Check your connection and try again."); }
      });
    }}>
      <div className="csv-mapping-heading"><div><p className="workspace-eyebrow">MAP YOUR COLUMNS</p><h3>Confirm the file structure</h3></div><span className="csv-file-chip"><FileSpreadsheet size={13} />{file.name}</span></div>
      <div className="csv-mapping-grid">{(Object.keys(mapping) as (keyof ColumnMap)[]).map(key => <label key={key}><span>{mappingLabels[key]}</span><select aria-label={mappingLabels[key]} disabled={pending} value={mapping[key] ?? ""} onChange={event => setMapping({ ...mapping, [key]: event.target.value || null })} required={key !== "creditCol"}><option value="">Choose column</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>)}</div>
      <div className="csv-options-grid"><label><span>Date order</span><select aria-label="Date order" disabled={pending} name="dateOrder"><option value="DMY">Day / month / year (Australia)</option><option value="MDY">Month / day / year (US)</option></select></label><label><span>Currency</span><input disabled={pending} name="currency" defaultValue={currency} required pattern="[A-Za-z]{3}" maxLength={3} /></label><label><span>Sign convention</span><select aria-label="Sign convention" disabled={pending} name="negativeIsCredit"><option value="true">Negative = credit, positive = debit</option><option value="false">Negative = debit, positive = credit</option></select></label></div>
      <div className="csv-form-footer"><p>These choices are retained after importing.</p><Button type="submit" disabled={pending} className="workspace-primary-action csv-import-button">{pending ? "Importing…" : "Import transactions"}</Button></div>
    </form>}
    {message && <p role="status" className={`csv-feedback ${message.startsWith("Imported") ? "csv-feedback-success" : "csv-feedback-error"}`}>{message}</p>}
  </section>;
}
