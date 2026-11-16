import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (mutating && request.nextUrl.pathname.startsWith("/api")) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json(
            { error: { code: "FORBIDDEN", message: "That request came from somewhere else.", details: null } },
            { status: 403 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Bad origin.", details: null } },
          { status: 403 },
        );
      }
    }
  }

  const response = NextResponse.next();
  if (!request.cookies.get("mm_device")) {
    response.cookies.set("mm_device", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: (process.env.APP_URL ?? "").startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)"] };
