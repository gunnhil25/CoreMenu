"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Package,
  Refrigerator,
  Snowflake,
  Sparkles,
  Plus,
  Trash2,
  CalendarPlus,
  ChefHat,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adjustLeftoverPortionsAction,
  adjustPantryQuantityAction,
  createLeftoverBatchAction,
  createPantryItemAction,
  deleteLeftoverBatchAction,
  deletePantryItemAction,
  getPantryWorkspaceAction,
  updatePantryItemAction,
} from "@/actions/pantry";
import { addMealPlanEntryAction } from "@/actions/planner";
import { daysUntilIso, toIsoDate } from "@/lib/utils";
import {
  AISLE_CATEGORIES,
  PANTRY_LOCATIONS,
  type AisleCategory,
  type LeftoverBatchRecord,
  type PantryItemRecord,
  type PantryLocation,
  type RecipeRecord,
  type WhatCanICookMatch,
} from "@/lib/types";

interface PantryViewProps {
  initialPantryItems: PantryItemRecord[];
  initialLeftoverBatches: LeftoverBatchRecord[];
  initialMatches: WhatCanICookMatch[];
  recipes: RecipeRecord[];
  todayIso: string;
}

export function PantryView({
  initialPantryItems,
  initialLeftoverBatches,
  initialMatches,
  recipes,
  todayIso,
}: PantryViewProps) {
  const [isPending, startTransition] = useTransition();
  const [pantryItems, setPantryItems] = useState<PantryItemRecord[]>(initialPantryItems);
  const [leftovers, setLeftovers] = useState<LeftoverBatchRecord[]>(initialLeftoverBatches);
  const [matches, setMatches] = useState<WhatCanICookMatch[]>(initialMatches);

  const [locationFilter, setLocationFilter] = useState<PantryLocation | "all">("all");
  const [search, setSearch] = useState("");

  // New pantry item form
  const [pName, setPName] = useState("");
  const [pQty, setPQty] = useState("1");
  const [pUnit, setPUnit] = useState("unit");
  const [pLoc, setPLoc] = useState<PantryLocation>("pantry");
  const [pAisle, setPAisle] = useState<AisleCategory>("Pantry & Dry Goods");
  const [pExpires, setPExpires] = useState("");
  const [pAlwaysStocked, setPAlwaysStocked] = useState(false);

  // New leftover batch form
  const [bTitle, setBTitle] = useState("");
  const [bRecipeId, setBRecipeId] = useState("");
  const [bStorage, setBStorage] = useState<"fridge" | "freezer">("fridge");
  const [bPortions, setBPortions] = useState("4");
  const [bUseBy, setBUseBy] = useState("");
  const [scheduledToast, setScheduledToast] = useState<string | null>(null);

  const refreshAll = async () => {
    const ws = await getPantryWorkspaceAction();
    setPantryItems(ws.pantryItems);
    setLeftovers(ws.leftoverBatches);
    setMatches(ws.whatCanICook);
  };

  const handleAddPantry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;
    startTransition(async () => {
      const res = await createPantryItemAction({
        name: pName,
        quantity: parseFloat(pQty) || 1,
        unit: pUnit,
        location: pLoc,
        aisle: pAisle,
        expiresAt: pExpires || null,
        isAlwaysStocked: pAlwaysStocked,
      });
      if (res.success) {
        setPName("");
        setPExpires("");
        setPAlwaysStocked(false);
        await refreshAll();
      }
    });
  };

  const handleAdjustPantry = (id: string, delta: number) => {
    startTransition(async () => {
      await adjustPantryQuantityAction(id, delta);
      await refreshAll();
    });
  };

  const handleToggleAlwaysStocked = (item: PantryItemRecord) => {
    startTransition(async () => {
      await updatePantryItemAction(item.id, {
        isAlwaysStocked: !item.isAlwaysStocked,
      });
      await refreshAll();
    });
  };

  const handleDeletePantry = (id: string) => {
    setPantryItems((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      await deletePantryItemAction(id);
      await refreshAll();
    });
  };

  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenRecipe = recipes.find((r) => r.id === bRecipeId);
    const title = bTitle.trim() || chosenRecipe?.title || "";
    if (!title) return;
    startTransition(async () => {
      const res = await createLeftoverBatchAction({
        recipeId: bRecipeId || null,
        title,
        storageLocation: bStorage,
        totalPortions: Math.max(1, parseInt(bPortions, 10) || 4),
        preparedDate: toIsoDate(new Date()),
        useByDate: bUseBy || null,
        caloriesPerPortion: chosenRecipe?.caloriesPerServing ?? null,
        proteinPerPortion: chosenRecipe?.proteinPerServing
          ? parseFloat(chosenRecipe.proteinPerServing)
          : null,
        carbsPerPortion: chosenRecipe?.carbsPerServing
          ? parseFloat(chosenRecipe.carbsPerServing)
          : null,
        fatPerPortion: chosenRecipe?.fatPerServing
          ? parseFloat(chosenRecipe.fatPerServing)
          : null,
      });
      if (res.success) {
        setBTitle("");
        setBRecipeId("");
        setBUseBy("");
        await refreshAll();
      }
    });
  };

  const handleAdjustPortions = (id: string, delta: number) => {
    setLeftovers((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, remainingPortions: Math.max(0, b.remainingPortions + delta) }
          : b
      )
    );
    startTransition(async () => {
      await adjustLeftoverPortionsAction(id, delta);
      await refreshAll();
    });
  };

  const handleDeleteBatch = (id: string) => {
    setLeftovers((prev) => prev.filter((b) => b.id !== id));
    startTransition(async () => {
      await deleteLeftoverBatchAction(id);
    });
  };

  const handleScheduleLeftoverToday = (batch: LeftoverBatchRecord) => {
    startTransition(async () => {
      const res = await addMealPlanEntryAction({
        planDate: todayIso,
        mealSlot: "lunch",
        recipeId: batch.recipeId,
        leftoverId: batch.id,
        customTitle: batch.title,
        servings: 1,
        isLeftover: true,
      });
      if (res.success) {
        setScheduledToast(`Added "${batch.title}" to today's lunch plan!`);
        setTimeout(() => setScheduledToast(null), 2500);
      }
    });
  };

  const filteredPantry = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pantryItems.filter((p) => {
      if (locationFilter !== "all" && p.location !== locationFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pantryItems, locationFilter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Pantry & Leftover Stash
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Track staples & fridge inventory to avoid double-buying, discover what you can cook now, and manage prepped freezer/fridge containers.
        </p>
      </div>

      {scheduledToast && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {scheduledToast}
        </div>
      )}

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="inventory">
            <Package className="h-3.5 w-3.5 mr-1.5" />
            Inventory ({pantryItems.length})
          </TabsTrigger>
          <TabsTrigger value="leftovers">
            <Refrigerator className="h-3.5 w-3.5 mr-1.5" />
            Leftover Stash ({leftovers.filter((l) => l.remainingPortions > 0).length})
          </TabsTrigger>
          <TabsTrigger value="what-can-i-cook">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            What Can I Cook?
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INVENTORY */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Pantry / Fridge Item</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleAddPantry}
                className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end"
              >
                <div className="md:col-span-3 space-y-1">
                  <Label className="text-[10px]">Item Name</Label>
                  <Input
                    placeholder="e.g. Brown rice, Garlic"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-[10px]">Qty</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={pQty}
                    onChange={(e) => setPQty(e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-[10px]">Unit</Label>
                  <Input value={pUnit} onChange={(e) => setPUnit(e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Location</Label>
                  <select
                    value={pLoc}
                    onChange={(e) => setPLoc(e.target.value as PantryLocation)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs capitalize"
                  >
                    {PANTRY_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Aisle</Label>
                  <select
                    value={pAisle}
                    onChange={(e) => setPAisle(e.target.value as AisleCategory)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    {AISLE_CATEGORIES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Expires (optional)</Label>
                  <Input
                    type="date"
                    value={pExpires}
                    onChange={(e) => setPExpires(e.target.value)}
                  />
                </div>
                <div className="md:col-span-1">
                  <Button type="submit" disabled={isPending} className="w-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="md:col-span-12">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pAlwaysStocked}
                      onChange={(e) => setPAlwaysStocked(e.target.checked)}
                    />
                    Mark as Always-Stocked Staple (auto-skipped or flagged in grocery generator)
                  </label>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Filter & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={locationFilter === "all" ? "default" : "outline"}
                onClick={() => setLocationFilter("all")}
              >
                All
              </Button>
              {PANTRY_LOCATIONS.map((loc) => (
                <Button
                  key={loc}
                  type="button"
                  size="sm"
                  variant={locationFilter === loc ? "default" : "outline"}
                  onClick={() => setLocationFilter(loc)}
                  className="capitalize"
                >
                  {loc}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                placeholder="Search pantry..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPantry.map((item) => {
              const expDays = daysUntilIso(item.expiresAt, todayIso);
              return (
                <Card key={item.id}>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {item.location} • {item.aisle}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePantry(item.id)}
                        aria-label={`Delete ${item.name}`}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleAlwaysStocked(item)}
                        className="text-left"
                      >
                        <Badge
                          variant={item.isAlwaysStocked ? "success" : "outline"}
                          className="text-[10px] cursor-pointer"
                        >
                          {item.isAlwaysStocked ? "Always Stocked" : "Standard Stock"}
                        </Badge>
                      </button>
                      {expDays !== null && (
                        <Badge
                          variant={
                            expDays <= 1 ? "destructive" : expDays <= 5 ? "warning" : "outline"
                          }
                          className="text-[10px] gap-1"
                        >
                          {expDays <= 5 && <AlertTriangle className="h-2.5 w-2.5" />}
                          {expDays < 0
                            ? "Expired"
                            : expDays === 0
                            ? "Expires Today"
                            : `Expires in ${expDays}d`}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-mono font-bold text-sm">
                        {item.quantity} {item.unit}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => handleAdjustPantry(item.id, -1)}
                        >
                          -1
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => handleAdjustPantry(item.id, 1)}
                        >
                          +1
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 2: LEFTOVER STASH */}
        <TabsContent value="leftovers" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Log Batch-Cook / Leftover Containers</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleAddBatch}
                className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end"
              >
                <div className="md:col-span-3 space-y-1">
                  <Label className="text-[10px]">Linked Recipe (Optional)</Label>
                  <select
                    value={bRecipeId}
                    onChange={(e) => {
                      const rid = e.target.value;
                      setBRecipeId(rid);
                      const r = recipes.find((x) => x.id === rid);
                      if (r && !bTitle) setBTitle(r.title);
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    <option value="">Custom Batch</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <Label className="text-[10px]">Container Label</Label>
                  <Input
                    placeholder="e.g. Teriyaki Bowls"
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Storage</Label>
                  <select
                    value={bStorage}
                    onChange={(e) =>
                      setBStorage(e.target.value as "fridge" | "freezer")
                    }
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    <option value="fridge">Fridge</option>
                    <option value="freezer">Freezer</option>
                  </select>
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-[10px]">Portions</Label>
                  <Input
                    type="number"
                    min="1"
                    value={bPortions}
                    onChange={(e) => setBPortions(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Use-By Date</Label>
                  <Input
                    type="date"
                    value={bUseBy}
                    onChange={(e) => setBUseBy(e.target.value)}
                  />
                </div>
                <div className="md:col-span-1">
                  <Button type="submit" disabled={isPending} className="w-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leftovers.map((batch) => {
              const pct =
                batch.totalPortions > 0
                  ? Math.round((batch.remainingPortions / batch.totalPortions) * 100)
                  : 0;
              return (
                <Card
                  key={batch.id}
                  className={batch.remainingPortions === 0 ? "opacity-60" : ""}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {batch.storageLocation === "freezer" ? (
                          <Snowflake className="h-4 w-4 text-sky-400 shrink-0" />
                        ) : (
                          <Refrigerator className="h-4 w-4 text-emerald-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm truncate">{batch.title}</h4>
                          <p className="text-[11px] text-muted-foreground">
                            Prepped {batch.preparedDate} • Use by {batch.useByDate || "N/A"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(batch.id)}
                        aria-label={`Delete ${batch.title}`}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold">
                          {batch.remainingPortions} / {batch.totalPortions} portions left
                        </span>
                        <Badge variant="outline" className="uppercase text-[9px]">
                          {batch.storageLocation}
                        </Badge>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={batch.remainingPortions <= 0}
                          onClick={() => handleAdjustPortions(batch.id, -1)}
                          className="h-7 text-xs"
                        >
                          -1 Eaten
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdjustPortions(batch.id, 1)}
                          className="h-7 text-xs"
                        >
                          +1
                        </Button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={batch.remainingPortions <= 0}
                        onClick={() => handleScheduleLeftoverToday(batch)}
                        className="h-7 text-xs"
                      >
                        <CalendarPlus className="h-3 w-3 mr-1" />
                        Eat Today
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 3: WHAT CAN I COOK? */}
        <TabsContent value="what-can-i-cook" className="space-y-3">
          {matches.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Add recipes and pantry items to see match scores.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((m) => (
                <Card key={m.recipe.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/recipes/${m.recipe.id}`}
                          className="font-bold text-base hover:text-primary hover:underline"
                        >
                          {m.recipe.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {m.matchedCount} of {m.totalIngredients} ingredients on hand
                        </p>
                      </div>
                      <Badge
                        variant={
                          m.matchPct >= 75
                            ? "success"
                            : m.matchPct >= 40
                            ? "warning"
                            : "outline"
                        }
                        className="font-mono text-xs shrink-0"
                      >
                        {m.matchPct}% match
                      </Badge>
                    </div>

                    {m.matchedIngredients.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.matchedIngredients.map((name) => (
                          <Badge key={name} variant="success" className="text-[10px]">
                            ✓ {name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {m.missingIngredients.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.missingIngredients.map((name) => (
                          <Badge key={name} variant="outline" className="text-[10px]">
                            Missing: {name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/recipes/${m.recipe.id}`}>Open Recipe</Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link href={`/recipes/${m.recipe.id}/cook`}>
                          <ChefHat className="h-3.5 w-3.5 mr-1" />
                          Cook Mode
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
