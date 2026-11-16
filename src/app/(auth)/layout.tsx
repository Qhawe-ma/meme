import { GamePill } from "@/components/layout/game-pill";
import { Logo } from "@/components/layout/logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto max-w-lg px-4 py-4">
        <Logo />
        <div className="mt-2">
          <GamePill />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
      <p className="mx-auto max-w-lg px-4 pb-10 text-center text-xs text-ink-dim">
        <Link href="/legal/terms" className="underline">
          Terms
        </Link>
        {" · "}
        Game · FR has no cash value
      </p>
    </div>
  );
}
