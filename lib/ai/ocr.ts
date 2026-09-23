import "server-only";
import { Worker } from "node:worker_threads";
import { join } from "node:path";

// Own the supervisor from creation, so timeout also stops a stuck Tesseract startup.
export function recogniseReceipt(buffer: Buffer, timeoutMs = 90000): Promise<string> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const worker = new Worker(join(process.cwd(), "lib/ai/ocr-worker.cjs"), {
      workerData: buffer, execArgv: [],
    });
    let settled = false;
    let stage = "starting";
    const finish = (error?: Error, text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Terminating the supervisor also tears down its nested OCR worker.
      void worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(text ?? "");
    };
    const timer = setTimeout(() => finish(new Error(`OCR_TIMEOUT:${stage}`)), timeoutMs);
    worker.on("message", (message: { type?: string; stage?: string; text?: string; error?: string }) => {
      if (settled || !message || typeof message !== "object") return;
      if (message.type === "stage" && typeof message.stage === "string") {
        stage = message.stage.slice(0, 80);
        console.info("OCR progress", { stage, elapsedMs: Date.now() - started });
      } else if (message.type === "result" && typeof message.text === "string") finish(undefined, message.text);
      else if (message.type === "error") finish(new Error(`OCR_FAILED:${String(message.error ?? "worker error").slice(0, 200)}`));
    });
    worker.once("error", error => finish(new Error(`OCR_WORKER_ERROR:${error.message.slice(0, 200)}`)));
    worker.once("exit", code => finish(new Error(`OCR_WORKER_EXIT:${code}`)));
  });
}
