"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatFR } from "@/lib/money/format";
import { Button } from "@/components/ui/button";

export function ClaimButton({ pendingUfr }: { pendingUfr: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = BigInt(pendingUfr || "0");
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <p className="text-sm text-ink-dim">Creator rewards</p>
        <p className="font-display text-3xl font-extrabold num">{formatFR(amount)}</p>
        <p className="text-xs text-ink-dim">0.25% of trades on your coins. Claim moves them into your balance.</p>
      </div>
      <div>
        <Button
          type="button"
          disabled={busy || amount < 10_000n}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            const response = await fetch("/api/creator-rewards/claim", {
              method: "POST",
              headers: { "idempotency-key": crypto.randomUUID() },
            });
            const data = (await response.json()) as { claimedUfr?: string; error?: { message?: string } };
            setBusy(false);
            if (!response.ok) {
              setMessage(data.error?.message ?? "Could not claim.");
              return;
            }
            setMessage(`Claimed ${formatFR(BigInt(data.claimedUfr ?? "0"))}`);
            router.refresh();
          }}
        >
          {busy ? "Claiming…" : "Claim"}
        </Button>
        {message ? <p className="mt-2 text-xs text-ink-dim">{message}</p> : null}
      </div>
    </div>
  );
}
