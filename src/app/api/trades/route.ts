import { cookies } from "next/headers";
import { ECON } from "@/lib/config/economy";
import { tradeSchema } from "@/lib/validation/schemas";
import { requireUser } from "@/server/auth/service";
import { AppError, clientIp, idempotencyKey, jsonOk, readJson } from "@/server/http";
import { ipHash } from "@/server/ids";
import { limit, route } from "@/server/route";
import { executeTrade } from "@/server/trade/execute";
import { parseAmount } from "@/lib/money/parse";

export const POST = route(async (request) => {
  const user = await requireUser();
  limit(`trade:${user.id}`, ECON.TRADE_RATE_LIMIT_PER_MIN, 60_000);
  const key = idempotencyKey(request);
  const parsed = tradeSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("INVALID_AMOUNT", "Check the trade and try again.");
  const jar = await cookies();
  const body = parsed.data;
  const result = await executeTrade({
    userId: user.id,
    ticker: body.ticker,
    side: body.side,
    amountUfr: body.side === "buy" ? parseAmount(body.amountUfr) : undefined,
    shares: body.side === "sell" ? (body.shares === "all" ? "all" : parseAmount(body.shares)) : undefined,
    minSharesOut: body.side === "buy" && body.minSharesOut ? BigInt(body.minSharesOut) : 0n,
    minPayoutUfr: body.side === "sell" && body.minPayoutUfr ? BigInt(body.minPayoutUfr) : 0n,
    idempotencyKey: key,
    ipHash: ipHash(clientIp(request)),
    deviceId: jar.get("mm_device")?.value ?? null,
  });
  return jsonOk(result);
});
