import { describe, expect, it } from "vitest";
import { ageInYears, bucketStart, currentSeason, isAdult } from "./sast";

describe("SAST time", () => {
  it("treats a birthday as SAST, not UTC", () => {
    const dob = "2000-11-01";
    const before = new Date("2018-10-31T21:00:00.000Z");
    const after = new Date("2018-10-31T22:30:00.000Z");
    expect(ageInYears(dob, before)).toBe(17);
    expect(isAdult(dob, before)).toBe(false);
    expect(isAdult(dob, after)).toBe(true);
  });

  it("starts the week on Monday 00:00 SAST", () => {
    const wednesday = new Date("2026-11-04T10:00:00.000Z");
    const season = currentSeason(wednesday);
    expect(season.startsAt.toISOString()).toBe("2026-11-01T22:00:00.000Z");
    expect(season.endsAt.toISOString()).toBe("2026-11-08T22:00:00.000Z");
  });

  it("buckets a 1d candle on SAST midnight", () => {
    const justBefore = new Date("2026-11-01T21:59:00.000Z");
    const justAfter = new Date("2026-11-01T22:01:00.000Z");
    expect(bucketStart(justBefore, "1d").toISOString()).toBe("2026-10-31T22:00:00.000Z");
    expect(bucketStart(justAfter, "1d").toISOString()).toBe("2026-11-01T22:00:00.000Z");
    expect(bucketStart(new Date("2026-11-01T22:07:00.000Z"), "5m").toISOString()).toBe(
      "2026-11-01T22:05:00.000Z",
    );
  });
});
