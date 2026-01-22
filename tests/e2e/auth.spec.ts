import { test, expect } from "@playwright/test";

/**
 * Authentication flow tests
 * Based on AGENTS.md requirement: E2E tests for main user flows
 */

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/login");

    // Check for login form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should display registration page", async ({ page }) => {
    await page.goto("/register");

    // Check for registration form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', "invalid@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should show error or stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    // Clear any cookies first
    await page.context().clearCookies();

    // Try to access protected page
    await page.goto("/articles");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});
