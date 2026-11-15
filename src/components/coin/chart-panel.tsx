"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Candle = { t: string; o: string; h: string; l: string; c: string; v: string; bv: string; sv: string };
const TFS = ["1m", "5m", "15m", "1h", "1d"] as const;

export function ChartPanel({ ticker }: { ticker: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [tf, setTf] = useState<(typeof TFS)[number]>("5m");
  const [mode, setMode] = useState<"price" | "mcap">("price");
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let dead = false;
    let chart: { remove: () => void } | null = null;
    (async () => {
      const response = await fetch(`/api/coins/${ticker}/candles?tf=${tf}`);
      const data = (await response.json()) as { candles: Candle[] };
      if (dead) return;
      setEmpty(data.candles.length === 0);
      if (data.candles.length === 0) return;
      const lib = await import("lightweight-charts");
      if (dead || !host.current) return;
      const next = lib.createChart(host.current, {
        height: 320,
        layout: { background: { type: lib.ColorType.Solid, color: "#0e0f0c" }, textColor: "#8e927f", fontFamily: "IBM Plex Mono, ui-monospace, monospace" },
        grid: { vertLines: { color: "#1c2018" }, horzLines: { color: "#1c2018" } },
        rightPriceScale: { borderColor: "#2a2e24" },
        timeScale: { borderColor: "#2a2e24", timeVisible: tf !== "1d" },
      });
      const scale = mode === "mcap" ? 1000 : 1;
      const candles = next.addSeries(lib.CandlestickSeries, {
        upColor: "#c6f135",
        downColor: "#ff4b2b",
        borderVisible: false,
        wickUpColor: "#c6f135",
        wickDownColor: "#ff4b2b",
      });
      candles.setData(
        data.candles.map((candle) => ({
          time: Math.floor(new Date(candle.t).getTime() / 1000) as never,
          open: (Number(candle.o) / 1e6) * scale,
          high: (Number(candle.h) / 1e6) * scale,
          low: (Number(candle.l) / 1e6) * scale,
          close: (Number(candle.c) / 1e6) * scale,
        })),
      );
      const volume = next.addSeries(lib.HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(
        data.candles.map((candle) => ({
          time: Math.floor(new Date(candle.t).getTime() / 1000) as never,
          value: Number(candle.v) / 1e6,
          color: BigInt(candle.bv) >= BigInt(candle.sv) ? "rgba(198,241,53,0.45)" : "rgba(255,75,43,0.45)",
        })),
      );
      next.timeScale().fitContent();
      chart = next;
    })();
    return () => {
      dead = true;
      chart?.remove();
    };
  }, [ticker, tf, mode]);

  return (
    <section className="border border-line bg-night">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 py-1">
        <div className="flex">
          {TFS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTf(item)}
              className={cn("px-2 py-1 font-mono text-[11px] uppercase", tf === item ? "bg-ink text-night" : "text-ink-dim")}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex font-mono text-[11px] uppercase">
          <button type="button" className={cn("px-2 py-1", mode === "price" ? "bg-taxi text-night" : "text-ink-dim")} onClick={() => setMode("price")}>
            Price
          </button>
          <button type="button" className={cn("px-2 py-1", mode === "mcap" ? "bg-taxi text-night" : "text-ink-dim")} onClick={() => setMode("mcap")}>
            Mcap
          </button>
        </div>
      </div>
      <div ref={host} className="min-h-80" />
      {empty ? <p className="px-2 pb-4 text-sm text-ink-dim">The chart fills in as people trade. Price is FR per 1M shares.</p> : null}
    </section>
  );
}
