"use server";

import {
  clearSessionCookie,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import {
  getAuthStatus,
  requireAdmin,
  requireAuth,
  safeRevalidatePaths,
  toSafeUser,
} from "@/lib/auth-guard";
import { store } from "@/lib/store";
import type { SafeUser, UnitSystem } from "@/lib/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidateAllCoreMenuPaths() {
  safeRevalidatePaths([
    "/setup",
    "/login",
    "/",
    "/recipes",
    "/planner",
    "/grocery",
    "/pantry",
    "/settings",
  ]);
}

export async function getAuthStatusAction(): Promise<{
  initialized: boolean;
  user: SafeUser | null;
}> {
  return getAuthStatus();
}

export async function setupInitialAdminAction(input: {
  name: string;
  email: string;
  password: string;
  householdName?: string;
  preferredUnits?: UnitSystem;
  currency?: string;
  weeklyGroceryBudget?: number;
  seedMode: "clean" | "demo";
}): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  try {
    const existingCount = await store.getUserCount();
    if (existingCount > 0) {
      return {
        success: false,
        error: "CoreMenu is already initialized. Please sign in instead.",
      };
    }

    const name = input.name?.trim() || "";
    const email = input.email?.trim().toLowerCase() || "";
    const password = input.password || "";

    if (name.length < 2) {
      return { success: false, error: "Full name must be at least 2 characters." };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long." };
    }

    const admin = await store.createInitialAdminWithSeed({
      name,
      email,
      passwordHash: hashPassword(password),
      preferredUnits: input.preferredUnits === "imperial" ? "imperial" : "metric",
      householdName: input.householdName?.trim() || "CoreMenu Kitchen",
      weeklyGroceryBudget:
        input.weeklyGroceryBudget !== undefined && input.weeklyGroceryBudget >= 0
          ? input.weeklyGroceryBudget
          : 220,
      currency: (input.currency || "AUD").trim().toUpperCase().slice(0, 3),
      seedMode: input.seedMode === "demo" ? "demo" : "clean",
    });

    await setSessionCookie({
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      sessionVersion: admin.sessionVersion,
    });

    revalidateAllCoreMenuPaths();

    return { success: true, user: toSafeUser(admin) };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to initialize CoreMenu admin.",
    };
  }
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  try {
    const email = input.email?.trim().toLowerCase() || "";
    const password = input.password || "";

    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }

    const user = await store.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { success: false, error: "Invalid email or password." };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: "This account has been deactivated by a household administrator.",
      };
    }

    await store.updateLastLogin(user.id);
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });

    revalidateAllCoreMenuPaths();

    return { success: true, user: toSafeUser(user) };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sign in failed.",
    };
  }
}

export async function logoutAction(): Promise<{ success: boolean }> {
  await clearSessionCookie();
  safeRevalidatePaths(["/", "/login"]);
  return { success: true };
}

export async function updateMyProfileAction(input: {
  name: string;
  email: string;
  preferredUnits: UnitSystem;
  currency: string;
  dailyCalorieGoal: number;
  dailyProteinGoal: number;
  dailyCarbsGoal: number;
  dailyFatGoal: number;
}): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  try {
    const currentUser = await requireAuth();

    const name = input.name?.trim() || "";
    const email = input.email?.trim().toLowerCase() || "";
    if (name.length < 2) {
      return { success: false, error: "Name must be at least 2 characters." };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "Please enter a valid email address." };
    }

    const duplicate = await store.getUserByEmail(email);
    if (duplicate && duplicate.id !== currentUser.id) {
      return { success: false, error: "Another household member is already using that email." };
    }

    const updated = await store.updateUser(currentUser.id, {
      name,
      email,
      preferredUnits: input.preferredUnits === "imperial" ? "imperial" : "metric",
      currency: (input.currency || "AUD").trim().toUpperCase().slice(0, 3),
      dailyCalorieGoal: Math.max(800, Math.round(input.dailyCalorieGoal || 2200)),
      dailyProteinGoal: Math.max(20, Math.round(input.dailyProteinGoal || 150)),
      dailyCarbsGoal: Math.max(20, Math.round(input.dailyCarbsGoal || 220)),
      dailyFatGoal: Math.max(10, Math.round(input.dailyFatGoal || 70)),
    });

    if (!updated) {
      return { success: false, error: "Account not found." };
    }

    await setSessionCookie({
      userId: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      sessionVersion: updated.sessionVersion,
    });

    revalidateAllCoreMenuPaths();
    return { success: true, user: toSafeUser(updated) };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update profile.",
    };
  }
}

