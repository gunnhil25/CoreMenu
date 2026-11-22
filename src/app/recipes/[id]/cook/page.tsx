import { notFound, redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { CookModeView } from "@/components/recipes/cook-mode-view";
import { store } from "@/lib/store";
import type { UnitSystem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CookModePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ servings?: string; units?: string }>;
}) {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const recipe = await store.getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  const parsedServings = sp.servings ? parseInt(sp.servings, 10) : recipe.servings;
  const initialServings =
    Number.isFinite(parsedServings) && parsedServings > 0
      ? parsedServings
      : recipe.servings;
  const initialUnits: UnitSystem =
    sp.units === "imperial" || sp.units === "metric" ? sp.units : user.preferredUnits;

  return (
    <CookModeView
      recipe={recipe}
      initialServings={initialServings}
      initialUnits={initialUnits}
    />
  );
}
