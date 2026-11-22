"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Link2,
  Dices,
  Heart,
  Clock,
  Star,
  Flame,
  Download,
  ChefHat,
  UtensilsCrossed,
  FileText,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createRecipeAction,
  importRecipeUrlAction,
  parseRecipeTextAction,
  pickRandomRecipeAction,
  toggleFavoriteRecipeAction,
} from "@/actions/recipes";
import { formatCurrency, formatDate, formatDuration } from "@/lib/utils";
import { MEAL_TYPES, type MealType, type RecipeRecord } from "@/lib/types";

interface RecipesViewProps {
  initialRecipes: RecipeRecord[];
  currency: string;
  initialOpenImport?: boolean;
}

type SortOption = "newest" | "rating" | "quickest" | "least_recent" | "lowest_cost";

export function RecipesView({
  initialRecipes,
  currency,
  initialOpenImport = false,
}: RecipesViewProps) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeRecord[]>(initialRecipes);
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [mealFilter, setMealFilter] = useState<MealType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [maxTimeFilter, setMaxTimeFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [highProteinOnly, setHighProteinOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // URL / Text Importer modal
  const [importOpen, setImportOpen] = useState(initialOpenImport);
  const [importTab, setImportTab] = useState<"url" | "text">("url");
  const [importUrl, setImportUrl] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteIngredients, setPasteIngredients] = useState("");
  const [pasteSteps, setPasteSteps] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // Random picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<RecipeRecord | null>(null);
  const [pickerErr, setPickerErr] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) {
      for (const t of r.tags) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = recipes.filter((r) => {
      if (mealFilter !== "all" && r.mealType !== mealFilter) return false;
      if (tagFilter !== "all" && !r.tags.includes(tagFilter)) return false;
      if (favoritesOnly && !r.isFavorite) return false;
      if (highProteinOnly) {
        const p = r.proteinPerServing ? parseFloat(r.proteinPerServing) : 0;
        if (p < 30) return false;
      }
      if (maxTimeFilter !== "all") {
        const maxM = parseInt(maxTimeFilter, 10);
        if (r.prepTimeMin + r.cookTimeMin > maxM) return false;
      }
      if (q) {
        const haystack = [
          r.title,
          r.cuisine || "",
          r.description || "",
          ...r.tags,
          ...r.ingredients.map((i) => i.name),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating || b.cookCount - a.cookCount;
      if (sortBy === "quickest") {
        return a.prepTimeMin + a.cookTimeMin - (b.prepTimeMin + b.cookTimeMin);
      }
      if (sortBy === "least_recent") {
        if (!a.lastCookedAt && !b.lastCookedAt) return 0;
        if (!a.lastCookedAt) return -1;
        if (!b.lastCookedAt) return 1;
        return a.lastCookedAt.localeCompare(b.lastCookedAt);
      }
      if (sortBy === "lowest_cost") {
        const ac = a.estimatedCostPerServing ? parseFloat(a.estimatedCostPerServing) : 9999;
        const bc = b.estimatedCostPerServing ? parseFloat(b.estimatedCostPerServing) : 9999;
        return ac - bc;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return list;
  }, [
    recipes,
    query,
    mealFilter,
    tagFilter,
    maxTimeFilter,
    favoritesOnly,
    highProteinOnly,
    sortBy,
  ]);

  const handleToggleFav = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r))
    );
    startTransition(async () => {
      const res = await toggleFavoriteRecipeAction(id);
      if (res.success && res.recipe) {
        setRecipes((prev) =>
          prev.map((r) => (r.id === id ? res.recipe! : r))
        );
      }
    });
  };

  const handleImportUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    startTransition(async () => {
      const res = await importRecipeUrlAction(importUrl);
      if (!res.success || !res.draft) {
        setImportError(res.error || "Could not import recipe from URL.");
        return;
      }
      const created = await createRecipeAction({
        title: res.draft.title,
        description: res.draft.description,
        imageUrl: res.draft.imageUrl,
        sourceUrl: res.draft.sourceUrl,
        mealType: res.draft.mealType,
        cuisine: res.draft.cuisine,
        difficulty: res.draft.difficulty,
        prepTimeMin: res.draft.prepTimeMin,
        cookTimeMin: res.draft.cookTimeMin,
        servings: res.draft.servings,
        tags: res.draft.tags,
        ingredients: res.draft.ingredients,
        steps: res.draft.steps,
        caloriesPerServing: res.draft.caloriesPerServing,
        proteinPerServing: res.draft.proteinPerServing,
        carbsPerServing: res.draft.carbsPerServing,
        fatPerServing: res.draft.fatPerServing,
      });
      if (!created.success || !created.recipe) {
        setImportError(created.error || "Failed to save imported recipe.");
        return;
      }
      setImportOpen(false);
      router.push(`/recipes/${created.recipe.id}/edit`);
      router.refresh();
    });
  };

  const handleImportText = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    startTransition(async () => {
      const res = await parseRecipeTextAction({
        title: pasteTitle,
        rawIngredients: pasteIngredients,
        rawSteps: pasteSteps,
      });
      if (!res.success || !res.draft) {
        setImportError(res.error || "Failed to parse recipe text.");
        return;
      }
      const created = await createRecipeAction({
        title: res.draft.title,
        description: res.draft.description,
        mealType: res.draft.mealType,
        cuisine: res.draft.cuisine,
        difficulty: res.draft.difficulty,
        prepTimeMin: res.draft.prepTimeMin,
        cookTimeMin: res.draft.cookTimeMin,
        servings: res.draft.servings,
        tags: res.draft.tags,
        ingredients: res.draft.ingredients,
        steps: res.draft.steps,
      });
      if (!created.success || !created.recipe) {
        setImportError(created.error || "Failed to save parsed recipe.");
        return;
      }
      setImportOpen(false);
      router.push(`/recipes/${created.recipe.id}/edit`);
      router.refresh();
    });
  };

  const handleRandomPick = () => {
    setPickerErr(null);
    setPickerOpen(true);
    startTransition(async () => {
      const res = await pickRandomRecipeAction({
        mealType: mealFilter,
        maxTotalMinutes: maxTimeFilter !== "all" ? parseInt(maxTimeFilter, 10) : null,
        minProteinGrams: highProteinOnly ? 30 : null,
        favoritesOnly,
      });
      if (!res.success || !res.recipe) {
        setPicked(null);
        setPickerErr(res.error || "No recipes match your current filters.");
        return;
      }
      setPicked(res.recipe);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Recipe Book
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {recipes.length} household recipes • Scale servings, convert metric/imperial, import URLs, or launch Cook Mode.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRandomPick}>
            <Dices className="h-3.5 w-3.5 mr-1.5" />
            Dinner Picker
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Import URL / Text
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export/markdown">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export .md
            </a>
          </Button>
          <Button size="sm" asChild>
            <Link href="/recipes/new">
              <Plus className="h-4 w-4 mr-1" />
              New Recipe
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                aria-label="Search recipes"
                placeholder="Search title, ingredient, cuisine, or tag..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="md:col-span-2">
              <select
                aria-label="Filter by meal type"
                value={mealFilter}
                onChange={(e) => setMealFilter(e.target.value as MealType | "all")}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
              >
                <option value="all">All Meal Types</option>
                {MEAL_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {mt.charAt(0).toUpperCase() + mt.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                aria-label="Filter by tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
              >
                <option value="all">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                aria-label="Sort recipes"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
              >
                <option value="newest">Sort: Recently Updated</option>
                <option value="rating">Sort: Highest Rated</option>
                <option value="quickest">Sort: Quickest First</option>
                <option value="least_recent">Sort: Least Recently Cooked</option>
                <option value="lowest_cost">Sort: Lowest Cost / Serving</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant={favoritesOnly ? "default" : "outline"}
              onClick={() => setFavoritesOnly((v) => !v)}
              className="h-7 text-xs"
            >
              <Heart className="h-3 w-3 mr-1" />
              Favorites
            </Button>
            <Button
              type="button"
              size="sm"
              variant={highProteinOnly ? "default" : "outline"}
              onClick={() => setHighProteinOnly((v) => !v)}
              className="h-7 text-xs"
            >
              <Flame className="h-3 w-3 mr-1" />
              High Protein (30g+)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={maxTimeFilter === "30" ? "default" : "outline"}
              onClick={() =>
                setMaxTimeFilter((prev) => (prev === "30" ? "all" : "30"))
              }
              className="h-7 text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              Under 30m
            </Button>
            <span className="ml-auto text-xs text-muted-foreground font-mono">
              Showing {filteredRecipes.length} of {recipes.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <UtensilsCrossed className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <h3 className="font-semibold text-base">No recipes found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create your own recipe from scratch or import one directly from a URL or plain text.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" asChild>
                <Link href="/recipes/new">Create Recipe</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                Import URL / Text
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredRecipes.map((recipe) => {
            const totalMin = recipe.prepTimeMin + recipe.cookTimeMin;
            return (
              <Card
                key={recipe.id}
                className="overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-lg transition-all group"
              >
                <Link href={`/recipes/${recipe.id}`} className="block relative h-40 bg-gradient-to-br from-[#6d5dfc]/20 via-muted/40 to-[#27c6a5]/20 overflow-hidden">
                  {recipe.imageUrl ? (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 gap-1">
                      <UtensilsCrossed className="h-8 w-8" />
                      <span className="text-[11px] font-mono uppercase tracking-wider">
                        {recipe.cuisine || recipe.mealType}
                      </span>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <Badge className="text-[10px] uppercase bg-background/85 text-foreground backdrop-blur-sm border">
                      {recipe.mealType}
                    </Badge>
                    {recipe.caloriesPerServing && (
                      <Badge className="text-[10px] bg-background/85 text-foreground backdrop-blur-sm border font-mono">
                        {recipe.caloriesPerServing} kcal
                      </Badge>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-label={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}
                    onClick={(e) => handleToggleFav(recipe.id, e)}
                    className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        recipe.isFavorite
                          ? "fill-rose-500 text-rose-500"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                </Link>

                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="font-bold text-base leading-snug hover:text-primary transition-colors line-clamp-2"
                    >
                      {recipe.title}
                    </Link>
                    {recipe.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {recipe.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {recipe.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] px-2 py-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(totalMin)}
                        </span>
                        {recipe.proteinPerServing && (
                          <span className="font-semibold text-emerald-500">
                            {Math.round(parseFloat(recipe.proteinPerServing))}g P
                          </span>
                        )}
                        {recipe.estimatedCostPerServing && (
                          <span className="font-mono">
                            {formatCurrency(recipe.estimatedCostPerServing, currency)}/srv
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-mono font-medium">
                          {recipe.rating > 0 ? recipe.rating : "-"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {recipe.lastCookedAt
                          ? `Last cooked ${formatDate(recipe.lastCookedAt)}`
                          : "Never cooked yet"}
                      </span>
                      <Link
                        href={`/recipes/${recipe.id}/cook`}
                        className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                      >
                        <ChefHat className="h-3 w-3" />
                        Cook Mode
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import URL / Text Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Import Recipe
            </DialogTitle>
            <DialogDescription>
              Extract structured schema.org/Recipe metadata from a web link, or paste raw recipe text to parse offline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted">
            <button
              type="button"
              onClick={() => setImportTab("url")}
              className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                importTab === "url" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              From Recipe URL
            </button>
            <button
              type="button"
              onClick={() => setImportTab("text")}
              className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                importTab === "text" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Paste Plain Text
            </button>
          </div>

          {importError && (
            <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive text-xs">
              {importError}
            </div>
          )}

          {importTab === "url" ? (
            <form onSubmit={handleImportUrl} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="import-url-input">Recipe Page URL</Label>
                <Input
                  id="import-url-input"
                  type="url"
                  placeholder="https://example.com/recipes/teriyaki-chicken"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Parses JSON-LD schema.org Recipe blocks (title, times, yield, nutrition, ingredients & steps).
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Importing..." : "Import & Review"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleImportText} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="paste-title">Recipe Title</Label>
                <Input
                  id="paste-title"
                  placeholder="Honey Garlic Chicken Skewers"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paste-ingredients">Ingredients (one per line)</Label>
                <Textarea
                  id="paste-ingredients"
                  rows={4}
                  placeholder={"600 g chicken thigh, diced\n2 tbsp honey\n3 cloves garlic, minced"}
                  value={pasteIngredients}
                  onChange={(e) => setPasteIngredients(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paste-steps">Steps (one per line)</Label>
                <Textarea
                  id="paste-steps"
                  rows={4}
                  placeholder={"1. Thread chicken onto skewers.\n2. Grill for 12 minutes until charred."}
                  value={pasteSteps}
                  onChange={(e) => setPasteSteps(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Parsing..." : "Parse & Edit Recipe"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Random Dinner Picker Modal */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dices className="h-4 w-4 text-primary" />
              Meal Suggestion
            </DialogTitle>
            <DialogDescription>
              Picked randomly from your active filters.
            </DialogDescription>
          </DialogHeader>
          {pickerErr ? (
            <p className="text-sm text-amber-500">{pickerErr}</p>
          ) : picked ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border bg-muted/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="info" className="uppercase text-[10px]">
                    {picked.mealType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(picked.prepTimeMin + picked.cookTimeMin)}
                  </span>
                </div>
                <h3 className="font-bold text-lg">{picked.title}</h3>
                {picked.description && (
                  <p className="text-xs text-muted-foreground">{picked.description}</p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={handleRandomPick} disabled={isPending}>
                  <Dices className="h-4 w-4 mr-1.5" />
                  Spin Again
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/recipes/${picked.id}`}>View Recipe</Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/recipes/${picked.id}/cook`}>Start Cook Mode</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Spinning...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
