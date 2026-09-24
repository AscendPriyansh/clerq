import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { createCanvas } from "@napi-rs/canvas";

// Exercise the emitted worker, not the source entry point. No external services.
async function main() {
  const chunks = resolve(".next/server/chunks");
  const entries = (await readdir(chunks)).filter(name => name.startsWith("[worker thread]") && name.includes("ocr-worker") && name.endsWith(".js"));
  assert.equal(entries.length, 1, "Build first: expected one compiled OCR worker entry");
  const canvas = createCanvas(1100, 350);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1100, 350);
  ctx.fillStyle = "black"; ctx.font = "48px Arial";
  ctx.fillText("STRIPE INVOICE", 40, 90);
  ctx.fillText("Total USD 100.00", 40, 180);
  ctx.fillText("2026-09-24", 40, 270);
  const data = { image: canvas.toBuffer("image/png") };
  // Match the metadata merge performed by Turbopack's worker constructor.
  const worker = new Worker(join(chunks, entries[0]), { workerData: { ...data, __turbopack_globals__: {} }, execArgv: [] });
  try {
    const text = await new Promise<string>((resolveText, reject) => {
      const timer = setTimeout(() => reject(new Error("Compiled OCR exceeded 90 seconds")), 90000);
      const fail = (error: Error) => { clearTimeout(timer); reject(error); };
      worker.once("error", fail);
      worker.once("exit", code => fail(new Error(`Compiled worker exited before result: ${code}`)));
      worker.on("message", (message: { type: string; text?: string; error?: string; stage?: string }) => {
        if (message.type === "stage") console.log("Compiled OCR stage:", message.stage);
        if (message.type === "error") fail(new Error(message.error));
        if (message.type === "result") { clearTimeout(timer); resolveText(message.text ?? ""); }
      });
    });
    assert.match(text, /STRIPE/i);
    assert.match(text, /100[.,]00/);
    console.log("PASS compiled production worker: local language data, image bytes, OCR and termination");
  } finally { await worker.terminate(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Compiled OCR failed"); process.exitCode = 1; });
