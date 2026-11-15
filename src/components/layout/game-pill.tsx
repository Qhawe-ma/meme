import { cn } from "@/lib/utils";

// On every page, so the product keeps reading as a game.
export function GamePill({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-block -rotate-1 whitespace-nowrap rounded-md border-2 border-night bg-taxi px-2 py-0.5",
        "text-xs font-bold text-night shadow-[2px_2px_0_0_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      GAME · FR has no cash value
    </p>
  );
}
