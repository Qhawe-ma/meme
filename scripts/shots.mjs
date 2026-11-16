import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";
import sharp from "sharp";

const base = "http://localhost:3000";
const out = "/opt/cursor/artifacts/screenshots";
mkdirSync(out, { recursive: true });

const stamp = `${Date.now()}`;
const email = `shots${stamp}@example.com`;
const handle = `s${stamp.slice(-8)}`;
const ticker = `S${stamp.slice(-5)}`;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const browser = await chromium.launch();
const png = await sharp({
  create: { width: 320, height: 320, channels: 3, background: { r: 255, g: 200, b: 87 } },
}).png().toBuffer();

async function shoot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });

for (const [ctx, tag] of [[phone, "mobile"], [desk, "desktop"]]) {
  const page = await ctx.newPage();
  await page.goto(`${base}/`);
  await shoot(page, `${tag}-landing`);
  await page.goto(`${base}/sign-up`);
  await shoot(page, `${tag}-signup`);
}

const page = await phone.newPage();
await page.goto(`${base}/sign-up`);
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("password123");
await page.getByLabel("Handle").fill(handle);
await page.getByLabel("Display name").fill("Thandi");
await page.getByLabel("Date of birth").fill("1996-03-12");
await page.getByRole("checkbox", { name: /FR has no cash value/ }).check();
await page.getByRole("button", { name: "Create account" }).click();
await page.getByRole("heading", { name: "Check your email" }).waitFor();

let link = "";
for (let i = 0; i < 20; i += 1) {
  const [row] = await sql`SELECT body FROM email_messages WHERE to_email = ${email} ORDER BY id DESC LIMIT 1`;
  link = row?.body?.match(/https?:\/\/\S+/)?.[0] ?? "";
  if (link) break;
  await new Promise((r) => setTimeout(r, 200));
}
await page.goto(link);
await page.waitForURL(/\/feed/);

const deskPage = await desk.newPage();
const cookies = await phone.cookies();
await desk.addCookies(cookies);

async function both(path, name) {
  await page.goto(`${base}${path}`);
  await page.waitForTimeout(400);
  await shoot(page, `mobile-${name}`);
  await deskPage.goto(`${base}${path}`);
  await deskPage.waitForTimeout(400);
  await shoot(deskPage, `desktop-${name}`);
}

await both("/feed", "feed");
await page.goto(`${base}/launch`);
await page.getByLabel("Coin image").setInputFiles({ name: "coin.png", mimeType: "image/png", buffer: png });
await page.getByLabel("Name").fill("Braai Season");
await page.getByLabel("Ticker").fill(ticker);
await page.getByLabel("Description").fill("Saturday fire, fake rand, no cash value.");
await page.getByRole("checkbox", { name: /rules are fixed/ }).check();
await shoot(page, "mobile-launch");
await page.getByRole("button", { name: "Launch for FR20" }).click();
await page.waitForURL(new RegExp(`/c/${ticker}`));
await page.getByLabel("Amount").fill("25");
await page.getByRole("button", { name: "Review buy" }).click();
await page.getByRole("button", { name: "Confirm buy" }).click();
await page.getByText(/buy ·/).first().waitFor();
await page.waitForTimeout(500);
await shoot(page, "mobile-coin");
await deskPage.goto(`${base}/c/${ticker}`);
await deskPage.waitForTimeout(600);
await shoot(deskPage, "desktop-coin");
await both("/portfolio", "portfolio");
await both("/leaderboard", "leaderboard");

await sql.end();
await browser.close();
console.log("screenshots written", ticker);
