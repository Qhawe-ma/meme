import { z } from "zod";
import { requireUser } from "@/server/auth/service";
import { db } from "@/server/db";
import { AppError, jsonOk, readJson } from "@/server/http";
import { route } from "@/server/route";

const schema = z.object({
  action: z.enum(["hide", "unhide", "ban", "suspend", "dismiss"]),
  ticker: z.string().optional(),
  handle: z.string().optional(),
  reportId: z.string().optional(),
});

export const POST = route(async (request) => {
  const admin = await requireUser();
  if (admin.role !== "admin" && admin.role !== "moderator") throw new AppError("FORBIDDEN", "Admins only.", 403);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) throw new AppError("FORBIDDEN", "Unknown moderation action.");
  if (parsed.data.action === "hide" && parsed.data.ticker) {
    await db()`UPDATE coins SET status = 'hidden' WHERE ticker = ${parsed.data.ticker.toUpperCase()}`;
  }
  if (parsed.data.action === "unhide" && parsed.data.ticker) {
    await db()`UPDATE coins SET status = 'live' WHERE ticker = ${parsed.data.ticker.toUpperCase()} AND status = 'hidden'`;
  }
  if ((parsed.data.action === "ban" || parsed.data.action === "suspend") && parsed.data.handle) {
    const status = parsed.data.action === "ban" ? "banned" : "suspended";
    const [person] = await db()<{ user_id: string }[]>`SELECT user_id FROM profiles WHERE handle = ${parsed.data.handle}`;
    if (!person) throw new AppError("FORBIDDEN", "No player with that handle.", 404);
    await db()`UPDATE profiles SET status = ${status} WHERE user_id = ${person.user_id}`;
    await db()`DELETE FROM sessions WHERE user_id = ${person.user_id}`;
  }
  if (parsed.data.action === "dismiss" && parsed.data.reportId) {
    await db()`UPDATE reports SET status = 'dismissed' WHERE id = ${parsed.data.reportId}`;
  }
  return jsonOk({ ok: true });
});
