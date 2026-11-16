import { jsonOk } from "@/server/http";
import { coinCandles } from "@/server/read/market";
import { route } from "@/server/route";

export const GET = route(async (request, context) => {
  const { ticker } = await context.params;
  const tf = new URL(request.url).searchParams.get("tf") ?? "5m";
  return jsonOk(await coinCandles(ticker ?? "", tf));
});
