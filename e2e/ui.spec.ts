import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test("desktop creator audit renders Commons integrity report", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Audit the/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("COMMONS CREATOR").fill("alice_builder");
  await page.getByRole("button", { name: "Audit creator" }).click();

  await expect(page.getByRole("heading", { name: "@alice_builder" })).toBeVisible();
  await expect(page.getByText("COMMONS INTEGRITY", { exact: true })).toBeVisible();
  await expect(page.getByText("Observed Commons graph signals")).toBeVisible();
  await expect(page.getByText("Who moved this creator’s Commons score?")).toBeVisible();
  await expect(page.getByText("Incoming vouches and slashes")).toBeVisible();
  await expect(page.getByText("Est. score from net support", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Share integrity audit on X/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile risk audit stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);

  const input = page.getByLabel("COMMONS CREATOR");
  const audit = page.getByRole("button", { name: "Audit creator" });
  await input.fill("bot_swarm_01");

  const buttonBox = await audit.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.width).toBeGreaterThan(300);

  await audit.click();
  await expect(page.getByRole("heading", { name: "@bot_swarm_01" })).toBeVisible();
  await expect(page.getByText(/coordination risk/i).first()).toBeVisible();
  await expect(page.getByText("SUPPORTERS", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("supporter table is horizontally contained on phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("COMMONS CREATOR").fill("organic_creator");
  await page.getByRole("button", { name: "Audit creator" }).click();
  await expect(page.locator(".supporter-table-wrap")).toBeVisible();
  const contained = await page.locator(".supporter-table-wrap").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -2 && rect.right <= window.innerWidth + 2 && element.scrollWidth >= element.clientWidth;
  });
  expect(contained).toBeTruthy();
  await expectNoHorizontalOverflow(page);
});

test("methodology page remains readable on phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "Audit how the rank was built." })).toBeVisible();
  await expect(page.getByText(/VG-COMMONS-2026\.08\.2/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
