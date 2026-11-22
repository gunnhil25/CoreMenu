import {
  AISLE_CATEGORIES,
  type AisleCategory,
  type GroceryItemRecord,
  type GroceryListRecord,
  type MealPlanEntryRecord,
  type PantryGenerationMode,
  type PantryItemRecord,
  type PantryMatchFlag,
  type RecipeRecord,
  type WhatCanICookMatch,
} from "@/lib/types";
import { mergeQuantities, normalizeUnit, roundClean, scaleQuantity } from "@/lib/units";

const STOP_WORDS = new Set([
  "fresh",
  "organic",
  "large",
  "medium",
  "small",
  "extra",
  "virgin",
  "raw",
  "lean",
  "skinless",
  "boneless",
  "free",
  "range",
]);

export function normalizeIngredientName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((tok) => tok && !STOP_WORDS.has(tok));

  if (cleaned.length === 0) {
    return raw.toLowerCase().trim();
  }

  // Singularize simple trailing plural on the final noun
  const lastIdx = cleaned.length - 1;
  let last = cleaned[lastIdx];
  if (last.length > 4 && last.endsWith("ies")) {
    last = `${last.slice(0, -3)}y`;
  } else if (last.length > 4 && last.endsWith("oes")) {
    last = last.slice(0, -2);
  } else if (
    last.length > 3 &&
    last.endsWith("s") &&
    !last.endsWith("ss") &&
    !last.endsWith("us")
  ) {
    last = last.slice(0, -1);
  }
  cleaned[lastIdx] = last;
  return cleaned.join(" ");
}

const AISLE_KEYWORDS: Array<{ aisle: AisleCategory; keywords: string[] }> = [
  {
    aisle: "Meat & Seafood",
    keywords: [
      "chicken",
      "beef",
      "mince",
      "steak",
      "pork",
      "bacon",
      "lamb",
      "turkey",
      "salmon",
      "tuna",
      "prawn",
      "shrimp",
      "fish",
      "barramundi",
      "sausage",
      "ham",
      "prosciutto",
    ],
  },
  {
    aisle: "Dairy & Eggs",
    keywords: [
      "milk",
      "cheese",
      "cheddar",
      "mozzarella",
      "parmesan",
      "feta",
      "ricotta",
      "halloumi",
      "yoghurt",
      "yogurt",
      "butter",
      "cream",
      "egg",
      "eggs",
      "sour cream",
      "cottage",
    ],
  },
  {
    aisle: "Produce",
    keywords: [
      "onion",
      "garlic",
      "ginger",
      "tomato",
      "spinach",
      "kale",
      "lettuce",
      "broccoli",
      "broccolini",
      "carrot",
      "capsicum",
      "pepper",
      "zucchini",
      "cucumber",
      "avocado",
      "potato",
      "sweet potato",
      "mushroom",
      "lemon",
      "lime",
      "banana",
      "berry",
      "blueberries",
      "strawberries",
      "apple",
      "coriander",
      "cilantro",
      "parsley",
      "basil",
      "spring onion",
      "shallot",
      "celery",
      "cabbage",
      "bok choy",
      "chilli",
      "chili",
      "edamame",
    ],
  },
  {
    aisle: "Bakery",
    keywords: [
      "bread",
      "sourdough",
      "wrap",
      "tortilla",
      "pita",
      "bun",
      "roll",
      "baguette",
      "naan",
      "brioche",
      "croissant",
    ],
  },
  {
    aisle: "Frozen",
    keywords: ["frozen", "peas", "ice cream", "dumpling", "gyoza"],
  },
  {
    aisle: "Spices & Condiments",
    keywords: [
      "salt",
      "black pepper",
      "cumin",
      "paprika",
      "turmeric",
      "oregano",
      "thyme",
      "rosemary",
      "cinnamon",
      "garam masala",
      "curry powder",
      "chilli flakes",
      "soy sauce",
      "tamari",
      "sesame oil",
      "olive oil",
      "oil",
      "vinegar",
      "honey",
      "maple syrup",
      "mustard",
      "mayonnaise",
      "mayo",
      "sriracha",
      "teriyaki",
      "oyster sauce",
      "fish sauce",
      "miso",
      "tahini",
      "tomato paste",
      "stock",
      "broth",
      "worcestershire",
      "vanilla",
    ],
  },
  {
    aisle: "Beverages",
    keywords: ["coffee", "tea", "juice", "sparkling water", "kombucha", "almond milk", "oat milk"],
  },
  {
    aisle: "Household & Other",
    keywords: ["foil", "baking paper", "glad wrap", "paper towel", "sponge", "detergent", "zip lock"],
  },
];

export function classifyAisle(name: string): AisleCategory {
  const lower = name.toLowerCase();
  for (const entry of AISLE_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.aisle;
    }
  }
  return "Pantry & Dry Goods";
}

