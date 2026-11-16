import { ECON, type PresetName } from "@/lib/config/economy";
import { buildContractRecord, contractIdFromHash, hashContract } from "@/lib/contract/contract";
import { freshState, spot } from "@/lib/curve/curve";
import { normalizeSocial, SOCIAL_KINDS, type SocialKind } from "@/lib/links/validate";
import { db, jsonb, type Tx } from "@/server/db";
import { AppError } from "@/server/http";
import { uuidv7 } from "@/server/ids";
import { accountBalance, ensureCoinReserve, ensureUserAccounts, lockAccounts, postLedger, treasuryId } from "@/server/ledger/post";
import { assertCoinText } from "@/server/moderation/text";
import { readCoinImage } from "@/server/images/store";
import { executeTrade, type TradeJson } from "@/server/trade/execute";
import { publish } from "@/server/realtime/bus";

export type SocialInput = Partial<Record<"x" | "tiktok" | "instagram" | "telegram" | "whatsappChannel" | "website", string>>;

const KIND_MAP = {
  x: "x",
  tiktok: "tiktok",
  instagram: "instagram",
  telegram: "telegram",
  whatsappChannel: "whatsapp_channel",
  website: "website",
} as const;

export async function launchCoin(input: {
  userId: string;
  name: string;
  ticker: string;
  description: string;
  socials: SocialInput;
  uploadKey: string;
  phash: string;
  initialBuyUfr: bigint | null;
  ipHash: string | null;
  deviceId: string | null;
}): Promise<{ ticker: string; contractId: string; paramsHash: string; initialTrade: TradeJson | null }> {
  const ticker = input.ticker.toUpperCase();
  const description = input.description.trim();
  assertCoinText({ name: input.name.trim(), ticker, description });
  const links: { kind: SocialKind; url: string }[] = [];
  for (const [field, kind] of Object.entries(KIND_MAP) as [keyof typeof KIND_MAP, SocialKind][]) {
    const raw = input.socials[field]?.trim();
    if (!raw) continue;
    const normalized = normalizeSocial(kind, raw);
    if (!normalized.ok) throw new AppError("LINK_INVALID", `Check the ${field} link (${normalized.reason}).`);
    links.push({ kind, url: normalized.url });
  }
  if (!(await readCoinImage(input.uploadKey, false))) throw new AppError("IMAGE_REJECTED", "Upload the coin image again.");

  const coinId = uuidv7();
  const createdAt = new Date().toISOString();
  try {
  const result = await db().begin(async (tx) => {
    const [settings] = await tx<{ trading_frozen: boolean; economy_preset: PresetName }[]>`
      SELECT trading_frozen, economy_preset FROM system_settings WHERE id = 1
    `;
    if (settings?.trading_frozen) throw new AppError("FROZEN", "The market is paused for maintenance.", 503);
    const [player] = await tx<{ ok: boolean }[]>`
      SELECT (
        u.email_verified_at IS NOT NULL AND p.age_ok AND p.status = 'active'
        AND EXISTS (SELECT 1 FROM grant_claims g WHERE g.user_id = u.id)
      ) AS ok
      FROM "user" u JOIN profiles p ON p.user_id = u.id WHERE u.id = ${input.userId}
    `;
    if (!player?.ok) throw new AppError("GRANT_HELD", "Verify your email and get your starting grant before launching.", 403);
    const [count] = await tx<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM coins
      WHERE creator_id = ${input.userId} AND created_at > now() - interval '24 hours'
    `;
    if ((count?.n ?? 0) >= ECON.MAX_COINS_PER_USER_PER_DAY) {
      throw new AppError("RATE_LIMITED", "You can launch up to 3 coins a day.", 429);
    }

    const preset = settings?.economy_preset === "beta" ? "beta" : "default";
    const [prev] = await tx<{ params_hash: string }[]>`
      SELECT params_hash FROM coin_contracts ORDER BY seq DESC LIMIT 1
    `;
    const record = buildContractRecord({
      coinId,
      ticker,
      creatorUserId: input.userId,
      createdAt,
      preset,
      prevContractHash: prev?.params_hash ?? null,
    });
    const paramsHash = hashContract(record);
    const contractId = contractIdFromHash(paramsHash);
    const curve = {
      x0: BigInt(record.virtual_fr_ufr),
      y0: BigInt(record.virtual_shares),
      totalSupply: BigInt(record.total_supply),
      curveSupply: BigInt(record.curve_supply),
      graduationTarget: BigInt(record.graduation_target_ufr),
      buyFeeBps: BigInt(record.buy_fee_bps),
      sellFeeBps: BigInt(record.sell_fee_bps),
      creatorFeeBps: BigInt(record.creator_fee_bps),
      graduationFeeBps: BigInt(record.graduation_fee_bps),
      maxPositionBps: BigInt(record.max_position_bps),
    };
    const state = freshState(curve);
    const priced = spot(state, curve);

    const accounts = await ensureUserAccounts(tx, input.userId);
    const treasury = await treasuryId(tx);
    await lockAccounts(tx, [accounts.cashId, treasury]);
    const cash = await accountBalance(tx, accounts.cashId);
    const initial = input.initialBuyUfr ?? 0n;
    if (cash < ECON.CREATE_FEE_UFR + initial) throw new AppError("INSUFFICIENT_FR", "You need the FR20 launch fee plus any first buy.", 400);

    await tx`
      INSERT INTO coin_contracts (id, coin_id, version, params, params_hash, prev_contract_hash, created_at)
      VALUES (
        ${contractId}, ${coinId}, ${record.version}, ${jsonb(tx, record)}, ${paramsHash},
        ${record.prev_contract_hash}, ${createdAt}
      )
    `;
    await tx`
      INSERT INTO coins (
        id, contract_id, creator_id, name, ticker, description, image_key, image_phash, status, phase,
        x_ufr, y_shares, k, sold_shares, reserve_ufr, price_ufr_per_1m, live_at
      ) VALUES (
        ${coinId}, ${contractId}, ${input.userId}, ${input.name.trim()}, ${ticker}, ${description || null},
        ${input.uploadKey}, ${input.phash}, 'live', 'curve',
        ${state.x}, ${state.y}, ${state.k.toString()}::numeric, 0, 0, ${priced.priceUfrPer1m}, now()
      )
    `;
    await ensureCoinReserve(tx, coinId);
    for (const link of links) {
      await tx`
        INSERT INTO coin_links (coin_id, kind, url, safety_status, checked_at)
        VALUES (${coinId}, ${link.kind}, ${link.url}, 'ok', now())
      `;
    }
    await postLedger(tx, {
      kind: "COIN_CREATE_FEE",
      idempotencyKey: `create:${coinId}`,
      beneficiaryUserId: input.userId,
      coinId,
      legs: [
        { accountId: accounts.cashId, amount: -ECON.CREATE_FEE_UFR },
        { accountId: treasury, amount: ECON.CREATE_FEE_UFR },
      ],
    });
    await tx`
      INSERT INTO outbox (topic, payload)
      VALUES ('feed', ${jsonb(tx, { type: "coin.new", ticker })})
    `;

    let initialTrade: TradeJson | null = null;
    if (initial > 0n) {
      initialTrade = await executeTrade(
        {
          userId: input.userId,
          ticker,
          side: "buy",
          amountUfr: initial,
          minSharesOut: 0n,
          idempotencyKey: `initial-${coinId}`,
          ipHash: input.ipHash,
          deviceId: input.deviceId,
        },
        tx,
      );
    }
    return { ticker, contractId, paramsHash, initialTrade };
  });

  publish("feed", { type: "coin.new", ticker: result.ticker });
  return result;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new AppError("TICKER_TAKEN", "That ticker is already taken.", 409);
    }
    throw error;
  }
}

export async function updateSocials(input: {
  userId: string;
  ticker: string;
  description?: string | null;
  socials?: SocialInput;
  ipHash: string | null;
}) {
  const ticker = input.ticker.toUpperCase();
  await db().begin(async (tx) => {
    const [coin] = await tx<{ id: string; creator_id: string; socials_locked: boolean; description: string | null }[]>`
      SELECT id, creator_id, socials_locked, description FROM coins WHERE ticker = ${ticker} FOR UPDATE
    `;
    if (!coin) throw new AppError("COIN_NOT_TRADABLE", "No coin with that ticker.", 404);
    if (coin.creator_id !== input.userId) throw new AppError("FORBIDDEN", "Only the creator can edit this coin.", 403);
    if (coin.socials_locked) throw new AppError("FORBIDDEN", "Socials on this coin are locked.", 403);
    const [count] = await tx<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM coin_link_edits
      WHERE coin_id = ${coin.id} AND created_at > now() - interval '24 hours'
    `;
    if ((count?.n ?? 0) >= Number(ECON.SOCIAL_EDITS_PER_DAY)) {
      throw new AppError("RATE_LIMITED", "Socials can be edited 10 times a day.", 429);
    }
    if (input.description !== undefined) {
      const description = input.description?.trim() ?? "";
      assertCoinText({ name: "Ok", ticker: "OK1", description });
      await tx`UPDATE coins SET description = ${description || null} WHERE id = ${coin.id}`;
      await tx`
        INSERT INTO coin_link_edits (coin_id, editor_id, field, old_value, new_value, ip_hash)
        VALUES (${coin.id}, ${input.userId}, 'description', ${coin.description}, ${description || null}, ${input.ipHash})
      `;
    }
    if (input.socials) {
      for (const [field, kind] of Object.entries(KIND_MAP) as [keyof typeof KIND_MAP, SocialKind][]) {
        if (!(field in input.socials)) continue;
        const raw = input.socials[field];
        const [current] = await tx<{ url: string }[]>`
          SELECT url FROM coin_links WHERE coin_id = ${coin.id} AND kind = ${kind}
        `;
        if (!raw) {
          await tx`DELETE FROM coin_links WHERE coin_id = ${coin.id} AND kind = ${kind}`;
          await tx`
            INSERT INTO coin_link_edits (coin_id, editor_id, field, old_value, new_value, ip_hash)
            VALUES (${coin.id}, ${input.userId}, ${kind}, ${current?.url ?? null}, ${null}, ${input.ipHash})
          `;
          continue;
        }
        const normalized = normalizeSocial(kind, raw);
        if (!normalized.ok) throw new AppError("LINK_INVALID", `Check the ${field} link (${normalized.reason}).`);
        await tx`
          INSERT INTO coin_links (coin_id, kind, url, safety_status, checked_at)
          VALUES (${coin.id}, ${kind}, ${normalized.url}, 'ok', now())
          ON CONFLICT (coin_id, kind) DO UPDATE SET url = EXCLUDED.url, safety_status = 'ok', checked_at = now()
        `;
        await tx`
          INSERT INTO coin_link_edits (coin_id, editor_id, field, old_value, new_value, ip_hash)
          VALUES (${coin.id}, ${input.userId}, ${kind}, ${current?.url ?? null}, ${normalized.url}, ${input.ipHash})
        `;
      }
    }
  });
}

export function knownSocialKind(value: string): value is SocialKind {
  return (SOCIAL_KINDS as readonly string[]).includes(value);
}

export async function editCountToday(tx: Tx, coinId: string) {
  const [count] = await tx<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM coin_link_edits WHERE coin_id = ${coinId}`;
  return count?.n ?? 0;
}
