import { describe, expect, it } from "vitest";
import { normalizeSocial, textSafetyIssues } from "./validate";

describe("social links", () => {
  it.each([
    ["x", "@Thandi_ZA", "https://x.com/Thandi_ZA"],
    ["x", "https://twitter.com/Thandi_ZA", "https://x.com/Thandi_ZA"],
    ["x", "https://x.com/Thandi_ZA", "https://x.com/Thandi_ZA"],
    ["tiktok", "@braai.time", "https://www.tiktok.com/@braai.time"],
    ["tiktok", "https://www.tiktok.com/@braai.time", "https://www.tiktok.com/@braai.time"],
    ["instagram", "https://instagram.com/braai.time", "https://www.instagram.com/braai.time"],
    ["telegram", "https://t.me/braaicoin", "https://t.me/braaicoin"],
    ["whatsapp_channel", "https://whatsapp.com/channel/AbCdEfGhIj123456", "https://whatsapp.com/channel/AbCdEfGhIj123456"],
    ["website", "https://Example.com/Braai", "https://example.com/Braai"],
  ] as const)("accepts %s %s", (kind, input, stored) => {
    const result = normalizeSocial(kind, input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe(stored);
  });

  it.each([
    ["x", "javascript:alert(1)"],
    ["x", "http://x.com/thandi"],
    ["website", "http://example.com"],
    ["website", "https://user:pass@example.com"],
    ["website", "https://example.com:444/path"],
    ["website", "https://127.0.0.1/secret"],
    ["website", "https://localhost/admin"],
    ["website", "https://xn--mnchen-3ya.de"],
    ["website", "https://bit.ly/free-fr"],
    ["x", "https://example.com/thandi"],
    ["telegram", "https://t.me/+inviteCode"],
    ["whatsapp_channel", "https://wa.me/27821234567"],
    ["instagram", "@"],
    ["website", "https://10.0.0.5/phish"],
    ["website", "data:text/html,hi"],
  ] as const)("rejects %s %s", (kind, input) => {
    expect(normalizeSocial(kind, input).ok).toBe(false);
  });

  it("strips website fragments and rejects private hosts", () => {
    const site = normalizeSocial("website", "https://Example.com/path#frag");
    expect(site.ok).toBe(true);
    if (site.ok) expect(site.url).toBe("https://example.com/path");
    expect(normalizeSocial("website", "https://192.168.0.5/").ok).toBe(false);
  });

  it("flags personal info and links inside a description", () => {
    expect(textSafetyIssues("Just a braai coin")).toEqual([]);
    expect(textSafetyIssues("mail me a@b.co")).toContain("email");
    expect(textSafetyIssues("see https://example.com")).toContain("url");
    expect(textSafetyIssues("call 0821234567")).toContain("phone");
    expect(textSafetyIssues("id 8001015009087")).toContain("sa_id");
  });
});
