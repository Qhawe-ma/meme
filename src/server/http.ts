export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function jsonError(code: string, message: string, status: number, details?: unknown) {
  return Response.json({ error: { code, message, details: details ?? null } }, { status });
}

export function jsonOk(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function asAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : "";
  const code = (error as { code?: string }).code;
  if (message.includes("insufficient balance")) return new AppError("INSUFFICIENT_FR", "Not enough FR for that.", 400);
  if (message.includes("platform treasury can only increase")) return new AppError("FORBIDDEN", "That money move is not allowed.", 400);
  if (message.includes("illegal")) return new AppError("FORBIDDEN", "That money move is not allowed.", 400);
  if (code === "23505") return new AppError("CONFLICT", "That was already saved.", 409);
  if (message.includes("trading_frozen") || code === "FROZEN") return new AppError("FROZEN", "The market is paused.", 503);
  return null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("INVALID_AMOUNT", "The request body must be JSON.", 400);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && process.env.TRUST_PROXY === "1") return forwarded.split(",")[0]?.trim() || "0.0.0.0";
  return request.headers.get("x-real-ip") || "0.0.0.0";
}

export function idempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[0-9a-fA-F-]{16,80}$/.test(key)) {
    throw new AppError("INVALID_AMOUNT", "Add an Idempotency-Key header (a UUID).", 400);
  }
  return key;
}
