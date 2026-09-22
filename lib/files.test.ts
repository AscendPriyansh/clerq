import { validateFile, readLimitedBody } from "./files";
test("MIME spoofing is rejected", () => expect(() => validateFile(Buffer.from("<html>hi</html>"), "application/pdf")).toThrow());
test("empty file is rejected", () => expect(() => validateFile(Buffer.alloc(0), "application/pdf")).toThrow());
test("oversized streamed body is rejected even without Content-Length", async () => { const response = new Response(new Uint8Array(100)); await expect(readLimitedBody(response, 10)).rejects.toThrow(); });
