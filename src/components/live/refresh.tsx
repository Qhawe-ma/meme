"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({ topics }: { topics: string }) {
  const router = useRouter();
  useEffect(() => {
    const source = new EventSource(`/api/stream?topics=${encodeURIComponent(topics)}`);
    let last = 0;
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type?: string };
      if (data.type === "heartbeat" || data.type === "hello") return;
      const now = Date.now();
      if (now - last < 800) return;
      last = now;
      router.refresh();
    };
    return () => source.close();
  }, [router, topics]);
  return null;
}
