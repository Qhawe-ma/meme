"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Plus, Trophy, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/feed", label: "Feed", Icon: Flame },
  { href: "/portfolio", label: "Portfolio", Icon: Wallet },
  { href: "/launch", label: "Launch", Icon: Plus, raised: true },
  { href: "/leaderboard", label: "Leaders", Icon: Trophy },
  { href: "/settings", label: "Me", Icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-night-3 bg-night-2 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 items-end">
        {items.map(({ href, label, Icon, ...rest }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const raised = "raised" in rest;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-xs font-medium",
                  active ? "text-ink" : "text-ink-dim",
                )}
              >
                <span
                  className={cn(
                    "grid place-items-center",
                    raised ? "-mt-5 size-12 rounded-full bg-protea text-white ring-4 ring-night-2" : "size-6",
                  )}
                >
                  <Icon className={raised ? "size-6" : "size-5"} strokeWidth={active ? 2.5 : 2} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
