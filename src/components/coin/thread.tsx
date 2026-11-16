"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function Thread({
  ticker,
  signedIn,
  comments,
}: {
  ticker: string;
  signedIn: boolean;
  comments: { id: string; handle: string; body: string; at: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  return (
    <section className="border border-line">
      <header className="border-b border-line px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-dim">Thread</header>
      <ul>
        {comments.length === 0 ? <li className="px-3 py-4 text-sm text-ink-dim">No one has said a word. Eish.</li> : null}
        {comments.map((comment) => (
          <li key={comment.id} className="border-b border-line px-3 py-2">
            <p className="font-mono text-[11px] text-taxi">@{comment.handle}</p>
            <p className="text-sm">{comment.body}</p>
          </li>
        ))}
      </ul>
      {signedIn ? (
        <form
          className="flex gap-2 p-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const response = await fetch(`/api/coins/${ticker}/comments`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ body }),
            });
            if (!response.ok) {
              const data = (await response.json()) as { error?: { message?: string } };
              setError(data.error?.message ?? "Could not post.");
              return;
            }
            setBody("");
            router.refresh();
          }}
        >
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={280}
            placeholder="Say something. No real-money talk."
            aria-label="Comment"
            className="h-10 flex-1 border border-line bg-night px-2 text-sm"
          />
          <button type="submit" className="bg-ink px-3 text-xs font-semibold uppercase text-night">
            Post
          </button>
        </form>
      ) : (
        <p className="px-3 py-2 text-xs text-ink-dim">Sign in to talk on the thread.</p>
      )}
      {error ? <p className="px-3 pb-2 text-xs text-down">{error}</p> : null}
    </section>
  );
}
