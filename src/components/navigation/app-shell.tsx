"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { Sidebar } from "@/components/navigation/sidebar";
import { Header } from "@/components/navigation/header";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { SafeUser } from "@/lib/types";

interface AppShellProps {
  initialized: boolean;
  user: SafeUser | null;
  householdName: string;
  children: React.ReactNode;
}

export function AppShell({
  initialized,
  user,
  householdName,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = pathname === "/setup" || pathname === "/login";
  const isCookModeRoute = pathname.startsWith("/recipes/") && pathname.endsWith("/cook");

  useEffect(() => {
    if (!initialized && pathname !== "/setup") {
      router.replace("/setup");
      return;
    }
    if (initialized && !user && pathname !== "/login") {
      router.replace("/login");
      return;
    }
    if (initialized && user && isAuthRoute) {
      router.replace("/");
    }
  }, [initialized, user, pathname, isAuthRoute, router]);

  if ((!initialized && pathname === "/setup") || (initialized && !user && pathname === "/login")) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground flex items-center justify-center p-4">
        <ThemeToggle variant="compact" className="fixed top-5 right-5 z-20" />
        {children}
      </div>
    );
  }

  if (!initialized || !user || isAuthRoute) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center gap-3 p-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#6d5dfc] to-[#27c6a5] flex items-center justify-center text-white shadow-lg shadow-[#6d5dfc]/25 animate-pulse">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          {!initialized
            ? "Initializing CoreMenu Setup Wizard..."
            : !user
            ? "Redirecting to CoreMenu Sign In..."
            : "Loading CoreMenu Kitchen..."}
        </p>
      </div>
    );
  }

  if (isCookModeRoute) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground">
        {children}
      </div>
    );
  }

  return (
    <>
      <Sidebar user={user} householdName={householdName} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl mx-auto w-full overflow-x-hidden">
          <div key={pathname} className="cc-animate-page">
            {children}
          </div>
        </main>
      </div>

      <MobileNav />
    </>
  );
}
