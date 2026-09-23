// A real Node worker entry point: keep this file and its dependencies in the trace.
/* eslint-disable @typescript-eslint/no-require-imports -- Node executes this CommonJS worker directly. */
const { parentPort, workerData } = require("node:worker_threads");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { createWorker } = require("tesseract.js");

async function main() {
  let worker;
  let previousStage;
  function stage(value) {
    if (value !== previousStage) {
      previousStage = value;
      parentPort.postMessage({ type: "stage", stage: value });
    }
  }
  try {
    stage("initialising");
    // Turbopack can replace require.resolve(package.json) with a numeric module
    // ID in the compiled worker. Use the explicitly traced filesystem asset.
    const dataRoot = join(process.cwd(), "node_modules", "@tesseract.js-data", "eng");
    worker = await createWorker("eng", 1, {
      langPath: join(dataRoot, "4.0.0_best_int"), gzip: true,
      cachePath: tmpdir(), cacheMethod: "none",
      logger: message => stage(message.status),
      errorHandler: error => parentPort.postMessage({ type: "error", error: String(error).slice(0, 200) }),
    });
    stage("recognising");
    const result = await worker.recognize(Buffer.from(workerData));
    parentPort.postMessage({ type: "result", text: result.data.text });
  } catch (error) {
    parentPort.postMessage({ type: "error", error: error instanceof Error ? error.message.slice(0, 200) : "worker error" });
  } finally {
    if (worker) await worker.terminate();
  }
}
void main();
