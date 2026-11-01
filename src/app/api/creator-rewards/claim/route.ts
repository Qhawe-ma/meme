import { requireUser } from "@/server/auth/service";
import { idempotencyKey, jsonOk } from "@/server/http";
import { claimRewards } from "@/server/rewards/claim";
import { limit, route } from "@/server/route";

export const POST = route(async (request) => {
  const user = await requireUser();
  limit(`claim:${user.id}`, 10, 60 * 60 * 1000);
  const key = idempotencyKey(request);
  return jsonOk(await claimRewards(user.id, key));
});
