import { currentUser } from "@/server/auth/service";
import { db } from "@/server/db";
import { jsonError } from "@/server/http";
import { route } from "@/server/route";

export const GET = route(async () => {
  const user = await currentUser();
  if (!user) return jsonError("UNAUTHENTICATED", "Sign in first.", 401);
  const trades = await db()`
    SELECT side, gross_ufr, shares, created_at FROM trades WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 500
  `;
  const holdings = await db()`
    SELECT c.ticker, h.shares FROM holdings h JOIN coins c ON c.id = h.coin_id WHERE h.user_id = ${user.id}
  `;
  return Response.json({
    exportedAt: new Date().toISOString(),
    profile: { handle: user.handle, displayName: user.displayName, email: user.email },
    cashUfr: user.cashUfr.toString(),
    rewardsPendingUfr: user.rewardsUfr.toString(),
    holdings,
    trades,
  });
});
