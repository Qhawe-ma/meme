import { GamePill } from "@/components/layout/game-pill";

export default function RulesPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-ink-dim">
      <GamePill />
      <h1 className="mt-6 font-display text-4xl font-extrabold text-ink">House rules</h1>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li>Be 18 or older.</li>
        <li>Don&apos;t ask anyone to pay real money for FR, coins, or accounts.</li>
        <li>No sexual content, hate, harassment, gore, or other people&apos;s personal information.</li>
        <li>No links that phish, bet, or sell FR.</li>
        <li>Three reports from established accounts can hide a coin. Holders can still sell.</li>
        <li>A removed coin is settled back to holders with fees waived, so moderation does not take their FR.</li>
      </ul>
    </article>
  );
}
