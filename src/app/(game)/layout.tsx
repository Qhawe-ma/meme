import Link from "next/link";
import { BottomNav } from "@/components/layout/bottom-nav";
import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";
import { formatFR } from "@/lib/money/format";
import { currentUser } from "@/server/auth/service";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const [settings] = await db()<{ trading_frozen: boolean; frozen_reason: string | null }[]>`
    SELECT trading_frozen, frozen_reason FROM system_settings WHERE id = 1
  `;
  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2">
          <Logo />
          {user ? (
            <Link href="/portfolio" className="num ml-auto rounded-full bg-night-3 px-3 py-1.5 text-sm font-bold">
              {formatFR(user.cashUfr)}
            </Link>
          ) : (
            <Link href="/sign-in" className="ml-auto text-sm font-semibold text-taxi">
              Sign in
            </Link>
          )}
          <div className="w-full">
            <GamePill />
          </div>
        </div>
        {settings?.trading_frozen ? (
          <p className="bg-taxi px-4 py-2 text-center text-sm font-bold text-night">
            Market paused for maintenance{settings.frozen_reason ? ` · ${settings.frozen_reason}` : ""}
          </p>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
