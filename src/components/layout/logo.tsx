import Link from "next/link";

export function Logo() {
  // text-base below sm. text-lg next to the game label overflows a 360px header.
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-base font-extrabold tracking-tight sm:text-lg"
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-full bg-protea text-sm text-white"
      >
        M
      </span>
      <span>Meme Market</span>
    </Link>
  );
}
