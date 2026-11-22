"use server";

import { requireAuth, safeRevalidatePaths } from "@/lib/auth-guard";
import { calculateWhatCanICook } from "@/lib/grocery-engine";
import { store } from "@/lib/store";
import type {
  AisleCategory,
  LeftoverBatchRecord,
  PantryItemRecord,
  PantryLocation,
  RecipeRecord,
  WhatCanICookMatch,
} from "@/lib/types";

function revalidatePantryPaths() {
  safeRevalidatePaths(["/", "/pantry", "/grocery", "/planner"]);
}

export async function getPantryWorkspaceAction(): Promise<{
  pantryItems: PantryItemRecord[];
  leftoverBatches: LeftoverBatchRecord[];
  recipes: RecipeRecord[];
  whatCanICook: WhatCanICookMatch[];
}> {
  await requireAuth();
  const [pantryItems, leftoverBatches, recipes] = await Promise.all([
    store.listPantryItems(),
    store.listLeftoverBatches(),
    store.listRecipes(),
  ]);
  const whatCanICook = calculateWhatCanICook(recipes, pantryItems);
  return { pantryItems, leftoverBatches, recipes, whatCanICook };
}

export async function createPantryItemAction(input: {
  name: string;
  quantity: number;
  unit: string;
  location: PantryLocation;
  aisle?: AisleCategory;
  isAlwaysStocked?: boolean;
  expiresAt?: string | null;
  lowStockThreshold?: number | null;
  notes?: string | null;
}): Promise<{ success: boolean; item?: PantryItemRecord; error?: string }> {
  try {
    await requireAuth();
    if (!input.name.trim()) {
      return { success: false, error: "Item name is required." };
    }
    const item = await store.createPantryItem(input);
    revalidatePantryPaths();
    return { success: true, item };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add pantry item.",
    };
  }
}

export async function updatePantryItemAction(
  id: string,
  patch: {
    name?: string;
    quantity?: number;
    unit?: string;
    location?: PantryLocation;
    aisle?: AisleCategory;
    isAlwaysStocked?: boolean;
    expiresAt?: string | null;
    lowStockThreshold?: number | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; item?: PantryItemRecord; error?: string }> {
  try {
    await requireAuth();
    const item = await store.updatePantryItem(id, patch);
    if (!item) return { success: false, error: "Pantry item not found." };
    revalidatePantryPaths();
    return { success: true, item };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update pantry item.",
    };
  }
}

export async function adjustPantryQuantityAction(
  id: string,
  delta: number
): Promise<{ success: boolean; item?: PantryItemRecord; error?: string }> {
  try {
    await requireAuth();
    const item = await store.adjustPantryQuantity(id, delta);
    if (!item) return { success: false, error: "Pantry item not found." };
    revalidatePantryPaths();
    return { success: true, item };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to adjust quantity.",
    };
  }
}

export async function deletePantryItemAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deletePantryItem(id);
    revalidatePantryPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete pantry item.",
    };
  }
}

export async function createLeftoverBatchAction(input: {
  recipeId?: string | null;
  title: string;
  storageLocation: "fridge" | "freezer";
  totalPortions: number;
  preparedDate?: string;
  useByDate?: string | null;
  caloriesPerPortion?: number | null;
  proteinPerPortion?: number | null;
  carbsPerPortion?: number | null;
  fatPerPortion?: number | null;
  notes?: string | null;
}): Promise<{ success: boolean; batch?: LeftoverBatchRecord; error?: string }> {
  try {
    const user = await requireAuth();
    if (!input.title.trim()) {
      return { success: false, error: "Batch title is required." };
    }
    const batch = await store.createLeftoverBatch({
      ...input,
      createdByUserId: user.id,
    });
    revalidatePantryPaths();
    return { success: true, batch };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create leftover batch.",
    };
  }
}

export async function adjustLeftoverPortionsAction(
  id: string,
  delta: number
): Promise<{ success: boolean; batch?: LeftoverBatchRecord; error?: string }> {
  try {
    await requireAuth();
    const batch = await store.adjustLeftoverPortions(id, delta);
    if (!batch) return { success: false, error: "Leftover batch not found." };
    revalidatePantryPaths();
    return { success: true, batch };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to adjust portions.",
    };
  }
}

export async function deleteLeftoverBatchAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deleteLeftoverBatch(id);
    revalidatePantryPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete leftover batch.",
    };
  }
}
