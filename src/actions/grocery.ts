"use server";

import { requireAuth, safeRevalidatePaths } from "@/lib/auth-guard";
import { store } from "@/lib/store";
import type {
  AisleCategory,
  GroceryItemRecord,
  GroceryListRecord,
  HouseholdSettingsRecord,
  PantryGenerationMode,
  QuickStapleRecord,
} from "@/lib/types";

function revalidateGroceryPaths() {
  safeRevalidatePaths(["/", "/grocery", "/pantry", "/settings"]);
}

export async function getGroceryWorkspaceAction(activeListId?: string): Promise<{
  lists: GroceryListRecord[];
  activeList: GroceryListRecord | null;
  items: GroceryItemRecord[];
  quickStaples: QuickStapleRecord[];
  settings: HouseholdSettingsRecord;
}> {
  await requireAuth();
  const [lists, quickStaples, settings] = await Promise.all([
    store.listGroceryLists(),
    store.listQuickStaples(),
    store.getHouseholdSettings(),
  ]);

  const activeList =
    (activeListId ? lists.find((l) => l.id === activeListId) : null) ||
    lists.find((l) => l.status === "active") ||
    lists[0] ||
    null;

  const items = activeList ? await store.listGroceryItems(activeList.id) : [];

  return { lists, activeList, items, quickStaples, settings };
}

export async function createGroceryListAction(input: {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<{ success: boolean; list?: GroceryListRecord; error?: string }> {
  try {
    const user = await requireAuth();
    if (!input.name.trim()) {
      return { success: false, error: "Grocery list name is required." };
    }
    const list = await store.createGroceryList({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      createdByUserId: user.id,
    });
    revalidateGroceryPaths();
    return { success: true, list };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create grocery list.",
    };
  }
}

export async function generateGroceryListFromPlanAction(input: {
  name: string;
  startDate: string;
  endDate: string;
  pantryMode: PantryGenerationMode;
  includeLeftoverSlots: boolean;
  includeQuickStaples: boolean;
}): Promise<{ success: boolean; list?: GroceryListRecord; error?: string }> {
  try {
    const user = await requireAuth();
    const list = await store.generateGroceryListFromPlan({
      ...input,
      createdByUserId: user.id,
    });
    revalidateGroceryPaths();
    return { success: true, list };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate grocery list.",
    };
  }
}

export async function addGroceryItemAction(input: {
  listId: string;
  name: string;
  quantity?: number | null;
  unit?: string;
  aisle?: AisleCategory;
  store?: string | null;
  estimatedCost?: number | null;
  notes?: string | null;
}): Promise<{ success: boolean; item?: GroceryItemRecord; error?: string }> {
  try {
    await requireAuth();
    if (!input.name.trim()) {
      return { success: false, error: "Item name is required." };
    }
    const item = await store.addGroceryItem({
      ...input,
      isManual: true,
    });
    revalidateGroceryPaths();
    return { success: true, item };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add grocery item.",
    };
  }
}

export async function updateGroceryItemAction(
  id: string,
  patch: {
    name?: string;
    quantity?: number | null;
    unit?: string;
    aisle?: AisleCategory;
    store?: string | null;
    isChecked?: boolean;
    estimatedCost?: number | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; item?: GroceryItemRecord; error?: string }> {
  try {
    await requireAuth();
    const item = await store.updateGroceryItem(id, patch);
    if (!item) return { success: false, error: "Item not found." };
    revalidateGroceryPaths();
    return { success: true, item };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update grocery item.",
    };
  }
}

export async function toggleGroceryItemAction(
  id: string
): Promise<{ success: boolean; item?: GroceryItemRecord; error?: string }> {
  try {
    await requireAuth();
    const item = await store.toggleGroceryItem(id);
    if (!item) return { success: false, error: "Item not found." };
    revalidateGroceryPaths();
    return { success: true, item };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle grocery item.",
    };
  }
}

export async function deleteGroceryItemAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deleteGroceryItem(id);
    revalidateGroceryPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete grocery item.",
    };
  }
}

export async function clearCheckedItemsAction(
  listId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.clearCheckedGroceryItems(listId);
    revalidateGroceryPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear checked items.",
    };
  }
}

export async function completeGroceryListAction(input: {
  listId: string;
  actualTotal?: number | null;
  restockCheckedToPantry: boolean;
}): Promise<{ success: boolean; list?: GroceryListRecord; error?: string }> {
  try {
    await requireAuth();
    const list = await store.completeGroceryList(input);
    if (!list) return { success: false, error: "Grocery list not found." };
    revalidateGroceryPaths();
    return { success: true, list };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete shop.",
    };
  }
}

export async function deleteGroceryListAction(
  listId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deleteGroceryList(listId);
    revalidateGroceryPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete grocery list.",
    };
  }
}

export async function addQuickStapleAction(input: {
  name: string;
  defaultQuantity: number;
  defaultUnit: string;
  aisle: AisleCategory;
  store?: string | null;
  estimatedCost?: number | null;
}): Promise<{ success: boolean; staple?: QuickStapleRecord; error?: string }> {
  try {
    await requireAuth();
    if (!input.name.trim()) {
      return { success: false, error: "Staple name is required." };
    }
    const staple = await store.addQuickStaple(input);
    revalidateGroceryPaths();
    return { success: true, staple };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add quick staple.",
    };
  }
}

export async function deleteQuickStapleAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await store.deleteQuickStaple(id);
    revalidateGroceryPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete quick staple.",
    };
  }
}

export async function addQuickStapleToListAction(input: {
  listId: string;
  stapleId: string;
}): Promise<{ success: boolean; item?: GroceryItemRecord; error?: string }> {
  try {
    await requireAuth();
    const staples = await store.listQuickStaples();
    const staple = staples.find((s) => s.id === input.stapleId);
    if (!staple) return { success: false, error: "Quick staple not found." };
    const item = await store.addGroceryItem({
      listId: input.listId,
      name: staple.name,
      quantity: parseFloat(staple.defaultQuantity) || 1,
      unit: staple.defaultUnit,
      aisle: staple.aisle,
      store: staple.store,
      isManual: true,
      estimatedCost: staple.estimatedCost ? parseFloat(staple.estimatedCost) : null,
      notes: "Quick staple",
    });
    revalidateGroceryPaths();
    return { success: true, item };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add staple to list.",
    };
  }
}
