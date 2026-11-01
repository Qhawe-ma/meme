import { cookies } from "next/headers";
import { ECON } from "@/lib/config/economy";
import { isAdult } from "@/lib/time/sast";
import { db, withRetry, type Tx } from "@/server/db";
import { AppError } from "@/server/http";
import { ipHash, ipv4Slash24, randomToken, sha256, uuidv7 } from "@/server/ids";
import { isDisposableEmail } from "@/server/abuse/disposable";
import { ensureUserAccounts, mintId, postLedger } from "@/server/ledger/post";
import { sendEmail } from "@/server/email/send";
import { hashPassword, passwordProblems, verifyPassword } from "./password";

const DAY = 86_400_000;

export function sessionCookie() {
  const secure = (process.env.APP_URL ?? "").startsWith("https://");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function signUp(input: {
  email: string;
  password: string;
  handle: string;
  displayName: string;
  dateOfBirth: string;
  marketingOptIn: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  const handle = input.handle.trim();
  const displayName = input.displayName.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("FORBIDDEN", "Enter a real email address.");
  if (isDisposableEmail(email)) throw new AppError("FORBIDDEN", "Use a personal email address, not a temporary one.");
  const passwordError = passwordProblems(input.password);
  if (passwordError) throw new AppError("FORBIDDEN", passwordError);
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) {
    throw new AppError("FORBIDDEN", "Handles are 3–20 letters, numbers or underscores.");
  }
  if (displayName.length < 1 || displayName.length > 40) throw new AppError("FORBIDDEN", "Add a display name.");
  if (!isAdult(input.dateOfBirth)) {
    throw new AppError("AGE_GATE", "Meme Market is for people who are 18 or older.", 403);
  }

  const userId = uuidv7();
  const passwordHash = await hashPassword(input.password);
  const role = adminEmails().has(email) ? "admin" : "player";
  try {
    await db().begin(async (tx) => {
      await tx`
        INSERT INTO "user" (id, email, password_hash)
        VALUES (${userId}, ${email}, ${passwordHash})
      `;
      await tx`
        INSERT INTO profiles (user_id, handle, display_name, date_of_birth, age_ok, role, marketing_opt_in)
        VALUES (${userId}, ${handle}, ${displayName}, ${input.dateOfBirth}, true, ${role}, ${input.marketingOptIn})
      `;
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") throw new AppError("CONFLICT", "That email or handle is already taken.", 409);
    throw error;
  }

  await issueToken(userId, email, "verify");
  return { userId };
}

async function issueToken(userId: string, email: string, purpose: "verify" | "reset") {
  const token = randomToken();
  const hours = purpose === "verify" ? 24 : 1;
  await db()`
    INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at)
    VALUES (${uuidv7()}, ${userId}, ${purpose}, ${sha256(token)}, ${new Date(Date.now() + hours * 3600_000)})
  `;
  const url =
    purpose === "verify"
      ? `${appUrl()}/api/auth/verify-email?token=${token}`
      : `${appUrl()}/reset?token=${token}`;
  const subject = purpose === "verify" ? "Verify your Meme Market email" : "Reset your Meme Market password";
  const text =
    purpose === "verify"
      ? `Verify your email to get your one-time FR200 starting grant.\n\n${url}\n\nFR is a game score and has no cash value. If you did not sign up, ignore this email.`
      : `Reset your Meme Market password:\n\n${url}\n\nThis link expires in one hour.`;
  await sendEmail({ to: email, subject, text });
}

export async function verifyEmail(token: string, deviceId: string | null, ip: string) {
  const tokenHash = sha256(token);
  return withRetry(() =>
    db().begin(async (tx) => {
      const [row] = await tx<{ user_id: string; purpose: string; used_at: Date | null; expires_at: Date }[]>`
        SELECT user_id, purpose, used_at, expires_at
        FROM email_tokens WHERE token_hash = ${tokenHash} FOR UPDATE
      `;
      if (!row || row.purpose !== "verify") throw new AppError("FORBIDDEN", "That verification link is not valid.");
      if (row.used_at) throw new AppError("CONFLICT", "That email is already verified.", 409);
      if (new Date(row.expires_at).getTime() < Date.now()) {
        throw new AppError("FORBIDDEN", "That verification link has expired.");
      }
      await tx`UPDATE email_tokens SET used_at = now() WHERE token_hash = ${tokenHash}`;
      await tx`UPDATE "user" SET email_verified_at = now() WHERE id = ${row.user_id}`;
      const grant = await maybeGrant(tx, row.user_id, deviceId, ip);
      const sessionToken = await createSession(tx, row.user_id);
      return { sessionToken, grant, userId: row.user_id };
    }),
  );
}

async function maybeGrant(tx: Tx, userId: string, deviceId: string | null, ip: string): Promise<"granted" | "held"> {
  const [existing] = await tx`SELECT 1 FROM grant_claims WHERE user_id = ${userId}`;
  if (existing) return "granted";
  const [held] = await tx`SELECT 1 FROM grant_holds WHERE user_id = ${userId} AND status = 'open'`;
  if (held) return "held";

  const network = ipHash(ipv4Slash24(ip));
  let reason: string | null = null;
  if (deviceId) {
    const [count] = await tx<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM grant_claims WHERE device_id = ${deviceId}
    `;
    if ((count?.n ?? 0) >= 2) reason = "device";
  }
  const loopback = ip === "::1" || ip.startsWith("127.");
  if (!reason && !loopback) {
    const [count] = await tx<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM grant_claims
      WHERE ip_hash = ${network} AND created_at > now() - interval '24 hours'
    `;
    if ((count?.n ?? 0) >= 3) reason = "ip";
  }
  if (reason) {
    await tx`
      INSERT INTO grant_holds (user_id, reason) VALUES (${userId}, ${reason})
      ON CONFLICT (user_id) DO NOTHING
    `;
    return "held";
  }

  const accounts = await ensureUserAccounts(tx, userId);
  const mint = await mintId(tx);
  const ledgerTxId = await postLedger(tx, {
    kind: "SIGNUP_GRANT",
    idempotencyKey: `signup:${userId}`,
    beneficiaryUserId: userId,
    legs: [
      { accountId: mint, amount: -ECON.SIGNUP_GRANT_UFR },
      { accountId: accounts.cashId, amount: ECON.SIGNUP_GRANT_UFR },
    ],
  });
  await tx`
    INSERT INTO grant_claims (user_id, ledger_tx_id, device_id, ip_hash)
    VALUES (${userId}, ${ledgerTxId}, ${deviceId}, ${network})
  `;
  return "granted";
}

async function createSession(tx: Tx, userId: string): Promise<string> {
  const token = randomToken();
  await tx`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (${uuidv7()}, ${userId}, ${sha256(token)}, ${new Date(Date.now() + 30 * DAY)})
  `;
  return token;
}

export async function login(email: string, password: string) {
  const [user] = await db()<{
    id: string;
    password_hash: string;
    email_verified_at: Date | null;
    failed_logins: number;
    locked_until: Date | null;
    status: string;
  }[]>`
    SELECT u.id, u.password_hash, u.email_verified_at, u.failed_logins, u.locked_until, p.status
    FROM "user" u JOIN profiles p ON p.user_id = u.id
    WHERE u.email = ${email.trim().toLowerCase()}
  `;
  if (!user || user.status === "deleted") throw new AppError("UNAUTHENTICATED", "Email or password is wrong.", 401);
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new AppError("RATE_LIMITED", "Too many tries. Wait a few minutes and try again.", 429);
  }
  const match = await verifyPassword(password, user.password_hash);
  if (!match) {
    const fails = user.failed_logins + 1;
    const locked = fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
    await db()`UPDATE "user" SET failed_logins = ${fails}, locked_until = ${locked} WHERE id = ${user.id}`;
    throw new AppError("UNAUTHENTICATED", "Email or password is wrong.", 401);
  }
  if (user.status === "banned" || user.status === "suspended") {
    throw new AppError("FORBIDDEN", "This account can't sign in.", 403);
  }
  if (!user.email_verified_at) throw new AppError("EMAIL_UNVERIFIED", "Verify your email before you sign in.", 403);
  await db()`UPDATE "user" SET failed_logins = 0, locked_until = NULL WHERE id = ${user.id}`;
  const sessionToken = await db().begin((tx) => createSession(tx, user.id));
  return { sessionToken, userId: user.id };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await db()`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
}

export async function requestPasswordReset(email: string) {
  const [user] = await db()<{ id: string; email: string }[]>`
    SELECT id, email FROM "user" WHERE email = ${email.trim().toLowerCase()} AND email_verified_at IS NOT NULL
  `;
  if (!user) return;
  await issueToken(user.id, user.email, "reset");
}

export async function resetPassword(token: string, password: string) {
  const passwordError = passwordProblems(password);
  if (passwordError) throw new AppError("FORBIDDEN", passwordError);
  const tokenHash = sha256(token);
  const passwordHash = await hashPassword(password);
  await db().begin(async (tx) => {
    const [row] = await tx<{ user_id: string; used_at: Date | null; expires_at: Date }[]>`
      SELECT user_id, used_at, expires_at FROM email_tokens
      WHERE token_hash = ${tokenHash} AND purpose = 'reset' FOR UPDATE
    `;
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new AppError("FORBIDDEN", "That reset link is not valid any more.");
    }
    await tx`UPDATE email_tokens SET used_at = now() WHERE token_hash = ${tokenHash}`;
    await tx`UPDATE "user" SET password_hash = ${passwordHash}, failed_logins = 0, locked_until = NULL WHERE id = ${row.user_id}`;
    await tx`DELETE FROM sessions WHERE user_id = ${row.user_id}`;
  });
}

export type SessionUser = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  role: string;
  status: string;
  ageOk: boolean;
  emailVerified: boolean;
  flags: string[];
  granted: boolean;
  held: boolean;
  cashUfr: bigint;
  rewardsUfr: bigint;
};

export async function sessionFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db()<{
    id: string;
    email: string;
    handle: string;
    display_name: string;
    role: string;
    status: string;
    age_ok: boolean;
    email_verified_at: Date | null;
    flags: string[];
    granted: boolean;
    held: boolean;
    cash_ufr: bigint | null;
    rewards_ufr: bigint | null;
    expires_at: Date;
  }[]>`
    SELECT u.id, u.email, p.handle, p.display_name, p.role, p.status, p.age_ok, u.email_verified_at, p.flags,
      EXISTS (SELECT 1 FROM grant_claims g WHERE g.user_id = u.id) AS granted,
      EXISTS (SELECT 1 FROM grant_holds h WHERE h.user_id = u.id AND h.status = 'open') AS held,
      (SELECT balance_ufr FROM ledger_accounts a WHERE a.user_id = u.id AND a.kind = 'USER_CASH') AS cash_ufr,
      (SELECT balance_ufr FROM ledger_accounts a WHERE a.user_id = u.id AND a.kind = 'CREATOR_REWARDS') AS rewards_ufr,
      s.expires_at
    FROM sessions s
    JOIN "user" u ON u.id = s.user_id
    JOIN profiles p ON p.user_id = u.id
    WHERE s.token_hash = ${sha256(token)}
  `;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return {
    id: row.id,
    email: row.email,
    handle: row.handle,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    ageOk: row.age_ok,
    emailVerified: Boolean(row.email_verified_at),
    flags: row.flags ?? [],
    granted: row.granted,
    held: row.held,
    cashUfr: row.cash_ufr ?? 0n,
    rewardsUfr: row.rewards_ufr ?? 0n,
  };
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return sessionFromToken(jar.get("mm_session")?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in to do that.", 401);
  return user;
}
