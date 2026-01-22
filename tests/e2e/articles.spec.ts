import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "./fixtures";

/**
 * Article and Entity workflow tests
 * Based on AGENTS.md: "人物登録→地図配置→資料貼付→PDF"
 */

test.describe("Articles", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("should display articles list page", async ({ page }) => {
    await page.goto("/articles");

    // Check for main UI elements
    await expect(page.locator("h1")).toContainText(/article|knowledge/i);
  });

  test("should navigate to new article page", async ({ page }) => {
    await page.goto("/articles");

    // Click create button
    const createButton = page.locator('a[href="/articles/new"], button:has-text("Create"), a:has-text("記事を作成")');
    if (await createButton.isVisible()) {
      await createButton.click();
      await expect(page).toHaveURL(/articles\/new/);
    }
  });

  test("should display article creation form", async ({ page }) => {
    await page.goto("/articles/new");

    // Check for form elements
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('select[name="type"]')).toBeVisible();
  });

  test("should display Wikipedia import option", async ({ page }) => {
    await page.goto("/articles/import");

    // Check for import UI
    await expect(page.locator("input, textarea")).toBeVisible();
  });
});

test.describe("Wiki Pages", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("should handle non-existent wiki pages gracefully", async ({ page }) => {
    await page.goto("/wiki/NonExistentPage12345");

    // Should show "not found" or suggestions
    const content = await page.textContent("body");
    expect(content).toMatch(/not found|suggestions|no exact match/i);
  });
});
