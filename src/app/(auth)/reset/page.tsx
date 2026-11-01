import { ResetForm } from "@/components/auth/auth-forms";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  if (!params.token) return <p>That reset link is missing a token.</p>;
  return <ResetForm token={params.token} />;
}
