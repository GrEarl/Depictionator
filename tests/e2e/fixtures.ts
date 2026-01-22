import { test, expect, type Page } from "@playwright/test";

/**
 * Test fixtures and helpers for Depictionator E2E tests
 */

// Test user credentials (should match seed data or mock auth)
export const TEST_USER = {
  email: "test@example.com",
  password: "testpassword123",
};

// Test workspace
export const TEST_WORKSPACE = {
  name: "Test Workspace",
  slug: "test-workspace",
};

/**
 * Login helper function
 */
export async function login(page: Page, email = TEST_USER.email, password = TEST_USER.password) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/^(?!.*\/login).*/);
}

/**
 * Ensure user is logged in, login if not
 */
export async function ensureLoggedIn(page: Page) {
  await page.goto("/");

  // Check if we're redirected to login
  if (page.url().includes("/login")) {
    await login(page);
  }
}

/**
 * Select a workspace
 */
export async function selectWorkspace(page: Page, workspaceSlug = TEST_WORKSPACE.slug) {
  // Look for workspace selector or form
  const workspaceButton = page.locator(`form[action="/api/workspaces/open"] button`).first();
  if (await workspaceButton.isVisible()) {
    await workspaceButton.click();
    await page.waitForLoadState("networkidle");
  }
}

/**
 * Create a new entity
 */
export async function createEntity(
  page: Page,
  options: { title: string; type?: string; summary?: string }
) {
  await page.goto("/articles/new");
  await page.fill('input[name="title"]', options.title);

  if (options.type) {
    await page.selectOption('select[name="type"]', options.type);
  }

  if (options.summary) {
    await page.fill('textarea[name="summaryMd"]', options.summary);
  }

  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to wiki page
 */
export async function goToWikiPage(page: Page, title: string) {
  const encodedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  await page.goto(`/wiki/${encodedTitle}`);
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, textMatch?: string | RegExp) {
  const toast = page.locator("[role='alert'], .toast, .notification");
  await expect(toast).toBeVisible({ timeout: 5000 });

  if (textMatch) {
    if (typeof textMatch === "string") {
      await expect(toast).toContainText(textMatch);
    } else {
      await expect(toast).toHaveText(textMatch);
    }
  }

  return toast;
}

/**
 * Take a labeled screenshot for debugging
 */
export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: true });
}
