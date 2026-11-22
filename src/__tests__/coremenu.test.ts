import { beforeEach, describe, expect, it } from "vitest";
import {
  convertIngredientUnit,
  convertInstructionTemperatures,
  formatQuantity,
  mergeQuantities,
  normalizeUnit,
  scaleQuantity,
} from "@/lib/units";
import {
  calculateWhatCanICook,
  classifyAisle,
  formatGroceryListAsCsv,
  generateGroceryItemsFromPlan,
  normalizeIngredientName,
} from "@/lib/grocery-engine";
import {
  extractTimerMinutes,
  parseIngredientLine,
  parseIsoDurationMinutes,
  parseRecipeFromHtml,
  parseRecipeFromPlainText,
  validateImportUrl,
} from "@/lib/recipe-importer";
import {
  buildHouseholdBackupPayload,
  exportRecipeToMarkdown,
  validateHouseholdBackupPayload,
} from "@/lib/export-import";
import {
  createSessionToken,
  hashPassword,
  setTestSession,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import { resetMemoryStore, store } from "@/lib/store";
import {
  setupInitialAdminAction,
  createUserAdminAction,
  deleteUserAdminAction,
  loginAction,
} from "@/actions/auth";
import { createRecipeAction, logRecipeCookedAction } from "@/actions/recipes";
import { generateGroceryListFromPlanAction, completeGroceryListAction } from "@/actions/grocery";
import type { RecipeRecord } from "@/lib/types";
import { detectImageFormat, isSafeUploadFilename } from "@/lib/uploads";

describe("CoreMenu Unit & Conversion Engine", () => {
  it("normalizes units and scales servings accurately", () => {
    expect(normalizeUnit("Tablespoons")).toBe("tbsp");
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("cups")).toBe("cup");
    expect(scaleQuantity(200, 4, 6)).toBe(300);
    expect(scaleQuantity(null, 4, 6)).toBeNull();
    expect(formatQuantity(0.5)).toBe("½");
    expect(formatQuantity(1.25)).toBe("1¼");
  });

  it("converts metric <-> imperial weights, volumes, and step temperatures", () => {
    const toImpWeight = convertIngredientUnit(500, "g", "imperial");
    expect(toImpWeight.unit).toBe("lb");
    expect(toImpWeight.quantity).toBeCloseTo(1.1, 1);

    const toMetricWeight = convertIngredientUnit(8, "oz", "metric");
    expect(toMetricWeight.unit).toBe("g");
    expect(toMetricWeight.quantity).toBe(227);

    const toMetricVol = convertIngredientUnit(2, "cup", "metric");
    expect(toMetricVol.unit).toBe("ml");
    expect(toMetricVol.quantity).toBe(480);

    const toImpVol = convertIngredientUnit(500, "ml", "imperial");
    expect(toImpVol.unit).toBe("cup");
    expect(toImpVol.quantity).toBeCloseTo(2.11, 1);

    expect(
      convertInstructionTemperatures("Bake at 200°C for 20 minutes", "imperial")
    ).toBe("Bake at 392°F for 20 minutes");
    expect(
      convertInstructionTemperatures("Preheat oven to 350°F", "metric")
    ).toBe("Preheat oven to 177°C");
  });

  it("merges compatible weights and volumes and promotes >= 1000g/ml", () => {
    expect(mergeQuantities(600, "g", 500, "g")).toEqual({ quantity: 1.1, unit: "kg" });
    expect(mergeQuantities(1, "kg", 250, "g")).toEqual({ quantity: 1.25, unit: "kg" });
    expect(mergeQuantities(1, "tbsp", 3, "tsp")).toEqual({ quantity: 2, unit: "tbsp" });
    expect(mergeQuantities(3, "clove", 200, "g")).toBeNull();
  });
});

