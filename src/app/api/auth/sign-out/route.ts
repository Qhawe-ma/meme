import { cookies } from "next/headers";
import { logout, sessionCookie } from "@/server/auth/service";
import { jsonOk } from "@/server/http";
import { route } from "@/server/route";

export const POST = route(async () => {
  const jar = await cookies();
  await logout(jar.get("mm_session")?.value);
  jar.set("mm_session", "", { ...sessionCookie(), maxAge: 0 });
  return jsonOk({ ok: true });
});
