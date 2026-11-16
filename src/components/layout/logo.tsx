import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-[8px] bg-taxi text-sm font-medium text-[#052e16]">
        M
      </span>
      <span className="text-[15px] font-medium tracking-[-0.03em]">Meme Market</span>
    </Link>
  );
}
