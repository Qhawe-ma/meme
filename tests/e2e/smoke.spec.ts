import { expect, test } from "@playwright/test";

const pages = ["/", "/feed", "/launch", "/portfolio", "/leaderboard", "/settings"];

test.describe("shell at 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of pages) {
    test(`${path} shows the GAME pill and does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      const pill = page.getByText("GAME · FR has no cash value").first();
      await expect(pill).toBeVisible();

      const box = await pill.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("game pages have the bottom nav with all five tabs", async ({ page }) => {
    await page.goto("/feed");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const label of ["Feed", "Portfolio", "Launch", "Leaders", "Me"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await nav.getByRole("link", { name: "Launch" }).click();
    await expect(page).toHaveURL(/\/launch$/);
  });
});

test("landing page leads with the headline and links to the feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Launch a meme coin");
  await page.getByRole("link", { name: "Browse the floor" }).click();
  await expect(page).toHaveURL(/\/feed$/);
});

test("PWA manifest and icons are served", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});
