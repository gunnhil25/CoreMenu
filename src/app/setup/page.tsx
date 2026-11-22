import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { SetupView } from "@/components/auth/setup-view";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const { initialized, user } = await getAuthStatusAction();

  if (initialized) {
    redirect(user ? "/" : "/login");
  }

  return <SetupView />;
}