export interface GeneratedGroceryDraftItem {
  name: string;
  normalizedName: string;
  quantity: number | null;
  unit: string;
  aisle: AisleCategory;
  store: string | null;
  inPantryFlag: PantryMatchFlag;
  pantryNote: string | null;
  estimatedCost: number | null;
  sourceRecipes: string[];
  notes: string | null;
}

export function generateGroceryItemsFromPlan(
  entries: MealPlanEntryRecord[],
  recipesById: Map<string, RecipeRecord>,
  pantryItems: PantryItemRecord[],
  options: {
    pantryMode: PantryGenerationMode;
    includeLeftoverSlots?: boolean;
  } = { pantryMode: "flag", includeLeftoverSlots: false }
): GeneratedGroceryDraftItem[] {
  const aggregated: Array<{
    name: string;
    normalizedName: string;
    quantity: number | null;
    unit: string;
    aisle: AisleCategory;
    store: string | null;
    estimatedCost: number | null;
    sourceRecipes: Set<string>;
    isStaple: boolean;
  }> = [];

  for (const entry of entries) {
    if (entry.isLeftover && !options.includeLeftoverSlots) continue;
    if (!entry.recipeId) continue;

    const recipe = recipesById.get(entry.recipeId);
    if (!recipe) continue;

    const scaleRatio =
      recipe.servings > 0 ? Math.max(0.1, entry.servings / recipe.servings) : 1;

    for (const ing of recipe.ingredients) {
      const normalizedName = normalizeIngredientName(ing.name);
      if (!normalizedName) continue;
      const scaledQty = scaleQuantity(ing.quantity, recipe.servings, entry.servings);
      const unit = normalizeUnit(ing.unit);
      const scaledCost =
        ing.estimatedCost !== null && ing.estimatedCost !== undefined
          ? roundClean(ing.estimatedCost * scaleRatio, 2)
          : null;

      // Find an existing bucket with same normalizedName & mergeable unit
      let mergedIntoExisting = false;
      for (const bucket of aggregated) {
        if (bucket.normalizedName !== normalizedName) continue;
        const merged = mergeQuantities(bucket.quantity, bucket.unit, scaledQty, unit);
        if (merged) {
          bucket.quantity = merged.quantity;
          bucket.unit = merged.unit;
          bucket.sourceRecipes.add(recipe.title);
          if (scaledCost !== null) {
            bucket.estimatedCost = roundClean((bucket.estimatedCost ?? 0) + scaledCost, 2);
          }
          if (!bucket.store && ing.store) bucket.store = ing.store;
          if (ing.isStaple) bucket.isStaple = true;
          mergedIntoExisting = true;
          break;
        }
      }

      if (!mergedIntoExisting) {
        aggregated.push({
          name: ing.name.trim(),
          normalizedName,
          quantity: scaledQty,
          unit,
          aisle: ing.aisle || classifyAisle(ing.name),
          store: ing.store?.trim() || null,
          estimatedCost: scaledCost,
          sourceRecipes: new Set([recipe.title]),
          isStaple: Boolean(ing.isStaple),
        });
      }
    }
  }

  // Reconcile against pantry items
  const pantryByNorm = new Map<string, PantryItemRecord[]>();
  for (const p of pantryItems) {
    const norm = p.normalizedName || normalizeIngredientName(p.name);
    const list = pantryByNorm.get(norm) ?? [];
    list.push(p);
    pantryByNorm.set(norm, list);
  }

  const results: GeneratedGroceryDraftItem[] = [];
  for (const bucket of aggregated) {
    const matches = pantryByNorm.get(bucket.normalizedName) ?? [];
    let flag: PantryMatchFlag = "none";
    let pantryNote: string | null = null;
    let finalQty = bucket.quantity;
    let finalUnit = bucket.unit;
    let skipItem = false;

    if (options.pantryMode !== "ignore") {
      const alwaysStocked = matches.find((m) => m.isAlwaysStocked) || (bucket.isStaple ? null : undefined);
      if (matches.some((m) => m.isAlwaysStocked)) {
        flag = "stocked";
        pantryNote = "Always-stocked pantry staple";
        if (options.pantryMode === "skip_staples") {
          skipItem = true;
        }
      } else if (matches.length > 0) {
        // Attempt unit-compatible subtraction using negative second term via merge
        const pantryPrimary = matches[0];
        const pantryQty = parseFloat(pantryPrimary.quantity);
        if (!Number.isNaN(pantryQty) && pantryQty > 0) {
          const diff = mergeQuantities(
            bucket.quantity,
            bucket.unit,
            -pantryQty,
            pantryPrimary.unit
          );
          if (diff && diff.quantity !== null) {
            if (diff.quantity <= 0) {
              flag = "stocked";
              pantryNote = `In ${pantryPrimary.location}: ${pantryPrimary.quantity} ${pantryPrimary.unit}`;
              if (options.pantryMode === "subtract" || options.pantryMode === "skip_staples") {
                skipItem = true;
              }
            } else {
              flag = "partial";
              pantryNote = `Have ${pantryPrimary.quantity} ${pantryPrimary.unit} in ${pantryPrimary.location}`;
              if (options.pantryMode === "subtract" || options.pantryMode === "skip_staples") {
                finalQty = diff.quantity;
                finalUnit = diff.unit;
              }
            }
          } else {
            flag = "partial";
            pantryNote = `Have ${pantryPrimary.quantity} ${pantryPrimary.unit} in ${pantryPrimary.location}`;
          }
        }
      } else if (alwaysStocked === null && options.pantryMode === "skip_staples") {
        // Ingredient itself marked isStaple on recipe
        flag = "stocked";
        pantryNote = "Recipe staple item";
        skipItem = true;
      }
    }

    if (skipItem) continue;

    results.push({
      name: bucket.name,
      normalizedName: bucket.normalizedName,
      quantity: finalQty,
      unit: finalUnit,
      aisle: bucket.aisle,
      store: bucket.store,
      inPantryFlag: flag,
      pantryNote,
      estimatedCost: bucket.estimatedCost,
      sourceRecipes: Array.from(bucket.sourceRecipes),
      notes: null,
    });
  }

  const aisleOrder = new Map(AISLE_CATEGORIES.map((a, i) => [a, i]));
  results.sort((a, b) => {
    const ao = aisleOrder.get(a.aisle) ?? 99;
    const bo = aisleOrder.get(b.aisle) ?? 99;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });

  return results;
}

