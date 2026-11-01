import { currentUser } from "@/server/auth/service";
import { jsonError, jsonOk } from "@/server/http";
import { getCoin } from "@/server/read/market";
import { route } from "@/server/route";

export const GET = route(async (_request, context) => {
  const { ticker } = await context.params;
  const user = await currentUser();
  const coin = await getCoin(ticker ?? "", user?.id);
  if (!coin) return jsonError("COIN_NOT_TRADABLE", "No coin with that ticker.", 404);
  return jsonOk({
    coin: coin.card,
    description: coin.description,
    contract: { id: coin.contractId, params: coin.contract, summary: coin.summary },
    socials: coin.links,
    myShares: coin.myShares,
    rewardsEarnedUfr: coin.rewardsLifetimeUfr,
  });
});
