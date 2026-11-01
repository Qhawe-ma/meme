"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "Something went wrong.");
  return data;
}

export function SignUpForm() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  return done ? (
    <div className="card p-6">
      <h1 className="font-display text-3xl font-extrabold">Check your email</h1>
      <p className="mt-3 text-ink-dim">
        We sent a verification link. Open it on this device and your one-time FR200 grant lands. FR has no cash value.
      </p>
    </div>
  ) : (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const form = new FormData(event.currentTarget);
        try {
          await post("/api/auth/sign-up", {
            email: form.get("email"),
            password: form.get("password"),
            handle: form.get("handle"),
            displayName: form.get("displayName"),
            dateOfBirth: form.get("dateOfBirth"),
            acceptTerms: form.get("acceptTerms") === "on",
            marketingOptIn: form.get("marketingOptIn") === "on",
          });
          setDone(true);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not sign up.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <h1 className="font-display text-3xl font-extrabold">Create your account</h1>
        <p className="mt-2 text-sm text-ink-dim">18+ only. One FR200 grant per verified person. It is a game.</p>
      </div>
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint="10 or more characters, with a letter and a number.">
        <TextInput name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Handle" hint="This is public. 3–20 letters, numbers or underscores.">
        <TextInput name="handle" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" />
      </Field>
      <Field label="Display name">
        <TextInput name="displayName" required maxLength={40} />
      </Field>
      <Field label="Date of birth">
        <TextInput name="dateOfBirth" type="date" required />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input name="acceptTerms" type="checkbox" required className="mt-1 size-4 accent-protea" />
        <span>
          I am 18 or older and I understand FR has no cash value. I agree to the{" "}
          <Link href="/legal/terms" className="underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline">
            privacy notice
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-ink-dim">
        <input name="marketingOptIn" type="checkbox" className="mt-1 size-4 accent-protea" />
        <span>Send me the occasional product note. Optional, and off unless I tick this.</span>
      </label>
      {error ? <p className="text-sm text-down">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}

export function SignInForm({ errorHint }: { errorHint?: string }) {
  const router = useRouter();
  const [error, setError] = useState(errorHint ?? "");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          await post("/api/auth/sign-in", { email: form.get("email"), password: form.get("password") });
          router.push("/feed");
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not sign in.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="font-display text-3xl font-extrabold">Welcome back</h1>
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error ? <p className="text-sm text-down">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-ink-dim">
        <Link href="/forgot" className="underline">
          Forgot password
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  return done ? (
    <p className="card p-6 text-ink-dim">If that email has an account, a reset link is on its way.</p>
  ) : (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await post("/api/auth/forgot", { email: form.get("email") });
          setDone(true);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not send the link.");
        }
      }}
    >
      <h1 className="font-display text-3xl font-extrabold">Reset password</h1>
      <Field label="Email">
        <TextInput name="email" type="email" required />
      </Field>
      {error ? <p className="text-sm text-down">{error}</p> : null}
      <Button type="submit">Send reset link</Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await post("/api/auth/reset", { token, password: form.get("password") });
          router.push("/sign-in");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not reset.");
        }
      }}
    >
      <h1 className="font-display text-3xl font-extrabold">Choose a new password</h1>
      <Field label="New password">
        <TextInput name="password" type="password" required minLength={10} />
      </Field>
      {error ? <p className="text-sm text-down">{error}</p> : null}
      <Button type="submit">Save password</Button>
    </form>
  );
}

export function DeleteAccountButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="quiet"
      onClick={async () => {
        if (!window.confirm("Delete your account? This removes your email and name. The ledger stays, without your name.")) return;
        await fetch("/api/me", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm: "DELETE" }),
        });
        router.push("/");
        router.refresh();
      }}
    >
      Delete my account
    </Button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="quiet"
      onClick={async () => {
        await fetch("/api/auth/sign-out", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