export function calculateWhatCanICook(
  recipes: RecipeRecord[],
  pantryItems: PantryItemRecord[]
): WhatCanICookMatch[] {
  const inStockSet = new Set<string>();
  for (const p of pantryItems) {
    const qty = parseFloat(p.quantity);
    if (p.isAlwaysStocked || (!Number.isNaN(qty) && qty > 0)) {
      inStockSet.add(p.normalizedName || normalizeIngredientName(p.name));
    }
  }

  const matches: WhatCanICookMatch[] = recipes.map((recipe) => {
    const considered = recipe.ingredients.filter((i) => i.name.trim().length > 0);
    const totalIngredients = considered.length;
    const matchedIngredients: string[] = [];
    const missingIngredients: string[] = [];

    for (const ing of considered) {
      const norm = normalizeIngredientName(ing.name);
      if (inStockSet.has(norm) || ing.isStaple) {
        matchedIngredients.push(ing.name);
      } else {
        missingIngredients.push(ing.name);
      }
    }

    const matchPct =
      totalIngredients > 0
        ? Math.round((matchedIngredients.length / totalIngredients) * 100)
        : 0;

    return {
      recipe,
      matchPct,
      matchedCount: matchedIngredients.length,
      totalIngredients,
      matchedIngredients,
      missingIngredients,
    };
  });

  return matches.sort((a, b) => {
    if (b.matchPct !== a.matchPct) return b.matchPct - a.matchPct;
    return a.missingIngredients.length - b.missingIngredients.length;
  });
}

function escapeCsvCell(val: string): string {
  if (/[",\r\n]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function formatGroceryListAsCsv(
  list: GroceryListRecord,
  items: GroceryItemRecord[]
): string {
  const header = [
    "List",
    "Date",
    "Item",
    "Quantity",
    "Unit",
    "Aisle",
    "Store",
    "Category",
    "EstimatedCost",
    "Checked",
    "SourceRecipes",
  ];

  const listDate = list.startDate || list.endDate || list.createdAt.slice(0, 10);
  const rows = items.map((item) => [
    list.name,
    listDate,
    item.name,
    item.quantity ?? "",
    item.unit,
    item.aisle,
    item.store ?? "",
    "Groceries",
    item.estimatedCost ?? "0.00",
    item.isChecked ? "Yes" : "No",
    item.sourceRecipes.join("; "),
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(","))
    .join("\n");
}

export function formatGroceryListAsText(
  list: GroceryListRecord,
  items: GroceryItemRecord[]
): string {
  const byAisle = new Map<string, GroceryItemRecord[]>();
  for (const item of items) {
    const group = byAisle.get(item.aisle) ?? [];
    group.push(item);
    byAisle.set(item.aisle, group);
  }

  const lines: string[] = [`${list.name} (Est. $${list.estimatedTotal})`, ""];
  for (const [aisle, group] of byAisle.entries()) {
    lines.push(`## ${aisle}`);
    for (const item of group) {
      const box = item.isChecked ? "[x]" : "[ ]";
      const qtyPart = [item.quantity, item.unit].filter(Boolean).join(" ");
      const storePart = item.store ? ` @ ${item.store}` : "";
      lines.push(`- ${box} ${qtyPart ? `${qtyPart} ` : ""}${item.name}${storePart}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
