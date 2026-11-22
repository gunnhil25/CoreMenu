import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { RecipesView } from "@/components/recipes/recipes-view";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const sp = await searchParams;
  const [recipes, settings] = await Promise.all([
    store.listRecipes(),
    store.getHouseholdSettings(),
  ]);

  return (
    <RecipesView
      initialRecipes={recipes}
      currency={settings.currency}
      initialOpenImport={sp.import === "url"}
    />
  );
}
