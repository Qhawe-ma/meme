"use client";

import { useState } from "react";

export function ContractPanel({ id, canonical, summary }: { id: string; canonical: string; summary: string }) {
  const [state, setState] = useState<"idle" | "match" | "mismatch">("idle");
  const [copied, setCopied] = useState(false);

  async function verify() {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    setState(id === `MMC-${hash.slice(0, 16).toUpperCase()}` ? "match" : "mismatch");
  }

  return (
    <section className="space-y-3 text-sm">
      <p className="text-ink-dim">{summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-night px-2 py-1 font-mono text-xs">{id}</code>
        <button
          type="button"
          className="rounded-lg bg-night-3 px-2 py-1 text-xs font-semibold"
          onClick={async () => {
            await navigator.clipboard.writeText(id);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="rounded-lg bg-night-3 px-2 py-1 text-xs font-semibold" onClick={verify}>
          Verify
        </button>
        {state === "match" ? <span className="text-up">Match</span> : null}
        {state === "mismatch" ? <span className="text-down">Mismatch</span> : null}
      </div>
      <p className="text-xs text-ink-dim">
        Coin contract: the fixed rules this coin trades by, stored on Meme Market&apos;s servers. Not a blockchain smart contract.
      </p>
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-ink-dim">Show full hash source</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-night p-3 text-[11px] leading-relaxed text-ink-dim">{canonical}</pre>
      </details>
    </section>
  );
}
