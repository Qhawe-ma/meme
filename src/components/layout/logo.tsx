import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span aria-hidden className="grid h-7 w-7 place-items-center bg-taxi font-display text-lg leading-none text-night">
        M
      </span>
      <span className="display text-2xl leading-none">Meme Market</span>
    </Link>
  );
}
