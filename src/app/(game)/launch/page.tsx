import { LaunchForm } from "@/components/launch/launch-form";
import { currentUser } from "@/server/auth/service";

export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const user = await currentUser();
  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="font-display text-3xl font-extrabold">Launch a coin</h1>
      <p className="mt-2 text-sm text-ink-dim">
        FR20 goes to the platform treasury. The coin contract locks the curve, fees and supply. It is a database record, not a blockchain.
      </p>
      <div className="mt-5">
        <LaunchForm signedIn={Boolean(user?.granted)} />
      </div>
    </div>
  );
}
