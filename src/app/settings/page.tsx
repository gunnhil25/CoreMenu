import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { getSettingsWorkspaceAction } from "@/actions/settings";
import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { initialized, user } = await getAuthStatusAction();
  if (!initialized) redirect("/setup");
  if (!user) redirect("/login");

  const workspace = await getSettingsWorkspaceAction();

  return (
    <SettingsView
      initialUser={workspace.user}
      initialSettings={workspace.householdSettings}
      initialUsers={workspace.users}
      initialQuickStaples={workspace.quickStaples}
    />
  );
}
