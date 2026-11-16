import { jsonError, jsonOk } from "@/server/http";
import { getCoin } from "@/server/read/market";
import { quoteCoin } from "@/server/trade/execute";
import { route } from "@/server/route";
import { bi } from "@/server/db";

export const GET = route(async (request, context) => {
  const { ticker } = await context.params;
  const url = new URL(request.url);
  const side = url.searchParams.get("side") === "sell" ? "sell" : "buy";
  const amount = BigInt(url.searchParams.get(side === "buy" ? "amountUfr" : "shares") ?? "0");
  const coin = await getCoin(ticker ?? "");
  if (!coin) return jsonError("COIN_NOT_TRADABLE", "No coin with that ticker.", 404);
  const [row] = [{ ...coin.state, x_ufr: coin.state.x, y_shares: coin.state.y, k: coin.state.k.toString(), sold_shares: coin.state.sold, phase: coin.state.phase }];
  const quoted = quoteCoin(coin.contract, row, bi(coin.myShares), side, amount);
  if (!quoted.quote.ok) return jsonOk({ ok: false, code: quoted.quote.code });
  const quote = quoted.quote;
  return jsonOk({
    ok: true,
    shares: quote.shares.toString(),
    payoutUfr: quote.payout.toString(),
    grossUfr: quote.gross.toString(),
    feeUfr: quote.fee.toString(),
    creatorUfr: quote.creator.toString(),
    platformUfr: quote.platform.toString(),
    priceAfterUfrPer1m: quote.priceUfrPer1m.toString(),
  });
});
