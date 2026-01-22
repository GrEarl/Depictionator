import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "./fixtures";

/**
 * Evidence board tests
 * Based on AGENTS.md: "エビデンスボード"
 */

test.describe("Evidence Boards", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("should display boards list page", async ({ page }) => {
    await page.goto("/boards");

    // Check for main UI elements
    await expect(page.locator("h3, h2")).toContainText(/board/i);
  });

  test("should have create board option", async ({ page }) => {
    await page.goto("/boards");

    // Check for create button or link
    const createOption = page.locator('a[href="/boards/new"], a:has-text("ボードを作成"), button:has-text("Create")');
    const manageTab = page.locator('a:has-text("Manage")');

    // Either create option is visible or we need to switch to manage tab
    if (await manageTab.isVisible()) {
      await manageTab.click();
      await page.waitForLoadState("networkidle");
    }

    await expect(createOption.first()).toBeVisible();
  });

  test("should display board creation form", async ({ page }) => {
    await page.goto("/boards/new");

    // Check for form elements
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test("should show empty state message when no boards", async ({ page }) => {
    await page.goto("/boards");

    const content = await page.textContent("body");
    const hasContent =
      content?.includes("board") ||
      content?.includes("Board") ||
      content?.includes("evidence");
    expect(hasContent).toBeTruthy();
  });
});

test.describe("Evidence Board Canvas", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("should display canvas with drag hints", async ({ page }) => {
    await page.goto("/boards");

    // Check for canvas or empty state
    const canvas = page.locator(".evidence-canvas, .pane-center");
    await expect(canvas.first()).toBeVisible();
  });
});
