import { cn } from "@/lib/utils";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-dim">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "num h-11 w-full rounded-[2px] border border-line bg-night px-3 text-sm outline-none",
        "placeholder:text-ink-dim/70 focus:border-taxi",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-[2px] border border-line bg-night px-3 py-2 text-sm outline-none",
        "placeholder:text-ink-dim/70 focus:border-taxi",
        props.className,
      )}
    />
  );
}