describe("CoreMenu Grocery Aggregation, Pantry Reconciliation & What Can I Cook", () => {
  it("normalizes ingredient names and classifies supermarket aisles", () => {
    expect(normalizeIngredientName("Fresh Garlic Cloves (minced)")).toBe("garlic clove");
    expect(classifyAisle("Chicken thigh fillets")).toBe("Meat & Seafood");
    expect(classifyAisle("Baby spinach")).toBe("Produce");
    expect(classifyAisle("Soy sauce")).toBe("Spices & Condiments");
  });

  it("merges duplicate ingredients across multiple planned meals and reconciles pantry", () => {
    const r1: RecipeRecord = {
      id: "r1",
      createdByUserId: null,
      title: "Teriyaki Chicken",
      slug: "teriyaki-chicken",
      description: null,
      imageUrl: null,
      sourceUrl: null,
      mealType: "prep" as const,
      cuisine: "Japanese",
      difficulty: "easy" as const,
      prepTimeMin: 15,
      cookTimeMin: 20,
      servings: 4,
      tags: [],
      ingredients: [
        { id: "1", name: "Chicken thigh fillets", quantity: 800, unit: "g", aisle: "Meat & Seafood" as const, store: "Woolworths", estimatedCost: 12 },
        { id: "2", name: "Jasmine rice", quantity: 400, unit: "g", aisle: "Pantry & Dry Goods" as const, estimatedCost: 2 },
        { id: "3", name: "Soy sauce", quantity: 60, unit: "ml", aisle: "Spices & Condiments" as const, isStaple: true },
      ],
      steps: [],
      caloriesPerServing: 550,
      proteinPerServing: "42.0",
      carbsPerServing: "55.0",
      fatPerServing: "14.0",
      estimatedCostPerServing: "4.00",
      rating: 5,
      isFavorite: true,
      cookCount: 0,
      lastCookedAt: null,
      notes: null,
      createdAt: "2026-11-22T00:00:00Z",
      updatedAt: "2026-11-22T00:00:00Z",
    };

    const r2: RecipeRecord = {
      ...r1,
      id: "r2",
      title: "Miso Salmon",
      servings: 2,
      ingredients: [
        { id: "4", name: "Jasmine rice", quantity: 200, unit: "g", aisle: "Pantry & Dry Goods" as const, estimatedCost: 1 },
        { id: "5", name: "Chicken thigh fillets", quantity: 400, unit: "g", aisle: "Meat & Seafood" as const, estimatedCost: 6 },
      ],
    };

    const entries = [
      { id: "e1", planDate: "2026-11-23", mealSlot: "dinner" as const, recipeId: "r1", leftoverId: null, customTitle: null, servings: 4, isBatchPrep: false, isLeftover: false, isCompleted: false, notes: null, createdByUserId: null, createdAt: "2026-11-22T00:00:00Z" },
      { id: "e2", planDate: "2026-11-24", mealSlot: "dinner" as const, recipeId: "r2", leftoverId: null, customTitle: null, servings: 2, isBatchPrep: false, isLeftover: false, isCompleted: false, notes: null, createdByUserId: null, createdAt: "2026-11-22T00:00:00Z" },
    ];

    const pantry = [
      { id: "p1", name: "Soy sauce", normalizedName: normalizeIngredientName("Soy sauce"), quantity: "300", unit: "ml", location: "pantry" as const, aisle: "Spices & Condiments" as const, isAlwaysStocked: true, expiresAt: null, lowStockThreshold: null, notes: null, createdAt: "2026-11-22T00:00:00Z", updatedAt: "2026-11-22T00:00:00Z" },
      { id: "p2", name: "Jasmine rice", normalizedName: normalizeIngredientName("Jasmine rice"), quantity: "250", unit: "g", location: "pantry" as const, aisle: "Pantry & Dry Goods" as const, isAlwaysStocked: false, expiresAt: null, lowStockThreshold: null, notes: null, createdAt: "2026-11-22T00:00:00Z", updatedAt: "2026-11-22T00:00:00Z" },
    ];

    const map = new Map([
      ["r1", r1],
      ["r2", r2],
    ]);

    const flagged = generateGroceryItemsFromPlan(entries, map, pantry, {
      pantryMode: "flag",
    });
    const chicken = flagged.find((i) => i.normalizedName === "chicken thigh fillet");
    expect(chicken?.quantity).toBe(1.2);
    expect(chicken?.unit).toBe("kg");
    expect(chicken?.sourceRecipes).toEqual(["Teriyaki Chicken", "Miso Salmon"]);

    const soy = flagged.find((i) => i.normalizedName === "soy sauce");
    expect(soy?.inPantryFlag).toBe("stocked");

    const skipped = generateGroceryItemsFromPlan(entries, map, pantry, {
      pantryMode: "skip_staples",
    });
    expect(skipped.find((i) => i.normalizedName === "soy sauce")).toBeUndefined();
    const riceSub = skipped.find((i) => i.normalizedName === "jasmine rice");
    expect(riceSub?.quantity).toBe(350);
    expect(riceSub?.unit).toBe("g");

    const matches = calculateWhatCanICook([r1, r2], pantry);
    expect(matches[0].recipe.id).toBe("r1");
    expect(matches[0].matchPct).toBe(67);

    const csv = formatGroceryListAsCsv(
      {
        id: "l1",
        name: "Shop Week",
        startDate: "2026-11-23",
        endDate: "2026-11-29",
        status: "active",
        estimatedTotal: "21.00",
        actualTotal: null,
        completedAt: null,
        createdByUserId: null,
        createdAt: "2026-11-22T00:00:00Z",
        updatedAt: "2026-11-22T00:00:00Z",
      },
      [
        {
          id: "gi1",
          listId: "l1",
          name: "Chicken thigh fillets",
          normalizedName: "chicken thigh fillet",
          quantity: "1.2",
          unit: "kg",
          aisle: "Meat & Seafood",
          store: "Woolworths",
          isChecked: false,
          inPantryFlag: "none",
          pantryNote: null,
          isManual: false,
          estimatedCost: "18.00",
          sourceRecipes: ["Teriyaki Chicken", "Miso Salmon"],
          notes: null,
          sortOrder: 0,
          createdAt: "2026-11-22T00:00:00Z",
        },
      ]
    );
    expect(csv).toContain("Shop Week,2026-11-23,Chicken thigh fillets,1.2,kg,Meat & Seafood,Woolworths,Groceries,18.00,No");
  });
});

