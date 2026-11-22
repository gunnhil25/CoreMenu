import type {
  CookLogRecord,
  GroceryItemRecord,
  GroceryListRecord,
  HouseholdSettingsRecord,
  LeftoverBatchRecord,
  MealPlanEntryRecord,
  MealPlanTemplateRecord,
  PantryItemRecord,
  QuickStapleRecord,
  RecipeRecord,
} from "@/lib/types";
import { formatQuantity } from "@/lib/units";

export interface CoreMenuBackupPayload {
  schemaVersion: "coremenu-v1";
  exportedAt: string;
  householdSettings: HouseholdSettingsRecord;
  recipes: RecipeRecord[];
  cookLogs: CookLogRecord[];
  mealPlanEntries: MealPlanEntryRecord[];
  mealPlanTemplates: MealPlanTemplateRecord[];
  groceryLists: GroceryListRecord[];
  groceryItems: GroceryItemRecord[];
  quickStaples: QuickStapleRecord[];
  pantryItems: PantryItemRecord[];
  leftoverBatches: LeftoverBatchRecord[];
}

export function exportRecipeToMarkdown(recipe: RecipeRecord): string {
  const lines: string[] = [
    "---",
    `title: ${JSON.stringify(recipe.title)}`,
    `mealType: ${recipe.mealType}`,
    `cuisine: ${JSON.stringify(recipe.cuisine || "")}`,
    `difficulty: ${recipe.difficulty}`,
    `prepTimeMin: ${recipe.prepTimeMin}`,
    `cookTimeMin: ${recipe.cookTimeMin}`,
    `servings: ${recipe.servings}`,
    `rating: ${recipe.rating}`,
    `tags: ${JSON.stringify(recipe.tags)}`,
    recipe.caloriesPerServing !== null ? `caloriesPerServing: ${recipe.caloriesPerServing}` : "",
    recipe.proteinPerServing !== null ? `proteinPerServing: ${recipe.proteinPerServing}` : "",
    recipe.carbsPerServing !== null ? `carbsPerServing: ${recipe.carbsPerServing}` : "",
    recipe.fatPerServing !== null ? `fatPerServing: ${recipe.fatPerServing}` : "",
    recipe.estimatedCostPerServing !== null
      ? `estimatedCostPerServing: ${recipe.estimatedCostPerServing}`
      : "",
    recipe.sourceUrl ? `sourceUrl: ${JSON.stringify(recipe.sourceUrl)}` : "",
    "---",
    "",
    `# ${recipe.title}`,
    "",
  ].filter((l) => l !== "");

  if (recipe.description) {
    lines.push(recipe.description, "");
  }

  lines.push(
    `**Prep:** ${recipe.prepTimeMin}m | **Cook:** ${recipe.cookTimeMin}m | **Servings:** ${recipe.servings}`,
    ""
  );

  if (recipe.caloriesPerServing !== null) {
    lines.push(
      `**Nutrition / serving:** ${recipe.caloriesPerServing} kcal | P ${recipe.proteinPerServing ?? 0}g | C ${recipe.carbsPerServing ?? 0}g | F ${recipe.fatPerServing ?? 0}g`,
      ""
    );
  }

  lines.push("## Ingredients", "");
  for (const ing of recipe.ingredients) {
    const qtyStr = formatQuantity(ing.quantity);
    const qtyUnit = [qtyStr, ing.unit].filter(Boolean).join(" ");
    const prep = ing.prepNote ? `, ${ing.prepNote}` : "";
    lines.push(`- ${qtyUnit ? `${qtyUnit} ` : ""}${ing.name}${prep}`);
  }
  lines.push("");

  lines.push("## Instructions", "");
  recipe.steps.forEach((step, idx) => {
    const timer = step.timerMinutes ? ` *(${step.timerMinutes} min timer)*` : "";
    const prefix = step.section ? `**[${step.section}]** ` : "";
    lines.push(`${idx + 1}. ${prefix}${step.instruction}${timer}`);
  });

  if (recipe.notes) {
    lines.push("", "## Notes", "", recipe.notes);
  }

  return lines.join("\n").trim() + "\n";
}

export function exportCookbookToMarkdown(recipes: RecipeRecord[]): string {
  const header = [
    "# CoreMenu Cookbook Export",
    `Exported: ${new Date().toISOString()}`,
    `Total Recipes: ${recipes.length}`,
    "",
    "---",
    "",
  ].join("\n");

  return header + recipes.map((r) => exportRecipeToMarkdown(r)).join("\n---\n\n");
}

export function buildHouseholdBackupPayload(data: {
  householdSettings: HouseholdSettingsRecord;
  recipes: RecipeRecord[];
  cookLogs: CookLogRecord[];
  mealPlanEntries: MealPlanEntryRecord[];
  mealPlanTemplates: MealPlanTemplateRecord[];
  groceryLists: GroceryListRecord[];
  groceryItems: GroceryItemRecord[];
  quickStaples: QuickStapleRecord[];
  pantryItems: PantryItemRecord[];
  leftoverBatches: LeftoverBatchRecord[];
}): CoreMenuBackupPayload {
  return {
    schemaVersion: "coremenu-v1",
    exportedAt: new Date().toISOString(),
    ...data,
  };
}

export function validateHouseholdBackupPayload(raw: unknown): CoreMenuBackupPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Backup file must be a JSON object.");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== "coremenu-v1") {
    throw new Error("Unsupported backup format. Expected schemaVersion 'coremenu-v1'.");
  }
  if (!Array.isArray(obj.recipes)) {
    throw new Error("Backup file is missing a valid 'recipes' array.");
  }
  if (!obj.householdSettings || typeof obj.householdSettings !== "object") {
    throw new Error("Backup file is missing 'householdSettings'.");
  }

  return {
    schemaVersion: "coremenu-v1",
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
    householdSettings: obj.householdSettings as HouseholdSettingsRecord,
    recipes: obj.recipes as RecipeRecord[],
    cookLogs: Array.isArray(obj.cookLogs) ? (obj.cookLogs as CookLogRecord[]) : [],
    mealPlanEntries: Array.isArray(obj.mealPlanEntries)
      ? (obj.mealPlanEntries as MealPlanEntryRecord[])
      : [],
    mealPlanTemplates: Array.isArray(obj.mealPlanTemplates)
      ? (obj.mealPlanTemplates as MealPlanTemplateRecord[])
      : [],
    groceryLists: Array.isArray(obj.groceryLists)
      ? (obj.groceryLists as GroceryListRecord[])
      : [],
    groceryItems: Array.isArray(obj.groceryItems)
      ? (obj.groceryItems as GroceryItemRecord[])
      : [],
    quickStaples: Array.isArray(obj.quickStaples)
      ? (obj.quickStaples as QuickStapleRecord[])
      : [],
    pantryItems: Array.isArray(obj.pantryItems)
      ? (obj.pantryItems as PantryItemRecord[])
      : [],
    leftoverBatches: Array.isArray(obj.leftoverBatches)
      ? (obj.leftoverBatches as LeftoverBatchRecord[])
      : [],
  };
}
