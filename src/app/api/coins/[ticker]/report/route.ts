import { reportSchema } from "@/lib/validation/schemas";
import { requireUser } from "@/server/auth/service";
import { db } from "@/server/db";
import { AppError, jsonOk, readJson } from "@/server/http";
import { uuidv7 } from "@/server/ids";
import { route } from "@/server/route";
import { ECON } from "@/lib/config/economy";

export const POST = route(async (request, context) => {
  const user = await requireUser();
  const { ticker } = await context.params;
  const parsed = reportSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("FORBIDDEN", "Pick a reason.");
  const [coin] = await db()<{ id: string }[]>`SELECT id FROM coins WHERE ticker = ${(ticker ?? "").toUpperCase()}`;
  if (!coin) throw new AppError("COIN_NOT_TRADABLE", "No coin with that ticker.", 404);
  await db()`
    INSERT INTO reports (id, coin_id, reporter_id, reason, details)
    VALUES (${uuidv7()}, ${coin.id}, ${user.id}, ${parsed.data.reason}, ${parsed.data.details ?? null})
    ON CONFLICT (coin_id, reporter_id) DO NOTHING
  `;
  const [count] = await db()<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM reports r
    JOIN profiles p ON p.user_id = r.reporter_id
    WHERE r.coin_id = ${coin.id} AND r.status = 'open' AND p.created_at < now() - interval '3 days'
  `;
  if ((count?.n ?? 0) >= ECON.REPORTS_TO_AUTO_HIDE) {
    await db()`UPDATE coins SET status = 'hidden' WHERE id = ${coin.id} AND status = 'live'`;
  }
  return jsonOk({ ok: true }, 201);
});