describe("CoreMenu Recipe URL & Text Importer + SSRF Guard", () => {
  it("blocks private/localhost URLs and accepts valid public https URLs", () => {
    expect(() => validateImportUrl("http://localhost:3000/recipe")).toThrow();
    expect(() => validateImportUrl("http://127.0.0.1/admin")).toThrow();
    expect(() => validateImportUrl("http://192.168.1.10/test")).toThrow();
    expect(() => validateImportUrl("http://10.0.0.5/internal")).toThrow();
    expect(() => validateImportUrl("file:///etc/passwd")).toThrow();
    expect(validateImportUrl("https://example.com/recipe").hostname).toBe("example.com");
  });

  it("parses ISO durations, step timers, ingredient lines, and schema.org JSON-LD", () => {
    expect(parseIsoDurationMinutes("PT1H25M")).toBe(85);
    expect(extractTimerMinutes("Simmer gently for 15-20 minutes until thickened")).toBe(20);
    expect(extractTimerMinutes("Bake 1 hour 10 mins")).toBe(70);

    const ing = parseIngredientLine("1 1/2 cups rolled oats, toasted");
    expect(ing.quantity).toBe(1.5);
    expect(ing.unit).toBe("cup");
    expect(ing.name).toBe("rolled oats");
    expect(ing.prepNote).toBe("toasted");

    const html = `
      <html><head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Recipe",
                "name": "Garlic Butter Salmon",
                "description": "Quick pan seared salmon.",
                "prepTime": "PT10M",
                "cookTime": "PT15M",
                "recipeYield": "2 servings",
                "recipeCategory": "Dinner",
                "recipeCuisine": "Modern",
                "recipeIngredient": ["400 g salmon fillets", "2 tbsp butter"],
                "recipeInstructions": [
                  { "@type": "HowToSection", "name": "Cook", "itemListElement": [{ "@type": "HowToStep", "text": "Sear salmon for 8 minutes." }] }
                ],
                "nutrition": { "calories": "480 kcal", "proteinContent": "38 g" }
              }
            ]
          }
        </script>
      </head><body></body></html>
    `;

    const draft = parseRecipeFromHtml(html, "https://example.com/salmon");
    expect(draft.title).toBe("Garlic Butter Salmon");
    expect(draft.prepTimeMin).toBe(10);
    expect(draft.cookTimeMin).toBe(15);
    expect(draft.servings).toBe(2);
    expect(draft.caloriesPerServing).toBe(480);
    expect(draft.proteinPerServing).toBe(38);
    expect(draft.steps[0].section).toBe("Cook");
    expect(draft.steps[0].timerMinutes).toBe(8);

    const plain = parseRecipeFromPlainText("Test Dish", "2 eggs\n100 g flour", "1. Whisk and fry 4 minutes.");
    expect(plain.ingredients).toHaveLength(2);
    expect(plain.steps[0].timerMinutes).toBe(4);
  });
});

