import { LaunchForm } from "@/components/launch/launch-form";
import { currentUser } from "@/server/auth/service";

export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const user = await currentUser();
  return (
    <div className="mx-auto max-w-xl px-3 py-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-taxi">FR20 · treasury</p>
      <h1 className="display text-5xl leading-none">Launch a coin</h1>
      <p className="mt-2 text-sm text-ink-dim">
        The fee goes to the platform treasury. The contract locks the curve. It is a row in our database, not a chain.
      </p>
      <div className="mt-5">
        <LaunchForm signedIn={Boolean(user?.granted)} />
      </div>
    </div>
  );
}
