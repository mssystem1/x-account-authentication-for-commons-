import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test("desktop scan renders a complete scored assessment", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Scan before/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("X ACCOUNT").fill("alice_builder");
  await page.getByRole("button", { name: "Scan account" }).click();

  await expect(page.getByRole("heading", { name: "@alice_builder" })).toBeVisible();
  await expect(page.getByText("VOUCH CONFIDENCE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Vouch on X/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Review for slash/i })).toBeVisible();
  await expect(page.getByText("Why the model saw these patterns")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile scan stays within viewport and stacks primary actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);

  const input = page.getByLabel("X ACCOUNT");
  const scan = page.getByRole("button", { name: "Scan account" });
  await input.fill("yield_farmer");

  const buttonBox = await scan.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.width).toBeGreaterThan(300);

  await scan.click();
  await expect(page.getByRole("heading", { name: "@yield_farmer" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Vouch on X/i })).toBeVisible();

  const columns = await page.locator(".decision-bar").evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(columns.trim().split(/\s+/)).toHaveLength(1);
  await expectNoHorizontalOverflow(page);
});

test("unscorable response never renders fake numeric scores", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/scan", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "missing-1",
        handle: "missing_account",
        createdAt: new Date().toISOString(),
        model: "grok-4.5-latest",
        mode: "live",
        scores: null,
        confidence: 0.1,
        confidenceLabel: "low",
        recommendation: "UNSCORABLE",
        summary: "Not enough verified X evidence to score this account.",
        profile: {
          handle: "missing_account",
          displayName: "Missing account",
          bioSummary: "Insufficient public data.",
          accountHistory: "Profile resolved with sparse history.",
          activitySummary: "Too little public activity for an account-level assessment.",
        },
        coverage: {
          profileResolved: true,
          postsObserved: 2,
          distinctDaysObserved: 1,
          sufficiency: "insufficient",
          note: "Only two authored posts were available.",
        },
        diagnostics: {
          xSearchCalls: 0,
          webSearchCalls: 0,
          retrievalMode: "x-api",
          directTargetSources: 0,
          neutralVectorDetected: false,
          retrievedPosts: 2,
          analysisSampleSize: 2,
          identityCacheHit: false,
          estimatedXReadCostUsd: 0.02,
        },
        evidence: [],
        uncertainties: ["Sparse public activity."],
        sourceUrls: [],
        methodologyVersion: "vg-2026.08.7",
        cached: false,
        permalink: "/u/missing_account",
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("X ACCOUNT").fill("missing_account");
  await page.getByRole("button", { name: "Scan account" }).click();

  await expect(page.getByText("Insufficient X data — rescan")).toBeVisible();
  await expect(page.getByText("—", { exact: true })).toHaveCount(5);
  await expect(page.getByRole("link", { name: /Retry account scan/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Vouch on X/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("methodology page remains readable on phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { name: "Account behavior, not one post." })).toBeVisible();
  await expect(page.getByText(/VG-2026\.08\.7/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
