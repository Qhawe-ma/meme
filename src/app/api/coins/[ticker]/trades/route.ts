import { jsonOk } from "@/server/http";
import { coinTrades } from "@/server/read/market";
import { route } from "@/server/route";

export const GET = route(async (request, context) => {
  const { ticker } = await context.params;
  const before = new URL(request.url).searchParams.get("before") ?? undefined;
  return jsonOk(await coinTrades(ticker ?? "", before));
});
