import { notFound, redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const { id } = await params;
  const [recipe, settings] = await Promise.all([
    store.getRecipeById(id),
    store.getHouseholdSettings(),
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <RecipeForm
      mode="edit"
      initialRecipe={recipe}
      defaultStores={settings.defaultStores}
    />
  );
}
