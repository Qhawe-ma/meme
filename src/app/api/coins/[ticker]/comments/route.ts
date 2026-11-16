import { z } from "zod";
import { requireUser } from "@/server/auth/service";
import { db } from "@/server/db";
import { AppError, jsonOk, readJson } from "@/server/http";
import { uuidv7 } from "@/server/ids";
import { route } from "@/server/route";

const schema = z.object({ body: z.string().trim().min(1).max(280) });

export const POST = route(async (request, context) => {
  const user = await requireUser();
  const { ticker } = await context.params;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("FORBIDDEN", "Keep it to 280 characters.");
  if (/https?:\/\/|www\./i.test(parsed.data.body)) throw new AppError("FORBIDDEN", "No links in the thread.");
  const [coin] = await db()<{ id: string; status: string }[]>`
    SELECT id, status FROM coins WHERE ticker = ${(ticker ?? "").toUpperCase()}
  `;
  if (!coin || coin.status === "removed") throw new AppError("COIN_NOT_TRADABLE", "That coin is gone.", 404);
  await db()`
    INSERT INTO coin_comments (id, coin_id, user_id, body)
    VALUES (${uuidv7()}, ${coin.id}, ${user.id}, ${parsed.data.body})
  `;
  return jsonOk({ ok: true }, 201);
});
