"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Flame,
  Clock,
  ChefHat,
  Dices,
  AlertTriangle,
  PackageCheck,
  Sparkles,
  ArrowRight,
  Snowflake,
  Refrigerator,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WeeklyMacroChart, type DailyMacroPoint } from "@/components/dashboard/macro-chart";
import { pickRandomRecipeAction } from "@/actions/recipes";
import { daysUntilIso, formatCurrency, formatDuration } from "@/lib/utils";
import type {
  GroceryListRecord,
  HouseholdSettingsRecord,
  LeftoverBatchRecord,
  MealPlanEntryRecord,
  MealType,
  PantryItemRecord,
  RecipeRecord,
  SafeUser,
} from "@/lib/types";

interface DashboardViewProps {
  user: SafeUser;
  settings: HouseholdSettingsRecord;
  recipes: RecipeRecord[];
  weekEntries: MealPlanEntryRecord[];
  activeGroceryList: GroceryListRecord | null;
  pantryItems: PantryItemRecord[];
  leftoverBatches: LeftoverBatchRecord[];
  todayIso: string;
  weekDates: string[];
}

export function DashboardView({
  user,
  settings,
  recipes,
  weekEntries,
  activeGroceryList,
  pantryItems,
  leftoverBatches,
  todayIso,
  weekDates,
}: DashboardViewProps) {
  const [isPending, startTransition] = useTransition();
  const [pickerMealType, setPickerMealType] = useState<MealType | "all">("dinner");
  const [pickerMaxMins, setPickerMaxMins] = useState<string>("30");
  const [pickerMinProtein, setPickerMinProtein] = useState<string>("");
  const [pickedRecipe, setPickedRecipe] = useState<RecipeRecord | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const favoritesCount = recipes.filter((r) => r.isFavorite).length;
  const completedMeals = weekEntries.filter((e) => e.isCompleted).length;

  const activeLeftovers = leftoverBatches.filter((b) => b.remainingPortions > 0);
  const totalLeftoverPortions = activeLeftovers.reduce(
    (sum, b) => sum + b.remainingPortions,
    0
  );

  const expiringPantry = pantryItems.filter((item) => {
    const d = daysUntilIso(item.expiresAt, todayIso);
    return d !== null && d <= 5;
  });

  const todayEntries = weekEntries.filter((e) => e.planDate === todayIso);

  const computeEntryMacros = (entry: MealPlanEntryRecord) => {
    const recipe = entry.recipeId ? recipesById.get(entry.recipeId) : null;
    const leftover = entry.leftoverId
      ? leftoverBatches.find((b) => b.id === entry.leftoverId)
      : null;

    if (recipe) {
      return {
        kcal: recipe.caloriesPerServing ?? 0,
        p: recipe.proteinPerServing ? parseFloat(recipe.proteinPerServing) : 0,
        c: recipe.carbsPerServing ? parseFloat(recipe.carbsPerServing) : 0,
        f: recipe.fatPerServing ? parseFloat(recipe.fatPerServing) : 0,
        title: recipe.title,
      };
    }
    if (leftover) {
      return {
        kcal: leftover.caloriesPerPortion ?? 0,
        p: leftover.proteinPerPortion ? parseFloat(leftover.proteinPerPortion) : 0,
        c: leftover.carbsPerPortion ? parseFloat(leftover.carbsPerPortion) : 0,
        f: leftover.fatPerPortion ? parseFloat(leftover.fatPerPortion) : 0,
        title: leftover.title,
      };
    }
    return {
      kcal: 0,
      p: 0,
      c: 0,
      f: 0,
      title: entry.customTitle || "Custom Meal",
    };
  };

  const todayTotals = todayEntries.reduce(
    (acc, entry) => {
      if (entry.isBatchPrep) return acc;
      const m = computeEntryMacros(entry);
      return {
        kcal: acc.kcal + m.kcal,
        p: acc.p + m.p,
        c: acc.c + m.c,
        f: acc.f + m.f,
      };
    },
    { kcal: 0, p: 0, c: 0, f: 0 }
  );

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyChartData: DailyMacroPoint[] = weekDates.map((dateStr, idx) => {
    const dayEntries = weekEntries.filter(
      (e) => e.planDate === dateStr && !e.isBatchPrep
    );
    const totals = dayEntries.reduce(
      (acc, entry) => {
        const m = computeEntryMacros(entry);
        return {
          calories: acc.calories + m.kcal,
          protein: Math.round(acc.protein + m.p),
          carbs: Math.round(acc.carbs + m.c),
          fat: Math.round(acc.fat + m.f),
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return {
      day: dayNames[idx] || dateStr.slice(5),
      date: dateStr,
      ...totals,
    };
  });

  const estGrocerySpend = activeGroceryList
    ? parseFloat(activeGroceryList.estimatedTotal) || 0
    : 0;
  const weeklyBudget = parseFloat(settings.weeklyGroceryBudget) || 220;
  const budgetPct = weeklyBudget > 0 ? Math.min(100, Math.round((estGrocerySpend / weeklyBudget) * 100)) : 0;

  const handleSpinPicker = () => {
    setPickerError(null);
    startTransition(async () => {
      const res = await pickRandomRecipeAction({
        mealType: pickerMealType,
        maxTotalMinutes: pickerMaxMins ? parseInt(pickerMaxMins, 10) : null,
        minProteinGrams: pickerMinProtein ? parseInt(pickerMinProtein, 10) : null,
      });
      if (!res.success || !res.recipe) {
        setPickedRecipe(null);
        setPickerError(res.error || "No matching recipes found.");
        return;
      }
      setPickedRecipe(res.recipe);
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Kitchen Cockpit
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {settings.householdName} — Today&apos;s meals, weekly macro pacing, pantry alerts, and grocery budget.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/planner">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Open Planner
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/grocery">
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Active Shop List
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recipe Book
              </p>
              <p className="text-2xl font-extrabold">{recipes.length}</p>
              <p className="text-xs text-muted-foreground">
                {favoritesCount} favorites saved
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Planned This Week
              </p>
              <p className="text-2xl font-extrabold">{weekEntries.length}</p>
              <p className="text-xs text-muted-foreground">
                {completedMeals} cooked / completed
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <CalendarDays className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Est. Grocery Spend
                </p>
                <p className="text-2xl font-extrabold">
                  {formatCurrency(estGrocerySpend, settings.currency)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    estGrocerySpend > weeklyBudget ? "bg-destructive" : "bg-emerald-500"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {budgetPct}% of {formatCurrency(weeklyBudget, settings.currency)} weekly budget
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Prepped Stash
              </p>
              <p className="text-2xl font-extrabold">{totalLeftoverPortions} portions</p>
              <p className="text-xs text-muted-foreground">
                {expiringPantry.length > 0 ? (
                  <span className="text-amber-500 font-medium">
                    {expiringPantry.length} pantry expiring soon
                  </span>
                ) : (
                  `${pantryItems.length} pantry items tracked`
                )}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <PackageCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Today's Menu & Weekly Nutrition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Menu & Daily Macros */}
        <Card className="lg:col-span-5 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                Today&apos;s Menu ({todayIso})
              </CardTitle>
              <Link href="/planner" className="text-xs text-primary hover:underline">
                Edit plan
              </Link>
            </div>
            <CardDescription>
              Jump directly into hands-free Cook Mode or check your daily macro targets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            {todayEntries.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  No meals scheduled for today yet.
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/planner">Schedule Today&apos;s Meals</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayEntries.map((entry) => {
                  const recipe = entry.recipeId ? recipesById.get(entry.recipeId) : null;
                  const m = computeEntryMacros(entry);
                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl border bg-muted/20 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {entry.mealSlot}
                          </Badge>
                          {entry.isLeftover && (
                            <Badge variant="info" className="text-[10px]">
                              Leftover
                            </Badge>
                          )}
                          {entry.isBatchPrep && (
                            <Badge variant="success" className="text-[10px]">
                              Batch Prep
                            </Badge>
                          )}
                        </div>
                        <p className="font-semibold text-sm truncate">
                          {recipe ? (
                            <Link href={`/recipes/${recipe.id}`} className="hover:underline">
                              {m.title}
                            </Link>
                          ) : (
                            m.title
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {entry.servings} serving{entry.servings > 1 ? "s" : ""}
                          {m.kcal > 0 ? ` • ${m.kcal} kcal • ${Math.round(m.p)}g P` : ""}
                        </p>
                      </div>
                      {recipe && (
                        <Button size="sm" variant="secondary" asChild className="shrink-0">
                          <Link href={`/recipes/${recipe.id}/cook`}>
                            <ChefHat className="h-3.5 w-3.5 mr-1" />
                            Cook
                          </Link>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Today's Macro Progress */}
            <div className="pt-3 border-t space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Daily Macro Pacing (per portion)</span>
                <span className="font-mono text-muted-foreground">
                  {Math.round(todayTotals.kcal)} / {user.dailyCalorieGoal} kcal
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-muted/40 border">
                  <span className="text-[10px] text-muted-foreground uppercase block">
                    Protein
                  </span>
                  <span className="font-bold text-emerald-500">
                    {Math.round(todayTotals.p)}g
                  </span>{" "}
                  <span className="text-[10px] text-muted-foreground">
                    / {user.dailyProteinGoal}g
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 border">
                  <span className="text-[10px] text-muted-foreground uppercase block">
                    Carbs
                  </span>
                  <span className="font-bold text-sky-500">
                    {Math.round(todayTotals.c)}g
                  </span>{" "}
                  <span className="text-[10px] text-muted-foreground">
                    / {user.dailyCarbsGoal}g
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 border">
                  <span className="text-[10px] text-muted-foreground uppercase block">
                    Fat
                  </span>
                  <span className="font-bold text-amber-500">
                    {Math.round(todayTotals.f)}g
                  </span>{" "}
                  <span className="text-[10px] text-muted-foreground">
                    / {user.dailyFatGoal}g
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Nutrition Chart */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#27c6a5]" />
              Weekly Nutrition Trajectory
            </CardTitle>
            <CardDescription>
              Planned calories and protein across Monday–Sunday compared with your {user.dailyCalorieGoal} kcal target.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyMacroChart data={weeklyChartData} calorieGoal={user.dailyCalorieGoal} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Random Dinner Picker + Expiring Pantry & Active Leftovers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* What's for Dinner Picker */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Dices className="h-4 w-4 text-primary" />
              What Should I Cook? Picker
            </CardTitle>
            <CardDescription>
              Filter by meal type, cook time, or protein target and spin for an instant suggestion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                aria-label="Picker Meal Type"
                value={pickerMealType}
                onChange={(e) => setPickerMealType(e.target.value as MealType | "all")}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
              >
                <option value="all">Any Meal Type</option>
                <option value="dinner">Dinner</option>
                <option value="lunch">Lunch</option>
                <option value="breakfast">Breakfast</option>
                <option value="prep">Batch Prep</option>
              </select>

              <select
                aria-label="Picker Max Total Time"
                value={pickerMaxMins}
                onChange={(e) => setPickerMaxMins(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
              >
                <option value="">Any Cook Time</option>
                <option value="20">Under 20 mins</option>
                <option value="30">Under 30 mins</option>
                <option value="45">Under 45 mins</option>
              </select>

              <select
                aria-label="Picker Protein Minimum"
                value={pickerMinProtein}
                onChange={(e) => setPickerMinProtein(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
              >
                <option value="">Any Protein</option>
                <option value="30">High Protein (30g+)</option>
                <option value="40">Extra High (40g+)</option>
              </select>
            </div>

            <Button onClick={handleSpinPicker} disabled={isPending} className="w-full gap-2">
              <Dices className="h-4 w-4" />
              {isPending ? "Picking..." : "Pick a Recipe for Me"}
            </Button>

            {pickerError && (
              <p className="text-xs text-amber-500 text-center">{pickerError}</p>
            )}

            {pickedRecipe && (
              <div className="p-4 rounded-xl border bg-primary/5 border-primary/25 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm">{pickedRecipe.title}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(pickedRecipe.prepTimeMin + pickedRecipe.cookTimeMin)}
                      </span>
                      {pickedRecipe.proteinPerServing && (
                        <span>• {pickedRecipe.proteinPerServing}g protein</span>
                      )}
                    </p>
                  </div>
                  <Badge variant="info" className="uppercase text-[10px]">
                    {pickedRecipe.mealType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" asChild>
                    <Link href={`/recipes/${pickedRecipe.id}`}>
                      Open Recipe <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/recipes/${pickedRecipe.id}/cook`}>Start Cook Mode</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Pantry & Active Stash */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Use Soon & Prepped Leftovers
              </CardTitle>
              <Link href="/pantry" className="text-xs text-primary hover:underline">
                Manage Pantry
              </Link>
            </div>
            <CardDescription>
              Ingredients expiring soon plus ready-to-eat fridge and freezer portions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {expiringPantry.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                  Expiring Within 5 Days
                </p>
                <div className="flex flex-wrap gap-2">
                  {expiringPantry.map((item) => {
                    const days = daysUntilIso(item.expiresAt, todayIso);
                    return (
                      <Badge
                        key={item.id}
                        variant={days !== null && days <= 1 ? "destructive" : "warning"}
                        className="text-xs py-1"
                      >
                        {item.name} ({item.quantity} {item.unit}) —{" "}
                        {days !== null && days < 0
                          ? "Expired"
                          : days === 0
                          ? "Today"
                          : `${days}d`}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Active Batch-Cook Stash
              </p>
              {activeLeftovers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No leftover containers currently stored. Log a batch from any recipe or the Pantry page.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeLeftovers.slice(0, 4).map((batch) => (
                    <div
                      key={batch.id}
                      className="p-2.5 rounded-lg border bg-muted/20 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {batch.storageLocation === "freezer" ? (
                          <Snowflake className="h-4 w-4 text-sky-400 shrink-0" />
                        ) : (
                          <Refrigerator className="h-4 w-4 text-emerald-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{batch.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {batch.storageLocation} • use by {batch.useByDate || "N/A"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="success" className="shrink-0 font-mono">
                        {batch.remainingPortions}/{batch.totalPortions} left
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
