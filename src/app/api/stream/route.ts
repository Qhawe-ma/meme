import { subscribe } from "@/server/realtime/bus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const topics = (new URL(request.url).searchParams.get("topics") ?? "feed")
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 8);
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heart: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* closed */
        }
      };
      unsubscribe = subscribe(topics, send);
      send({ type: "hello" });
      heart = setInterval(() => send({ type: "heartbeat" }), 25_000);
    },
    cancel() {
      unsubscribe();
      if (heart) clearInterval(heart);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
