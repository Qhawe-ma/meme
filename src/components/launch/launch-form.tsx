"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { frInputToUfr } from "@/lib/client/money";

export function LaunchForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (!signedIn) {
    return (
      <p className="card p-6">
        <a href="/sign-in" className="font-semibold text-taxi underline">
          Sign in
        </a>{" "}
        to launch a coin. It costs FR20 from your game balance.
      </p>
    );
  }
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const initial = frInputToUfr(String(form.get("initial") || ""));
        const body = new FormData();
        body.set("name", String(form.get("name") ?? ""));
        body.set("ticker", String(form.get("ticker") ?? "").toUpperCase());
        body.set("description", String(form.get("description") ?? ""));
        body.set(
          "socials",
          JSON.stringify({
            x: form.get("x") || undefined,
            tiktok: form.get("tiktok") || undefined,
            instagram: form.get("instagram") || undefined,
            telegram: form.get("telegram") || undefined,
            whatsappChannel: form.get("whatsapp") || undefined,
            website: form.get("website") || undefined,
          }),
        );
        if (initial) body.set("initialBuyUfr", initial.toString());
        const file = form.get("file");
        if (file instanceof File) body.set("file", file);
        const response = await fetch("/api/coins", { method: "POST", body });
        const data = (await response.json()) as { ticker?: string; error?: { message?: string } };
        setPending(false);
        if (!response.ok || !data.ticker) {
          setError(data.error?.message ?? "Could not launch.");
          return;
        }
        router.push(`/c/${data.ticker}`);
        router.refresh();
      }}
    >
      <Field label="Coin image" hint="PNG, JPG, WEBP or GIF. 256 to 4096 px. Max 5 MB.">
        <input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required className="block w-full text-sm" />
      </Field>
      <Field label="Name">
        <TextInput name="name" required minLength={2} maxLength={32} placeholder="Braai Season" />
      </Field>
      <Field label="Ticker" hint="3–8 letters or numbers. It can't be changed.">
        <TextInput name="ticker" required minLength={3} maxLength={8} className="uppercase" placeholder="BRAAI" />
      </Field>
      <Field label="Description" hint="Optional. No links or phone numbers. Put those in socials.">
        <TextArea name="description" maxLength={500} placeholder="A Saturday afternoon, in coin form." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="X">
          <TextInput name="x" placeholder="@handle" />
        </Field>
        <Field label="TikTok">
          <TextInput name="tiktok" placeholder="@handle" />
        </Field>
        <Field label="Instagram">
          <TextInput name="instagram" placeholder="@handle" />
        </Field>
        <Field label="Telegram">
          <TextInput name="telegram" placeholder="t.me/name" />
        </Field>
        <Field label="WhatsApp channel">
          <TextInput name="whatsapp" placeholder="whatsapp.com/channel/…" />
        </Field>
        <Field label="Website">
          <TextInput name="website" placeholder="https://" />
        </Field>
      </div>
      <Field label="First buy" hint="Optional. On top of the FR20 launch fee, which goes to the platform treasury.">
        <TextInput name="initial" placeholder="0" />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" required className="mt-1 size-4 accent-protea" />
        <span>I understand these rules are fixed when the coin goes live, and FR has no cash value.</span>
      </label>
      {error ? <p className="text-sm text-down">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Launching…" : "Launch for FR20"}
      </Button>
    </form>
  );
}
