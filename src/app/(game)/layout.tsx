import { BottomNav } from "@/components/layout/bottom-nav";
import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";

// Header balance and the freeze banner arrive with accounts (M2) and the ledger (M1).
export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-night-3 bg-night/95 px-4 py-3 backdrop-blur">
        <Logo />
        <GamePill />
      </header>
      <main className="mx-auto max-w-xl px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
