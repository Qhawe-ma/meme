import { expect, test } from "@playwright/test";
import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL ?? "postgres://app_rw:mm_app_dev_only@127.0.0.1:5432/meme_market";

async function verificationLink(email: string) {
  const sql = postgres(dbUrl, { max: 1 });
  let body = "";
  for (let i = 0; i < 20; i += 1) {
    const [row] = await sql<{ body: string }[]>`
      SELECT body FROM email_messages WHERE to_email = ${email} ORDER BY id DESC LIMIT 1
    `;
    if (row?.body) {
      body = row.body;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await sql.end();
  const link = body.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`no verification email for ${email}`);
  return link;
}

test("sign up, verify, launch, buy, sell, claim, leaderboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The full journey runs once, on the phone-sized project.");
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `play${stamp}@example.com`;
  const handle = `p${stamp.slice(-8)}`;
  const ticker = `P${stamp.slice(-5)}`;

  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Display name").fill("Play Tester");
  await page.getByLabel("Date of birth").fill("1994-06-15");
  await page.getByRole("checkbox", { name: /FR has no cash value/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const link = await verificationLink(email);
  await page.goto(link);
  await expect(page.getByText("FR200.00").first()).toBeVisible();

  await page.goto("/launch");
  await page.getByLabel("Coin image").setInputFiles({
    name: "coin.png",
    mimeType: "image/png",
    buffer: await solidPng(),
  });
  await page.getByLabel("Name").fill("Play Coin");
  await page.getByLabel("Ticker").fill(ticker);
  await page.getByLabel("Description").fill("A coin made by the end to end test.");
  await page.getByRole("textbox", { name: "X", exact: true }).fill("@playtest");
  await page.getByRole("checkbox", { name: /rules are fixed/ }).check();
  await page.getByRole("button", { name: "Launch for FR20" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${ticker}$`));
  await expect(page.getByRole("heading", { name: "Play Coin" })).toBeVisible();
  await expect(page.getByText("Not a blockchain smart contract")).toBeVisible();

  await page.getByLabel("Amount").fill("10");
  await page.getByRole("button", { name: "Review buy" }).click();
  await page.getByRole("button", { name: "Confirm buy" }).click();
  await expect(page.getByText("buy ·").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "sell", exact: true }).click();
  await page.getByRole("button", { name: "Sell all" }).click();
  await page.getByRole("button", { name: "Review sell" }).click();
  await page.getByRole("button", { name: "Confirm sell" }).click();
  await expect(page.getByText("sell ·").first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/portfolio");
  await page.getByRole("button", { name: "Claim" }).click();
  await expect(page.getByText(/Claimed FR/)).toBeVisible();

  await page.goto("/leaderboard");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(page.getByText(`@${handle}`)).toBeVisible();
});

async function solidPng() {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: { width: 320, height: 320, channels: 3, background: { r: 255, g: 77, b: 136 } },
  })
    .png()
    .toBuffer();
}
