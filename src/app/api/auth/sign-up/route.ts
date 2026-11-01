import { cookies } from "next/headers";
import { signUpSchema } from "@/lib/validation/schemas";
import { limit, route } from "@/server/route";
import { signUp } from "@/server/auth/service";
import { clientIp, jsonOk, readJson } from "@/server/http";
import { AppError } from "@/server/http";

export const POST = route(async (request) => {
  const ip = clientIp(request);
  limit(`signup:${ip}`, 5, 60 * 60 * 1000);
  const parsed = signUpSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("FORBIDDEN", "Check the form and try again.");
  await signUp({ ...parsed.data, marketingOptIn: parsed.data.marketingOptIn ?? false });
  const jar = await cookies();
  void jar;
  return jsonOk({ next: "verify-email" }, 201);
});
