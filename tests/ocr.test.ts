jest.mock("node:worker_threads", () => ({ Worker: jest.fn() }));
import { EventEmitter } from "node:events";
import { Worker } from "node:worker_threads";
import { recogniseReceipt } from "@/lib/ai/ocr";

let worker: EventEmitter & { terminate: jest.Mock };
beforeEach(() => {
  jest.useFakeTimers();
  worker = Object.assign(new EventEmitter(), { terminate: jest.fn().mockResolvedValue(1) });
  (Worker as unknown as jest.Mock).mockImplementation(() => worker);
});
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

test("startup timeout terminates a worker that never becomes ready", async () => {
  const result = recogniseReceipt(Buffer.from("image"), 1000);
  const assertion = expect(result).rejects.toThrow("OCR_TIMEOUT:starting");
  jest.advanceTimersByTime(1000);
  await assertion;
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("successful recognition returns text and cleans up the worker", async () => {
  const result = recogniseReceipt(Buffer.from("image"));
  const options = (Worker as unknown as jest.Mock).mock.calls[0][1];
  const wrapped = structuredClone({ ...options.workerData, __turbopack_globals__: {} });
  expect(Buffer.from(wrapped.image).toString()).toBe("image");
  worker.emit("message", { type: "result", text: "Stripe 100.00" });
  await expect(result).resolves.toBe("Stripe 100.00");
  jest.runAllTimers();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("worker startup errors reject promptly", async () => {
  const result = recogniseReceipt(Buffer.from("image"));
  worker.emit("error", new Error("Missing runtime dependency"));
  await expect(result).rejects.toThrow("OCR_WORKER_ERROR:Missing runtime dependency");
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("language initialisation errors reject instead of leaving the job running", async () => {
  const result = recogniseReceipt(Buffer.from("image"));
  worker.emit("message", { type: "error", error: "Language data unavailable" });
  await expect(result).rejects.toThrow("OCR_FAILED:Language data unavailable");
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
test("unexpected clean exit without a result is a failure", async () => {
  const result = recogniseReceipt(Buffer.from("image"));
  worker.emit("exit", 0);
  await expect(result).rejects.toThrow("OCR_WORKER_EXIT:0");
});
test("a late result cannot turn a timeout into success", async () => {
  const result = recogniseReceipt(Buffer.from("image"), 1000);
  const assertion = expect(result).rejects.toThrow("OCR_TIMEOUT");
  jest.advanceTimersByTime(1000);
  worker.emit("message", { type: "result", text: "late" });
  await assertion;
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});
