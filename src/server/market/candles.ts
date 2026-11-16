import type { Tx } from "@/server/db";
import { bucketStart, type Timeframe } from "@/lib/time/sast";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1d"];

export async function applyTradeToCandles(
  tx: Tx,
  input: {
    coinId: string;
    at: Date;
    seq: bigint;
    side: "buy" | "sell";
    gross: bigint;
    priceBefore: bigint;
    priceAfter: bigint;
  },
) {
  const high = input.priceBefore > input.priceAfter ? input.priceBefore : input.priceAfter;
  const low = input.priceBefore < input.priceAfter ? input.priceBefore : input.priceAfter;
  const buy = input.side === "buy" ? input.gross : 0n;
  const sell = input.side === "sell" ? input.gross : 0n;
  for (const tf of TIMEFRAMES) {
    const bucket = bucketStart(input.at, tf);
    await tx`
      INSERT INTO candles AS c (
        coin_id, interval, bucket_start, open, high, low, close,
        volume_ufr, buy_volume_ufr, sell_volume_ufr, trades, first_seq, last_seq
      ) VALUES (
        ${input.coinId}, ${tf}, ${bucket}, ${input.priceBefore}, ${high}, ${low}, ${input.priceAfter},
        ${input.gross}, ${buy}, ${sell}, 1, ${input.seq}, ${input.seq}
      )
      ON CONFLICT (coin_id, interval, bucket_start) DO UPDATE SET
        high = GREATEST(c.high, EXCLUDED.high),
        low = LEAST(c.low, EXCLUDED.low),
        close = EXCLUDED.close,
        volume_ufr = c.volume_ufr + EXCLUDED.volume_ufr,
        buy_volume_ufr = c.buy_volume_ufr + EXCLUDED.buy_volume_ufr,
        sell_volume_ufr = c.sell_volume_ufr + EXCLUDED.sell_volume_ufr,
        trades = c.trades + 1,
        last_seq = EXCLUDED.last_seq
      WHERE EXCLUDED.last_seq > c.last_seq
    `;
  }
}
