import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const settings = await store.getHouseholdSettings();

  return <RecipeForm mode="create" defaultStores={settings.defaultStores} />;
}
