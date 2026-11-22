"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Upload,
  Save,
  ArrowLeft,
  Clock,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRecipeAction, updateRecipeAction } from "@/actions/recipes";
import {
  AISLE_CATEGORIES,
  MEAL_TYPES,
  type AisleCategory,
  type DifficultyLevel,
  type MealType,
  type RecipeIngredient,
  type RecipeRecord,
  type RecipeStep,
} from "@/lib/types";

interface RecipeFormProps {
  mode: "create" | "edit";
  initialRecipe?: RecipeRecord;
  defaultStores: string[];
}

function emptyIngredient(): RecipeIngredient {
  return {
    id: crypto.randomUUID(),
    name: "",
    quantity: 1,
    unit: "unit",
    prepNote: "",
    aisle: "Pantry & Dry Goods",
    store: "",
    estimatedCost: null,
    isStaple: false,
  };
}

function emptyStep(): RecipeStep {
  return {
    id: crypto.randomUUID(),
    section: "",
    instruction: "",
    timerMinutes: null,
  };
}

export function RecipeForm({ mode, initialRecipe, defaultStores }: RecipeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [title, setTitle] = useState(initialRecipe?.title ?? "");
  const [description, setDescription] = useState(initialRecipe?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initialRecipe?.imageUrl ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialRecipe?.sourceUrl ?? "");
  const [mealType, setMealType] = useState<MealType>(
    initialRecipe?.mealType ?? "dinner"
  );
  const [cuisine, setCuisine] = useState(initialRecipe?.cuisine ?? "");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    initialRecipe?.difficulty ?? "easy"
  );
  const [prepTimeMin, setPrepTimeMin] = useState(
    String(initialRecipe?.prepTimeMin ?? 15)
  );
  const [cookTimeMin, setCookTimeMin] = useState(
    String(initialRecipe?.cookTimeMin ?? 20)
  );
  const [servings, setServings] = useState(String(initialRecipe?.servings ?? 4));
  const [tagsText, setTagsText] = useState(
    initialRecipe?.tags.join(", ") ?? "Meal Prep, High Protein"
  );

  const [calories, setCalories] = useState(
    initialRecipe?.caloriesPerServing !== null &&
      initialRecipe?.caloriesPerServing !== undefined
      ? String(initialRecipe.caloriesPerServing)
      : ""
  );
  const [protein, setProtein] = useState(initialRecipe?.proteinPerServing ?? "");
  const [carbs, setCarbs] = useState(initialRecipe?.carbsPerServing ?? "");
  const [fat, setFat] = useState(initialRecipe?.fatPerServing ?? "");
  const [costPerServing, setCostPerServing] = useState(
    initialRecipe?.estimatedCostPerServing ?? ""
  );
  const [notes, setNotes] = useState(initialRecipe?.notes ?? "");

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initialRecipe && initialRecipe.ingredients.length > 0
      ? initialRecipe.ingredients
      : [emptyIngredient()]
  );

  const [steps, setSteps] = useState<RecipeStep[]>(
    initialRecipe && initialRecipe.steps.length > 0
      ? initialRecipe.steps
      : [emptyStep()]
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to upload photo.");
      } else if (data.url) {
        setImageUrl(data.url);
      }
    } catch {
      setError("Failed to upload photo.");
    } finally {
      setUploadingImage(false);
    }
  };

  const updateIngredient = (id: string, patch: Partial<RecipeIngredient>) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing))
    );
  };

  const updateStep = (id: string, patch: Partial<RecipeStep>) => {
    setSteps((prev) => prev.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedIngredients = ingredients
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        ...i,
        name: i.name.trim(),
        unit: i.unit.trim(),
        prepNote: i.prepNote?.trim() || undefined,
        store: i.store?.trim() || undefined,
      }));

    const cleanedSteps = steps
      .filter((s) => s.instruction.trim().length > 0)
      .map((s) => ({
        ...s,
        section: s.section?.trim() || undefined,
        instruction: s.instruction.trim(),
      }));

    if (cleanedIngredients.length === 0) {
      setError("Please add at least one ingredient.");
      return;
    }
    if (cleanedSteps.length === 0) {
      setError("Please add at least one cooking step.");
      return;
    }

    const payload = {
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      sourceUrl: sourceUrl || null,
      mealType,
      cuisine: cuisine || null,
      difficulty,
      prepTimeMin: parseInt(prepTimeMin, 10) || 0,
      cookTimeMin: parseInt(cookTimeMin, 10) || 0,
      servings: Math.max(1, parseInt(servings, 10) || 1),
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ingredients: cleanedIngredients,
      steps: cleanedSteps,
      caloriesPerServing: calories ? parseInt(calories, 10) : null,
      proteinPerServing: protein ? parseFloat(protein) : null,
      carbsPerServing: carbs ? parseFloat(carbs) : null,
      fatPerServing: fat ? parseFloat(fat) : null,
      estimatedCostPerServing: costPerServing ? parseFloat(costPerServing) : null,
      notes: notes || null,
    };

    startTransition(async () => {
      if (mode === "edit" && initialRecipe) {
        const res = await updateRecipeAction(initialRecipe.id, payload);
        if (!res.success || !res.recipe) {
          setError(res.error || "Failed to update recipe.");
          return;
        }
        router.push(`/recipes/${res.recipe.id}`);
        router.refresh();
      } else {
        const res = await createRecipeAction(payload);
        if (!res.success || !res.recipe) {
          setError(res.error || "Failed to create recipe.");
          return;
        }
        router.push(`/recipes/${res.recipe.id}`);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={initialRecipe ? `/recipes/${initialRecipe.id}` : "/recipes"}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {mode === "edit" ? "Edit Recipe" : "Create New Recipe"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Structured ingredients power auto-merging grocery lists and unit conversion.
            </p>
          </div>
        </div>
        <Button type="submit" disabled={isPending} className="gap-1.5">
          <Save className="h-4 w-4" />
          {isPending
            ? "Saving..."
            : mode === "edit"
            ? "Save Changes"
            : "Save Recipe"}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Core Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipe Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recipe-title">Recipe Title</Label>
              <Input
                id="recipe-title"
                placeholder="e.g. Spicy Korean Beef Meal Prep Bowls"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="recipe-meal-type">Meal Type</Label>
                <select
                  id="recipe-meal-type"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                >
                  {MEAL_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {mt.charAt(0).toUpperCase() + mt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-cuisine">Cuisine</Label>
                <Input
                  id="recipe-cuisine"
                  placeholder="Korean"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-difficulty">Difficulty</Label>
                <select
                  id="recipe-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recipe-description">Short Description</Label>
            <Textarea
              id="recipe-description"
              rows={2}
              placeholder="Summary, flavor profile, or meal prep suitability..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recipe-prep">Prep Time (min)</Label>
              <Input
                id="recipe-prep"
                type="number"
                min="0"
                value={prepTimeMin}
                onChange={(e) => setPrepTimeMin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipe-cook">Cook Time (min)</Label>
              <Input
                id="recipe-cook"
                type="number"
                min="0"
                value={cookTimeMin}
                onChange={(e) => setCookTimeMin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipe-servings">Base Servings</Label>
              <Input
                id="recipe-servings"
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipe-cost">Est. Cost / Serving</Label>
              <Input
                id="recipe-cost"
                type="number"
                min="0"
                step="0.05"
                placeholder="5.50"
                value={costPerServing}
                onChange={(e) => setCostPerServing(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recipe-tags">Tags (comma separated)</Label>
              <Input
                id="recipe-tags"
                placeholder="High Protein, Meal Prep, Freezer Friendly"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipe-source-url">Original Source URL (optional)</Label>
              <Input
                id="recipe-source-url"
                type="url"
                placeholder="https://..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Photo Upload + URL */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-1">
            <div className="md:col-span-6 space-y-1.5">
              <Label htmlFor="recipe-image-url">Dish Photo URL or Local Upload</Label>
              <Input
                id="recipe-image-url"
                placeholder="/api/uploads/... or https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div className="md:col-span-4 space-y-1.5">
              <Label htmlFor="recipe-photo-file">Upload Photo (Docker Volume)</Label>
              <label
                htmlFor="recipe-photo-file"
                className="flex h-9 items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 px-3 text-xs font-medium cursor-pointer hover:bg-muted/60 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadingImage ? "Uploading..." : "Choose JPEG / PNG / WebP"}
                <input
                  id="recipe-photo-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="md:col-span-2 flex justify-end">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="h-14 w-20 object-cover rounded-lg border"
                />
              ) : (
                <div className="h-14 w-20 rounded-lg border bg-muted/30 flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nutrition Per Serving */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Macros & Nutrition (Per Serving, Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="recipe-kcal">Calories (kcal)</Label>
            <Input
              id="recipe-kcal"
              type="number"
              min="0"
              placeholder="520"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-protein">Protein (g)</Label>
            <Input
              id="recipe-protein"
              type="number"
              min="0"
              step="0.5"
              placeholder="42"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-carbs">Carbs (g)</Label>
            <Input
              id="recipe-carbs"
              type="number"
              min="0"
              step="0.5"
              placeholder="48"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-fat">Fat (g)</Label>
            <Input
              id="recipe-fat"
              type="number"
              min="0"
              step="0.5"
              placeholder="16"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ingredients Builder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Ingredients</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Ingredient
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {ingredients.map((ing, idx) => (
            <div
              key={ing.id}
              className="p-3 rounded-xl border bg-muted/20 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end"
            >
              <div className="md:col-span-2 space-y-1">
                <Label className="text-[10px]">Qty</Label>
                <Input
                  aria-label={`Ingredient ${idx + 1} quantity`}
                  type="number"
                  step="any"
                  min="0"
                  value={ing.quantity ?? ""}
                  onChange={(e) =>
                    updateIngredient(ing.id, {
                      quantity: e.target.value === "" ? null : parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-[10px]">Unit</Label>
                <Input
                  aria-label={`Ingredient ${idx + 1} unit`}
                  placeholder="g, ml, tbsp..."
                  value={ing.unit}
                  onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })}
                />
              </div>
              <div className="md:col-span-3 space-y-1">
                <Label className="text-[10px]">Ingredient Name</Label>
                <Input
                  aria-label={`Ingredient ${idx + 1} name`}
                  placeholder="Chicken breast fillets"
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label className="text-[10px]">Aisle</Label>
                <select
                  aria-label={`Ingredient ${idx + 1} aisle`}
                  value={ing.aisle}
                  onChange={(e) =>
                    updateIngredient(ing.id, { aisle: e.target.value as AisleCategory })
                  }
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
                <Label className="text-[10px]">Store / Est $</Label>
                <div className="flex gap-1">
                  <select
                    aria-label={`Ingredient ${idx + 1} store`}
                    value={ing.store || ""}
                    onChange={(e) => updateIngredient(ing.id, { store: e.target.value })}
                    className="h-9 flex-1 rounded-lg border border-input bg-background px-1.5 text-xs min-w-0"
                  >
                    <option value="">Any</option>
                    {defaultStores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Ingredient ${idx + 1} estimated cost`}
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="$"
                    className="w-16 px-2"
                    value={ing.estimatedCost ?? ""}
                    onChange={(e) =>
                      updateIngredient(ing.id, {
                        estimatedCost:
                          e.target.value === "" ? null : parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="md:col-span-1 flex items-center justify-between gap-1">
                <label className="flex items-center gap-1 text-[10px] cursor-pointer" title="Pantry staple">
                  <input
                    type="checkbox"
                    checked={Boolean(ing.isStaple)}
                    onChange={(e) =>
                      updateIngredient(ing.id, { isStaple: e.target.checked })
                    }
                  />
                  Staple
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setIngredients((prev) =>
                      prev.length > 1 ? prev.filter((i) => i.id !== ing.id) : prev
                    )
                  }
                  aria-label="Remove ingredient"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Instructions Builder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Cooking Instructions & Timers</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSteps((prev) => [...prev, emptyStep()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((st, idx) => (
            <div
              key={st.id}
              className="p-3 rounded-xl border bg-muted/20 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-primary">Step {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Step ${idx + 1} section`}
                    placeholder="Optional section (e.g. Sauce)"
                    className="h-8 w-44 text-xs"
                    value={st.section ?? ""}
                    onChange={(e) => updateStep(st.id, { section: e.target.value })}
                  />
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      aria-label={`Step ${idx + 1} timer minutes`}
                      type="number"
                      min="0"
                      placeholder="Timer (m)"
                      className="h-8 w-24 text-xs"
                      value={st.timerMinutes ?? ""}
                      onChange={(e) =>
                        updateStep(st.id, {
                          timerMinutes:
                            e.target.value === "" ? null : parseInt(e.target.value, 10),
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setSteps((prev) =>
                        prev.length > 1 ? prev.filter((x) => x.id !== st.id) : prev
                      )
                    }
                    aria-label="Remove step"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                aria-label={`Step ${idx + 1} instruction`}
                rows={2}
                placeholder="Describe this step cleanly (temperatures like 200°C auto-convert in imperial view)..."
                value={st.instruction}
                onChange={(e) => updateStep(st.id, { instruction: e.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes & Bottom Save */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <Label htmlFor="recipe-notes">Storage & Meal Prep Notes</Label>
          <Textarea
            id="recipe-notes"
            rows={2}
            placeholder="Freezer storage life, reheating tips, or substitution ideas..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending} className="gap-1.5">
              <Save className="h-4 w-4" />
              {isPending
                ? "Saving..."
                : mode === "edit"
                ? "Save Recipe Changes"
                : "Create Recipe"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
