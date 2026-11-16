import { requireUser } from "@/server/auth/service";
import { jsonOk } from "@/server/http";
import { portfolioFor } from "@/server/read/market";
import { route } from "@/server/route";

export const GET = route(async () => {
  const user = await requireUser();
  return jsonOk(await portfolioFor(user.id));
});
