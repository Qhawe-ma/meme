import { cn } from "@/lib/utils";

/** Exact wording is a hard rule. One instance per screen so it is never display:none. */
export function GamePill({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center bg-taxi px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-night",
        className,
      )}
    >
      GAME · FR has no cash value
    </p>
  );
}
