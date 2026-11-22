import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { getGroceryWorkspaceAction } from "@/actions/grocery";
import { GroceryView } from "@/components/grocery/grocery-view";

export const dynamic = "force-dynamic";

export default async function GroceryPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const sp = await searchParams;
  const workspace = await getGroceryWorkspaceAction(sp.listId);

  return (
    <GroceryView
      initialLists={workspace.lists}
      initialActiveList={workspace.activeList}
      initialItems={workspace.items}
      quickStaples={workspace.quickStaples}
      settings={workspace.settings}
    />
  );
}
