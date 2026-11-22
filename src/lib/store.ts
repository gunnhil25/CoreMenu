import crypto from "crypto";
import path from "path";
import { asc, desc, eq, gte, lte, and } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { checkDbConnection, db } from "@/db";
import {
  cookLogs,
  groceryItems,
  groceryLists,
  householdSettings,
  leftoverBatches,
  mealPlanEntries,
  mealPlanTemplates,
  pantryItems,
  quickStaples,
  recipes,
  users,
} from "@/db/schema";
import {
  type AisleCategory,
  type CookLogRecord,
  type DifficultyLevel,
  type GroceryItemRecord,
  type GroceryListRecord,
  type HouseholdSettingsRecord,
  type LeftoverBatchRecord,
  type MealPlanEntryRecord,
  type MealPlanTemplateRecord,
  type MealSlot,
  type MealTemplateSlot,
  type MealType,
  type PantryGenerationMode,
  type PantryItemRecord,
  type PantryLocation,
  type QuickStapleRecord,
  type RecipeIngredient,
  type RecipeRecord,
  type RecipeStep,
  type SafeUser,
  type UnitSystem,
  type UserRecord,
} from "@/lib/types";
import { createDemoHouseholdPayload } from "@/lib/demo-data";
import {
  classifyAisle,
  generateGroceryItemsFromPlan,
  normalizeIngredientName,
} from "@/lib/grocery-engine";
import { type CoreMenuBackupPayload } from "@/lib/export-import";
import { addDaysIso, getWeekStartMonday, slugify, toIsoDate } from "@/lib/utils";
import { roundClean } from "@/lib/units";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toUuid(id: string): string {
  if (UUID_REGEX.test(id)) return id.toLowerCase();
  const hex = crypto.createHash("sha256").update(id).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isoString(val: Date | string | null | undefined): string {
  if (!val) return new Date().toISOString();
  return val instanceof Date ? val.toISOString() : String(val);
}

function nullableIsoString(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return val instanceof Date ? val.toISOString() : String(val);
}

function sanitizeUser(u: UserRecord): SafeUser {
  const { passwordHash: _ph, ...safe } = u;
  return safe;
}

function defaultHouseholdSettings(): HouseholdSettingsRecord {
  return {
    id: toUuid("household-settings-main"),
    householdName: "CoreMenu Kitchen",
    currency: "AUD",
    weeklyGroceryBudget: "220.00",
    defaultStores: ["Woolworths", "Coles", "Aldi", "Butcher", "Asian Grocer"],
    updatedAt: new Date().toISOString(),
  };
}

interface InMemoryStoreState {
  users: UserRecord[];
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

function createEmptyMemoryState(): InMemoryStoreState {
  return {
    users: [],
    householdSettings: defaultHouseholdSettings(),
    recipes: [],
    cookLogs: [],
    mealPlanEntries: [],
    mealPlanTemplates: [],
    groceryLists: [],
    groceryItems: [],
    quickStaples: [],
    pantryItems: [],
    leftoverBatches: [],
  };
}

const g = globalThis as typeof globalThis & {
  __coreMenuMemStore?: InMemoryStoreState;
};

function getMem(): InMemoryStoreState {
  if (!g.__coreMenuMemStore) {
    g.__coreMenuMemStore = createEmptyMemoryState();
  }
  return g.__coreMenuMemStore;
}

export function resetMemoryStore(): void {
  g.__coreMenuMemStore = createEmptyMemoryState();
}

let migratePromise: Promise<void> | null = null;
let hasMigratedDb = false;

async function ensureMigrated(): Promise<void> {
  if (hasMigratedDb) return;
  if (migratePromise) return migratePromise;

  migratePromise = (async () => {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), "src/db/migrations"),
    });
    hasMigratedDb = true;
  })().finally(() => {
    migratePromise = null;
  });

  return migratePromise;
}

async function isDbReady(): Promise<boolean> {
  const connected = await checkDbConnection();
  if (!connected) return false;
  try {
    await ensureMigrated();
    return true;
  } catch (error) {
    console.error("[CoreMenu] Database migration check failed:", error);
    return false;
  }
}

function mapDbUser(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: row.isActive,
    sessionVersion: row.sessionVersion,
    preferredUnits: row.preferredUnits,
    currency: row.currency,
    dailyCalorieGoal: row.dailyCalorieGoal,
    dailyProteinGoal: row.dailyProteinGoal,
    dailyCarbsGoal: row.dailyCarbsGoal,
    dailyFatGoal: row.dailyFatGoal,
    lastLoginAt: nullableIsoString(row.lastLoginAt),
    createdAt: isoString(row.createdAt),
    updatedAt: isoString(row.updatedAt),
  };
}

function mapDbRecipe(row: typeof recipes.$inferSelect): RecipeRecord {
  return {
    id: row.id,
    createdByUserId: row.createdByUserId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    sourceUrl: row.sourceUrl,
    mealType: row.mealType,
    cuisine: row.cuisine,
    difficulty: row.difficulty,
    prepTimeMin: row.prepTimeMin,
    cookTimeMin: row.cookTimeMin,
    servings: row.servings,
    tags: row.tags ?? [],
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    caloriesPerServing: row.caloriesPerServing,
    proteinPerServing: row.proteinPerServing,
    carbsPerServing: row.carbsPerServing,
    fatPerServing: row.fatPerServing,
    estimatedCostPerServing: row.estimatedCostPerServing,
    rating: row.rating,
    isFavorite: row.isFavorite,
    cookCount: row.cookCount,
    lastCookedAt: nullableIsoString(row.lastCookedAt),
    notes: row.notes,
    createdAt: isoString(row.createdAt),
    updatedAt: isoString(row.updatedAt),
  };
}

function mapDbLeftover(row: typeof leftoverBatches.$inferSelect): LeftoverBatchRecord {
  return {
    id: row.id,
    recipeId: row.recipeId,
    title: row.title,
    storageLocation: row.storageLocation,
    totalPortions: row.totalPortions,
    remainingPortions: row.remainingPortions,
    preparedDate: row.preparedDate,
    useByDate: row.useByDate,
    caloriesPerPortion: row.caloriesPerPortion,
    proteinPerPortion: row.proteinPerPortion,
    carbsPerPortion: row.carbsPerPortion,
    fatPerPortion: row.fatPerPortion,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    createdAt: isoString(row.createdAt),
    updatedAt: isoString(row.updatedAt),
  };
}

function mapDbMealPlanEntry(row: typeof mealPlanEntries.$inferSelect): MealPlanEntryRecord {
  return {
    id: row.id,
    planDate: row.planDate,
    mealSlot: row.mealSlot,
    recipeId: row.recipeId,
    leftoverId: row.leftoverId,
    customTitle: row.customTitle,
    servings: row.servings,
    isBatchPrep: row.isBatchPrep,
    isLeftover: row.isLeftover,
    isCompleted: row.isCompleted,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    createdAt: isoString(row.createdAt),
  };
}

function mapDbGroceryList(row: typeof groceryLists.$inferSelect): GroceryListRecord {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    estimatedTotal: row.estimatedTotal,
    actualTotal: row.actualTotal,
    completedAt: nullableIsoString(row.completedAt),
    createdByUserId: row.createdByUserId,
    createdAt: isoString(row.createdAt),
    updatedAt: isoString(row.updatedAt),
  };
}

function mapDbGroceryItem(row: typeof groceryItems.$inferSelect): GroceryItemRecord {
  return {
    id: row.id,
    listId: row.listId,
    name: row.name,
    normalizedName: row.normalizedName,
    quantity: row.quantity,
    unit: row.unit,
    aisle: row.aisle,
    store: row.store,
    isChecked: row.isChecked,
    inPantryFlag: row.inPantryFlag,
    pantryNote: row.pantryNote,
    isManual: row.isManual,
    estimatedCost: row.estimatedCost,
    sourceRecipes: row.sourceRecipes ?? [],
    notes: row.notes,
    sortOrder: row.sortOrder,
    createdAt: isoString(row.createdAt),
  };
}

function mapDbPantryItem(row: typeof pantryItems.$inferSelect): PantryItemRecord {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    quantity: row.quantity,
    unit: row.unit,
    location: row.location,
    aisle: row.aisle,
    isAlwaysStocked: row.isAlwaysStocked,
    expiresAt: row.expiresAt,
    lowStockThreshold: row.lowStockThreshold,
    notes: row.notes,
    createdAt: isoString(row.createdAt),
    updatedAt: isoString(row.updatedAt),
  };
}

async function recalculateDbGroceryListTotal(listId: string): Promise<void> {
  const items = await db
    .select()
    .from(groceryItems)
    .where(eq(groceryItems.listId, listId));
  const total = items.reduce(
    (sum, i) => sum + (i.estimatedCost ? parseFloat(i.estimatedCost) || 0 : 0),
    0
  );
  await db
    .update(groceryLists)
    .set({ estimatedTotal: total.toFixed(2), updatedAt: new Date() })
    .where(eq(groceryLists.id, listId));
}

function recalculateMemGroceryListTotal(listId: string): void {
  const mem = getMem();
  const total = mem.groceryItems
    .filter((i) => i.listId === listId)
    .reduce((sum, i) => sum + (i.estimatedCost ? parseFloat(i.estimatedCost) || 0 : 0), 0);
  const target = mem.groceryLists.find((l) => l.id === listId);
  if (target) {
    target.estimatedTotal = total.toFixed(2);
    target.updatedAt = new Date().toISOString();
  }
}

