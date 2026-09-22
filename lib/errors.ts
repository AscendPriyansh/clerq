export class AppError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) { super(message); }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  console.error("Request failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "The request could not be completed. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
}
