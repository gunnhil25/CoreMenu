"use server";

import { requireAuth, safeRevalidatePaths } from "@/lib/auth-guard";
import { store } from "@/lib/store";
import type {
  LeftoverBatchRecord,
  MealPlanEntryRecord,
  MealPlanTemplateRecord,
  MealSlot,
  RecipeRecord,
} from "@/lib/types";
import { addDaysIso, getWeekStartMonday } from "@/lib/utils";

function revalidatePlannerPaths() {
  safeRevalidatePaths(["/", "/planner", "/grocery"]);
}

export async function getWeekPlanAction(weekStartIso?: string): Promise<{
  weekStart: string;
  weekEnd: string;
  entries: MealPlanEntryRecord[];
  templates: MealPlanTemplateRecord[];
  recipes: RecipeRecord[];
  leftovers: LeftoverBatchRecord[];
}> {
  await requireAuth();
  const weekStart = weekStartIso || getWeekStartMonday();
  const weekEnd = addDaysIso(weekStart, 6);
  const [entries, templates, recipes, leftovers] = await Promise.all([
    store.listMealPlanEntries(weekStart, weekEnd),
    store.listMealPlanTemplates(),
    store.listRecipes(),
    store.listLeftoverBatches(),
  ]);
  return { weekStart, weekEnd, entries, templates, recipes, leftovers };
}

export async function addMealPlanEntryAction(input: {
  planDate: string;
  mealSlot: MealSlot;
  recipeId?: string | null;
  leftoverId?: string | null;
  customTitle?: string | null;
  servings: number;
  isBatchPrep?: boolean;
  isLeftover?: boolean;
  notes?: string | null;
}): Promise<{ success: boolean; entry?: MealPlanEntryRecord; error?: string }> {
  try {
    const user = await requireAuth();
    if (!input.recipeId && !input.leftoverId && !input.customTitle?.trim()) {
      return { success: false, error: "Select a recipe, leftover batch, or custom meal." };
    }
    const entry = await store.addMealPlanEntry({
      ...input,
      createdByUserId: user.id,
    });
    revalidatePlannerPaths();
    return { success: true, entry };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add meal plan slot.",
    };
  }
}

export async function updateMealPlanEntryAction(
  id: string,
  patch: {
    planDate?: string;
    mealSlot?: MealSlot;
    servings?: number;
    isBatchPrep?: boolean;
    isLeftover?: boolean;
    isCompleted?: boolean;
    notes?: string | null;
  }
): Promise<{ success: boolean; entry?: MealPlanEntryRecord; error?: string }> {
  try {
    await requireAuth();
    const entry = await store.updateMealPlanEntry(id, patch);
    if (!entry) return { success: false, error: "Meal slot not found." };
    revalidatePlannerPaths();
    return { success: true, entry };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update meal slot.",
    };
  }
}

export async function deleteMealPlanEntryAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deleteMealPlanEntry(id);
    revalidatePlannerPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete meal slot.",
    };
  }
}

export async function toggleMealEntryCompletedAction(
  id: string
): Promise<{ success: boolean; entry?: MealPlanEntryRecord; error?: string }> {
  try {
    await requireAuth();
    const entry = await store.toggleMealEntryCompleted(id);
    if (!entry) return { success: false, error: "Meal slot not found." };
    revalidatePlannerPaths();
    return { success: true, entry };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle completion.",
    };
  }
}

export async function saveWeekTemplateAction(input: {
  name: string;
  description?: string | null;
  weekStartDate: string;
}): Promise<{ success: boolean; template?: MealPlanTemplateRecord; error?: string }> {
  try {
    const user = await requireAuth();
    if (!input.name.trim()) {
      return { success: false, error: "Template name is required." };
    }
    const template = await store.saveMealPlanTemplate({
      name: input.name,
      description: input.description,
      weekStartDate: input.weekStartDate,
      createdByUserId: user.id,
    });
    revalidatePlannerPaths();
    return { success: true, template };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save template.",
    };
  }
}

export async function applyWeekTemplateAction(input: {
  templateId: string;
  weekStartDate: string;
  replaceWeek: boolean;
}): Promise<{ success: boolean; createdCount?: number; error?: string }> {
  try {
    const user = await requireAuth();
    const created = await store.applyMealPlanTemplate({
      templateId: input.templateId,
      weekStartDate: input.weekStartDate,
      replaceWeek: input.replaceWeek,
      userId: user.id,
    });
    revalidatePlannerPaths();
    return { success: true, createdCount: created.length };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply template.",
    };
  }
}

export async function deleteWeekTemplateAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deleteMealPlanTemplate(id);
    revalidatePlannerPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete template.",
    };
  }
}
