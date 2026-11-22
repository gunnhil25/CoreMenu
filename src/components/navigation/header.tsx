"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Plus,
  Link2,
  UtensilsCrossed,
  Calendar,
  Clock,
  Settings,
  LogOut,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logoutAction } from "@/actions/auth";
import type { SafeUser } from "@/lib/types";

export function Header({ user }: { user: SafeUser }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateLabel = now
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(now)
    : "Loading date...";

  const timeLabel = now
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now)
    : "--:--:--";

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <header className="h-16 border-b bg-card/75 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="lg:hidden flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-[#6d5dfc] to-[#27c6a5] flex items-center justify-center text-white shadow-sm shadow-[#6d5dfc]/20">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-[#6d5dfc] to-[#27c6a5] bg-clip-text text-transparent">
            CoreMenu
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2.5 text-xs text-muted-foreground font-mono tabular-nums bg-muted/60 border border-border/60 px-3 py-1.5 rounded-lg">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{dateLabel}</span>
          </span>
          <span className="h-3.5 w-px bg-border" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 text-foreground/90">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span suppressHydrationWarning>{timeLabel}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
          <Link href="/recipes?import=url">
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Import URL
          </Link>
        </Button>
        <Button size="sm" asChild className="shadow-sm hidden sm:inline-flex">
          <Link href="/recipes/new">
            <Plus className="h-4 w-4 mr-1" />
            New Recipe
          </Link>
        </Button>

        <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

        <ThemeToggle variant="icon" className="lg:hidden" />

        <Link
          href="/settings"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-background/60 hover:bg-muted/60 transition-colors text-xs"
          title="Settings & Household Management"
        >
          <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="hidden sm:inline font-medium max-w-[110px] truncate">
            {user.name}
          </span>
          <Badge
            variant={user.role === "admin" ? "info" : "outline"}
            className="text-[9px] px-1 py-0 font-mono uppercase hidden md:inline-flex"
          >
            {user.role}
          </Badge>
          <Settings className="h-3.5 w-3.5 text-muted-foreground ml-0.5 lg:hidden" />
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={isPending}
          title="Sign Out"
          aria-label="Sign Out"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
