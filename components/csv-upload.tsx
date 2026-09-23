"use client";
import { useState, useTransition } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { detectColumns, type ColumnMap } from "@/lib/parser/csv-mapper";
import { importBankStatementCSV } from "@/app/(dashboard)/dashboard/[orgSlug]/transactions/actions";
import { Button } from "@/components/ui/button";

export function CsvUpload({ orgSlug, currency }: { orgSlug: string; currency: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMap>({ dateCol: null, descriptionCol: null, amountCol: null, creditCol: null });
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const { getRootProps, getInputProps } = useDropzone({ accept: { "text/csv": [".csv"] }, maxSize: 4 * 1024 * 1024, multiple: false, disabled: pending,
    onDropRejected: () => setMessage("Choose one CSV file no larger than 4 MB."),
    onDrop: async files => {
      if (!files[0]) return;
      const parsed = Papa.parse<Record<string, string>>(await files[0].text(), { header: true, preview: 5, skipEmptyLines: true, transformHeader: value => value.trim() });
      if (parsed.errors.length || !parsed.meta.fields?.length) { setMessage("The CSV could not be read."); return; }
      setFile(files[0]); setHeaders(parsed.meta.fields); setMapping(detectColumns(parsed.meta.fields)); setMessage("");
    },
  });
  return <section className="space-y-3 rounded border p-4"><h3 className="font-semibold">Import bank statement</h3><div {...getRootProps()} className="cursor-pointer rounded border border-dashed p-6"><input {...getInputProps()} aria-label="Choose bank CSV" />{file?.name ?? "Drop a CSV here or click to choose"}</div>
    {file && <form className="grid gap-3 sm:grid-cols-2" action={form => {
      form.set("file", file); Object.entries(mapping).forEach(([key, value]) => form.set(key, value ?? ""));
      startTransition(async () => {
        const result = await importBankStatementCSV(form, orgSlug);
        setMessage("error" in result ? result.error ?? "Import failed." : `Imported ${result.imported} transactions, skipped ${result.skipped} duplicates, ${result.invalid} invalid rows. ${result.errors.map(row => `Row ${row.row}: ${row.error}`).join(" ")}`);
        router.refresh();
      });
    }}>
      {(Object.keys(mapping) as (keyof ColumnMap)[]).map(key => <label key={key}>{({ dateCol: "Date", descriptionCol: "Description", amountCol: "Amount / debit", creditCol: "Credit (optional)" })[key]}<select className="mt-1 block w-full rounded border p-2" value={mapping[key] ?? ""} onChange={event => setMapping({ ...mapping, [key]: event.target.value || null })} required={key !== "creditCol"}><option value="">Choose column</option>{headers.map(header => <option key={header}>{header}</option>)}</select></label>)}
      <label>Date order<select name="dateOrder" className="block w-full rounded border p-2"><option value="DMY">Day / month / year (Australia)</option><option value="MDY">Month / day / year (US)</option></select></label>
      <label>Currency<input name="currency" defaultValue={currency} required pattern="[A-Za-z]{3}" maxLength={3} className="block w-full rounded border p-2" /></label>
      <label>Single amount column<select name="negativeIsCredit" className="block w-full rounded border p-2"><option value="true">Negative = credit, positive = debit</option><option value="false">Negative = debit, positive = credit</option></select></label>
      <Button type="submit" disabled={pending}>{pending ? "Importing…" : "Import transactions"}</Button>
    </form>}{message && <p role="status" className="text-sm">{message}</p>}</section>;
}
