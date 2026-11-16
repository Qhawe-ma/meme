"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminActions({
  reports,
}: {
  reports: { id: string; ticker: string; reason: string; details: string | null; handle: string }[];
}) {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState("");

  async function act(body: Record<string, string>) {
    const response = await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { error?: { message?: string } };
    setMessage(response.ok ? "Done." : (data.error?.message ?? "Failed."));
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-4">
      <ul className="space-y-2">
        {reports.length === 0 ? <li className="text-sm text-ink-dim">No open reports.</li> : null}
        {reports.map((report) => (
          <li key={report.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span>
              ${report.ticker} · {report.reason} · @{report.handle}
              {report.details ? ` · ${report.details}` : ""}
            </span>
            <span className="flex gap-2">
              <Button type="button" variant="quiet" onClick={() => act({ action: "hide", ticker: report.ticker })}>
                Hide coin
              </Button>
              <Button type="button" variant="quiet" onClick={() => act({ action: "dismiss", reportId: report.id })}>
                Dismiss
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm">
          Ticker
          <input value={ticker} onChange={(event) => setTicker(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-night px-3" />
        </label>
        <label className="text-sm">
          Handle
          <input value={handle} onChange={(event) => setHandle(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-night px-3" />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="button" variant="quiet" onClick={() => act({ action: "hide", ticker })}>
            Hide coin
          </Button>
          <Button type="button" variant="quiet" onClick={() => act({ action: "suspend", handle })}>
            Suspend
          </Button>
          <Button type="button" onClick={() => act({ action: "ban", handle })}>
            Ban user
          </Button>
        </div>
        {message ? <p className="text-sm text-ink-dim">{message}</p> : null}
        <p className="text-xs text-ink-dim sm:col-span-2">
          Ban blocks play. It does not move FR. Clawing balances back needs a second admin and is not a one-click action.
        </p>
      </div>
    </div>
  );
}
