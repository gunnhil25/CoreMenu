"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Package,
  Settings,
  UtensilsCrossed,
  Server,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { SafeUser } from "@/lib/types";

const navSections = [
  {
    title: "Kitchen",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Recipe Book", href: "/recipes", icon: BookOpen },
      { name: "New Recipe", href: "/recipes/new", icon: PlusCircle },
    ],
  },
  {
    title: "Meal Prep & Shop",
    items: [
      { name: "Meal Planner", href: "/planner", icon: CalendarDays },
      { name: "Grocery Lists", href: "/grocery", icon: ShoppingCart },
      { name: "Pantry & Leftovers", href: "/pantry", icon: Package },
    ],
  },
  {
    title: "System & Household",
    items: [
      { name: "Settings & Users", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  user,
  householdName,
}: {
  user: SafeUser;
  householdName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r bg-card/80 backdrop-blur-xl h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 shrink-0 flex items-center px-6 border-b justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#6d5dfc] to-[#27c6a5] flex items-center justify-center text-white shadow-md shadow-[#6d5dfc]/25">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <div>
            <span className="bg-gradient-to-r from-[#6d5dfc] to-[#27c6a5] bg-clip-text text-transparent font-extrabold">
              CoreMenu
            </span>
            <span className="block text-[10px] uppercase font-mono tracking-widest text-muted-foreground -mt-1 truncate max-w-[115px]">
              {householdName || "Kitchen Engine"}
            </span>
          </div>
        </Link>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-5 border-[#6d5dfc]/30 text-[#6d5dfc] dark:text-[#8f83ff] font-mono"
        >
          v1.0
        </Badge>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 px-3">
              {section.title}
            </h4>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : item.href === "/recipes"
                    ? pathname === "/recipes" ||
                      (pathname.startsWith("/recipes/") && pathname !== "/recipes/new")
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98] group",
                      isActive
                        ? "bg-primary/10 dark:bg-primary/15 text-primary border border-primary/20 shadow-sm font-semibold pl-4"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-gradient-to-b from-[#6d5dfc] to-[#27c6a5]"
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Theme Switcher & Active Node Status */}
      <div className="p-4 border-t bg-muted/20 space-y-2.5 shrink-0">
        <ThemeToggle variant="sidebar" />

        <div className="rounded-lg border bg-background/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Server className="h-3.5 w-3.5 text-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs font-semibold truncate">{user.name}</span>
            </div>
            <Badge
              variant={user.role === "admin" ? "info" : "outline"}
              className="text-[9px] px-1.5 py-0 font-mono uppercase shrink-0"
            >
              {user.role}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Proxmox • Docker</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              ONLINE
            </span>
          </div>
          <div className="pt-1 border-t text-[10px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-sky-500" />
            <span>Units: {user.preferredUnits.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
