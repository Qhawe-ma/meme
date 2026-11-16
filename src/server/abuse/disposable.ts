const DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "dispostable.com",
  "getnada.com",
  "fakeinbox.com",
  "maildrop.cc",
  "throwaway.email",
  "tempmailo.com",
  "moakt.com",
  "emailondeck.com",
  "mintemail.com",
  "discard.email",
  "mailnesia.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DOMAINS.has(domain);
}