describe("CoreMenu Auth, Store & Server Actions Lifecycle", () => {
  beforeEach(() => {
    resetMemoryStore();
    setTestSession(undefined);
  });

  it("hashes passwords and verifies signed session tokens", () => {
    const hash = hashPassword("SuperSecret99!");
    expect(verifyPassword("SuperSecret99!", hash)).toBe(true);
    expect(verifyPassword("WrongPass!", hash)).toBe(false);

    const token = createSessionToken({
      userId: "u1",
      email: "chef@coremenu.local",
      name: "Chef",
      role: "admin",
      sessionVersion: 1,
    });
    const decoded = verifySessionToken(token);
    expect(decoded?.userId).toBe("u1");
    expect(verifySessionToken(`${token}tampered`)).toBeNull();
  });

  it("runs first-run setup, prevents duplicate setup, protects last admin, logs cook + leftovers, and roundtrips backup", async () => {
    const setupRes = await setupInitialAdminAction({
      name: "Nicolas Kim",
      email: "nicolas@coremenu.local",
      password: "Password123!",
      householdName: "Kim Kitchen",
      preferredUnits: "metric",
      currency: "AUD",
      weeklyGroceryBudget: 250,
      seedMode: "demo",
    });

    expect(setupRes.success).toBe(true);
    expect(setupRes.user?.role).toBe("admin");

    // Second setup attempt must fail
    const secondSetup = await setupInitialAdminAction({
      name: "Attacker",
      email: "a@b.com",
      password: "Password123!",
      seedMode: "clean",
    });
    expect(secondSetup.success).toBe(false);

    // Create a non-admin member and verify admin can delete member, but cannot delete self
    const memberRes = await createUserAdminAction({
      name: "Partner",
      email: "partner@coremenu.local",
      password: "Password123!",
      role: "user",
    });
    expect(memberRes.success).toBe(true);

    const delSelf = await deleteUserAdminAction(setupRes.user!.id);
    expect(delSelf.success).toBe(false);

    const delMember = await deleteUserAdminAction(memberRes.user!.id);
    expect(delMember.success).toBe(true);

    // Sign in as admin again cleanly
    const loginRes = await loginAction({
      email: "nicolas@coremenu.local",
      password: "Password123!",
    });
    expect(loginRes.success).toBe(true);

    // Create a recipe and log cook + leftover batch
    const created = await createRecipeAction({
      title: "Sheet Pan Fajitas",
      description: "Fast weeknight chicken fajitas",
      mealType: "dinner",
      difficulty: "easy",
      prepTimeMin: 10,
      cookTimeMin: 20,
      servings: 4,
      tags: ["High Protein"],
      ingredients: [
        { id: "i1", name: "Chicken breast", quantity: 700, unit: "g", aisle: "Meat & Seafood" },
      ],
      steps: [{ id: "s1", instruction: "Bake at 200°C for 20 minutes", timerMinutes: 20 }],
      caloriesPerServing: 450,
      proteinPerServing: 40,
      estimatedCostPerServing: 5.25,
    });
    expect(created.success).toBe(true);

    const cooked = await logRecipeCookedAction({
      recipeId: created.recipe!.id,
      servingsMade: 4,
      rating: 5,
      saveLeftovers: {
        portions: 3,
        storageLocation: "fridge",
        useByDays: 4,
      },
    });
    expect(cooked.success).toBe(true);
    expect(cooked.recipe?.cookCount).toBe(1);
    expect(cooked.leftoverBatch?.remainingPortions).toBe(3);

    // Generate grocery list from demo week plan and complete it with restock
    const lists = await store.listGroceryLists();
    expect(lists.length).toBeGreaterThan(0);
    const genRes = await generateGroceryListFromPlanAction({
      name: "E2E Generated List",
      startDate: lists[0].startDate || "2026-11-16",
      endDate: lists[0].endDate || "2026-11-29",
      pantryMode: "flag",
      includeLeftoverSlots: false,
      includeQuickStaples: true,
    });
    expect(genRes.success).toBe(true);

    const completed = await completeGroceryListAction({
      listId: genRes.list!.id,
      actualTotal: 145.5,
      restockCheckedToPantry: false,
    });
    expect(completed.success).toBe(true);
    expect(completed.list?.status).toBe("completed");
    expect(completed.list?.actualTotal).toBe("145.50");

    // Markdown + JSON backup export & validation roundtrip
    const md = exportRecipeToMarkdown(created.recipe!);
    expect(md).toContain("# Sheet Pan Fajitas");

    const exported = await store.exportHouseholdData();
    const payload = buildHouseholdBackupPayload(exported);
    const validated = validateHouseholdBackupPayload(JSON.parse(JSON.stringify(payload)));
    expect(validated.recipes.length).toBeGreaterThanOrEqual(9);
  });

  it("validates upload image magic bytes and safe filenames", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectImageFormat(pngHeader)).toEqual({ ext: "png", mime: "image/png" });
    expect(detectImageFormat(Buffer.from("not an image"))).toBeNull();
    expect(isSafeUploadFilename("abc-123.png")).toBe(true);
    expect(isSafeUploadFilename("../secret.png")).toBe(false);
  });
});
