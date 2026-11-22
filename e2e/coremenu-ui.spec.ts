import { expect, Page, test, BrowserContext } from "@playwright/test";

async function assertNoHorizontalOverflow(page: Page, routeLabel: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.scrollWidth,
    `Horizontal overflow detected on ${routeLabel}: scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth}`
  ).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test.describe.serial("CoreMenu End-to-End UI Flows", () => {
  let context: BrowserContext;
  let page: Page;
  let pageErrors: string[] = [];
  let consoleErrors: string[] = [];
  let failedResponses: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("response", (res) => {
      if (res.status() >= 400 && !res.url().includes("favicon")) {
        failedResponses.push(`${res.status()} ${res.url()}`);
      }
    });
  });

  test.beforeEach(() => {
    pageErrors = [];
    consoleErrors = [];
    failedResponses = [];
  });

  test.afterEach(async () => {
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join("; ")}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join("; ")}`).toEqual([]);
    expect(failedResponses, `Failed HTTP responses: ${failedResponses.join("; ")}`).toEqual([]);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("1. Health check, first-run /setup with Demo Recipes & theme toggle persistence", async ({
    request,
  }) => {
    const healthRes = await request.get("/api/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe("ok");
    expect(healthJson.app).toBe("coremenu");

    await page.goto("/");
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByText("CoreMenu Setup")).toBeVisible();

    await page.locator("#setup-name").fill("Nicolas Kim");
    await page.locator("#setup-email").fill("nicolas@coremenu.local");
    await page.locator("#setup-password").fill("TestPass123!");
    await page.locator("#setup-confirm-password").fill("TestPass123!");
    await page.getByRole("button", { name: /Load Demo Recipes & Plan/i }).click();
    await page.getByRole("button", { name: /Create Admin & Launch CoreMenu/i }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Kitchen Cockpit" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/ (dark)");

    // Verify theme toggle works and persists across reload
    const themeGroup = page.getByRole("group", { name: "Theme mode" });
    await themeGroup.getByRole("button", { name: "Light" }).click();
    await expect(
      page.evaluate(() => document.documentElement.classList.contains("dark"))
    ).resolves.toBe(false);
    await page.reload();
    await expect(
      page.evaluate(() => document.documentElement.classList.contains("dark"))
    ).resolves.toBe(false);
    await themeGroup.getByRole("button", { name: "Dark" }).click();
  });

  test("2. Dashboard random meal picker works", async () => {
    await page.getByRole("button", { name: /Pick a Recipe for Me/i }).click();
    await expect(page.getByRole("link", { name: /Open Recipe/i })).toBeVisible();
  });

  test("3. Recipe Book search, create recipe, dynamic scaler, metric/imperial converter & Cook Mode", async () => {
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Recipe Book" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/recipes");

    // Create a new recipe
    await page.getByRole("link", { name: "New Recipe" }).first().click();
    await expect(page).toHaveURL(/\/recipes\/new$/);

    await page.locator("#recipe-title").fill("E2E Honey Garlic Chicken");
    await page.locator("#recipe-servings").fill("4");
    await page.locator("#recipe-kcal").fill("480");
    await page.locator("#recipe-protein").fill("40");

    await page.getByLabel("Ingredient 1 quantity").fill("500");
    await page.getByLabel("Ingredient 1 unit").fill("g");
    await page.getByLabel("Ingredient 1 name").fill("Chicken breast");

    await page.getByLabel("Step 1 timer minutes").fill("12");
    await page
      .getByLabel("Step 1 instruction")
      .fill("Bake chicken at 200°C for 12 minutes until golden.");

    await page.getByRole("button", { name: "Save Recipe" }).click();
    await expect(page).toHaveURL(/\/recipes\/[a-f0-9-]+$/);
    await expect(page.getByRole("heading", { name: "E2E Honey Garlic Chicken" })).toBeVisible();

    // Test Serving Scaler (4 -> 5)
    await page.getByRole("button", { name: "Increase servings" }).click();
    await expect(page.getByTestId("scaled-servings-value")).toHaveText("5 srv");
    await expect(page.getByText("625 g")).toBeVisible();

    // Test Metric <-> Imperial conversion
    await page.getByRole("button", { name: /Imperial/i }).click();
    await expect(page.getByText(/392°F/)).toBeVisible();
    await page.getByRole("button", { name: /Metric/i }).click();

    // Launch Cook Mode & start built-in step timer
    await page.getByRole("link", { name: /Start Cook Mode/i }).click();
    await expect(page).toHaveURL(/\/cook/);
    await page.getByRole("button", { name: /Start 12m Timer/i }).click();
    await expect(page.getByTestId("active-timers-bar")).toContainText(/12:00|11:5\d/);
    await page.getByRole("link", { name: /Exit Cook Mode/i }).click();
    await expect(page).toHaveURL(/\/recipes\/[a-f0-9-]+$/);
  });

  test("4. Meal Planner weekly schedule & Smart Grocery List generation + CSV export", async ({
    request,
  }) => {
    await page.goto("/planner");
    await expect(page.getByRole("heading", { name: "Meal Prep Planner" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/planner");

    await page.getByRole("button", { name: /Generate Grocery List/i }).click();
    await page.locator("#gen-list-name").fill("E2E Generated Shop");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Generate Grocery List/i })
      .click();

    await expect(page).toHaveURL(/\/grocery\?listId=/);
    await expect(page.getByRole("heading", { name: "Smart Grocery Lists" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/grocery");

    // Switch grouping to Store and back to Aisle
    await page.getByRole("button", { name: /Group by Store/i }).click();
    await page.getByRole("button", { name: /Group by Aisle/i }).click();

    // Add manual grocery item
    await page.locator("#add-gi-name").fill("Sparkling Mineral Water");
    await page.getByRole("button", { name: "Add Item" }).click();
    await expect(page.getByText("Sparkling Mineral Water")).toBeVisible();

    // Verify CSV export endpoint works with active session cookie
    const listId = new URL(page.url()).searchParams.get("listId");
    expect(listId).toBeTruthy();
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const csvRes = await request.get(`/api/export/grocery/${listId}?format=csv`, {
      headers: { Cookie: cookieHeader },
    });
    expect(csvRes.status()).toBe(200);
    const csvBody = await csvRes.text();
    expect(csvBody).toContain("Sparkling Mineral Water");
  });

  test("5. Pantry inventory, Leftover Stash & What Can I Cook?", async () => {
    await page.goto("/pantry");
    await expect(page.getByRole("heading", { name: "Pantry & Leftover Stash" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/pantry");

    await page.getByRole("tab", { name: /Leftover Stash/i }).click();
    await expect(
      page.getByRole("heading", { name: /Teriyaki Chicken Meal Prep Bowls/i })
    ).toBeVisible();

    const eatBtn = page.getByRole("button", { name: "-1 Eaten" }).first();
    await eatBtn.click();

    await page.getByRole("tab", { name: /What Can I Cook/i }).click();
    await expect(page.getByText(/% match/i).first()).toBeVisible();
  });

  test("6. Settings macro goals update, logout & login cycle", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings & Household" })).toBeVisible();

    await page.locator("#goal-protein").fill("165");
    await page.getByRole("button", { name: /Save Profile & Goals/i }).click();
    await expect(page.getByText(/Profile & nutrition goals updated/i)).toBeVisible();

    // Logout & sign back in
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.locator("#login-email").fill("nicolas@coremenu.local");
    await page.locator("#login-password").fill("TestPass123!");
    await page.getByRole("button", { name: /Sign In to Kitchen/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Kitchen Cockpit" })).toBeVisible();
  });
});
