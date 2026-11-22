import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import type {
  AisleCategory,
  DifficultyLevel,
  MealSlot,
  MealTemplateSlot,
  MealType,
  PantryLocation,
  PantryMatchFlag,
  RecipeIngredient,
  RecipeStep,
  UnitSystem,
} from "@/lib/types";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).$type<"admin" | "user">().default("user").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sessionVersion: integer("session_version").default(1).notNull(),
  preferredUnits: varchar("preferred_units", { length: 16 })
    .$type<UnitSystem>()
    .default("metric")
    .notNull(),
  currency: varchar("currency", { length: 3 }).default("AUD").notNull(),
  dailyCalorieGoal: integer("daily_calorie_goal").default(2200).notNull(),
  dailyProteinGoal: integer("daily_protein_goal").default(150).notNull(),
  dailyCarbsGoal: integer("daily_carbs_goal").default(220).notNull(),
  dailyFatGoal: integer("daily_fat_goal").default(70).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const householdSettings = pgTable("household_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdName: varchar("household_name", { length: 150 })
    .default("CoreMenu Kitchen")
    .notNull(),
  currency: varchar("currency", { length: 3 }).default("AUD").notNull(),
  weeklyGroceryBudget: numeric("weekly_grocery_budget", { precision: 10, scale: 2 })
    .default("220.00")
    .notNull(),
  defaultStores: jsonb("default_stores")
    .$type<string[]>()
    .default(["Woolworths", "Coles", "Aldi", "Butcher", "Asian Grocer"])
    .notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  mealType: varchar("meal_type", { length: 40 })
    .$type<MealType>()
    .default("dinner")
    .notNull(),
  cuisine: varchar("cuisine", { length: 80 }),
  difficulty: varchar("difficulty", { length: 20 })
    .$type<DifficultyLevel>()
    .default("easy")
    .notNull(),
  prepTimeMin: integer("prep_time_min").default(15).notNull(),
  cookTimeMin: integer("cook_time_min").default(20).notNull(),
  servings: integer("servings").default(4).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  ingredients: jsonb("ingredients").$type<RecipeIngredient[]>().default([]).notNull(),
  steps: jsonb("steps").$type<RecipeStep[]>().default([]).notNull(),
  caloriesPerServing: integer("calories_per_serving"),
  proteinPerServing: numeric("protein_per_serving", { precision: 6, scale: 1 }),
  carbsPerServing: numeric("carbs_per_serving", { precision: 6, scale: 1 }),
  fatPerServing: numeric("fat_per_serving", { precision: 6, scale: 1 }),
  estimatedCostPerServing: numeric("estimated_cost_per_serving", {
    precision: 8,
    scale: 2,
  }),
  rating: integer("rating").default(0).notNull(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  cookCount: integer("cook_count").default(0).notNull(),
  lastCookedAt: timestamp("last_cooked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leftoverBatches = pgTable("leftover_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  storageLocation: varchar("storage_location", { length: 20 })
    .$type<"fridge" | "freezer">()
    .default("fridge")
    .notNull(),
  totalPortions: integer("total_portions").default(4).notNull(),
  remainingPortions: integer("remaining_portions").default(4).notNull(),
  preparedDate: varchar("prepared_date", { length: 10 }).notNull(),
  useByDate: varchar("use_by_date", { length: 10 }),
  caloriesPerPortion: integer("calories_per_portion"),
  proteinPerPortion: numeric("protein_per_portion", { precision: 6, scale: 1 }),
  carbsPerPortion: numeric("carbs_per_portion", { precision: 6, scale: 1 }),
  fatPerPortion: numeric("fat_per_portion", { precision: 6, scale: 1 }),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cookLogs = pgTable("cook_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipeId: uuid("recipe_id")
    .references(() => recipes.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  cookedAt: timestamp("cooked_at").defaultNow().notNull(),
  servingsMade: integer("servings_made").default(4).notNull(),
  rating: integer("rating"),
  notes: text("notes"),
});

export const mealPlanEntries = pgTable("meal_plan_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  planDate: varchar("plan_date", { length: 10 }).notNull(),
  mealSlot: varchar("meal_slot", { length: 20 })
    .$type<MealSlot>()
    .default("dinner")
    .notNull(),
  recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  leftoverId: uuid("leftover_id").references(() => leftoverBatches.id, {
    onDelete: "set null",
  }),
  customTitle: varchar("custom_title", { length: 200 }),
  servings: integer("servings").default(2).notNull(),
  isBatchPrep: boolean("is_batch_prep").default(false).notNull(),
  isLeftover: boolean("is_leftover").default(false).notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealPlanTemplates = pgTable("meal_plan_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  slots: jsonb("slots").$type<MealTemplateSlot[]>().default([]).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groceryLists = pgTable("grocery_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  startDate: varchar("start_date", { length: 10 }),
  endDate: varchar("end_date", { length: 10 }),
  status: varchar("status", { length: 20 })
    .$type<"active" | "completed" | "archived">()
    .default("active")
    .notNull(),
  estimatedTotal: numeric("estimated_total", { precision: 10, scale: 2 })
    .default("0.00")
    .notNull(),
  actualTotal: numeric("actual_total", { precision: 10, scale: 2 }),
  completedAt: timestamp("completed_at"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groceryItems = pgTable("grocery_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  listId: uuid("list_id")
    .references(() => groceryLists.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 40 }).default("").notNull(),
  aisle: varchar("aisle", { length: 60 })
    .$type<AisleCategory>()
    .default("Pantry & Dry Goods")
    .notNull(),
  store: varchar("store", { length: 80 }),
  isChecked: boolean("is_checked").default(false).notNull(),
  inPantryFlag: varchar("in_pantry_flag", { length: 20 })
    .$type<PantryMatchFlag>()
    .default("none")
    .notNull(),
  pantryNote: varchar("pantry_note", { length: 180 }),
  isManual: boolean("is_manual").default(false).notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 8, scale: 2 }),
  sourceRecipes: jsonb("source_recipes").$type<string[]>().default([]).notNull(),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quickStaples = pgTable("quick_staples", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  defaultQuantity: numeric("default_quantity", { precision: 10, scale: 2 })
    .default("1.00")
    .notNull(),
  defaultUnit: varchar("default_unit", { length: 40 }).default("unit").notNull(),
  aisle: varchar("aisle", { length: 60 })
    .$type<AisleCategory>()
    .default("Pantry & Dry Goods")
    .notNull(),
  store: varchar("store", { length: 80 }),
  estimatedCost: numeric("estimated_cost", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pantryItems = pgTable("pantry_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1.00").notNull(),
  unit: varchar("unit", { length: 40 }).default("unit").notNull(),
  location: varchar("location", { length: 20 })
    .$type<PantryLocation>()
    .default("pantry")
    .notNull(),
  aisle: varchar("aisle", { length: 60 })
    .$type<AisleCategory>()
    .default("Pantry & Dry Goods")
    .notNull(),
  isAlwaysStocked: boolean("is_always_stocked").default(false).notNull(),
  expiresAt: varchar("expires_at", { length: 10 }),
  lowStockThreshold: numeric("low_stock_threshold", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
