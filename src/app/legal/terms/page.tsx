import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";
import Link from "next/link";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-8">
      <Logo />
      <div className="mt-4">
        <GamePill />
      </div>
      <h1 className="mt-6 font-display text-4xl font-extrabold">Terms</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-dim">
        <p>Meme Market is a free game for people who are 18 or older. These terms are not legal advice and should be reviewed by a lawyer before a public launch.</p>
        <p>
          Fake rand (FR) is a game score. It is not money, electronic money, a deposit, a voucher, or property. It has zero cash value. You cannot buy FR, top it up, withdraw it, redeem it, or transfer it to another player except by trading against a coin&apos;s curve or by claiming creator rewards.
        </p>
        <p>
          Selling, buying, or trading FR, coins, or accounts for real money, airtime, crypto, goods, or anything of value is banned. Report those offers. We may hide coins and ban accounts.
        </p>
        <p>A coin contract is a database record of the fixed rules a coin trades by. It is not a blockchain smart contract, token, or NFT. There is no wallet and no chain.</p>
        <p>Creator rewards are a share of the game fee. They are not wages, profit, or a return. The platform treasury is an accounting balance of fees. It cannot be cashed out.</p>
        <p>We can change the rules for new coins, pause trading if the books do not balance, and remove content that breaks these terms. Your coins and trades may disappear from public lists if they are reported or hidden.</p>
        <p>
          <Link href="/legal/privacy" className="underline">
            Privacy notice
          </Link>
          {" · "}
          <Link href="/legal/rules" className="underline">
            House rules
          </Link>
        </p>
      </div>
    </article>
  );
}
