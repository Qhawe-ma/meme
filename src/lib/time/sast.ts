const SAST_MS = 2 * 60 * 60 * 1000;

/** Wall-clock parts in Africa/Johannesburg (UTC+2, no daylight saving). */
export function sastParts(now = new Date()) {
  const shifted = new Date(now.getTime() + SAST_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function ageInYears(dob: string, now = new Date()): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) return -1;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parts = sastParts(now);
  let age = parts.year - year;
  const today = parts.month * 100 + parts.day;
  if (today < month * 100 + day) age -= 1;
  return age;
}

export function isAdult(dob: string, now = new Date()): boolean {
  const age = ageInYears(dob, now);
  return age >= 18 && age <= 120;
}

/** Monday 00:00 SAST through the following Monday, half-open. */
export function currentSeason(now = new Date()): { startsAt: Date; endsAt: Date; key: string } {
  const parts = sastParts(now);
  const daysSinceMonday = (parts.weekday + 6) % 7;
  const midnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day) - SAST_MS;
  const startsAt = new Date(midnightUtc - daysSinceMonday * 86_400_000);
  const endsAt = new Date(startsAt.getTime() + 7 * 86_400_000);
  const key = startsAt.toISOString().slice(0, 10);
  return { startsAt, endsAt, key };
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d";

const STEP_MS: Record<Exclude<Timeframe, "1d">, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
};

export function bucketStart(at: Date, tf: Timeframe): Date {
  if (tf === "1d") {
    const parts = sastParts(at);
    const midnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day) - SAST_MS;
    return new Date(midnightUtc);
  }
  const step = STEP_MS[tf];
  return new Date(Math.floor(at.getTime() / step) * step);
}
