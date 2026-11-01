import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-lg font-extrabold tracking-tight">
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
