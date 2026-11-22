import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { PlannerView } from "@/components/planner/planner-view";
import { store } from "@/lib/store";
import { addDaysIso, getWeekStartMonday } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const weekStart = getWeekStartMonday();
  const weekEnd = addDaysIso(weekStart, 6);

  const [entries, templates, recipes, leftovers, settings] = await Promise.all([
    store.listMealPlanEntries(weekStart, weekEnd),
    store.listMealPlanTemplates(),
    store.listRecipes(),
    store.listLeftoverBatches(),
    store.getHouseholdSettings(),
  ]);

  return (
    <PlannerView
      initialWeekStart={weekStart}
      initialEntries={entries}
      initialTemplates={templates}
      recipes={recipes}
      leftovers={leftovers}
      user={user}
      currency={settings.currency}
    />
  );
}
