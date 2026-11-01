import { cn } from "@/lib/utils";

/**
 * The persistent "this is a game" label. Hard rule: visible in the header on every
 * page, and repeated on the trade sheet, onboarding, coin page and terms later.
 */
export function GamePill({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex max-w-full items-center whitespace-nowrap rounded-full bg-taxi px-2.5 py-1",
        "text-[11px] font-bold leading-none text-night",
        className,
      )}
    >
      GAME · FR has no cash value
    </p>
  );
}
