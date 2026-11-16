import { saveCoinImage } from "@/server/images/store";
import { requireUser } from "@/server/auth/service";
import { jsonOk } from "@/server/http";
import { route } from "@/server/route";

export const POST = route(async (request) => {
  await requireUser();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("IMAGE");
  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await saveCoinImage(bytes);
  return jsonOk({ uploadKey: saved.key, phash: saved.phash });
});
