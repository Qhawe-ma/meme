import { cookies } from "next/headers";
import { formatFR } from "@/lib/money/format";
import { currentUser, logout, sessionCookie } from "@/server/auth/service";
import { db } from "@/server/db";
import { AppError, jsonError, jsonOk, readJson } from "@/server/http";
import { route } from "@/server/route";
import { sha256, uuidv7 } from "@/server/ids";

export const GET = route(async () => {
  const user = await currentUser();
  if (!user) return jsonError("UNAUTHENTICATED", "Sign in to see your account.", 401);
  const [settings] = await db()<{ trading_frozen: boolean }[]>`SELECT trading_frozen FROM system_settings WHERE id = 1`;
  const net = user.cashUfr + user.rewardsUfr;
  return jsonOk({
    user: { id: user.id, handle: user.handle, displayName: user.displayName, role: user.role },
    cashUfr: user.cashUfr.toString(),
    rewardsPendingUfr: user.rewardsUfr.toString(),
    netWorthUfr: net.toString(),
    frozen: settings?.trading_frozen ?? false,
    granted: user.granted,
    held: user.held,
    display: { cash: formatFR(user.cashUfr), rewards: formatFR(user.rewardsUfr) },
  });
});

export const DELETE = route(async (request) => {
  const user = await currentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in first.", 401);
  const body = (await readJson(request)) as { confirm?: string };
  if (body.confirm !== "DELETE") throw new AppError("FORBIDDEN", 'Send confirm: "DELETE".');
  const tombstone = `deleted-${sha256(user.id).slice(0, 16)}@invalid.local`;
  await db().begin(async (tx) => {
    await tx`UPDATE "user" SET email = ${tombstone}, password_hash = 'deleted' WHERE id = ${user.id}`;
    await tx`
      UPDATE profiles
      SET status = 'deleted', display_name = 'Deleted', date_of_birth = NULL, phone_enc = NULL, avatar_key = NULL
      WHERE user_id = ${user.id}
    `;
    await tx`DELETE FROM sessions WHERE user_id = ${user.id}`;
    await tx`
      INSERT INTO audit_log (actor_id, action, target_type, target_id, row_hash)
      VALUES (${user.id}, 'account_delete', 'user', ${user.id}, ${sha256(`${user.id}:delete:${uuidv7()}`)})
    `;
  });
  const jar = await cookies();
  await logout(jar.get("mm_session")?.value);
  jar.set("mm_session", "", { ...sessionCookie(), maxAge: 0 });
  return jsonOk({ deleted: true });
});
