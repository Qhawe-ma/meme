import { resetSchema } from "@/lib/validation/schemas";
import { resetPassword } from "@/server/auth/service";
import { AppError, jsonOk, readJson } from "@/server/http";
import { route } from "@/server/route";

export const POST = route(async (request) => {
  const parsed = resetSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("FORBIDDEN", "Check the new password and the link.");
  await resetPassword(parsed.data.token, parsed.data.password);
  return jsonOk({ ok: true });
});
