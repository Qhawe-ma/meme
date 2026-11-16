import { SignInForm } from "@/components/auth/auth-forms";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const hint = params.error === "verify" ? "That verification link is no longer valid. Sign in if you already verified." : undefined;
  return <SignInForm errorHint={hint} />;
}
