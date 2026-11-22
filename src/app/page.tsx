import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { store } from "@/lib/store";
import { addDaysIso, getWeekDates, getWeekStartMonday, toIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const todayIso = toIsoDate(new Date());
  const weekStart = getWeekStartMonday(todayIso);
  const weekEnd = addDaysIso(weekStart, 6);
  const weekDates = getWeekDates(weekStart);

  const [settings, recipes, weekEntries, lists, pantryItems, leftoverBatches] =
    await Promise.all([
      store.getHouseholdSettings(),
      store.listRecipes(),
      store.listMealPlanEntries(weekStart, weekEnd),
      store.listGroceryLists(),
      store.listPantryItems(),
      store.listLeftoverBatches(),
    ]);

  const activeGroceryList =
    lists.find((l) => l.status === "active") || lists[0] || null;

  return (
    <DashboardView
      user={user}
      settings={settings}
      recipes={recipes}
      weekEntries={weekEntries}
      activeGroceryList={activeGroceryList}
      pantryItems={pantryItems}
      leftoverBatches={leftoverBatches}
      todayIso={todayIso}
      weekDates={weekDates}
    />
  );
}