async function clearDbHouseholdData(): Promise<void> {
  await db.delete(groceryItems);
  await db.delete(groceryLists);
  await db.delete(mealPlanEntries);
  await db.delete(mealPlanTemplates);
  await db.delete(cookLogs);
  await db.delete(leftoverBatches);
  await db.delete(recipes);
  await db.delete(quickStaples);
  await db.delete(pantryItems);
  await db.delete(householdSettings);
}

async function applyPayloadToDb(payload: {
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
}, fallbackUserId?: string | null): Promise<void> {
  await clearDbHouseholdData();

  await db.insert(householdSettings).values({
    id: toUuid(payload.householdSettings.id),
    householdName: payload.householdSettings.householdName,
    currency: payload.householdSettings.currency,
    weeklyGroceryBudget: payload.householdSettings.weeklyGroceryBudget,
    defaultStores: payload.householdSettings.defaultStores,
    updatedAt: new Date(),
  });

  if (payload.recipes.length > 0) {
    await db.insert(recipes).values(
      payload.recipes.map((r) => ({
        id: toUuid(r.id),
        createdByUserId: r.createdByUserId ? toUuid(r.createdByUserId) : fallbackUserId ?? null,
        title: r.title,
        slug: r.slug || slugify(r.title),
        description: r.description,
        imageUrl: r.imageUrl,
        sourceUrl: r.sourceUrl,
        mealType: r.mealType,
        cuisine: r.cuisine,
        difficulty: r.difficulty,
        prepTimeMin: r.prepTimeMin,
        cookTimeMin: r.cookTimeMin,
        servings: r.servings,
        tags: r.tags,
        ingredients: r.ingredients,
        steps: r.steps,
        caloriesPerServing: r.caloriesPerServing,
        proteinPerServing: r.proteinPerServing,
        carbsPerServing: r.carbsPerServing,
        fatPerServing: r.fatPerServing,
        estimatedCostPerServing: r.estimatedCostPerServing,
        rating: r.rating,
        isFavorite: r.isFavorite,
        cookCount: r.cookCount,
        lastCookedAt: r.lastCookedAt ? new Date(r.lastCookedAt) : null,
        notes: r.notes,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      }))
    );
  }

  if (payload.pantryItems.length > 0) {
    await db.insert(pantryItems).values(
      payload.pantryItems.map((p) => ({
        id: toUuid(p.id),
        name: p.name,
        normalizedName: p.normalizedName || normalizeIngredientName(p.name),
        quantity: p.quantity,
        unit: p.unit,
        location: p.location,
        aisle: p.aisle,
        isAlwaysStocked: p.isAlwaysStocked,
        expiresAt: p.expiresAt,
        lowStockThreshold: p.lowStockThreshold,
        notes: p.notes,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }))
    );
  }

  if (payload.leftoverBatches.length > 0) {
    await db.insert(leftoverBatches).values(
      payload.leftoverBatches.map((l) => ({
        id: toUuid(l.id),
        recipeId: l.recipeId ? toUuid(l.recipeId) : null,
        title: l.title,
        storageLocation: l.storageLocation,
        totalPortions: l.totalPortions,
        remainingPortions: l.remainingPortions,
        preparedDate: l.preparedDate,
        useByDate: l.useByDate,
        caloriesPerPortion: l.caloriesPerPortion,
        proteinPerPortion: l.proteinPerPortion,
        carbsPerPortion: l.carbsPerPortion,
        fatPerPortion: l.fatPerPortion,
        notes: l.notes,
        createdByUserId: l.createdByUserId ? toUuid(l.createdByUserId) : fallbackUserId ?? null,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      }))
    );
  }

  if (payload.cookLogs.length > 0) {
    await db.insert(cookLogs).values(
      payload.cookLogs.map((c) => ({
        id: toUuid(c.id),
        recipeId: toUuid(c.recipeId),
        userId: c.userId ? toUuid(c.userId) : fallbackUserId ?? null,
        cookedAt: new Date(c.cookedAt),
        servingsMade: c.servingsMade,
        rating: c.rating,
        notes: c.notes,
      }))
    );
  }

  if (payload.mealPlanEntries.length > 0) {
    await db.insert(mealPlanEntries).values(
      payload.mealPlanEntries.map((m) => ({
        id: toUuid(m.id),
        planDate: m.planDate,
        mealSlot: m.mealSlot,
        recipeId: m.recipeId ? toUuid(m.recipeId) : null,
        leftoverId: m.leftoverId ? toUuid(m.leftoverId) : null,
        customTitle: m.customTitle,
        servings: m.servings,
        isBatchPrep: m.isBatchPrep,
        isLeftover: m.isLeftover,
        isCompleted: m.isCompleted,
        notes: m.notes,
        createdByUserId: m.createdByUserId ? toUuid(m.createdByUserId) : fallbackUserId ?? null,
        createdAt: new Date(m.createdAt),
      }))
    );
  }

  if (payload.mealPlanTemplates.length > 0) {
    await db.insert(mealPlanTemplates).values(
      payload.mealPlanTemplates.map((t) => ({
        id: toUuid(t.id),
        name: t.name,
        description: t.description,
        slots: t.slots,
        createdByUserId: t.createdByUserId ? toUuid(t.createdByUserId) : fallbackUserId ?? null,
        createdAt: new Date(t.createdAt),
      }))
    );
  }

  if (payload.quickStaples.length > 0) {
    await db.insert(quickStaples).values(
      payload.quickStaples.map((q) => ({
        id: toUuid(q.id),
        name: q.name,
        defaultQuantity: q.defaultQuantity,
        defaultUnit: q.defaultUnit,
        aisle: q.aisle,
        store: q.store,
        estimatedCost: q.estimatedCost,
        createdAt: new Date(q.createdAt),
      }))
    );
  }

  if (payload.groceryLists.length > 0) {
    await db.insert(groceryLists).values(
      payload.groceryLists.map((gList) => ({
        id: toUuid(gList.id),
        name: gList.name,
        startDate: gList.startDate,
        endDate: gList.endDate,
        status: gList.status,
        estimatedTotal: gList.estimatedTotal,
        actualTotal: gList.actualTotal,
        completedAt: gList.completedAt ? new Date(gList.completedAt) : null,
        createdByUserId: gList.createdByUserId
          ? toUuid(gList.createdByUserId)
          : fallbackUserId ?? null,
        createdAt: new Date(gList.createdAt),
        updatedAt: new Date(gList.updatedAt),
      }))
    );
  }

  if (payload.groceryItems.length > 0) {
    await db.insert(groceryItems).values(
      payload.groceryItems.map((gi) => ({
        id: toUuid(gi.id),
        listId: toUuid(gi.listId),
        name: gi.name,
        normalizedName: gi.normalizedName || normalizeIngredientName(gi.name),
        quantity: gi.quantity,
        unit: gi.unit,
        aisle: gi.aisle,
        store: gi.store,
        isChecked: gi.isChecked,
        inPantryFlag: gi.inPantryFlag,
        pantryNote: gi.pantryNote,
        isManual: gi.isManual,
        estimatedCost: gi.estimatedCost,
        sourceRecipes: gi.sourceRecipes,
        notes: gi.notes,
        sortOrder: gi.sortOrder,
        createdAt: new Date(gi.createdAt),
      }))
    );
  }
}

function applyPayloadToMem(payload: {
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
}): void {
  const mem = getMem();
  mem.householdSettings = structuredClone(payload.householdSettings);
  mem.recipes = structuredClone(payload.recipes);
  mem.cookLogs = structuredClone(payload.cookLogs);
  mem.mealPlanEntries = structuredClone(payload.mealPlanEntries);
  mem.mealPlanTemplates = structuredClone(payload.mealPlanTemplates);
  mem.groceryLists = structuredClone(payload.groceryLists);
  mem.groceryItems = structuredClone(payload.groceryItems);
  mem.quickStaples = structuredClone(payload.quickStaples);
  mem.pantryItems = structuredClone(payload.pantryItems);
  mem.leftoverBatches = structuredClone(payload.leftoverBatches);
}

export interface CreateRecipeInput {
  createdByUserId: string | null;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  mealType: MealType;
  cuisine?: string | null;
  difficulty: DifficultyLevel;
  prepTimeMin: number;
  cookTimeMin: number;
  servings: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
  estimatedCostPerServing?: number | null;
  rating?: number;
  isFavorite?: boolean;
  notes?: string | null;
}

