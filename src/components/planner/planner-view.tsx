"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Bookmark,
  Trash2,
  Check,
  ChefHat,
  Layers,
  Refrigerator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addMealPlanEntryAction,
  applyWeekTemplateAction,
  deleteMealPlanEntryAction,
  deleteWeekTemplateAction,
  getWeekPlanAction,
  saveWeekTemplateAction,
  toggleMealEntryCompletedAction,
} from "@/actions/planner";
import { generateGroceryListFromPlanAction } from "@/actions/grocery";
import {
  addDaysIso,
  formatCurrency,
  getWeekDates,
  getWeekStartMonday,
  parseIsoDate,
} from "@/lib/utils";
import {
  MEAL_SLOTS,
  type LeftoverBatchRecord,
  type MealPlanEntryRecord,
  type MealPlanTemplateRecord,
  type MealSlot,
  type PantryGenerationMode,
  type RecipeRecord,
  type SafeUser,
} from "@/lib/types";

interface PlannerViewProps {
  initialWeekStart: string;
  initialEntries: MealPlanEntryRecord[];
  initialTemplates: MealPlanTemplateRecord[];
  recipes: RecipeRecord[];
  leftovers: LeftoverBatchRecord[];
  user: SafeUser;
  currency: string;
}

export function PlannerView({
  initialWeekStart,
  initialEntries,
  initialTemplates,
  recipes,
  leftovers,
  user,
  currency,
}: PlannerViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [entries, setEntries] = useState<MealPlanEntryRecord[]>(initialEntries);
  const [templates, setTemplates] = useState<MealPlanTemplateRecord[]>(initialTemplates);

  // Add Meal Slot modal
  const [addOpen, setAddOpen] = useState(false);
  const [slotDate, setSlotDate] = useState(initialWeekStart);
  const [slotType, setSlotType] = useState<MealSlot>("dinner");
  const [entryMode, setEntryMode] = useState<"recipe" | "leftover" | "custom">("recipe");
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? "");
  const [selectedLeftoverId, setSelectedLeftoverId] = useState(
    leftovers.find((l) => l.remainingPortions > 0)?.id ?? ""
  );
  const [customTitle, setCustomTitle] = useState("");
  const [slotServings, setSlotServings] = useState("2");
  const [isBatchPrep, setIsBatchPrep] = useState(false);
  const [slotNotes, setSlotNotes] = useState("");

  // Templates modal
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplDesc, setNewTplDesc] = useState("");
  const [replaceWeekOnApply, setReplaceWeekOnApply] = useState(true);

  // Generate Grocery modal
  const [genOpen, setGenOpen] = useState(false);
  const [genName, setGenName] = useState(`Weekly Shop (${initialWeekStart})`);
  const [genStart, setGenStart] = useState(initialWeekStart);
  const [genEnd, setGenEnd] = useState(addDaysIso(initialWeekStart, 6));
  const [pantryMode, setPantryMode] = useState<PantryGenerationMode>("flag");
  const [includeLeftovers, setIncludeLeftovers] = useState(false);
  const [includeStaples, setIncludeStaples] = useState(true);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const recipesById = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes]
  );
  const leftoversById = useMemo(
    () => new Map(leftovers.map((l) => [l.id, l])),
    [leftovers]
  );

  const loadWeek = (nextStart: string) => {
    setWeekStart(nextStart);
    setGenStart(nextStart);
    setGenEnd(addDaysIso(nextStart, 6));
    setGenName(`Weekly Shop (${nextStart})`);
    startTransition(async () => {
      const res = await getWeekPlanAction(nextStart);
      setEntries(res.entries);
      setTemplates(res.templates);
    });
  };

  const openAddForDay = (dateIso: string, defaultSlot: MealSlot = "dinner") => {
    setSlotDate(dateIso);
    setSlotType(defaultSlot);
    setEntryMode("recipe");
    setSelectedRecipeId(recipes[0]?.id ?? "");
    setSlotServings(String(recipes[0]?.servings ?? 2));
    setIsBatchPrep(defaultSlot === "prep");
    setCustomTitle("");
    setSlotNotes("");
    setAddOpen(true);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const leftoverObj =
        entryMode === "leftover" ? leftoversById.get(selectedLeftoverId) : null;
      const res = await addMealPlanEntryAction({
        planDate: slotDate,
        mealSlot: slotType,
        recipeId:
          entryMode === "recipe"
            ? selectedRecipeId
            : leftoverObj?.recipeId ?? null,
        leftoverId: entryMode === "leftover" ? selectedLeftoverId : null,
        customTitle:
          entryMode === "custom"
            ? customTitle
            : entryMode === "leftover"
            ? leftoverObj?.title ?? "Leftovers"
            : null,
        servings: Math.max(1, parseInt(slotServings, 10) || 2),
        isBatchPrep: entryMode === "recipe" && isBatchPrep,
        isLeftover: entryMode === "leftover",
        notes: slotNotes || null,
      });
      if (res.success && res.entry) {
        setEntries((prev) => [...prev, res.entry!]);
        setAddOpen(false);
      }
    });
  };

  const handleToggleDone = (id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isCompleted: !e.isCompleted } : e))
    );
    startTransition(async () => {
      await toggleMealEntryCompletedAction(id);
    });
  };

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      await deleteMealPlanEntryAction(id);
    });
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveWeekTemplateAction({
        name: newTplName,
        description: newTplDesc || null,
        weekStartDate: weekStart,
      });
      if (res.success && res.template) {
        setTemplates((prev) => [res.template!, ...prev]);
        setNewTplName("");
        setNewTplDesc("");
      }
    });
  };

  const handleApplyTemplate = (templateId: string) => {
    startTransition(async () => {
      const res = await applyWeekTemplateAction({
        templateId,
        weekStartDate: weekStart,
        replaceWeek: replaceWeekOnApply,
      });
      if (res.success) {
        const refreshed = await getWeekPlanAction(weekStart);
        setEntries(refreshed.entries);
        setTemplatesOpen(false);
      }
    });
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await deleteWeekTemplateAction(id);
    });
  };

  const handleGenerateGrocery = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await generateGroceryListFromPlanAction({
        name: genName,
        startDate: genStart,
        endDate: genEnd,
        pantryMode,
        includeLeftoverSlots: includeLeftovers,
        includeQuickStaples: includeStaples,
      });
      if (res.success && res.list) {
        setGenOpen(false);
        router.push(`/grocery?listId=${res.list.id}`);
        router.refresh();
      }
    });
  };

  const weeklyCostTotal = entries.reduce((sum, entry) => {
    if (entry.isLeftover || !entry.recipeId) return sum;
    const r = recipesById.get(entry.recipeId);
    if (!r || !r.estimatedCostPerServing) return sum;
    return sum + parseFloat(r.estimatedCostPerServing) * entry.servings;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Meal Prep Planner
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Schedule weekly recipes, batch prep cooks, and leftovers — then generate an aisle-grouped grocery run.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
            <Bookmark className="h-3.5 w-3.5 mr-1.5" />
            Templates ({templates.length})
          </Button>
          <Button size="sm" onClick={() => setGenOpen(true)}>
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Generate Grocery List
          </Button>
        </div>
      </div>

      {/* Week Navigation & Summary Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous week"
              onClick={() => loadWeek(addDaysIso(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadWeek(getWeekStartMonday())}
            >
              This Week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next week"
              onClick={() => loadWeek(addDaysIso(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="font-mono text-xs sm:text-sm font-semibold ml-2">
              {weekStart} → {addDaysIso(weekStart, 6)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge variant="outline" className="font-mono">
              {entries.length} meals scheduled
            </Badge>
            <Badge variant="info" className="font-mono">
              Est. Ingredients: {formatCurrency(weeklyCostTotal, currency)}
            </Badge>
            <Badge variant="success" className="font-mono">
              Goal: {user.dailyCalorieGoal} kcal / {user.dailyProteinGoal}g P
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
        {weekDates.map((dateIso) => {
          const dt = parseIsoDate(dateIso);
          const dayLabel = new Intl.DateTimeFormat("en-AU", {
            weekday: "short",
            day: "numeric",
            month: "short",
          }).format(dt);
          const dayEntries = entries.filter((e) => e.planDate === dateIso);

          const dayMacros = dayEntries.reduce(
            (acc, entry) => {
              if (entry.isBatchPrep) return acc;
              const r = entry.recipeId ? recipesById.get(entry.recipeId) : null;
              const l = entry.leftoverId ? leftoversById.get(entry.leftoverId) : null;
              const kcal = r?.caloriesPerServing ?? l?.caloriesPerPortion ?? 0;
              const p = r?.proteinPerServing
                ? parseFloat(r.proteinPerServing)
                : l?.proteinPerPortion
                ? parseFloat(l.proteinPerPortion)
                : 0;
              return { kcal: acc.kcal + kcal, p: acc.p + p };
            },
            { kcal: 0, p: 0 }
          );

          return (
            <Card key={dateIso} className="flex flex-col">
              <CardHeader className="p-3.5 pb-2 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider">
                    {dayLabel}
                  </CardTitle>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Add meal for ${dateIso}`}
                    onClick={() => openAddForDay(dateIso)}
                    className="h-6 w-6"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {dayMacros.kcal > 0
                    ? `${dayMacros.kcal} kcal • ${Math.round(dayMacros.p)}g P`
                    : "No macros logged"}
                </p>
              </CardHeader>

              <CardContent className="p-2.5 flex-1 space-y-2">
                {dayEntries.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openAddForDay(dateIso)}
                    className="w-full py-6 rounded-lg border border-dashed text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    + Add meal
                  </button>
                ) : (
                  dayEntries.map((entry) => {
                    const recipe = entry.recipeId ? recipesById.get(entry.recipeId) : null;
                    const title = recipe?.title || entry.customTitle || "Meal";
                    return (
                      <div
                        key={entry.id}
                        className={`p-2 rounded-lg border text-xs space-y-1.5 transition-colors ${
                          entry.isCompleted
                            ? "bg-muted/40 opacity-65"
                            : "bg-background/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <Badge
                            variant={entry.isBatchPrep ? "success" : entry.isLeftover ? "info" : "outline"}
                            className="text-[9px] uppercase px-1.5 py-0"
                          >
                            {entry.mealSlot}
                          </Badge>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              aria-label="Toggle meal completed"
                              onClick={() => handleToggleDone(entry.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-emerald-500"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              aria-label="Remove meal slot"
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <p
                          className={`font-semibold leading-tight ${
                            entry.isCompleted ? "line-through" : ""
                          }`}
                        >
                          {recipe ? (
                            <Link
                              href={`/recipes/${recipe.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {title}
                            </Link>
                          ) : (
                            title
                          )}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{entry.servings} srv</span>
                          {recipe && (
                            <Link
                              href={`/recipes/${recipe.id}/cook`}
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              <ChefHat className="h-2.5 w-2.5" />
                              Cook
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Meal Slot Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Meal ({slotDate})</DialogTitle>
            <DialogDescription>
              Pick a recipe, a prepped container from your leftover stash, or enter a custom meal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddEntry} className="space-y-4">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-muted">
              <button
                type="button"
                onClick={() => setEntryMode("recipe")}
                className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 ${
                  entryMode === "recipe" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" /> Recipe
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("leftover")}
                className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1 ${
                  entryMode === "leftover" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Refrigerator className="h-3.5 w-3.5" /> Leftover
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("custom")}
                className={`py-1.5 rounded-md text-xs font-semibold ${
                  entryMode === "custom" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                Custom
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="slot-type-select">Meal Slot</Label>
                <select
                  id="slot-type-select"
                  value={slotType}
                  onChange={(e) => setSlotType(e.target.value as MealSlot)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slot-servings">Servings</Label>
                <Input
                  id="slot-servings"
                  type="number"
                  min="1"
                  value={slotServings}
                  onChange={(e) => setSlotServings(e.target.value)}
                />
              </div>
            </div>

            {entryMode === "recipe" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="slot-recipe-select">Recipe</Label>
                  <select
                    id="slot-recipe-select"
                    value={selectedRecipeId}
                    onChange={(e) => {
                      const rid = e.target.value;
                      setSelectedRecipeId(rid);
                      const found = recipesById.get(rid);
                      if (found) setSlotServings(String(found.servings));
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.servings} srv)
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBatchPrep}
                    onChange={(e) => setIsBatchPrep(e.target.checked)}
                  />
                  Batch Prep Session (shop ingredients without adding to today&apos;s macro total)
                </label>
              </div>
            )}

            {entryMode === "leftover" && (
              <div className="space-y-1.5">
                <Label htmlFor="slot-leftover-select">Prepped Stash Batch</Label>
                {leftovers.filter((l) => l.remainingPortions > 0).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No active leftover portions in your fridge/freezer stash.
                  </p>
                ) : (
                  <select
                    id="slot-leftover-select"
                    value={selectedLeftoverId}
                    onChange={(e) => setSelectedLeftoverId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    {leftovers
                      .filter((l) => l.remainingPortions > 0)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title} ({l.remainingPortions} left in {l.storageLocation})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {entryMode === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="slot-custom-title">Custom Meal Name</Label>
                <Input
                  id="slot-custom-title"
                  placeholder="Takeaway Thai / Eating Out"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Add to Plan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Weekly Meal Prep Templates</DialogTitle>
            <DialogDescription>
              Save this week&apos;s rotation as a template or apply a favorite week in one click.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTemplate} className="p-3.5 rounded-xl border bg-muted/20 space-y-2.5">
            <Label className="text-[11px]">Save Current Week ({weekStart}) as Template</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="Template name (e.g. Lean Cut Week)"
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                required
              />
              <Input
                placeholder="Optional short notes"
                value={newTplDesc}
                onChange={(e) => setNewTplDesc(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              Save Current Week as Template
            </Button>
          </form>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={replaceWeekOnApply}
                onChange={(e) => setReplaceWeekOnApply(e.target.checked)}
              />
              Replace existing meals in {weekStart} when applying a template
            </label>

            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No templates saved yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-3 rounded-xl border flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tpl.slots.length} meal slots
                        {tpl.description ? ` • ${tpl.description}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleApplyTemplate(tpl.id)}
                        disabled={isPending}
                      >
                        Apply
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Grocery List Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Generate Smart Grocery List
            </DialogTitle>
            <DialogDescription>
              Merges duplicate ingredients across planned meals, groups by aisle, and checks your pantry stock.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateGrocery} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gen-list-name">Grocery List Name</Label>
              <Input
                id="gen-list-name"
                value={genName}
                onChange={(e) => setGenName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gen-start">From Date</Label>
                <Input
                  id="gen-start"
                  type="date"
                  value={genStart}
                  onChange={(e) => setGenStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gen-end">To Date</Label>
                <Input
                  id="gen-end"
                  type="date"
                  value={genEnd}
                  onChange={(e) => setGenEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gen-pantry-mode">Pantry Reconciliation Mode</Label>
              <select
                id="gen-pantry-mode"
                value={pantryMode}
                onChange={(e) => setPantryMode(e.target.value as PantryGenerationMode)}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="flag">Flag pantry/staple items (keep on list with badge)</option>
                <option value="subtract">Subtract pantry quantities (keep always-stocked flagged)</option>
                <option value="skip_staples">Auto-skip always-stocked staples & stocked pantry items</option>
                <option value="ignore">Ignore pantry (list all recipe ingredients)</option>
              </select>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStaples}
                  onChange={(e) => setIncludeStaples(e.target.checked)}
                />
                Include household Quick Staples (milk, eggs, coffee, etc.)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLeftovers}
                  onChange={(e) => setIncludeLeftovers(e.target.checked)}
                />
                Include leftover meal slots (normally already prepped)
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setGenOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Generating..." : "Generate Grocery List"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
