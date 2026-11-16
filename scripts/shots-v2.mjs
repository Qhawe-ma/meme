import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const base = "http://localhost:3000";
const out = "/opt/cursor/artifacts/screenshots-v3";
mkdirSync(out, { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const [user] = await sql`
  SELECT email FROM "user" WHERE email LIKE 'rank%@example.com' ORDER BY created_at DESC LIMIT 1
`;
await sql.end();

const browser = await chromium.launch();

async function session() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/feed/);
  const cookies = await context.cookies();
  await context.close();
  return cookies;
}

const cookies = await session();
const sizes = [
  ["mobile", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
];
const pages = [
  ["/", "landing"],
  ["/feed", "feed"],
  ["/c/BRAAI", "coin"],
  ["/launch", "launch"],
  ["/portfolio", "portfolio"],
];

for (const [tag, viewport] of sizes) {
  const context = await browser.newContext({ viewport });
  await context.addCookies(cookies);
  const page = await context.newPage();
  for (const [path, name] of pages) {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${tag}-${name}.png` });
    console.log(tag, name);
  }
  await context.close();
}
await browser.close();