export async function changeMyPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const fullUser = await store.getUserById(currentUser.id);
    if (!fullUser || !verifyPassword(input.currentPassword || "", fullUser.passwordHash)) {
      return { success: false, error: "Current password is incorrect." };
    }
    if (!input.newPassword || input.newPassword.length < 8) {
      return { success: false, error: "New password must be at least 8 characters long." };
    }

    const updated = await store.updateUser(currentUser.id, {
      passwordHash: hashPassword(input.newPassword),
      bumpSession: true,
    });
    if (!updated) {
      return { success: false, error: "Account not found." };
    }

    await setSessionCookie({
      userId: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      sessionVersion: updated.sessionVersion,
    });

    safeRevalidatePaths(["/settings"]);
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change password.",
    };
  }
}

export async function listUsersAdminAction(): Promise<{
  success: boolean;
  users: SafeUser[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const allUsers = await store.getUsers();
    return { success: true, users: allUsers };
  } catch (error: unknown) {
    return {
      success: false,
      users: [],
      error: error instanceof Error ? error.message : "Administrator privileges required.",
    };
  }
}

export async function createUserAdminAction(input: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  preferredUnits?: UnitSystem;
}): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  try {
    await requireAdmin();
    const name = input.name?.trim() || "";
    const email = input.email?.trim().toLowerCase() || "";
    const password = input.password || "";

    if (name.length < 2) {
      return { success: false, error: "Name must be at least 2 characters." };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "Please enter a valid email address." };
    }
    if (password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long." };
    }

    const existing = await store.getUserByEmail(email);
    if (existing) {
      return { success: false, error: "A user with that email already exists." };
    }

    const created = await store.createUser({
      name,
      email,
      passwordHash: hashPassword(password),
      role: input.role === "admin" ? "admin" : "user",
      preferredUnits: input.preferredUnits === "imperial" ? "imperial" : "metric",
    });

    safeRevalidatePaths(["/settings"]);
    return { success: true, user: toSafeUser(created) };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user.",
    };
  }
}

export async function updateUserAdminAction(input: {
  targetUserId: string;
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
}): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  try {
    const admin = await requireAdmin();
    const target = await store.getUserById(input.targetUserId);
    if (!target) {
      return { success: false, error: "User not found." };
    }

    const name = input.name?.trim() || "";
    const email = input.email?.trim().toLowerCase() || "";
    if (name.length < 2) {
      return { success: false, error: "Name must be at least 2 characters." };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "Please enter a valid email address." };
    }

    const duplicate = await store.getUserByEmail(email);
    if (duplicate && duplicate.id !== target.id) {
      return { success: false, error: "Another user is already using that email." };
    }

    if (target.role === "admin" && (input.role !== "admin" || !input.isActive)) {
      const allUsers = await store.getUsers();
      const otherActiveAdmins = allUsers.filter(
        (u) => u.id !== target.id && u.role === "admin" && u.isActive
      );
      if (otherActiveAdmins.length === 0) {
        return {
          success: false,
          error: "Cannot demote or deactivate the last active administrator.",
        };
      }
    }

    const roleOrStatusChanged =
      target.role !== input.role || target.isActive !== input.isActive;

    const updated = await store.updateUser(target.id, {
      name,
      email,
      role: input.role,
      isActive: input.isActive,
      bumpSession: roleOrStatusChanged,
    });
    if (!updated) {
      return { success: false, error: "Failed to update user." };
    }

    if (updated.id === admin.id && updated.isActive) {
      await setSessionCookie({
        userId: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        sessionVersion: updated.sessionVersion,
      });
    }

    revalidateAllCoreMenuPaths();
    return { success: true, user: toSafeUser(updated) };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user.",
    };
  }
}

export async function resetUserPasswordAdminAction(input: {
  targetUserId: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    if (!input.newPassword || input.newPassword.length < 8) {
      return { success: false, error: "New password must be at least 8 characters long." };
    }

    const updated = await store.updateUser(input.targetUserId, {
      passwordHash: hashPassword(input.newPassword),
      bumpSession: true,
    });
    if (!updated) {
      return { success: false, error: "User not found." };
    }

    if (updated.id === admin.id) {
      await setSessionCookie({
        userId: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        sessionVersion: updated.sessionVersion,
      });
    }

    safeRevalidatePaths(["/settings"]);
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset password.",
    };
  }
}

export async function deleteUserAdminAction(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    if (targetUserId === admin.id) {
      return { success: false, error: "You cannot delete your own active admin account." };
    }

    const target = await store.getUserById(targetUserId);
    if (!target) {
      return { success: false, error: "User not found." };
    }

    if (target.role === "admin" && target.isActive) {
      const allUsers = await store.getUsers();
      const otherActiveAdmins = allUsers.filter(
        (u) => u.id !== target.id && u.role === "admin" && u.isActive
      );
      if (otherActiveAdmins.length === 0) {
        return { success: false, error: "Cannot delete the last active administrator." };
      }
    }

    await store.deleteUser(target.id);
    safeRevalidatePaths(["/settings"]);
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user.",
    };
  }
}

export async function resetHouseholdDataAction(
  seedMode: "clean" | "demo"
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    await store.resetHousehold(seedMode, admin.id);
    revalidateAllCoreMenuPaths();
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset household kitchen.",
    };
  }
}
