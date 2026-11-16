import { cn } from "@/lib/utils";

/** Exact wording is a hard rule. One instance per screen so it is never display:none. */
export function GamePill({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center rounded-[6px] bg-taxi px-2 py-1 font-mono text-[11px] font-medium text-[#052e16]",
        className,
      )}
    >
      GAME · FR has no cash value
    </p>
  );
}
