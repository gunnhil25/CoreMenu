export const AISLE_CATEGORIES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry & Dry Goods",
  "Frozen",
  "Spices & Condiments",
  "Beverages",
  "Household & Other",
] as const;

export type AisleCategory = (typeof AISLE_CATEGORIES)[number];

export const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "prep",
  "dessert",
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_SLOTS = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "prep",
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

export const PANTRY_LOCATIONS = [
  "pantry",
  "fridge",
  "freezer",
  "spices",
] as const;

export type PantryLocation = (typeof PANTRY_LOCATIONS)[number];

export const DEFAULT_STORES = [
  "Woolworths",
  "Coles",
  "Aldi",
  "Butcher",
  "Asian Grocer",
] as const;

export type UnitSystem = "metric" | "imperial";
export type DifficultyLevel = "easy" | "medium" | "hard";
export type PantryMatchFlag = "none" | "partial" | "stocked";
export type PantryGenerationMode = "flag" | "subtract" | "skip_staples" | "ignore";

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  prepNote?: string;
  aisle: AisleCategory;
  store?: string;
  estimatedCost?: number | null;
  isStaple?: boolean;
}

export interface RecipeStep {
  id: string;
  section?: string;
  instruction: string;
  timerMinutes?: number | null;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "user";
  isActive: boolean;
  sessionVersion: number;
  preferredUnits: UnitSystem;
  currency: string;
  dailyCalorieGoal: number;
  dailyProteinGoal: number;
  dailyCarbsGoal: number;
  dailyFatGoal: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SafeUser = Omit<UserRecord, "passwordHash">;

export interface HouseholdSettingsRecord {
  id: string;
  householdName: string;
  currency: string;
  weeklyGroceryBudget: string;
  defaultStores: string[];
  updatedAt: string;
}

export interface RecipeRecord {
  id: string;
  createdByUserId: string | null;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  mealType: MealType;
  cuisine: string | null;
  difficulty: DifficultyLevel;
  prepTimeMin: number;
  cookTimeMin: number;
  servings: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  caloriesPerServing: number | null;
  proteinPerServing: string | null;
  carbsPerServing: string | null;
  fatPerServing: string | null;
  estimatedCostPerServing: string | null;
  rating: number;
  isFavorite: boolean;
  cookCount: number;
  lastCookedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CookLogRecord {
  id: string;
  recipeId: string;
  userId: string | null;
  cookedAt: string;
  servingsMade: number;
  rating: number | null;
  notes: string | null;
}

export interface MealPlanEntryRecord {
  id: string;
  planDate: string;
  mealSlot: MealSlot;
  recipeId: string | null;
  leftoverId: string | null;
  customTitle: string | null;
  servings: number;
  isBatchPrep: boolean;
  isLeftover: boolean;
  isCompleted: boolean;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface MealTemplateSlot {
  dayOffset: number; // 0 = Monday .. 6 = Sunday
  mealSlot: MealSlot;
  recipeId: string | null;
  customTitle: string | null;
  servings: number;
  isBatchPrep: boolean;
  notes?: string | null;
}

export interface MealPlanTemplateRecord {
  id: string;
  name: string;
  description: string | null;
  slots: MealTemplateSlot[];
  createdByUserId: string | null;
  createdAt: string;
}

export interface GroceryListRecord {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: "active" | "completed" | "archived";
  estimatedTotal: string;
  actualTotal: string | null;
  completedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroceryItemRecord {
  id: string;
  listId: string;
  name: string;
  normalizedName: string;
  quantity: string | null;
  unit: string;
  aisle: AisleCategory;
  store: string | null;
  isChecked: boolean;
  inPantryFlag: PantryMatchFlag;
  pantryNote: string | null;
  isManual: boolean;
  estimatedCost: string | null;
  sourceRecipes: string[];
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface QuickStapleRecord {
  id: string;
  name: string;
  defaultQuantity: string;
  defaultUnit: string;
  aisle: AisleCategory;
  store: string | null;
  estimatedCost: string | null;
  createdAt: string;
}

export interface PantryItemRecord {
  id: string;
  name: string;
  normalizedName: string;
  quantity: string;
  unit: string;
  location: PantryLocation;
  aisle: AisleCategory;
  isAlwaysStocked: boolean;
  expiresAt: string | null;
  lowStockThreshold: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeftoverBatchRecord {
  id: string;
  recipeId: string | null;
  title: string;
  storageLocation: "fridge" | "freezer";
  totalPortions: number;
  remainingPortions: number;
  preparedDate: string;
  useByDate: string | null;
  caloriesPerPortion: number | null;
  proteinPerPortion: string | null;
  carbsPerPortion: string | null;
  fatPerPortion: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatCanICookMatch {
  recipe: RecipeRecord;
  matchPct: number;
  matchedCount: number;
  totalIngredients: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}
