import { z } from "zod";
import { AppError, jsonOk, readJson } from "@/server/http";
import { requestPasswordReset } from "@/server/auth/service";
import { limit, route } from "@/server/route";
import { clientIp } from "@/server/http";

export const POST = route(async (request) => {
  limit(`reset:${clientIp(request)}`, 5, 60 * 60 * 1000);
  const parsed = z.object({ email: z.string().email() }).safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("FORBIDDEN", "Enter the email on your account.");
  await requestPasswordReset(parsed.data.email);
  return jsonOk({ ok: true });
});
