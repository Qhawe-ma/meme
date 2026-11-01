import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 2, types: { bigint: postgres.BigInt }, onnotice: () => {} });

async function check() {
  const [row] = await sql`
    SELECT
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind = 'MINT'), 0) AS mint,
      COALESCE(SUM(balance_ufr) FILTER (WHERE kind <> 'MINT'), 0) AS rest
    FROM ledger_accounts
  `;
  if (-row.mint !== row.rest) {
    console.error("[integrity] freezing", { mint: row.mint.toString(), rest: row.rest.toString() });
    await sql`SELECT freeze_trading(${"ledger invariant failed"})`;
    await sql`
      INSERT INTO integrity_incidents (scope, details)
      VALUES ('global', ${sql.json({ mint: row.mint.toString(), rest: row.rest.toString() })})
    `;
  }
}

await check();
setInterval(() => {
  check().catch((error) => console.error("[integrity]", error));
}, 60_000);
console.log("invariant worker running");
