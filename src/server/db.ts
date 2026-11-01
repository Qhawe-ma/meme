import postgres, { type JSONValue, type Parameter, type Sql, type TransactionSql } from "postgres";

type MoneyTypes = { bigint: bigint };
export type Db = Sql<MoneyTypes>;
export type Tx = TransactionSql<MoneyTypes>;

let client: Db | null = null;

export function db(): Db {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      types: { bigint: postgres.BigInt },
      onnotice: () => {},
    }) as unknown as Db;
  }
  return client;
}

/** Bind a value as jsonb. Do not also cast with ::jsonb or it gets stored as a string. */
export function jsonb(sql: { json: (value: JSONValue) => Parameter }, value: unknown) {
  return sql.json(value as JSONValue);
}

export function bi(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.trim() !== "") return BigInt(value);
  throw new Error(`expected an integer, got ${typeof value}`);
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const code = (error as { code?: string }).code;
      if ((code !== "40P01" && code !== "40001") || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 50));
    }
  }
  throw last;
}
