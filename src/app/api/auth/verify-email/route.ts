import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookie, verifyEmail } from "@/server/auth/service";
import { clientIp } from "@/server/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  try {
    const jar = await cookies();
    const result = await verifyEmail(token, jar.get("mm_device")?.value ?? null, clientIp(request));
    jar.set("mm_session", result.sessionToken, sessionCookie());
    const next = new URL(result.grant === "granted" ? "/feed?welcome=1" : "/feed?held=1", url.origin);
    return NextResponse.redirect(next);
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=verify", url.origin));
  }
}
