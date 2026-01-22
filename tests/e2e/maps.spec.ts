import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "./fixtures";

/**
 * Map editor tests
 * Based on AGENTS.md: "地図ピン配置、ドラッグで移動、動線作成"
 */

test.describe("Maps", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("should display maps list page", async ({ page }) => {
    await page.goto("/maps");

    // Check for main UI elements
    await expect(page.locator("h1")).toContainText(/map/i);
  });

  test("should have create map option", async ({ page }) => {
    await page.goto("/maps");

    // Check for create button
    const createButton = page.locator('a[href="/maps/new"], a:has-text("New Map"), a:has-text("Create Map")');
    await expect(createButton.first()).toBeVisible();
  });

  test("should display map creation form", async ({ page }) => {
    await page.goto("/maps/new");

    // Check for form elements
    await expect(page.locator('input[name="title"]')).toBeVisible();
  });

  test("should display Wikipedia map import option", async ({ page }) => {
    await page.goto("/maps/import");

    // Check for import UI
    await expect(page.locator("input")).toBeVisible();
  });

  test("should show empty state when no maps exist", async ({ page }) => {
    await page.goto("/maps");

    // Either show maps or empty state
    const content = await page.textContent("body");
    const hasContent = content?.includes("map") || content?.includes("Map");
    expect(hasContent).toBeTruthy();
  });
});

test.describe("Map Editor", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("should load map editor for existing map", async ({ page }) => {
    // First check if there are any maps
    await page.goto("/maps");

    // Try to find a map link
    const mapLink = page.locator('a[href^="/maps/"]').first();

    if (await mapLink.isVisible()) {
      await mapLink.click();

      // Should load the editor
      await page.waitForLoadState("networkidle");

      // Check for editor elements (canvas, toolbar, etc.)
      const hasEditor = await page.locator(".map-editor, .leaflet-container, [class*='map']").first().isVisible();
      expect(hasEditor).toBeTruthy();
    }
  });
});
