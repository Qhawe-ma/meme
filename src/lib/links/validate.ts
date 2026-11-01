import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SOCIAL_KINDS = ["x", "tiktok", "instagram", "telegram", "whatsapp_channel", "website"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];

const HANDLE: Record<Exclude<SocialKind, "website">, RegExp> = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  telegram: /^[A-Za-z0-9_]{5,32}$/,
  whatsapp_channel: /^[A-Za-z0-9]{10,40}$/,
};

const HOSTS: Record<Exclude<SocialKind, "website">, string[]> = {
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  telegram: ["t.me", "telegram.me"],
  whatsapp_channel: ["whatsapp.com", "www.whatsapp.com"],
};

let shortenerHosts: Set<string> | null = null;
let blockedHosts: Set<string> | null = null;

function loadList(file: string): Set<string> {
  const raw = readFileSync(join(/* turbopackIgnore: true */ process.cwd(), "src/server/links", file), "utf8");
  return new Set(
    raw
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && !line.startsWith("#")),
  );
}

export function shortenerSet(): Set<string> {
  shortenerHosts ??= loadList("shorteners.txt");
  return shortenerHosts;
}

export function blockedDomainSet(): Set<string> {
  blockedHosts ??= loadList("blocked-domains.txt");
  return blockedHosts;
}

function isIp(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function hostBlocked(host: string): boolean {
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1; i += 1) {
    const suffix = labels.slice(i).join(".");
    if (blockedDomainSet().has(suffix) || shortenerSet().has(suffix)) return true;
  }
  return false;
}

export type LinkResult = { ok: true; url: string } | { ok: false; reason: string };

/**
 * Normalise one social field. Returns a canonical https URL or a reason code.
 * The server never fetches the URL.
 */
export function normalizeSocial(kind: SocialKind, raw: string): LinkResult {
  const input = raw.trim();
  if (!input) return { ok: false, reason: "empty" };
  if (input.length > 300) return { ok: false, reason: "too_long" };
  if (/[\s]/.test(input) && !input.startsWith("@")) return { ok: false, reason: "whitespace" };
  if (/^(javascript|data|file|ftp|blob):/i.test(input)) return { ok: false, reason: "scheme" };
  if (/^http:\/\//i.test(input)) return { ok: false, reason: "http" };

  if (kind !== "website" && input.startsWith("@")) {
    return fromHandle(kind, input.slice(1));
  }

  const withScheme = /^https:\/\//i.test(input) ? input : `https://${input.replace(/^\/+/, "")}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "parse" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "scheme" };
  if (url.username || url.password) return { ok: false, reason: "userinfo" };
  if (url.port) return { ok: false, reason: "port" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.includes("xn--") || isIp(host) || isPrivateHost(host)) return { ok: false, reason: "host" };
  if (hostBlocked(host)) return { ok: false, reason: "blocked" };

  if (kind === "website") {
    url.hash = "";
    url.hostname = host;
    const stored = url.toString().replace(/\/$/, "");
    if (stored.length > 200) return { ok: false, reason: "too_long" };
    return { ok: true, url: stored };
  }

  if (!HOSTS[kind].includes(host)) return { ok: false, reason: "host" };
  const handle = handleFromPath(kind, url);
  if (!handle) return { ok: false, reason: "handle" };
  return fromHandle(kind, handle);
}

function fromHandle(kind: Exclude<SocialKind, "website"> | SocialKind, handle: string): LinkResult {
  if (kind === "website") return { ok: false, reason: "handle" };
  if (kind === "telegram" && handle.includes("+")) return { ok: false, reason: "invite" };
  if (!HANDLE[kind].test(handle)) return { ok: false, reason: "handle" };
  const stored =
    kind === "x"
      ? `https://x.com/${handle}`
      : kind === "tiktok"
        ? `https://www.tiktok.com/@${handle}`
        : kind === "instagram"
          ? `https://www.instagram.com/${handle}`
          : kind === "telegram"
            ? `https://t.me/${handle}`
            : `https://whatsapp.com/channel/${handle}`;
  return { ok: true, url: stored };
}

function handleFromPath(kind: Exclude<SocialKind, "website">, url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (kind === "whatsapp_channel") {
    if (parts[0] !== "channel" || !parts[1]) return null;
    return parts[1];
  }
  if (kind === "tiktok") {
    const first = parts[0] ?? "";
    return first.startsWith("@") ? first.slice(1) : first || null;
  }
  if (parts.length !== 1) return null;
  const first = parts[0] ?? "";
  return first.startsWith("@") ? first.slice(1) : first;
}

const URL_IN_TEXT = /https?:\/\/|www\./i;
const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SA_ID = /\b\d{13}\b/;
const PHONE = /(?:\+?27|0)\d{8,10}/;

export function textSafetyIssues(text: string): string[] {
  const issues: string[] = [];
  if (text.length > 500) issues.push("too_long");
  if (URL_IN_TEXT.test(text)) issues.push("url");
  if (EMAIL_IN_TEXT.test(text)) issues.push("email");
  if (SA_ID.test(text)) issues.push("sa_id");
  if (PHONE.test(text.replace(/[\s()-]/g, ""))) issues.push("phone");
  return issues;
}
