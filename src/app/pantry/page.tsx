import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { getPantryWorkspaceAction } from "@/actions/pantry";
import { PantryView } from "@/components/pantry/pantry-view";
import { toIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const workspace = await getPantryWorkspaceAction();

  return (
    <PantryView
      initialPantryItems={workspace.pantryItems}
      initialLeftoverBatches={workspace.leftoverBatches}
      initialMatches={workspace.whatCanICook}
      recipes={workspace.recipes}
      todayIso={toIsoDate(new Date())}
    />
  );
}
