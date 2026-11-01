import { GamePill } from "@/components/layout/game-pill";

export default function PrivacyPage() {
  const officer = process.env.INFORMATION_OFFICER_EMAIL || "privacy@example.com";
  return (
    <article className="mx-auto max-w-2xl px-4 py-8 text-sm leading-relaxed text-ink-dim">
      <GamePill />
      <h1 className="mt-6 font-display text-4xl font-extrabold text-ink">Privacy notice</h1>
      <p className="mt-4">
        This notice is written for the Protection of Personal Information Act (POPIA). It is not legal advice. Appoint an Information Officer and register them with the Information Regulator before you invite the public.
      </p>
      <p className="mt-3">We keep the least we can: email, a password hash, handle, display name, date of birth (to check that you are 18), and gameplay records. We hash IP addresses and store a device id to slow down people collecting many FR200 grants.</p>
      <p className="mt-3">We use that information to run your account, stop fraud and multi-accounting, and understand how the game is used. Marketing email is off unless you tick the box.</p>
      <p className="mt-3">The game may be hosted outside South Africa. Say so here once you pick a host, and name the country.</p>
      <p className="mt-3">You can download your data from Settings and you can delete your account. Deletion removes your email, name and date of birth. We keep the anonymised ledger so balances still add up, and we keep a one-way record that a grant was issued so the same person cannot claim FR200 again.</p>
      <p className="mt-3">Device and IP signals are kept for up to 12 months. If we have a breach that creates a risk, we will tell the Regulator and the people affected.</p>
      <p className="mt-3">Information Officer: {officer}</p>
    </article>
  );
}
