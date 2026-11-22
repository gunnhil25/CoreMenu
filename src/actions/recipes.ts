"use server";

import { requireAuth, safeRevalidatePaths } from "@/lib/auth-guard";
import {
  importRecipeFromUrl,
  parseRecipeFromPlainText,
  type ImportedRecipeDraft,
} from "@/lib/recipe-importer";
import { store, type CreateRecipeInput } from "@/lib/store";
import type { CookLogRecord, LeftoverBatchRecord, MealType, RecipeRecord } from "@/lib/types";

function revalidateRecipePaths(id?: string) {
  const paths = ["/", "/recipes", "/planner", "/pantry"];
  if (id) {
    paths.push(`/recipes/${id}`, `/recipes/${id}/edit`, `/recipes/${id}/cook`);
  }
  safeRevalidatePaths(paths);
}

export async function listRecipesAction(): Promise<RecipeRecord[]> {
  await requireAuth();
  return store.listRecipes();
}

export async function getRecipeAction(id: string): Promise<{
  recipe: RecipeRecord | null;
  cookLogs: CookLogRecord[];
}> {
  await requireAuth();
  const [recipe, cookLogs] = await Promise.all([
    store.getRecipeById(id),
    store.getCookLogsForRecipe(id),
  ]);
  return { recipe, cookLogs };
}

export async function createRecipeAction(
  input: Omit<CreateRecipeInput, "createdByUserId">
): Promise<{ success: boolean; recipe?: RecipeRecord; error?: string }> {
  try {
    const user = await requireAuth();
    if (!input.title || input.title.trim().length < 2) {
      return { success: false, error: "Recipe title must be at least 2 characters." };
    }
    const recipe = await store.createRecipe({
      ...input,
      createdByUserId: user.id,
    });
    revalidateRecipePaths(recipe.id);
    return { success: true, recipe };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create recipe.",
    };
  }
}

export async function updateRecipeAction(
  id: string,
  patch: Partial<Omit<CreateRecipeInput, "createdByUserId">>
): Promise<{ success: boolean; recipe?: RecipeRecord; error?: string }> {
  try {
    await requireAuth();
    if (patch.title !== undefined && patch.title.trim().length < 2) {
      return { success: false, error: "Recipe title must be at least 2 characters." };
    }
    const recipe = await store.updateRecipe(id, patch);
    if (!recipe) {
      return { success: false, error: "Recipe not found." };
    }
    revalidateRecipePaths(id);
    return { success: true, recipe };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update recipe.",
    };
  }
}

export async function deleteRecipeAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deleteRecipe(id);
    revalidateRecipePaths(id);
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete recipe.",
    };
  }
}

export async function duplicateRecipeAction(
  id: string
): Promise<{ success: boolean; recipe?: RecipeRecord; error?: string }> {
  try {
    const user = await requireAuth();
    const copy = await store.duplicateRecipe(id, user.id);
    if (!copy) {
      return { success: false, error: "Original recipe not found." };
    }
    revalidateRecipePaths(copy.id);
    return { success: true, recipe: copy };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to duplicate recipe.",
    };
  }
}

export async function toggleFavoriteRecipeAction(
  id: string
): Promise<{ success: boolean; recipe?: RecipeRecord; error?: string }> {
  try {
    await requireAuth();
    const recipe = await store.toggleFavoriteRecipe(id);
    if (!recipe) return { success: false, error: "Recipe not found." };
    revalidateRecipePaths(id);
    return { success: true, recipe };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update favorite.",
    };
  }
}

export async function logRecipeCookedAction(input: {
  recipeId: string;
  servingsMade: number;
  rating?: number | null;
  notes?: string | null;
  saveLeftovers?: {
    portions: number;
    storageLocation: "fridge" | "freezer";
    useByDays: number;
  } | null;
}): Promise<{
  success: boolean;
  recipe?: RecipeRecord | null;
  leftoverBatch?: LeftoverBatchRecord | null;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const result = await store.logRecipeCooked({
      ...input,
      userId: user.id,
    });
    if (!result.recipe) {
      return { success: false, error: "Recipe not found." };
    }
    revalidateRecipePaths(input.recipeId);
    return {
      success: true,
      recipe: result.recipe,
      leftoverBatch: result.leftoverBatch,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to log cook.",
    };
  }
}

export async function importRecipeUrlAction(
  url: string
): Promise<{ success: boolean; draft?: ImportedRecipeDraft; error?: string }> {
  try {
    await requireAuth();
    const draft = await importRecipeFromUrl(url);
    return { success: true, draft };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import recipe URL.",
    };
  }
}

export async function parseRecipeTextAction(input: {
  title: string;
  rawIngredients: string;
  rawSteps: string;
}): Promise<{ success: boolean; draft?: ImportedRecipeDraft; error?: string }> {
  try {
    await requireAuth();
    const draft = parseRecipeFromPlainText(
      input.title,
      input.rawIngredients,
      input.rawSteps
    );
    return { success: true, draft };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse recipe text.",
    };
  }
}

export async function pickRandomRecipeAction(filters?: {
  mealType?: MealType | "all";
  maxTotalMinutes?: number | null;
  minProteinGrams?: number | null;
  favoritesOnly?: boolean;
}): Promise<{ success: boolean; recipe?: RecipeRecord; error?: string }> {
  try {
    await requireAuth();
    const all = await store.listRecipes();
    const filtered = all.filter((r) => {
      if (filters?.mealType && filters.mealType !== "all" && r.mealType !== filters.mealType) {
        return false;
      }
      if (
        filters?.maxTotalMinutes &&
        r.prepTimeMin + r.cookTimeMin > filters.maxTotalMinutes
      ) {
        return false;
      }
      if (filters?.minProteinGrams) {
        const p = r.proteinPerServing ? parseFloat(r.proteinPerServing) : 0;
        if (p < filters.minProteinGrams) return false;
      }
      if (filters?.favoritesOnly && !r.isFavorite) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      return { success: false, error: "No recipes match those filters." };
    }

    const picked = filtered[Math.floor(Math.random() * filtered.length)];
    return { success: true, recipe: picked };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to pick recipe.",
    };
  }
}
