"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  Clock,
  Users,
  Star,
  Heart,
  Copy,
  Edit,
  Trash2,
  CalendarPlus,
  CheckCircle2,
  Download,
  Scale,
  ArrowLeft,
  UtensilsCrossed,
  ExternalLink,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteRecipeAction,
  duplicateRecipeAction,
  logRecipeCookedAction,
  toggleFavoriteRecipeAction,
  updateRecipeAction,
} from "@/actions/recipes";
import { addMealPlanEntryAction } from "@/actions/planner";
import {
  convertIngredientUnit,
  convertInstructionTemperatures,
  formatQuantity,
  scaleQuantity,
} from "@/lib/units";
import { formatCurrency, formatDate, formatDuration, generateId, toIsoDate } from "@/lib/utils";
import {
  MEAL_SLOTS,
  type CookLogRecord,
  type MealSlot,
  type RecipeRecord,
  type UnitSystem,
} from "@/lib/types";

interface RecipeDetailViewProps {
  initialRecipe: RecipeRecord;
  initialCookLogs: CookLogRecord[];
  defaultUnitSystem: UnitSystem;
  currency: string;
}

export function RecipeDetailView({
  initialRecipe,
  initialCookLogs,
  defaultUnitSystem,
  currency,
}: RecipeDetailViewProps) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeRecord>(initialRecipe);
  const [cookLogs, setCookLogs] = useState<CookLogRecord[]>(initialCookLogs);
  const [isPending, startTransition] = useTransition();

  const [targetServings, setTargetServings] = useState<number>(initialRecipe.servings);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(defaultUnitSystem);
  const [checkedIngIds, setCheckedIngIds] = useState<Set<string>>(new Set());

  // Add to Meal Plan modal
  const [planOpen, setPlanOpen] = useState(false);
  const [planDate, setPlanDate] = useState(toIsoDate(new Date()));
  const [planSlot, setPlanSlot] = useState<MealSlot>(
    initialRecipe.mealType === "breakfast" ||
      initialRecipe.mealType === "lunch" ||
      initialRecipe.mealType === "dinner" ||
      initialRecipe.mealType === "snack" ||
      initialRecipe.mealType === "prep"
      ? initialRecipe.mealType
      : "dinner"
  );
  const [planServings, setPlanServings] = useState(String(initialRecipe.servings));
  const [planBatchPrep, setPlanBatchPrep] = useState(
    initialRecipe.mealType === "prep"
  );
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  // Log Cooked modal
  const [cookLogOpen, setCookLogOpen] = useState(false);
  const [cookedServings, setCookedServings] = useState(String(initialRecipe.servings));
  const [cookRating, setCookRating] = useState<number>(initialRecipe.rating || 5);
  const [cookNotes, setCookNotes] = useState("");
  const [saveToStash, setSaveToStash] = useState(false);
  const [stashPortions, setStashPortions] = useState("4");
  const [stashLocation, setStashLocation] = useState<"fridge" | "freezer">("fridge");
  const [stashDays, setStashDays] = useState("4");

  const scaleFactor =
    recipe.servings > 0 ? targetServings / recipe.servings : 1;

  const toggleIngredientCheck = (id: string) => {
    setCheckedIngIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleFav = () => {
    setRecipe((r) => ({ ...r, isFavorite: !r.isFavorite }));
    startTransition(async () => {
      const res = await toggleFavoriteRecipeAction(recipe.id);
      if (res.success && res.recipe) setRecipe(res.recipe);
    });
  };

  const handleSetRating = (stars: number) => {
    setRecipe((r) => ({ ...r, rating: stars }));
    startTransition(async () => {
      const res = await updateRecipeAction(recipe.id, { rating: stars });
      if (res.success && res.recipe) setRecipe(res.recipe);
    });
  };

  const handleDuplicate = () => {
    startTransition(async () => {
      const res = await duplicateRecipeAction(recipe.id);
      if (res.success && res.recipe) {
        router.push(`/recipes/${res.recipe.id}`);
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteRecipeAction(recipe.id);
      if (res.success) {
        router.push("/recipes");
        router.refresh();
      }
    });
  };

  const handleAddToPlanner = (e: React.FormEvent) => {
    e.preventDefault();
    setPlanMessage(null);
    startTransition(async () => {
      const res = await addMealPlanEntryAction({
        planDate,
        mealSlot: planSlot,
        recipeId: recipe.id,
        servings: Math.max(1, parseInt(planServings, 10) || recipe.servings),
        isBatchPrep: planBatchPrep,
      });
      if (res.success) {
        setPlanMessage("Scheduled onto Meal Planner!");
        setTimeout(() => {
          setPlanOpen(false);
          setPlanMessage(null);
        }, 800);
      }
    });
  };

  const handleLogCooked = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await logRecipeCookedAction({
        recipeId: recipe.id,
        servingsMade: Math.max(1, parseInt(cookedServings, 10) || recipe.servings),
        rating: cookRating,
        notes: cookNotes || null,
        saveLeftovers: saveToStash
          ? {
              portions: Math.max(1, parseInt(stashPortions, 10) || 2),
              storageLocation: stashLocation,
              useByDays: Math.max(1, parseInt(stashDays, 10) || 4),
            }
          : null,
      });
      if (res.success && res.recipe) {
        setRecipe(res.recipe);
        setCookLogs((prev) => [
          {
            id: generateId(),
            recipeId: recipe.id,
            userId: null,
            cookedAt: new Date().toISOString(),
            servingsMade: Math.max(1, parseInt(cookedServings, 10) || recipe.servings),
            rating: cookRating,
            notes: cookNotes || null,
          },
          ...prev,
        ]);
        setCookLogOpen(false);
        router.refresh();
      }
    });
  };

  const totalCostScaled =
    recipe.estimatedCostPerServing !== null
      ? parseFloat(recipe.estimatedCostPerServing) * targetServings
      : null;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/recipes">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Recipe Book
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link href={`/recipes/${recipe.id}/cook?servings=${targetServings}&units=${unitSystem}`}>
              <ChefHat className="h-4 w-4 mr-1.5" />
              Start Cook Mode
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
            Add to Plan
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCookLogOpen(true)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Log Cooked
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/recipes/${recipe.id}/edit`}>
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/export/markdown?recipeId=${recipe.id}`}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              .md
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDuplicate}
            disabled={isPending}
            title="Duplicate recipe"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isPending}
            title="Delete recipe"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4 min-h-[200px] bg-gradient-to-br from-[#6d5dfc]/20 via-muted/40 to-[#27c6a5]/20 flex items-center justify-center relative">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover max-h-[300px]"
              />
            ) : (
              <UtensilsCrossed className="h-14 w-14 text-muted-foreground/40" />
            )}
          </div>

          <div className="lg:col-span-8 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info" className="uppercase text-[10px]">
                    {recipe.mealType}
                  </Badge>
                  {recipe.cuisine && (
                    <Badge variant="outline" className="text-[10px]">
                      {recipe.cuisine}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {recipe.difficulty}
                  </Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {recipe.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5" aria-label="Recipe rating">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSetRating(s)}
                      aria-label={`Rate ${s} stars`}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          s <= recipe.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleToggleFav}
                  aria-label="Toggle favorite"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      recipe.isFavorite ? "fill-rose-500 text-rose-500" : ""
                    }`}
                  />
                </Button>
              </div>
            </div>

            {recipe.description && (
              <p className="text-sm text-muted-foreground">{recipe.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Prep {formatDuration(recipe.prepTimeMin)} + Cook{" "}
                {formatDuration(recipe.cookTimeMin)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                Base {recipe.servings} servings
              </span>
              <span>
                Cooked {recipe.cookCount}×{" "}
                {recipe.lastCookedAt ? `• Last ${formatDate(recipe.lastCookedAt)}` : ""}
              </span>
              {recipe.sourceUrl && (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recipe.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[11px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Scaling & Unit Controls + Macros / Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-6">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Dynamic Serving Scaler
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Decrease servings"
                  onClick={() => setTargetServings((s) => Math.max(1, s - 1))}
                >
                  -
                </Button>
                <span
                  data-testid="scaled-servings-value"
                  className="font-mono font-bold text-base w-16 text-center"
                >
                  {targetServings} srv
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Increase servings"
                  onClick={() => setTargetServings((s) => s + 1)}
                >
                  +
                </Button>
                {targetServings !== recipe.servings && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setTargetServings(recipe.servings)}
                    className="text-xs"
                  >
                    Reset ({recipe.servings})
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Scale className="h-3 w-3" /> Unit System
              </span>
              <div className="inline-flex rounded-lg border p-1 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setUnitSystem("metric")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    unitSystem === "metric"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Metric (g/ml/°C)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitSystem("imperial")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    unitSystem === "imperial"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Imperial (oz/cup/°F)
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6">
          <CardContent className="p-4 grid grid-cols-5 gap-2 text-center">
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Kcal / srv
              </span>
              <span className="font-bold text-sm">
                {recipe.caloriesPerServing ?? "-"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Protein
              </span>
              <span className="font-bold text-sm text-emerald-500">
                {recipe.proteinPerServing ? `${recipe.proteinPerServing}g` : "-"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Carbs
              </span>
              <span className="font-bold text-sm text-sky-500">
                {recipe.carbsPerServing ? `${recipe.carbsPerServing}g` : "-"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Fat
              </span>
              <span className="font-bold text-sm text-amber-500">
                {recipe.fatPerServing ? `${recipe.fatPerServing}g` : "-"}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <span className="text-[10px] uppercase text-muted-foreground block">
                Batch Cost
              </span>
              <span className="font-bold text-sm font-mono">
                {totalCostScaled !== null
                  ? formatCurrency(totalCostScaled, currency)
                  : "-"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ingredients + Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Ingredients ({targetServings} servings
              {scaleFactor !== 1 ? ` • ${scaleFactor.toFixed(2).replace(/\.00$/, "")}×` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recipe.ingredients.map((ing) => {
              const scaled = scaleQuantity(
                ing.quantity,
                recipe.servings,
                targetServings
              );
              const converted = convertIngredientUnit(scaled, ing.unit, unitSystem);
              const qtyLabel = formatQuantity(converted.quantity);
              const isDone = checkedIngIds.has(ing.id);

              return (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => toggleIngredientCheck(ing.id)}
                  className={`w-full text-left p-2.5 rounded-lg border flex items-start justify-between gap-2 transition-colors ${
                    isDone
                      ? "bg-muted/40 opacity-60 line-through"
                      : "bg-background/50 hover:bg-muted/30"
                  }`}
                >
                  <div className="text-sm">
                    <span className="font-semibold text-primary mr-1.5 font-mono">
                      {[qtyLabel, converted.unit].filter(Boolean).join(" ")}
                    </span>
                    <span>{ing.name}</span>
                    {ing.prepNote && (
                      <span className="text-xs text-muted-foreground">
                        , {ing.prepNote}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {ing.aisle}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preparation Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipe.steps.map((step, idx) => {
              const convertedText = convertInstructionTemperatures(
                step.instruction,
                unitSystem
              );
              return (
                <div
                  key={step.id}
                  className="p-3.5 rounded-xl border bg-muted/15 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {step.section && (
                        <Badge variant="secondary" className="text-[10px]">
                          {step.section}
                        </Badge>
                      )}
                    </div>
                    {step.timerMinutes && (
                      <Badge variant="info" className="text-[10px] font-mono gap-1">
                        <Timer className="h-3 w-3" />
                        {step.timerMinutes}m
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed pl-8">{convertedText}</p>
                </div>
              );
            })}

            {recipe.notes && (
              <div className="p-3.5 rounded-xl border bg-amber-500/5 border-amber-500/20 text-xs">
                <strong className="block mb-1 text-amber-500">Kitchen Notes</strong>
                {recipe.notes}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cook History */}
      {cookLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cook History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cookLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg border bg-muted/20 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold">{formatDate(log.cookedAt)}</span> —{" "}
                  <span>{log.servingsMade} servings made</span>
                  {log.notes && (
                    <span className="text-muted-foreground"> • {log.notes}</span>
                  )}
                </div>
                {log.rating && (
                  <Badge variant="warning" className="font-mono">
                    ★ {log.rating}/5
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add to Meal Plan Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule on Meal Planner</DialogTitle>
            <DialogDescription>
              Add {recipe.title} to your weekly meal plan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddToPlanner} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-date">Date</Label>
                <Input
                  id="plan-date"
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-slot">Meal Slot</Label>
                <select
                  id="plan-slot"
                  value={planSlot}
                  onChange={(e) => setPlanSlot(e.target.value as MealSlot)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="plan-servings">Servings</Label>
                <Input
                  id="plan-servings"
                  type="number"
                  min="1"
                  value={planServings}
                  onChange={(e) => setPlanServings(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planBatchPrep}
                  onChange={(e) => setPlanBatchPrep(e.target.checked)}
                />
                Mark as Batch Prep Cook
              </label>
            </div>

            {planMessage && (
              <p className="text-xs text-emerald-500 font-medium">{planMessage}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding..." : "Add to Planner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log Cooked Dialog */}
      <Dialog open={cookLogOpen} onOpenChange={setCookLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Cook & Optional Leftovers</DialogTitle>
            <DialogDescription>
              Updates &quot;last cooked&quot; history and optionally stores batch portions in your Fridge/Freezer stash.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogCooked} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cook-servings">Servings Made</Label>
                <Input
                  id="cook-servings"
                  type="number"
                  min="1"
                  value={cookedServings}
                  onChange={(e) => setCookedServings(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cook-rating">Rating (1-5)</Label>
                <select
                  id="cook-rating"
                  value={cookRating}
                  onChange={(e) => setCookRating(parseInt(e.target.value, 10))}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} Stars
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cook-notes">Tasting / Tweaks Notes</Label>
              <Textarea
                id="cook-notes"
                rows={2}
                placeholder="Great seasoning, next time add extra chilli..."
                value={cookNotes}
                onChange={(e) => setCookNotes(e.target.value)}
              />
            </div>

            <div className="p-3 rounded-xl border bg-muted/20 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToStash}
                  onChange={(e) => setSaveToStash(e.target.checked)}
                />
                Save prepped containers to Leftover / Freezer Stash
              </label>

              {saveToStash && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Portions</Label>
                    <Input
                      type="number"
                      min="1"
                      value={stashPortions}
                      onChange={(e) => setStashPortions(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Storage</Label>
                    <select
                      value={stashLocation}
                      onChange={(e) =>
                        setStashLocation(e.target.value as "fridge" | "freezer")
                      }
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
                    >
                      <option value="fridge">Fridge</option>
                      <option value="freezer">Freezer</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Use-by (days)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={stashDays}
                      onChange={(e) => setStashDays(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCookLogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Log Cook"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
