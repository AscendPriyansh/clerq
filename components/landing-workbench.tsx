"use client";
import { useState } from "react";
import { Check, FileText, ArrowRight, CircleAlert } from "lucide-react";
const examples = [
  { vendor: "Adobe", narration: "ADOBE CREATIVE CLOUD", amount: "49.99", date: "24 Sep 2026", status: "Matched" },
  { vendor: "Amazon Web Services", narration: "AWS AUSTRALIA", amount: "389.40", date: "22 Sep 2026", status: "Matched" },
  { vendor: "Atlassian", narration: "ATLASSIAN SOFTWARE", amount: "82.50", date: "21 Sep 2026", status: "Suggested" },
  { vendor: "Office supplies", narration: "OFFICE SUPPLIES MELBOURNE", amount: "64.00", date: "20 Sep 2026", status: "Missing" },
];
export function LandingWorkbench() {
  const [selected, setSelected] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const row = examples[selected];
  return <div className="lp-workbench" id="workbench-preview">
    <div className="lp-window-bar"><span className="lp-window-dots"><i /><i /><i /></span><span>clerq / melbourne-studio / statement-sep2026.csv</span><span className="lp-window-label">ILLUSTRATIVE WORKSPACE · AUD</span></div>
    <div className="lp-workbench-grid"><section className="lp-bank-preview"><div className="lp-preview-heading"><strong>Imported statement lines</strong><span>4 example records</span></div><div className="lp-preview-scroll"><table><thead><tr><th>Date</th><th>Statement narration</th><th>Debit (AUD)</th><th>Status</th></tr></thead><tbody>{examples.map((item, index) => <tr key={item.vendor} className={selected === index ? "lp-demo-selected" : ""}><td>{item.date}</td><td><button onClick={() => { setSelected(index); setConfirmed(false); }} aria-pressed={selected === index}>{item.narration}</button></td><td>{item.amount}</td><td><span className={`lp-status lp-status-${item.status.toLowerCase()}`}>{confirmed && selected === index ? "Confirmed" : item.status}</span></td></tr>)}</tbody></table></div><p className="lp-preview-caption">Select a sample record to explore the receipt preview.</p></section>
    <section className="lp-receipt-preview"><div className="lp-preview-heading"><strong>Receipt details</strong><span className="lp-status lp-status-matched">SAMPLE DATA</span></div><article className="lp-invoice"><FileText size={22} /><p className="lp-mono">RECEIPT PREVIEW</p><h3>{row.vendor}</h3><p>Melbourne Studio · {row.date}</p><div><span>Currency</span><strong>AUD</strong></div><div><span>Receipt total</span><strong>{row.amount}</strong></div><div className="lp-invoice-total"><span>Total amount</span><strong>AUD {row.amount}</strong></div></article><p className="lp-demo-note">{row.status === "Missing" ? <><CircleAlert size={13} /> This payment needs a receipt.</> : <><Check size={13} /> Review the details before confirming a match.</>}</p><button className="lp-demo-button" disabled={row.status === "Missing" || confirmed} onClick={() => setConfirmed(true)}>{confirmed ? "Sample match confirmed" : "Try a sample confirmation"}<ArrowRight size={14} /></button></section></div>
  </div>;
}
