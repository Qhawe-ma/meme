import { cookies } from "next/headers";
import { signInSchema } from "@/lib/validation/schemas";
import { AppError, clientIp, jsonOk, readJson } from "@/server/http";
import { limit, route } from "@/server/route";
import { login, sessionCookie } from "@/server/auth/service";

export const POST = route(async (request) => {
  limit(`login:${clientIp(request)}`, 20, 15 * 60 * 1000);
  const parsed = signInSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("UNAUTHENTICATED", "Email or password is wrong.", 401);
  const result = await login(parsed.data.email, parsed.data.password);
  const jar = await cookies();
  jar.set("mm_session", result.sessionToken, sessionCookie());
  return jsonOk({ ok: true });
});
