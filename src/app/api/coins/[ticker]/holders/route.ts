import { jsonError, jsonOk } from "@/server/http";
import { coinHolders } from "@/server/read/market";
import { route } from "@/server/route";

export const GET = route(async (_request, context) => {
  const { ticker } = await context.params;
  const data = await coinHolders(ticker ?? "");
  if (!data) return jsonError("COIN_NOT_TRADABLE", "No coin with that ticker.", 404);
  return jsonOk(data);
});
