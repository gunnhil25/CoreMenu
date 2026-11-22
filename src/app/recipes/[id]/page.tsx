import { notFound, redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { RecipeDetailView } from "@/components/recipes/recipe-detail-view";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const { id } = await params;
  const [recipe, cookLogs, settings] = await Promise.all([
    store.getRecipeById(id),
    store.getCookLogsForRecipe(id),
    store.getHouseholdSettings(),
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <RecipeDetailView
      initialRecipe={recipe}
      initialCookLogs={cookLogs}
      defaultUnitSystem={user.preferredUnits}
      currency={settings.currency}
    />
  );
}
