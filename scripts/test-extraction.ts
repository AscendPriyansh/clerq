import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { invoicePdf } from "./fixtures";
loadEnvConfig(process.cwd());
async function main() {
  const { parseReceiptWithGroq } = await import("../lib/ai/receipt-parser");
  const receipt = await parseReceiptWithGroq(invoicePdf("Stripe", "100.00", "2026-09-15"), "application/pdf");
  assert.match(receipt.vendorName.toLowerCase(), /stripe/);
  assert.equal(receipt.totalAmount, 100);
  assert.equal(receipt.transactionDate, "2026-09-15");
  assert.equal(receipt.currency, "USD");
  console.log("PASS live PDF text extraction and Groq structured parsing using a synthetic invoice.");
  if (process.argv.includes("--ocr")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(invoicePdf("Stripe", "100.00", "2026-09-15")) });
    let image: Buffer;
    try { image = Buffer.from((await parser.getScreenshot({ first: 1, scale: 1.5 })).pages[0].data); }
    finally { await parser.destroy(); }
    const extracted = await parseReceiptWithGroq(image, "image/png");
    assert.match(extracted.vendorName.toLowerCase(), /stripe/);
    assert.equal(extracted.totalAmount, 100);
    assert.equal(extracted.transactionDate, "2026-09-15");
    console.log("PASS PDF rasterisation, image OCR and Groq extraction.");
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Extraction check failed"); process.exitCode = 1; });
