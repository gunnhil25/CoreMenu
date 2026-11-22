"use server";

import { requireAdmin, requireAuth, safeRevalidatePaths } from "@/lib/auth-guard";
import { validateHouseholdBackupPayload } from "@/lib/export-import";
import { store } from "@/lib/store";
import type { HouseholdSettingsRecord, QuickStapleRecord, SafeUser } from "@/lib/types";

function revalidateSettingsPaths() {
  safeRevalidatePaths(["/", "/recipes", "/planner", "/grocery", "/pantry", "/settings"]);
}

export async function getSettingsWorkspaceAction(): Promise<{
  user: SafeUser;
  householdSettings: HouseholdSettingsRecord;
  users: SafeUser[];
  quickStaples: QuickStapleRecord[];
}> {
  const user = await requireAuth();
  const [householdSettings, quickStaples] = await Promise.all([
    store.getHouseholdSettings(),
    store.listQuickStaples(),
  ]);
  const users = user.role === "admin" ? await store.getUsers() : [];
  return { user, householdSettings, users, quickStaples };
}

export async function updateHouseholdSettingsAction(input: {
  householdName: string;
  currency: string;
  weeklyGroceryBudget: number;
  defaultStores: string[];
}): Promise<{
  success: boolean;
  householdSettings?: HouseholdSettingsRecord;
  error?: string;
}> {
  try {
    await requireAdmin();
    const cleanedStores = input.defaultStores
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = await store.updateHouseholdSettings({
      householdName: input.householdName,
      currency: input.currency,
      weeklyGroceryBudget: input.weeklyGroceryBudget,
      defaultStores: cleanedStores.length > 0 ? cleanedStores : ["Woolworths", "Coles"],
    });
    revalidateSettingsPaths();
    return { success: true, householdSettings: updated };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update household settings.",
    };
  }
}

export async function importHouseholdBackupAction(
  rawJson: string
): Promise<{ success: boolean; recipeCount?: number; error?: string }> {
  try {
    const admin = await requireAdmin();
    const parsed = JSON.parse(rawJson);
    const validated = validateHouseholdBackupPayload(parsed);
    await store.importHouseholdBackup(validated, admin.id);
    revalidateSettingsPaths();
    return { success: true, recipeCount: validated.recipes.length };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import backup JSON.",
    };
  }
}
