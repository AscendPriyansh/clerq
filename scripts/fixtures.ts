// A deterministic text PDF for integration tests and seed receipts.
export function invoicePdf(vendor: string, amount: string, date: string) {
  const escape = (value: string) => value.replace(/[^\x20-\x7e]/g, " ").replace(/[\\()]/g, "\\$&");
  const lines = [vendor, "TAX INVOICE", `Invoice date: ${date}`, "Description: Monthly business software subscription", "Quantity: 1", `Subtotal: USD ${amount}`, "Tax: USD 0.00", `Total amount paid: USD ${amount}`, "Payment received in full. Thank you for your business.", "This is a synthetic Clerq test receipt, not a real purchase."];
  const stream = `BT /F1 14 Tf 50 780 Td ${lines.map((line, index) => `${index ? "0 -24 Td " : ""}(${escape(line)}) Tj`).join("\n")} ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
