import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  handle: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/),
  displayName: z.string().trim().min(1).max(40),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acceptTerms: z.literal(true),
  marketingOptIn: z.boolean().optional(),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(10).max(200),
});

export const tradeSchema = z.discriminatedUnion("side", [
  z.object({
    ticker: z.string().min(3).max(8),
    side: z.literal("buy"),
    amountUfr: z.string().regex(/^[0-9]+$/),
    minSharesOut: z.string().regex(/^[0-9]+$/).optional(),
  }),
  z.object({
    ticker: z.string().min(3).max(8),
    side: z.literal("sell"),
    shares: z.union([z.literal("all"), z.string().regex(/^[0-9]+$/)]),
    minPayoutUfr: z.string().regex(/^[0-9]+$/).optional(),
  }),
]);

export const reportSchema = z.object({
  reason: z.enum(["nsfw", "hate", "harassment", "violence", "copyright", "personal_info", "scam", "real_money_offer", "spam", "other"]),
  details: z.string().max(500).optional(),
});
