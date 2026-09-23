import { readLimitedBody } from "./files";
import { AppError } from "./errors";

export async function readRequestJson(request: Request, maxBytes = 4096): Promise<unknown> {
  const body = await readLimitedBody(request, maxBytes);
  try { return JSON.parse(body.toString()); }
  catch { throw new AppError("Send a valid JSON request.", "INVALID_JSON", 400); }
}
