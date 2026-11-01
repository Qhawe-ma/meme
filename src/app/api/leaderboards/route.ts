import { currentUser } from "@/server/auth/service";
import { jsonOk } from "@/server/http";
import { leaderboard } from "@/server/read/market";
import { route } from "@/server/route";

export const GET = route(async () => {
  const user = await currentUser();
  return jsonOk(await leaderboard(user?.id));
});
