import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test("desktop creator audit renders support and slash-attack axes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Audit the/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("COMMONS CREATOR").fill("alice_builder");
  await page.getByRole("button", { name: "Audit creator" }).click();

  await expect(page.getByRole("heading", { name: "@alice_builder" })).toBeVisible();
  await expect(page.getByText("RANK VERDICT", { exact: true })).toBeVisible();
  await expect(page.getByText("Support integrity", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Slash attack risk", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("How was the account vouched?")).toBeVisible();
  await expect(page.getByText("Was the rank hit by mass or coordinated slashing?")).toBeVisible();
  await expect(page.getByText("Top vouchers")).toBeVisible();
  await expect(page.getByText("Top slashers")).toBeVisible();
  await expect(page.getByRole("button", { name: /Share rank audit on X/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile slash-attack audit stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);

  const input = page.getByLabel("COMMONS CREATOR");
  const audit = page.getByRole("button", { name: "Audit creator" });
  await input.fill("attacked_victim");

  const buttonBox = await audit.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.width).toBeGreaterThan(300);

  await audit.click();
  await expect(page.getByRole("heading", { name: "@attacked_victim" })).toBeVisible();
  await expect(page.getByText(/Rank heavily hit by slashing|Coordinated slash-attack risk/i)).toBeVisible();
  await expect(page.getByText("SLASH ATTACK ANALYSIS", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("voucher and slasher tables are horizontally contained on phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("COMMONS CREATOR").fill("attacked_victim");
  await page.getByRole("button", { name: "Audit creator" }).click();
  await expect(page.locator(".supporter-table-wrap").first()).toBeVisible();
  const wrappers = await page.locator(".supporter-table-wrap").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -2 && rect.right <= window.innerWidth + 2 && element.scrollWidth >= element.clientWidth;
  }));
  expect(wrappers.every(Boolean)).toBeTruthy();
  await expectNoHorizontalOverflow(page);
});

test("methodology page remains readable on phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "Audit how the rank was built." })).toBeVisible();
  await expect(page.getByText(/VG-COMMONS-2026\.08\.3/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
