import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [row] = await db()<{ trading_frozen: boolean }[]>`SELECT trading_frozen FROM system_settings WHERE id = 1`;
    return Response.json({ ok: true, frozen: row?.trading_frozen ?? false });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
