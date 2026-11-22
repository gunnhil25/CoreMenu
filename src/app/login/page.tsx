import { redirect } from "next/navigation";
import { getAuthStatusAction } from "@/actions/auth";
import { LoginView } from "@/components/auth/login-view";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { initialized, user } = await getAuthStatusAction();

  if (!initialized) {
    redirect("/setup");
  }
  if (user) {
    redirect("/");
  }

  return <LoginView />;
}
