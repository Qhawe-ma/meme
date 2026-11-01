import { ECON } from "@/lib/config/economy";
import { launchCoin } from "@/server/coins/launch";
import { requireUser } from "@/server/auth/service";
import { AppError, clientIp, jsonOk, readJson } from "@/server/http";
import { ipHash } from "@/server/ids";
import { listCoins } from "@/server/read/market";
import { limit, route } from "@/server/route";
import { cookies } from "next/headers";

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") ?? "trending";
  const q = url.searchParams.get("q") ?? "";
  const data = await listCoins(tab, q);
  return jsonOk(data);
});

export const POST = route(async (request) => {
  const user = await requireUser();
  limit(`launch:${user.id}`, ECON.MAX_COINS_PER_USER_PER_DAY, 24 * 60 * 60 * 1000);
  const contentType = request.headers.get("content-type") ?? "";
  let name = "";
  let ticker = "";
  let description = "";
  let socials = {};
  let uploadKey = "";
  let phash = "";
  let initialBuyUfr: bigint | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    name = String(form.get("name") ?? "");
    ticker = String(form.get("ticker") ?? "");
    description = String(form.get("description") ?? "");
    const socialRaw = String(form.get("socials") ?? "");
    if (socialRaw) socials = JSON.parse(socialRaw) as object;
    const initial = String(form.get("initialBuyUfr") ?? "");
    if (initial) initialBuyUfr = BigInt(initial);
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      const { saveCoinImage } = await import("@/server/images/store");
      const saved = await saveCoinImage(Buffer.from(await file.arrayBuffer()));
      uploadKey = saved.key;
      phash = saved.phash;
    } else {
      uploadKey = String(form.get("uploadKey") ?? "");
      phash = String(form.get("phash") ?? "");
    }
  } else {
    const body = (await readJson(request)) as {
      name?: string;
      ticker?: string;
      description?: string;
      socials?: object;
      uploadKey?: string;
      phash?: string;
      initialBuyUfr?: string;
    };
    name = body.name ?? "";
    ticker = body.ticker ?? "";
    description = body.description ?? "";
    socials = body.socials ?? {};
    uploadKey = body.uploadKey ?? "";
    phash = body.phash ?? "";
    if (body.initialBuyUfr) initialBuyUfr = BigInt(body.initialBuyUfr);
  }
  if (!uploadKey) throw new AppError("IMAGE_REJECTED", "Add a coin image.");
  const jar = await cookies();
  const launched = await launchCoin({
    userId: user.id,
    name,
    ticker,
    description,
    socials,
    uploadKey,
    phash,
    initialBuyUfr,
    ipHash: ipHash(clientIp(request)),
    deviceId: jar.get("mm_device")?.value ?? null,
  });
  return jsonOk(launched, 201);
});
