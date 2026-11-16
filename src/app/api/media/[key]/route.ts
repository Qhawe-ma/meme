import { readCoinImage } from "@/server/images/store";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const thumb = new URL(request.url).searchParams.get("size") === "thumb";
  const bytes = await readCoinImage(key ?? "", thumb);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=86400" },
  });
}
