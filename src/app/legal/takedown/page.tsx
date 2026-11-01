import { GamePill } from "@/components/layout/game-pill";

export default function TakedownPage() {
  const contact = process.env.INFORMATION_OFFICER_EMAIL || "privacy@example.com";
  return (
    <article className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-ink-dim">
      <GamePill />
      <h1 className="mt-6 font-display text-4xl font-extrabold text-ink">Copyright takedown</h1>
      <p className="mt-4">
        If you believe a coin uses your work, email {contact} with the coin ticker, the URL, a description of the work, and a statement that you are the rights holder or their agent. Have a lawyer check the Electronic Communications and Transactions Act process before you rely on this page.
      </p>
    </article>
  );
}
