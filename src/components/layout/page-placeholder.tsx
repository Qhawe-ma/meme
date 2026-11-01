export function PagePlaceholder({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-prose text-ink-dim">{children}</p>
    </section>
  );
}
