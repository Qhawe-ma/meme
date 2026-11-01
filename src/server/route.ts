import { AppError, asAppError, jsonError } from "@/server/http";
import { assertRate } from "@/server/abuse/rateLimit";

export function route(handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMITED") {
        const retry = (error as { retryAfterS?: number }).retryAfterS ?? 1;
        return jsonError("RATE_LIMITED", "Too many requests. Slow down a moment.", 429, { retryAfterS: retry });
      }
      const app = asAppError(error);
      if (app) return jsonError(app.code, app.message, app.status);
      console.error(error);
      return jsonError("INTERNAL", "Something went wrong on our side.", 500);
    }
  };
}

export function limit(key: string, count: number, windowMs: number) {
  try {
    assertRate(key, count, windowMs);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") throw error;
    throw new AppError("RATE_LIMITED", "Too many requests.", 429);
  }
}
