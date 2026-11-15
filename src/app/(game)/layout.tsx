import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";
import { formatFR } from "@/lib/money/format";
import { currentUser } from "@/server/auth/service";
import { db } from "@/server/db";
import { recentTape } from "@/server/read/market";
import { TradeTape } from "@/components/rank/tape";

export const dynamic = "force-dynamic";

const links = [
  ["/feed", "Feed"],
  ["/launch", "Launch"],
  ["/portfolio", "Portfolio"],
  ["/leaderboard", "Leaders"],
  ["/settings", "Me"],
] as const;

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const [settings, tape] = await Promise.all([
    db()<{ trading_frozen: boolean; frozen_reason: string | null }[]>`
      SELECT trading_frozen, frozen_reason FROM system_settings WHERE id = 1
    `,
    recentTape(16),
  ]);
  return (
    <div className="min-h-dvh pb-16 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-night">
        <div className="flex items-center gap-4 px-3 py-2">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-dim hover:text-ink">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            {user ? (
              <Link href="/portfolio" className="num text-sm">
                {formatFR(user.cashUfr)}
              </Link>
            ) : (
              <Link href="/sign-in" className="text-xs font-semibold uppercase tracking-wide text-taxi">
                Sign in
              </Link>
            )}
          </div>
        </div>
        <div className="px-3 pb-2">
          <GamePill />
        </div>
        <TradeTape items={tape} />
        {settings[0]?.trading_frozen ? (
          <p className="bg-taxi px-3 py-1 text-center font-mono text-[11px] uppercase text-night">
            Market paused{settings[0].frozen_reason ? ` · ${settings[0].frozen_reason}` : ""}
          </p>
        ) : null}
      </header>
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
