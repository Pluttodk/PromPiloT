import { test, expect, type Page } from "@playwright/test";

const PROJECT_ID = "8e182242-827d-40e4-9db1-7625d859efdd";

async function selectProject(page: Page) {
  await page.addInitScript((projectId) => {
    localStorage.setItem(
      "prom-pilot-project",
      JSON.stringify({ state: { currentProjectId: projectId }, version: 0 }),
    );
  }, PROJECT_ID);
}

test.describe("Traces Page", () => {
  test.beforeEach(async ({ page }) => {
    await selectProject(page);
    await page.goto("/traces");
  });

  test("date filter buttons and flow filter are visible on traces page", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 7 days" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Last 30 days" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Custom" })).toBeVisible();

    await expect(page.getByRole("combobox", { name: /filter by flow/i })).toBeVisible();
  });

  test("Last 7 days button is active by default", async ({ page }) => {
    const last7Button = page.getByRole("button", { name: "Last 7 days" });
    await expect(last7Button).toBeVisible();
    await expect(last7Button).toHaveAttribute("aria-pressed", "true");
  });

  test("clicking Custom shows date range inputs", async ({ page }) => {
    await page.getByRole("button", { name: "Custom" }).click();

    await expect(page.getByLabel("From date")).toBeVisible();
    await expect(page.getByLabel("To date")).toBeVisible();
  });

  test("clicking Today activates it and deactivates Last 7 days", async ({ page }) => {
    const todayButton = page.getByRole("button", { name: "Today" });
    const last7Button = page.getByRole("button", { name: "Last 7 days" });

    await todayButton.click();

    await expect(todayButton).toHaveAttribute("aria-pressed", "true");
    await expect(last7Button).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Trace Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await selectProject(page);
  });

  test("two-panel layout is present when navigating to a trace detail", async ({ page }) => {
    await page.goto("/traces");

    const traceCards = page.locator(".rounded-xl.border.border-slate-200.bg-white.p-5");
    await page.waitForTimeout(2000);
    const count = await traceCards.count();

    if (count > 0) {
      await traceCards.first().click();

      await expect(page.locator('[data-testid="node-list-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="detail-panel"]')).toBeVisible();
    } else {
      await expect(
        page.getByText("No traces found").or(page.getByText("No traces yet")),
      ).toBeVisible();
    }
  });

  test("node list panel and detail panel are side by side", async ({ page }) => {
    await page.goto("/traces");

    const traceCards = page.locator(".rounded-xl.border.border-slate-200.bg-white.p-5");
    await page.waitForTimeout(2000);
    const count = await traceCards.count();

    if (count > 0) {
      await traceCards.first().click();

      const nodePanel = page.locator('[data-testid="node-list-panel"]');
      const detailPanel = page.locator('[data-testid="detail-panel"]');

      await expect(nodePanel).toBeVisible();
      await expect(detailPanel).toBeVisible();

      const nodePanelBox = await nodePanel.boundingBox();
      const detailPanelBox = await detailPanel.boundingBox();

      if (nodePanelBox && detailPanelBox) {
        expect(nodePanelBox.x).toBeLessThan(detailPanelBox.x);
        expect(Math.abs(nodePanelBox.y - detailPanelBox.y)).toBeLessThan(20);
      }
    }
  });
});