export const store = {
  isDbReady,

  // ======================== USERS & AUTH ========================
  async getUserCount(): Promise<number> {
    if (await isDbReady()) {
      const rows = await db.select({ id: users.id }).from(users);
      return rows.length;
    }
    return getMem().users.length;
  },

  async getUsers(): Promise<SafeUser[]> {
    if (await isDbReady()) {
      const rows = await db.select().from(users).orderBy(asc(users.createdAt));
      return rows.map((r) => sanitizeUser(mapDbUser(r)));
    }
    return getMem().users.map(sanitizeUser);
  },

  async getUserById(userId: string): Promise<UserRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.id, toUuid(userId)))
        .limit(1);
      return rows[0] ? mapDbUser(rows[0]) : null;
    }
    return getMem().users.find((u) => u.id === userId) ?? null;
  },

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);
      return rows[0] ? mapDbUser(rows[0]) : null;
    }
    return getMem().users.find((u) => u.email.toLowerCase() === cleanEmail) ?? null;
  },

  async createInitialAdminWithSeed(input: {
    name: string;
    email: string;
    passwordHash: string;
    preferredUnits: UnitSystem;
    householdName: string;
    weeklyGroceryBudget: number;
    currency: string;
    seedMode: "clean" | "demo";
  }): Promise<UserRecord> {
    const now = new Date();
    const id = crypto.randomUUID();
    const newUser: UserRecord = {
      id,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: "admin",
      isActive: true,
      sessionVersion: 1,
      preferredUnits: input.preferredUnits,
      currency: input.currency || "AUD",
      dailyCalorieGoal: 2200,
      dailyProteinGoal: 150,
      dailyCarbsGoal: 220,
      dailyFatGoal: 70,
      lastLoginAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const basePayload =
      input.seedMode === "demo"
        ? createDemoHouseholdPayload(id)
        : {
            householdSettings: defaultHouseholdSettings(),
            recipes: [],
            cookLogs: [],
            mealPlanEntries: [],
            mealPlanTemplates: [],
            groceryLists: [],
            groceryItems: [],
            quickStaples: [],
            pantryItems: [],
            leftoverBatches: [],
          };

    basePayload.householdSettings.householdName =
      input.householdName.trim() || "CoreMenu Kitchen";
    basePayload.householdSettings.currency = input.currency || "AUD";
    basePayload.householdSettings.weeklyGroceryBudget = input.weeklyGroceryBudget.toFixed(2);
    basePayload.householdSettings.updatedAt = now.toISOString();

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(users)
        .values({
          id,
          email: newUser.email,
          name: newUser.name,
          passwordHash: newUser.passwordHash,
          role: "admin",
          isActive: true,
          sessionVersion: 1,
          preferredUnits: newUser.preferredUnits,
          currency: newUser.currency,
          dailyCalorieGoal: newUser.dailyCalorieGoal,
          dailyProteinGoal: newUser.dailyProteinGoal,
          dailyCarbsGoal: newUser.dailyCarbsGoal,
          dailyFatGoal: newUser.dailyFatGoal,
          lastLoginAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await applyPayloadToDb(basePayload, id);
      return mapDbUser(inserted);
    }

    const mem = getMem();
    mem.users.push(newUser);
    applyPayloadToMem(basePayload);
    return newUser;
  },

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: "admin" | "user";
    preferredUnits?: UnitSystem;
    currency?: string;
  }): Promise<UserRecord> {
    const now = new Date();
    const id = crypto.randomUUID();
    const record: UserRecord = {
      id,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: true,
      sessionVersion: 1,
      preferredUnits: input.preferredUnits || "metric",
      currency: input.currency || "AUD",
      dailyCalorieGoal: 2200,
      dailyProteinGoal: 150,
      dailyCarbsGoal: 220,
      dailyFatGoal: 70,
      lastLoginAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(users)
        .values({
          id,
          email: record.email,
          name: record.name,
          passwordHash: record.passwordHash,
          role: record.role,
          isActive: true,
          sessionVersion: 1,
          preferredUnits: record.preferredUnits,
          currency: record.currency,
          dailyCalorieGoal: record.dailyCalorieGoal,
          dailyProteinGoal: record.dailyProteinGoal,
          dailyCarbsGoal: record.dailyCarbsGoal,
          dailyFatGoal: record.dailyFatGoal,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapDbUser(inserted);
    }

    getMem().users.push(record);
    return record;
  },

  async updateUser(
    userId: string,
    patch: {
      name?: string;
      email?: string;
      role?: "admin" | "user";
      isActive?: boolean;
      passwordHash?: string;
      preferredUnits?: UnitSystem;
      currency?: string;
      dailyCalorieGoal?: number;
      dailyProteinGoal?: number;
      dailyCarbsGoal?: number;
      dailyFatGoal?: number;
      bumpSession?: boolean;
    }
  ): Promise<UserRecord | null> {
    if (await isDbReady()) {
      const existing = await this.getUserById(userId);
      if (!existing) return null;
      const nextSession = patch.bumpSession
        ? existing.sessionVersion + 1
        : existing.sessionVersion;

      const [updated] = await db
        .update(users)
        .set({
          name: patch.name ?? existing.name,
          email: patch.email ? patch.email.trim().toLowerCase() : existing.email,
          role: patch.role ?? existing.role,
          isActive: patch.isActive ?? existing.isActive,
          passwordHash: patch.passwordHash ?? existing.passwordHash,
          preferredUnits: patch.preferredUnits ?? existing.preferredUnits,
          currency: patch.currency ?? existing.currency,
          dailyCalorieGoal: patch.dailyCalorieGoal ?? existing.dailyCalorieGoal,
          dailyProteinGoal: patch.dailyProteinGoal ?? existing.dailyProteinGoal,
          dailyCarbsGoal: patch.dailyCarbsGoal ?? existing.dailyCarbsGoal,
          dailyFatGoal: patch.dailyFatGoal ?? existing.dailyFatGoal,
          sessionVersion: nextSession,
          updatedAt: new Date(),
        })
        .where(eq(users.id, toUuid(userId)))
        .returning();
      return updated ? mapDbUser(updated) : null;
    }

    const mem = getMem();
    const user = mem.users.find((u) => u.id === userId);
    if (!user) return null;
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.email !== undefined) user.email = patch.email.trim().toLowerCase();
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.isActive !== undefined) user.isActive = patch.isActive;
    if (patch.passwordHash !== undefined) user.passwordHash = patch.passwordHash;
    if (patch.preferredUnits !== undefined) user.preferredUnits = patch.preferredUnits;
    if (patch.currency !== undefined) user.currency = patch.currency;
    if (patch.dailyCalorieGoal !== undefined) user.dailyCalorieGoal = patch.dailyCalorieGoal;
    if (patch.dailyProteinGoal !== undefined) user.dailyProteinGoal = patch.dailyProteinGoal;
    if (patch.dailyCarbsGoal !== undefined) user.dailyCarbsGoal = patch.dailyCarbsGoal;
    if (patch.dailyFatGoal !== undefined) user.dailyFatGoal = patch.dailyFatGoal;
    if (patch.bumpSession) user.sessionVersion += 1;
    user.updatedAt = new Date().toISOString();
    return user;
  },

  async updateLastLogin(userId: string): Promise<void> {
    const now = new Date();
    if (await isDbReady()) {
      await db
        .update(users)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(users.id, toUuid(userId)));
      return;
    }
    const u = getMem().users.find((item) => item.id === userId);
    if (u) {
      u.lastLoginAt = now.toISOString();
      u.updatedAt = now.toISOString();
    }
  },

  async deleteUser(userId: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(users).where(eq(users.id, toUuid(userId)));
      return;
    }
    const mem = getMem();
    mem.users = mem.users.filter((u) => u.id !== userId);
  },

  // ======================== HOUSEHOLD SETTINGS ========================
  async getHouseholdSettings(): Promise<HouseholdSettingsRecord> {
    if (await isDbReady()) {
      const rows = await db.select().from(householdSettings).limit(1);
      if (rows[0]) {
        return {
          id: rows[0].id,
          householdName: rows[0].householdName,
          currency: rows[0].currency,
          weeklyGroceryBudget: rows[0].weeklyGroceryBudget,
          defaultStores: rows[0].defaultStores ?? [],
          updatedAt: isoString(rows[0].updatedAt),
        };
      }
      const def = defaultHouseholdSettings();
      await db.insert(householdSettings).values({
        id: def.id,
        householdName: def.householdName,
        currency: def.currency,
        weeklyGroceryBudget: def.weeklyGroceryBudget,
        defaultStores: def.defaultStores,
        updatedAt: new Date(),
      });
      return def;
    }
    return getMem().householdSettings;
  },

  async updateHouseholdSettings(patch: {
    householdName?: string;
    currency?: string;
    weeklyGroceryBudget?: number;
    defaultStores?: string[];
  }): Promise<HouseholdSettingsRecord> {
    const current = await this.getHouseholdSettings();
    const next: HouseholdSettingsRecord = {
      id: current.id,
      householdName: patch.householdName?.trim() || current.householdName,
      currency: patch.currency?.trim().toUpperCase().slice(0, 3) || current.currency,
      weeklyGroceryBudget:
        patch.weeklyGroceryBudget !== undefined
          ? Math.max(0, patch.weeklyGroceryBudget).toFixed(2)
          : current.weeklyGroceryBudget,
      defaultStores: patch.defaultStores ?? current.defaultStores,
      updatedAt: new Date().toISOString(),
    };

    if (await isDbReady()) {
      await db
        .update(householdSettings)
        .set({
          householdName: next.householdName,
          currency: next.currency,
          weeklyGroceryBudget: next.weeklyGroceryBudget,
          defaultStores: next.defaultStores,
          updatedAt: new Date(),
        })
        .where(eq(householdSettings.id, toUuid(current.id)));
      return next;
    }

    getMem().householdSettings = next;
    return next;
  },

  // ======================== RECIPES & COOK LOGS ========================
  async listRecipes(): Promise<RecipeRecord[]> {
    if (await isDbReady()) {
      const rows = await db.select().from(recipes).orderBy(desc(recipes.updatedAt));
      return rows.map(mapDbRecipe);
    }
    return [...getMem().recipes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getRecipeById(id: string): Promise<RecipeRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, toUuid(id)))
        .limit(1);
      return rows[0] ? mapDbRecipe(rows[0]) : null;
    }
    return getMem().recipes.find((r) => r.id === id) ?? null;
  },

  async createRecipe(input: CreateRecipeInput): Promise<RecipeRecord> {
    const now = new Date();
    const id = crypto.randomUUID();
    const record: RecipeRecord = {
      id,
      createdByUserId: input.createdByUserId,
      title: input.title.trim(),
      slug: slugify(input.title),
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      mealType: input.mealType,
      cuisine: input.cuisine?.trim() || null,
      difficulty: input.difficulty,
      prepTimeMin: Math.max(0, Math.round(input.prepTimeMin)),
      cookTimeMin: Math.max(0, Math.round(input.cookTimeMin)),
      servings: Math.max(1, Math.round(input.servings)),
      tags: input.tags.map((t) => t.trim()).filter(Boolean),
      ingredients: input.ingredients,
      steps: input.steps,
      caloriesPerServing:
        input.caloriesPerServing !== null && input.caloriesPerServing !== undefined
          ? Math.max(0, Math.round(input.caloriesPerServing))
          : null,
      proteinPerServing:
        input.proteinPerServing !== null && input.proteinPerServing !== undefined
          ? roundClean(input.proteinPerServing, 1).toFixed(1)
          : null,
      carbsPerServing:
        input.carbsPerServing !== null && input.carbsPerServing !== undefined
          ? roundClean(input.carbsPerServing, 1).toFixed(1)
          : null,
      fatPerServing:
        input.fatPerServing !== null && input.fatPerServing !== undefined
          ? roundClean(input.fatPerServing, 1).toFixed(1)
          : null,
      estimatedCostPerServing:
        input.estimatedCostPerServing !== null &&
        input.estimatedCostPerServing !== undefined
          ? roundClean(input.estimatedCostPerServing, 2).toFixed(2)
          : null,
      rating: Math.min(5, Math.max(0, Math.round(input.rating ?? 0))),
      isFavorite: Boolean(input.isFavorite),
      cookCount: 0,
      lastCookedAt: null,
      notes: input.notes?.trim() || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(recipes)
        .values({
          id,
          createdByUserId: record.createdByUserId
            ? toUuid(record.createdByUserId)
            : null,
          title: record.title,
          slug: record.slug,
          description: record.description,
          imageUrl: record.imageUrl,
          sourceUrl: record.sourceUrl,
          mealType: record.mealType,
          cuisine: record.cuisine,
          difficulty: record.difficulty,
          prepTimeMin: record.prepTimeMin,
          cookTimeMin: record.cookTimeMin,
          servings: record.servings,
          tags: record.tags,
          ingredients: record.ingredients,
          steps: record.steps,
          caloriesPerServing: record.caloriesPerServing,
          proteinPerServing: record.proteinPerServing,
          carbsPerServing: record.carbsPerServing,
          fatPerServing: record.fatPerServing,
          estimatedCostPerServing: record.estimatedCostPerServing,
          rating: record.rating,
          isFavorite: record.isFavorite,
          cookCount: 0,
          notes: record.notes,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapDbRecipe(inserted);
    }

    getMem().recipes.push(record);
    return record;
  },

  async updateRecipe(
    id: string,
    patch: Partial<CreateRecipeInput> & { rating?: number; isFavorite?: boolean }
  ): Promise<RecipeRecord | null> {
    const existing = await this.getRecipeById(id);
    if (!existing) return null;

    const updated: RecipeRecord = {
      ...existing,
      title: patch.title !== undefined ? patch.title.trim() : existing.title,
      slug: patch.title !== undefined ? slugify(patch.title) : existing.slug,
      description:
        patch.description !== undefined
          ? patch.description?.trim() || null
          : existing.description,
      imageUrl:
        patch.imageUrl !== undefined ? patch.imageUrl?.trim() || null : existing.imageUrl,
      sourceUrl:
        patch.sourceUrl !== undefined
          ? patch.sourceUrl?.trim() || null
          : existing.sourceUrl,
      mealType: patch.mealType ?? existing.mealType,
      cuisine:
        patch.cuisine !== undefined ? patch.cuisine?.trim() || null : existing.cuisine,
      difficulty: patch.difficulty ?? existing.difficulty,
      prepTimeMin:
        patch.prepTimeMin !== undefined
          ? Math.max(0, Math.round(patch.prepTimeMin))
          : existing.prepTimeMin,
      cookTimeMin:
        patch.cookTimeMin !== undefined
          ? Math.max(0, Math.round(patch.cookTimeMin))
          : existing.cookTimeMin,
      servings:
        patch.servings !== undefined
          ? Math.max(1, Math.round(patch.servings))
          : existing.servings,
      tags:
        patch.tags !== undefined
          ? patch.tags.map((t) => t.trim()).filter(Boolean)
          : existing.tags,
      ingredients: patch.ingredients ?? existing.ingredients,
      steps: patch.steps ?? existing.steps,
      caloriesPerServing:
        patch.caloriesPerServing !== undefined
          ? patch.caloriesPerServing !== null
            ? Math.max(0, Math.round(patch.caloriesPerServing))
            : null
          : existing.caloriesPerServing,
      proteinPerServing:
        patch.proteinPerServing !== undefined
          ? patch.proteinPerServing !== null
            ? roundClean(patch.proteinPerServing, 1).toFixed(1)
            : null
          : existing.proteinPerServing,
      carbsPerServing:
        patch.carbsPerServing !== undefined
          ? patch.carbsPerServing !== null
            ? roundClean(patch.carbsPerServing, 1).toFixed(1)
            : null
          : existing.carbsPerServing,
      fatPerServing:
        patch.fatPerServing !== undefined
          ? patch.fatPerServing !== null
            ? roundClean(patch.fatPerServing, 1).toFixed(1)
            : null
          : existing.fatPerServing,
      estimatedCostPerServing:
        patch.estimatedCostPerServing !== undefined
          ? patch.estimatedCostPerServing !== null
            ? roundClean(patch.estimatedCostPerServing, 2).toFixed(2)
            : null
          : existing.estimatedCostPerServing,
      rating:
        patch.rating !== undefined
          ? Math.min(5, Math.max(0, Math.round(patch.rating)))
          : existing.rating,
      isFavorite: patch.isFavorite ?? existing.isFavorite,
      notes: patch.notes !== undefined ? patch.notes?.trim() || null : existing.notes,
      updatedAt: new Date().toISOString(),
    };

    if (await isDbReady()) {
      const [row] = await db
        .update(recipes)
        .set({
          title: updated.title,
          slug: updated.slug,
          description: updated.description,
          imageUrl: updated.imageUrl,
          sourceUrl: updated.sourceUrl,
          mealType: updated.mealType,
          cuisine: updated.cuisine,
          difficulty: updated.difficulty,
          prepTimeMin: updated.prepTimeMin,
          cookTimeMin: updated.cookTimeMin,
          servings: updated.servings,
          tags: updated.tags,
          ingredients: updated.ingredients,
          steps: updated.steps,
          caloriesPerServing: updated.caloriesPerServing,
          proteinPerServing: updated.proteinPerServing,
          carbsPerServing: updated.carbsPerServing,
          fatPerServing: updated.fatPerServing,
          estimatedCostPerServing: updated.estimatedCostPerServing,
          rating: updated.rating,
          isFavorite: updated.isFavorite,
          notes: updated.notes,
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, toUuid(id)))
        .returning();
      return row ? mapDbRecipe(row) : null;
    }

    const mem = getMem();
    const idx = mem.recipes.findIndex((r) => r.id === id);
    if (idx !== -1) mem.recipes[idx] = updated;
    return updated;
  },

  async deleteRecipe(id: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(recipes).where(eq(recipes.id, toUuid(id)));
      return;
    }
    const mem = getMem();
    mem.recipes = mem.recipes.filter((r) => r.id !== id);
    mem.cookLogs = mem.cookLogs.filter((c) => c.recipeId !== id);
    mem.mealPlanEntries = mem.mealPlanEntries.map((m) =>
      m.recipeId === id ? { ...m, recipeId: null, customTitle: m.customTitle || "Removed Recipe" } : m
    );
  },

  async duplicateRecipe(id: string, userId: string | null): Promise<RecipeRecord | null> {
    const existing = await this.getRecipeById(id);
    if (!existing) return null;
    return this.createRecipe({
      createdByUserId: userId,
      title: `${existing.title} (Copy)`,
      description: existing.description,
      imageUrl: existing.imageUrl,
      sourceUrl: existing.sourceUrl,
      mealType: existing.mealType,
      cuisine: existing.cuisine,
      difficulty: existing.difficulty,
      prepTimeMin: existing.prepTimeMin,
      cookTimeMin: existing.cookTimeMin,
      servings: existing.servings,
      tags: [...existing.tags],
      ingredients: existing.ingredients.map((i) => ({ ...i, id: crypto.randomUUID() })),
      steps: existing.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
      caloriesPerServing: existing.caloriesPerServing,
      proteinPerServing: existing.proteinPerServing
        ? parseFloat(existing.proteinPerServing)
        : null,
      carbsPerServing: existing.carbsPerServing ? parseFloat(existing.carbsPerServing) : null,
      fatPerServing: existing.fatPerServing ? parseFloat(existing.fatPerServing) : null,
      estimatedCostPerServing: existing.estimatedCostPerServing
        ? parseFloat(existing.estimatedCostPerServing)
        : null,
      rating: existing.rating,
      isFavorite: false,
      notes: existing.notes,
    });
  },

  async toggleFavoriteRecipe(id: string): Promise<RecipeRecord | null> {
    const existing = await this.getRecipeById(id);
    if (!existing) return null;
    return this.updateRecipe(id, { isFavorite: !existing.isFavorite });
  },

  async getCookLogsForRecipe(recipeId: string): Promise<CookLogRecord[]> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(cookLogs)
        .where(eq(cookLogs.recipeId, toUuid(recipeId)))
        .orderBy(desc(cookLogs.cookedAt));
      return rows.map((r) => ({
        id: r.id,
        recipeId: r.recipeId,
        userId: r.userId,
        cookedAt: isoString(r.cookedAt),
        servingsMade: r.servingsMade,
        rating: r.rating,
        notes: r.notes,
      }));
    }
    return getMem()
      .cookLogs.filter((c) => c.recipeId === recipeId)
      .sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
  },

  async logRecipeCooked(input: {
    recipeId: string;
    userId: string | null;
    servingsMade: number;
    rating?: number | null;
    notes?: string | null;
    saveLeftovers?: {
      portions: number;
      storageLocation: "fridge" | "freezer";
      useByDays: number;
    } | null;
  }): Promise<{ recipe: RecipeRecord | null; leftoverBatch: LeftoverBatchRecord | null }> {
    const recipe = await this.getRecipeById(input.recipeId);
    if (!recipe) return { recipe: null, leftoverBatch: null };

    const now = new Date();
    const logId = crypto.randomUUID();
    const nextCookCount = recipe.cookCount + 1;
    const nextRating =
      input.rating !== null && input.rating !== undefined && input.rating > 0
        ? Math.min(5, Math.round(input.rating))
        : recipe.rating;

    if (await isDbReady()) {
      await db.insert(cookLogs).values({
        id: logId,
        recipeId: toUuid(recipe.id),
        userId: input.userId ? toUuid(input.userId) : null,
        cookedAt: now,
        servingsMade: Math.max(1, Math.round(input.servingsMade)),
        rating: input.rating ?? null,
        notes: input.notes?.trim() || null,
      });

      await db
        .update(recipes)
        .set({
          cookCount: nextCookCount,
          lastCookedAt: now,
          rating: nextRating,
          updatedAt: now,
        })
        .where(eq(recipes.id, toUuid(recipe.id)));
    } else {
      const mem = getMem();
      mem.cookLogs.push({
        id: logId,
        recipeId: recipe.id,
        userId: input.userId,
        cookedAt: now.toISOString(),
        servingsMade: Math.max(1, Math.round(input.servingsMade)),
        rating: input.rating ?? null,
        notes: input.notes?.trim() || null,
      });
      const r = mem.recipes.find((x) => x.id === recipe.id);
      if (r) {
        r.cookCount = nextCookCount;
        r.lastCookedAt = now.toISOString();
        r.rating = nextRating;
        r.updatedAt = now.toISOString();
      }
    }

    let leftoverBatch: LeftoverBatchRecord | null = null;
    if (input.saveLeftovers && input.saveLeftovers.portions > 0) {
      const todayIso = toIsoDate(now);
      const useBy = addDaysIso(
        todayIso,
        Math.max(1, Math.round(input.saveLeftovers.useByDays))
      );
      leftoverBatch = await this.createLeftoverBatch({
        recipeId: recipe.id,
        title: recipe.title,
        storageLocation: input.saveLeftovers.storageLocation,
        totalPortions: input.saveLeftovers.portions,
        preparedDate: todayIso,
        useByDate: useBy,
        caloriesPerPortion: recipe.caloriesPerServing,
        proteinPerPortion: recipe.proteinPerServing
          ? parseFloat(recipe.proteinPerServing)
          : null,
        carbsPerPortion: recipe.carbsPerServing ? parseFloat(recipe.carbsPerServing) : null,
        fatPerPortion: recipe.fatPerServing ? parseFloat(recipe.fatPerServing) : null,
        notes: input.notes?.trim() || `Prepped ${input.servingsMade} servings`,
        createdByUserId: input.userId,
      });
    }

    const updatedRecipe = await this.getRecipeById(recipe.id);
    return { recipe: updatedRecipe, leftoverBatch };
  },

  // ======================== MEAL PLANNER ========================
  async listMealPlanEntries(startDate?: string, endDate?: string): Promise<MealPlanEntryRecord[]> {
    if (await isDbReady()) {
      const conditions = [];
      if (startDate) conditions.push(gte(mealPlanEntries.planDate, startDate));
      if (endDate) conditions.push(lte(mealPlanEntries.planDate, endDate));
      const rows =
        conditions.length > 0
          ? await db
              .select()
              .from(mealPlanEntries)
              .where(and(...conditions))
              .orderBy(asc(mealPlanEntries.planDate))
          : await db
              .select()
              .from(mealPlanEntries)
              .orderBy(asc(mealPlanEntries.planDate));
      return rows.map(mapDbMealPlanEntry);
    }

    return getMem()
      .mealPlanEntries.filter((e) => {
        if (startDate && e.planDate < startDate) return false;
        if (endDate && e.planDate > endDate) return false;
        return true;
      })
      .sort((a, b) => a.planDate.localeCompare(b.planDate));
  },

  async addMealPlanEntry(input: {
    planDate: string;
    mealSlot: MealSlot;
    recipeId?: string | null;
    leftoverId?: string | null;
    customTitle?: string | null;
    servings: number;
    isBatchPrep?: boolean;
    isLeftover?: boolean;
    notes?: string | null;
    createdByUserId: string | null;
  }): Promise<MealPlanEntryRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const record: MealPlanEntryRecord = {
      id,
      planDate: input.planDate,
      mealSlot: input.mealSlot,
      recipeId: input.recipeId || null,
      leftoverId: input.leftoverId || null,
      customTitle: input.customTitle?.trim() || null,
      servings: Math.max(1, Math.round(input.servings)),
      isBatchPrep: Boolean(input.isBatchPrep),
      isLeftover: Boolean(input.isLeftover),
      isCompleted: false,
      notes: input.notes?.trim() || null,
      createdByUserId: input.createdByUserId,
      createdAt: now.toISOString(),
    };

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(mealPlanEntries)
        .values({
          id,
          planDate: record.planDate,
          mealSlot: record.mealSlot,
          recipeId: record.recipeId ? toUuid(record.recipeId) : null,
          leftoverId: record.leftoverId ? toUuid(record.leftoverId) : null,
          customTitle: record.customTitle,
          servings: record.servings,
          isBatchPrep: record.isBatchPrep,
          isLeftover: record.isLeftover,
          isCompleted: false,
          notes: record.notes,
          createdByUserId: record.createdByUserId ? toUuid(record.createdByUserId) : null,
          createdAt: now,
        })
        .returning();
      return mapDbMealPlanEntry(inserted);
    }

    getMem().mealPlanEntries.push(record);
    return record;
  },

  async updateMealPlanEntry(
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
  ): Promise<MealPlanEntryRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(mealPlanEntries)
        .where(eq(mealPlanEntries.id, toUuid(id)))
        .limit(1);
      if (!rows[0]) return null;
      const existing = mapDbMealPlanEntry(rows[0]);
      const [updated] = await db
        .update(mealPlanEntries)
        .set({
          planDate: patch.planDate ?? existing.planDate,
          mealSlot: patch.mealSlot ?? existing.mealSlot,
          servings:
            patch.servings !== undefined
              ? Math.max(1, Math.round(patch.servings))
              : existing.servings,
          isBatchPrep: patch.isBatchPrep ?? existing.isBatchPrep,
          isLeftover: patch.isLeftover ?? existing.isLeftover,
          isCompleted: patch.isCompleted ?? existing.isCompleted,
          notes: patch.notes !== undefined ? patch.notes?.trim() || null : existing.notes,
        })
        .where(eq(mealPlanEntries.id, toUuid(id)))
        .returning();
      return updated ? mapDbMealPlanEntry(updated) : null;
    }

    const mem = getMem();
    const target = mem.mealPlanEntries.find((m) => m.id === id);
    if (!target) return null;
    if (patch.planDate !== undefined) target.planDate = patch.planDate;
    if (patch.mealSlot !== undefined) target.mealSlot = patch.mealSlot;
    if (patch.servings !== undefined) target.servings = Math.max(1, Math.round(patch.servings));
    if (patch.isBatchPrep !== undefined) target.isBatchPrep = patch.isBatchPrep;
    if (patch.isLeftover !== undefined) target.isLeftover = patch.isLeftover;
    if (patch.isCompleted !== undefined) target.isCompleted = patch.isCompleted;
    if (patch.notes !== undefined) target.notes = patch.notes?.trim() || null;
    return target;
  },

  async deleteMealPlanEntry(id: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, toUuid(id)));
      return;
    }
    const mem = getMem();
    mem.mealPlanEntries = mem.mealPlanEntries.filter((m) => m.id !== id);
  },

  async toggleMealEntryCompleted(id: string): Promise<MealPlanEntryRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(mealPlanEntries)
        .where(eq(mealPlanEntries.id, toUuid(id)))
        .limit(1);
      if (!rows[0]) return null;
      return this.updateMealPlanEntry(id, { isCompleted: !rows[0].isCompleted });
    }
    const target = getMem().mealPlanEntries.find((m) => m.id === id);
    if (!target) return null;
    target.isCompleted = !target.isCompleted;
    return target;
  },

  async listMealPlanTemplates(): Promise<MealPlanTemplateRecord[]> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(mealPlanTemplates)
        .orderBy(desc(mealPlanTemplates.createdAt));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        slots: r.slots ?? [],
        createdByUserId: r.createdByUserId,
        createdAt: isoString(r.createdAt),
      }));
    }
    return [...getMem().mealPlanTemplates].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  },

  async saveMealPlanTemplate(input: {
    name: string;
    description?: string | null;
    weekStartDate: string;
    createdByUserId: string | null;
  }): Promise<MealPlanTemplateRecord> {
    const weekEnd = addDaysIso(input.weekStartDate, 6);
    const entries = await this.listMealPlanEntries(input.weekStartDate, weekEnd);
    const startMs = new Date(`${input.weekStartDate}T00:00:00`).getTime();

    const slots: MealTemplateSlot[] = entries.map((e) => {
      const entryMs = new Date(`${e.planDate}T00:00:00`).getTime();
      const dayOffset = Math.min(6, Math.max(0, Math.round((entryMs - startMs) / 86400000)));
      return {
        dayOffset,
        mealSlot: e.mealSlot,
        recipeId: e.recipeId,
        customTitle: e.customTitle,
        servings: e.servings,
        isBatchPrep: e.isBatchPrep,
        notes: e.notes,
      };
    });

    const id = crypto.randomUUID();
    const now = new Date();
    const record: MealPlanTemplateRecord = {
      id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      slots,
      createdByUserId: input.createdByUserId,
      createdAt: now.toISOString(),
    };

    if (await isDbReady()) {
      await db.insert(mealPlanTemplates).values({
        id,
        name: record.name,
        description: record.description,
        slots,
        createdByUserId: record.createdByUserId ? toUuid(record.createdByUserId) : null,
        createdAt: now,
      });
      return record;
    }

    getMem().mealPlanTemplates.push(record);
    return record;
  },

  async applyMealPlanTemplate(input: {
    templateId: string;
    weekStartDate: string;
    replaceWeek: boolean;
    userId: string | null;
  }): Promise<MealPlanEntryRecord[]> {
    const templates = await this.listMealPlanTemplates();
    const template = templates.find((t) => t.id === input.templateId);
    if (!template) {
      throw new Error("Meal plan template not found.");
    }

    const weekEnd = addDaysIso(input.weekStartDate, 6);
    if (input.replaceWeek) {
      const existing = await this.listMealPlanEntries(input.weekStartDate, weekEnd);
      for (const e of existing) {
        await this.deleteMealPlanEntry(e.id);
      }
    }

    const validRecipes = new Set((await this.listRecipes()).map((r) => r.id));
    const created: MealPlanEntryRecord[] = [];
    for (const slot of template.slots) {
      const planDate = addDaysIso(input.weekStartDate, slot.dayOffset);
      const validRecipeId = slot.recipeId && validRecipes.has(slot.recipeId) ? slot.recipeId : null;
      if (!validRecipeId && !slot.customTitle) continue;
      const entry = await this.addMealPlanEntry({
        planDate,
        mealSlot: slot.mealSlot,
        recipeId: validRecipeId,
        customTitle: slot.customTitle,
        servings: slot.servings,
        isBatchPrep: slot.isBatchPrep,
        notes: slot.notes ?? null,
        createdByUserId: input.userId,
      });
      created.push(entry);
    }

    return created;
  },

  async deleteMealPlanTemplate(id: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(mealPlanTemplates).where(eq(mealPlanTemplates.id, toUuid(id)));
      return;
    }
    const mem = getMem();
    mem.mealPlanTemplates = mem.mealPlanTemplates.filter((t) => t.id !== id);
  },

  // ======================== GROCERY LISTS & ITEMS ========================
  async listGroceryLists(): Promise<GroceryListRecord[]> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(groceryLists)
        .orderBy(desc(groceryLists.updatedAt));
      return rows.map(mapDbGroceryList);
    }
    return [...getMem().groceryLists].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  },

  async getGroceryListById(id: string): Promise<GroceryListRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(groceryLists)
        .where(eq(groceryLists.id, toUuid(id)))
        .limit(1);
      return rows[0] ? mapDbGroceryList(rows[0]) : null;
    }
    return getMem().groceryLists.find((l) => l.id === id) ?? null;
  },

  async listGroceryItems(listId: string): Promise<GroceryItemRecord[]> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(groceryItems)
        .where(eq(groceryItems.listId, toUuid(listId)))
        .orderBy(asc(groceryItems.sortOrder), asc(groceryItems.createdAt));
      return rows.map(mapDbGroceryItem);
    }
    return getMem()
      .groceryItems.filter((i) => i.listId === listId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async createGroceryList(input: {
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    createdByUserId: string | null;
  }): Promise<GroceryListRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const record: GroceryListRecord = {
      id,
      name: input.name.trim(),
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      status: "active",
      estimatedTotal: "0.00",
      actualTotal: null,
      completedAt: null,
      createdByUserId: input.createdByUserId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(groceryLists)
        .values({
          id,
          name: record.name,
          startDate: record.startDate,
          endDate: record.endDate,
          status: "active",
          estimatedTotal: "0.00",
          createdByUserId: record.createdByUserId ? toUuid(record.createdByUserId) : null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapDbGroceryList(inserted);
    }

    getMem().groceryLists.push(record);
    return record;
  },

  async generateGroceryListFromPlan(input: {
    name: string;
    startDate: string;
    endDate: string;
    pantryMode: PantryGenerationMode;
    includeLeftoverSlots: boolean;
    includeQuickStaples: boolean;
    createdByUserId: string | null;
  }): Promise<GroceryListRecord> {
    const [entries, allRecipes, allPantry, staples] = await Promise.all([
      this.listMealPlanEntries(input.startDate, input.endDate),
      this.listRecipes(),
      this.listPantryItems(),
      this.listQuickStaples(),
    ]);

    const recipesById = new Map(allRecipes.map((r) => [r.id, r]));
    const draftItems = generateGroceryItemsFromPlan(entries, recipesById, allPantry, {
      pantryMode: input.pantryMode,
      includeLeftoverSlots: input.includeLeftoverSlots,
    });

    const list = await this.createGroceryList({
      name: input.name.trim() || `Grocery Run (${input.startDate})`,
      startDate: input.startDate,
      endDate: input.endDate,
      createdByUserId: input.createdByUserId,
    });

    let sortIdx = 0;
    for (const item of draftItems) {
      await this.addGroceryItem({
        listId: list.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        aisle: item.aisle,
        store: item.store,
        inPantryFlag: item.inPantryFlag,
        pantryNote: item.pantryNote,
        isManual: false,
        estimatedCost: item.estimatedCost,
        sourceRecipes: item.sourceRecipes,
        notes: item.notes,
        sortOrder: sortIdx++,
      });
    }

    if (input.includeQuickStaples) {
      for (const st of staples) {
        await this.addGroceryItem({
          listId: list.id,
          name: st.name,
          quantity: parseFloat(st.defaultQuantity) || 1,
          unit: st.defaultUnit,
          aisle: st.aisle,
          store: st.store,
          inPantryFlag: "none",
          pantryNote: "Quick staple",
          isManual: true,
          estimatedCost: st.estimatedCost ? parseFloat(st.estimatedCost) : null,
          sourceRecipes: [],
          notes: "Added from Quick Staples",
          sortOrder: sortIdx++,
        });
      }
    }

    return (await this.getGroceryListById(list.id)) ?? list;
  },

  async addGroceryItem(input: {
    listId: string;
    name: string;
    quantity?: number | null;
    unit?: string;
    aisle?: AisleCategory;
    store?: string | null;
    inPantryFlag?: "none" | "partial" | "stocked";
    pantryNote?: string | null;
    isManual?: boolean;
    estimatedCost?: number | null;
    sourceRecipes?: string[];
    notes?: string | null;
    sortOrder?: number;
  }): Promise<GroceryItemRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const cleanName = input.name.trim();
    const record: GroceryItemRecord = {
      id,
      listId: input.listId,
      name: cleanName,
      normalizedName: normalizeIngredientName(cleanName),
      quantity:
        input.quantity !== null && input.quantity !== undefined && !Number.isNaN(input.quantity)
          ? String(roundClean(input.quantity, 2))
          : null,
      unit: (input.unit || "").trim(),
      aisle: input.aisle || classifyAisle(cleanName),
      store: input.store?.trim() || null,
      isChecked: false,
      inPantryFlag: input.inPantryFlag || "none",
      pantryNote: input.pantryNote || null,
      isManual: input.isManual ?? true,
      estimatedCost:
        input.estimatedCost !== null &&
        input.estimatedCost !== undefined &&
        !Number.isNaN(input.estimatedCost)
          ? roundClean(input.estimatedCost, 2).toFixed(2)
          : null,
      sourceRecipes: input.sourceRecipes ?? [],
      notes: input.notes?.trim() || null,
      sortOrder: input.sortOrder ?? 999,
      createdAt: now.toISOString(),
    };

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(groceryItems)
        .values({
          id,
          listId: toUuid(record.listId),
          name: record.name,
          normalizedName: record.normalizedName,
          quantity: record.quantity,
          unit: record.unit,
          aisle: record.aisle,
          store: record.store,
          isChecked: false,
          inPantryFlag: record.inPantryFlag,
          pantryNote: record.pantryNote,
          isManual: record.isManual,
          estimatedCost: record.estimatedCost,
          sourceRecipes: record.sourceRecipes,
          notes: record.notes,
          sortOrder: record.sortOrder,
          createdAt: now,
        })
        .returning();
      await recalculateDbGroceryListTotal(toUuid(record.listId));
      return mapDbGroceryItem(inserted);
    }

    getMem().groceryItems.push(record);
    recalculateMemGroceryListTotal(record.listId);
    return record;
  },

  async updateGroceryItem(
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
  ): Promise<GroceryItemRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(groceryItems)
        .where(eq(groceryItems.id, toUuid(id)))
        .limit(1);
      if (!rows[0]) return null;
      const existing = mapDbGroceryItem(rows[0]);
      const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
      const [updated] = await db
        .update(groceryItems)
        .set({
          name: nextName,
          normalizedName: normalizeIngredientName(nextName),
          quantity:
            patch.quantity !== undefined
              ? patch.quantity !== null
                ? String(roundClean(patch.quantity, 2))
                : null
              : existing.quantity,
          unit: patch.unit !== undefined ? patch.unit.trim() : existing.unit,
          aisle: patch.aisle ?? existing.aisle,
          store: patch.store !== undefined ? patch.store?.trim() || null : existing.store,
          isChecked: patch.isChecked ?? existing.isChecked,
          estimatedCost:
            patch.estimatedCost !== undefined
              ? patch.estimatedCost !== null
                ? roundClean(patch.estimatedCost, 2).toFixed(2)
                : null
              : existing.estimatedCost,
          notes: patch.notes !== undefined ? patch.notes?.trim() || null : existing.notes,
        })
        .where(eq(groceryItems.id, toUuid(id)))
        .returning();
      await recalculateDbGroceryListTotal(rows[0].listId);
      return updated ? mapDbGroceryItem(updated) : null;
    }

    const mem = getMem();
    const target = mem.groceryItems.find((i) => i.id === id);
    if (!target) return null;
    if (patch.name !== undefined) {
      target.name = patch.name.trim();
      target.normalizedName = normalizeIngredientName(target.name);
    }
    if (patch.quantity !== undefined) {
      target.quantity =
        patch.quantity !== null ? String(roundClean(patch.quantity, 2)) : null;
    }
    if (patch.unit !== undefined) target.unit = patch.unit.trim();
    if (patch.aisle !== undefined) target.aisle = patch.aisle;
    if (patch.store !== undefined) target.store = patch.store?.trim() || null;
    if (patch.isChecked !== undefined) target.isChecked = patch.isChecked;
    if (patch.estimatedCost !== undefined) {
      target.estimatedCost =
        patch.estimatedCost !== null ? roundClean(patch.estimatedCost, 2).toFixed(2) : null;
    }
    if (patch.notes !== undefined) target.notes = patch.notes?.trim() || null;
    recalculateMemGroceryListTotal(target.listId);
    return target;
  },

  async toggleGroceryItem(id: string): Promise<GroceryItemRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(groceryItems)
        .where(eq(groceryItems.id, toUuid(id)))
        .limit(1);
      if (!rows[0]) return null;
      return this.updateGroceryItem(id, { isChecked: !rows[0].isChecked });
    }
    const target = getMem().groceryItems.find((i) => i.id === id);
    if (!target) return null;
    target.isChecked = !target.isChecked;
    return target;
  },

  async deleteGroceryItem(id: string): Promise<void> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(groceryItems)
        .where(eq(groceryItems.id, toUuid(id)))
        .limit(1);
      await db.delete(groceryItems).where(eq(groceryItems.id, toUuid(id)));
      if (rows[0]) await recalculateDbGroceryListTotal(rows[0].listId);
      return;
    }
    const mem = getMem();
    const item = mem.groceryItems.find((i) => i.id === id);
    mem.groceryItems = mem.groceryItems.filter((i) => i.id !== id);
    if (item) recalculateMemGroceryListTotal(item.listId);
  },

  async clearCheckedGroceryItems(listId: string): Promise<void> {
    if (await isDbReady()) {
      await db
        .delete(groceryItems)
        .where(and(eq(groceryItems.listId, toUuid(listId)), eq(groceryItems.isChecked, true)));
      await recalculateDbGroceryListTotal(toUuid(listId));
      return;
    }
    const mem = getMem();
    mem.groceryItems = mem.groceryItems.filter(
      (i) => !(i.listId === listId && i.isChecked)
    );
    recalculateMemGroceryListTotal(listId);
  },

  async completeGroceryList(input: {
    listId: string;
    actualTotal?: number | null;
    restockCheckedToPantry: boolean;
  }): Promise<GroceryListRecord | null> {
    const list = await this.getGroceryListById(input.listId);
    if (!list) return null;

    const items = await this.listGroceryItems(input.listId);
    if (input.restockCheckedToPantry) {
      const existingPantry = await this.listPantryItems();
      const pantryByNorm = new Map(
        existingPantry.map((p) => [p.normalizedName || normalizeIngredientName(p.name), p])
      );

      for (const item of items) {
        if (!item.isChecked) continue;
        const qty = item.quantity ? parseFloat(item.quantity) || 1 : 1;
        const existing = pantryByNorm.get(item.normalizedName);
        if (existing) {
          await this.adjustPantryQuantity(existing.id, qty);
        } else {
          const location: PantryLocation =
            item.aisle === "Produce" ||
            item.aisle === "Dairy & Eggs" ||
            item.aisle === "Meat & Seafood"
              ? "fridge"
              : item.aisle === "Frozen"
              ? "freezer"
              : item.aisle === "Spices & Condiments"
              ? "spices"
              : "pantry";
          await this.createPantryItem({
            name: item.name,
            quantity: qty,
            unit: item.unit || "unit",
            location,
            aisle: item.aisle,
            isAlwaysStocked: false,
            notes: `Bought on ${toIsoDate(new Date())}`,
          });
        }
      }
    }

    const now = new Date();
    const actualStr =
      input.actualTotal !== null &&
      input.actualTotal !== undefined &&
      !Number.isNaN(input.actualTotal)
        ? roundClean(input.actualTotal, 2).toFixed(2)
        : list.estimatedTotal;

    if (await isDbReady()) {
      const [updated] = await db
        .update(groceryLists)
        .set({
          status: "completed",
          actualTotal: actualStr,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(groceryLists.id, toUuid(input.listId)))
        .returning();
      return updated ? mapDbGroceryList(updated) : null;
    }

    const target = getMem().groceryLists.find((l) => l.id === input.listId);
    if (!target) return null;
    target.status = "completed";
    target.actualTotal = actualStr;
    target.completedAt = now.toISOString();
    target.updatedAt = now.toISOString();
    return target;
  },

  async deleteGroceryList(listId: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(groceryLists).where(eq(groceryLists.id, toUuid(listId)));
      return;
    }
    const mem = getMem();
    mem.groceryLists = mem.groceryLists.filter((l) => l.id !== listId);
    mem.groceryItems = mem.groceryItems.filter((i) => i.listId !== listId);
  },

  async listQuickStaples(): Promise<QuickStapleRecord[]> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(quickStaples)
        .orderBy(asc(quickStaples.name));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        defaultQuantity: r.defaultQuantity,
        defaultUnit: r.defaultUnit,
        aisle: r.aisle,
        store: r.store,
        estimatedCost: r.estimatedCost,
        createdAt: isoString(r.createdAt),
      }));
    }
    return [...getMem().quickStaples].sort((a, b) => a.name.localeCompare(b.name));
  },

  async addQuickStaple(input: {
    name: string;
    defaultQuantity: number;
    defaultUnit: string;
    aisle: AisleCategory;
    store?: string | null;
    estimatedCost?: number | null;
  }): Promise<QuickStapleRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const record: QuickStapleRecord = {
      id,
      name: input.name.trim(),
      defaultQuantity: roundClean(Math.max(0.1, input.defaultQuantity), 2).toFixed(2),
      defaultUnit: input.defaultUnit.trim() || "unit",
      aisle: input.aisle,
      store: input.store?.trim() || null,
      estimatedCost:
        input.estimatedCost !== null &&
        input.estimatedCost !== undefined &&
        !Number.isNaN(input.estimatedCost)
          ? roundClean(input.estimatedCost, 2).toFixed(2)
          : null,
      createdAt: now.toISOString(),
    };

    if (await isDbReady()) {
      await db.insert(quickStaples).values({
        id,
        name: record.name,
        defaultQuantity: record.defaultQuantity,
        defaultUnit: record.defaultUnit,
        aisle: record.aisle,
        store: record.store,
        estimatedCost: record.estimatedCost,
        createdAt: now,
      });
      return record;
    }

    getMem().quickStaples.push(record);
    return record;
  },

  async deleteQuickStaple(id: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(quickStaples).where(eq(quickStaples.id, toUuid(id)));
      return;
    }
    const mem = getMem();
    mem.quickStaples = mem.quickStaples.filter((q) => q.id !== id);
  },

  // ======================== PANTRY & LEFTOVERS ========================
  async listPantryItems(): Promise<PantryItemRecord[]> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(pantryItems)
        .orderBy(asc(pantryItems.location), asc(pantryItems.name));
      return rows.map(mapDbPantryItem);
    }
    return [...getMem().pantryItems].sort((a, b) => a.name.localeCompare(b.name));
  },

  async createPantryItem(input: {
    name: string;
    quantity: number;
    unit: string;
    location: PantryLocation;
    aisle?: AisleCategory;
    isAlwaysStocked?: boolean;
    expiresAt?: string | null;
    lowStockThreshold?: number | null;
    notes?: string | null;
  }): Promise<PantryItemRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const cleanName = input.name.trim();
    const record: PantryItemRecord = {
      id,
      name: cleanName,
      normalizedName: normalizeIngredientName(cleanName),
      quantity: roundClean(Math.max(0, input.quantity), 2).toFixed(2),
      unit: input.unit.trim() || "unit",
      location: input.location,
      aisle: input.aisle || classifyAisle(cleanName),
      isAlwaysStocked: Boolean(input.isAlwaysStocked),
      expiresAt: input.expiresAt?.trim() || null,
      lowStockThreshold:
        input.lowStockThreshold !== null &&
        input.lowStockThreshold !== undefined &&
        !Number.isNaN(input.lowStockThreshold)
          ? roundClean(input.lowStockThreshold, 2).toFixed(2)
          : null,
      notes: input.notes?.trim() || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(pantryItems)
        .values({
          id,
          name: record.name,
          normalizedName: record.normalizedName,
          quantity: record.quantity,
          unit: record.unit,
          location: record.location,
          aisle: record.aisle,
          isAlwaysStocked: record.isAlwaysStocked,
          expiresAt: record.expiresAt,
          lowStockThreshold: record.lowStockThreshold,
          notes: record.notes,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapDbPantryItem(inserted);
    }

    getMem().pantryItems.push(record);
    return record;
  },

  async updatePantryItem(
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
  ): Promise<PantryItemRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(pantryItems)
        .where(eq(pantryItems.id, toUuid(id)))
        .limit(1);
      if (!rows[0]) return null;
      const existing = mapDbPantryItem(rows[0]);
      const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
      const [updated] = await db
        .update(pantryItems)
        .set({
          name: nextName,
          normalizedName: normalizeIngredientName(nextName),
          quantity:
            patch.quantity !== undefined
              ? roundClean(Math.max(0, patch.quantity), 2).toFixed(2)
              : existing.quantity,
          unit: patch.unit !== undefined ? patch.unit.trim() : existing.unit,
          location: patch.location ?? existing.location,
          aisle: patch.aisle ?? existing.aisle,
          isAlwaysStocked: patch.isAlwaysStocked ?? existing.isAlwaysStocked,
          expiresAt:
            patch.expiresAt !== undefined
              ? patch.expiresAt?.trim() || null
              : existing.expiresAt,
          lowStockThreshold:
            patch.lowStockThreshold !== undefined
              ? patch.lowStockThreshold !== null
                ? roundClean(patch.lowStockThreshold, 2).toFixed(2)
                : null
              : existing.lowStockThreshold,
          notes: patch.notes !== undefined ? patch.notes?.trim() || null : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(pantryItems.id, toUuid(id)))
        .returning();
      return updated ? mapDbPantryItem(updated) : null;
    }

    const target = getMem().pantryItems.find((p) => p.id === id);
    if (!target) return null;
    if (patch.name !== undefined) {
      target.name = patch.name.trim();
      target.normalizedName = normalizeIngredientName(target.name);
    }
    if (patch.quantity !== undefined) {
      target.quantity = roundClean(Math.max(0, patch.quantity), 2).toFixed(2);
    }
    if (patch.unit !== undefined) target.unit = patch.unit.trim();
    if (patch.location !== undefined) target.location = patch.location;
    if (patch.aisle !== undefined) target.aisle = patch.aisle;
    if (patch.isAlwaysStocked !== undefined) target.isAlwaysStocked = patch.isAlwaysStocked;
    if (patch.expiresAt !== undefined) target.expiresAt = patch.expiresAt?.trim() || null;
    if (patch.lowStockThreshold !== undefined) {
      target.lowStockThreshold =
        patch.lowStockThreshold !== null
          ? roundClean(patch.lowStockThreshold, 2).toFixed(2)
          : null;
    }
    if (patch.notes !== undefined) target.notes = patch.notes?.trim() || null;
    target.updatedAt = new Date().toISOString();
    return target;
  },

  async adjustPantryQuantity(id: string, delta: number): Promise<PantryItemRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(pantryItems)
        .where(eq(pantryItems.id, toUuid(id)))
        .limit(1);
      if (!rows[0]) return null;
      const cur = parseFloat(rows[0].quantity) || 0;
      return this.updatePantryItem(id, { quantity: Math.max(0, cur + delta) });
    }
    const target = getMem().pantryItems.find((p) => p.id === id);
    if (!target) return null;
    const cur = parseFloat(target.quantity) || 0;
    return this.updatePantryItem(id, { quantity: Math.max(0, cur + delta) });
  },

  async deletePantryItem(id: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(pantryItems).where(eq(pantryItems.id, toUuid(id)));
      return;
    }
    const mem = getMem();
    mem.pantryItems = mem.pantryItems.filter((p) => p.id !== id);
  },

  async listLeftoverBatches(): Promise<LeftoverBatchRecord[]> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(leftoverBatches)
        .orderBy(desc(leftoverBatches.createdAt));
      return rows.map(mapDbLeftover);
    }
    return [...getMem().leftoverBatches].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  },

  async createLeftoverBatch(input: {
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
    createdByUserId: string | null;
  }): Promise<LeftoverBatchRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const portions = Math.max(1, Math.round(input.totalPortions));
    const record: LeftoverBatchRecord = {
      id,
      recipeId: input.recipeId || null,
      title: input.title.trim(),
      storageLocation: input.storageLocation,
      totalPortions: portions,
      remainingPortions: portions,
      preparedDate: input.preparedDate || toIsoDate(now),
      useByDate: input.useByDate?.trim() || null,
      caloriesPerPortion:
        input.caloriesPerPortion !== null && input.caloriesPerPortion !== undefined
          ? Math.round(input.caloriesPerPortion)
          : null,
      proteinPerPortion:
        input.proteinPerPortion !== null && input.proteinPerPortion !== undefined
          ? roundClean(input.proteinPerPortion, 1).toFixed(1)
          : null,
      carbsPerPortion:
        input.carbsPerPortion !== null && input.carbsPerPortion !== undefined
          ? roundClean(input.carbsPerPortion, 1).toFixed(1)
          : null,
      fatPerPortion:
        input.fatPerPortion !== null && input.fatPerPortion !== undefined
          ? roundClean(input.fatPerPortion, 1).toFixed(1)
          : null,
      notes: input.notes?.trim() || null,
      createdByUserId: input.createdByUserId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (await isDbReady()) {
      const [inserted] = await db
        .insert(leftoverBatches)
        .values({
          id,
          recipeId: record.recipeId ? toUuid(record.recipeId) : null,
          title: record.title,
          storageLocation: record.storageLocation,
          totalPortions: record.totalPortions,
          remainingPortions: record.remainingPortions,
          preparedDate: record.preparedDate,
          useByDate: record.useByDate,
          caloriesPerPortion: record.caloriesPerPortion,
          proteinPerPortion: record.proteinPerPortion,
          carbsPerPortion: record.carbsPerPortion,
          fatPerPortion: record.fatPerPortion,
          notes: record.notes,
          createdByUserId: record.createdByUserId ? toUuid(record.createdByUserId) : null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapDbLeftover(inserted);
    }

    getMem().leftoverBatches.push(record);
    return record;
  },

  async adjustLeftoverPortions(id: string, delta: number): Promise<LeftoverBatchRecord | null> {
    if (await isDbReady()) {
      const rows = await db
        .select()
        .from(leftoverBatches)
        .where(eq(leftoverBatches.id, toUuid(id)))
        .limit(1);
      if (!rows[0]) return null;
      const next = Math.max(0, rows[0].remainingPortions + delta);
      const nextTotal = Math.max(rows[0].totalPortions, next);
      const [updated] = await db
        .update(leftoverBatches)
        .set({
          remainingPortions: next,
          totalPortions: nextTotal,
          updatedAt: new Date(),
        })
        .where(eq(leftoverBatches.id, toUuid(id)))
        .returning();
      return updated ? mapDbLeftover(updated) : null;
    }

    const target = getMem().leftoverBatches.find((b) => b.id === id);
    if (!target) return null;
    target.remainingPortions = Math.max(0, target.remainingPortions + delta);
    target.totalPortions = Math.max(target.totalPortions, target.remainingPortions);
    target.updatedAt = new Date().toISOString();
    return target;
  },

  async deleteLeftoverBatch(id: string): Promise<void> {
    if (await isDbReady()) {
      await db.delete(leftoverBatches).where(eq(leftoverBatches.id, toUuid(id)));
      return;
    }
    const mem = getMem();
    mem.leftoverBatches = mem.leftoverBatches.filter((b) => b.id !== id);
  },

  // ======================== EXPORT, IMPORT & RESET ========================
  async exportHouseholdData(): Promise<Omit<CoreMenuBackupPayload, "schemaVersion" | "exportedAt">> {
    const [
      settings,
      allRecipes,
      allEntries,
      templates,
      lists,
      allPantry,
      leftovers,
      staples,
    ] = await Promise.all([
      this.getHouseholdSettings(),
      this.listRecipes(),
      this.listMealPlanEntries(),
      this.listMealPlanTemplates(),
      this.listGroceryLists(),
      this.listPantryItems(),
      this.listLeftoverBatches(),
      this.listQuickStaples(),
    ]);

    let allCookLogs: CookLogRecord[] = [];
    let allGroceryItems: GroceryItemRecord[] = [];

    if (await isDbReady()) {
      const logRows = await db.select().from(cookLogs);
      allCookLogs = logRows.map((r) => ({
        id: r.id,
        recipeId: r.recipeId,
        userId: r.userId,
        cookedAt: isoString(r.cookedAt),
        servingsMade: r.servingsMade,
        rating: r.rating,
        notes: r.notes,
      }));
      const itemRows = await db.select().from(groceryItems);
      allGroceryItems = itemRows.map(mapDbGroceryItem);
    } else {
      const mem = getMem();
      allCookLogs = [...mem.cookLogs];
      allGroceryItems = [...mem.groceryItems];
    }

    return {
      householdSettings: settings,
      recipes: allRecipes,
      cookLogs: allCookLogs,
      mealPlanEntries: allEntries,
      mealPlanTemplates: templates,
      groceryLists: lists,
      groceryItems: allGroceryItems,
      quickStaples: staples,
      pantryItems: allPantry,
      leftoverBatches: leftovers,
    };
  },

  async importHouseholdBackup(
    payload: CoreMenuBackupPayload,
    actorUserId: string
  ): Promise<void> {
    if (await isDbReady()) {
      await applyPayloadToDb(payload, actorUserId);
      return;
    }
    applyPayloadToMem(payload);
  },

  async resetHousehold(seedMode: "clean" | "demo", actorUserId: string): Promise<void> {
    const payload =
      seedMode === "demo"
        ? createDemoHouseholdPayload(actorUserId)
        : {
            householdSettings: defaultHouseholdSettings(),
            recipes: [],
            cookLogs: [],
            mealPlanEntries: [],
            mealPlanTemplates: [],
            groceryLists: [],
            groceryItems: [],
            quickStaples: [],
            pantryItems: [],
            leftoverBatches: [],
          };

    if (await isDbReady()) {
      await applyPayloadToDb(payload, actorUserId);
      return;
    }
    applyPayloadToMem(payload);
  },
};

export { getWeekStartMonday };
