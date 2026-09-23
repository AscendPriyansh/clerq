import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) { super(message); }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: "Check the required fields and file details.", code: "INVALID_INPUT" }, { status: 400 });
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "The request could not be completed. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
}
