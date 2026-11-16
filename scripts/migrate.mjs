import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const migratorUrl = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
if (!migratorUrl) {
  console.error("Set MIGRATOR_DATABASE_URL (a superuser) before migrating.");
  process.exit(1);
}

const appPassword = process.env.APP_DB_PASSWORD || "mm_app_dev_only";
if (!/^[A-Za-z0-9_!@#%^*+=.-]{8,80}$/.test(appPassword)) {
  console.error("APP_DB_PASSWORD has characters the migrator will not interpolate.");
  process.exit(1);
}

const sql = postgres(migratorUrl, { max: 1, onnotice: () => {} });

await sql.unsafe(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw LOGIN PASSWORD '${appPassword.replaceAll("'", "''")}';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonly') THEN
    CREATE ROLE readonly;
  END IF;
END $$;
`);

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

const dir = join(process.cwd(), "db/sql");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const file of files) {
  const done = await sql`SELECT 1 FROM schema_migrations WHERE id = ${file}`;
  if (done.length > 0) {
    console.log(`skip ${file}`);
    continue;
  }
  const body = readFileSync(join(dir, file), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
  });
  console.log(`applied ${file}`);
}

if (process.env.ECONOMY_PRESET === "beta") {
  await sql`UPDATE system_settings SET economy_preset = 'beta' WHERE id = 1`;
  console.log("economy preset set to beta");
}

await sql.end();
console.log("migrations complete");
