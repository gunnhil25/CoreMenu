"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  ShieldCheck,
  Database,
  Layers,
  AlertCircle,
  ArrowRight,
  Lock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { setupInitialAdminAction } from "@/actions/auth";
import type { UnitSystem } from "@/lib/types";

export function SetupView() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [householdName, setHouseholdName] = useState("CoreMenu Kitchen");
  const [preferredUnits, setPreferredUnits] = useState<UnitSystem>("metric");
  const [currency, setCurrency] = useState("AUD");
  const [weeklyGroceryBudget, setWeeklyGroceryBudget] = useState("220");
  const [seedMode, setSeedMode] = useState<"clean" | "demo">("demo");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const res = await setupInitialAdminAction({
        name,
        email,
        password,
        householdName,
        preferredUnits,
        currency,
        weeklyGroceryBudget: parseFloat(weeklyGroceryBudget) || 220,
        seedMode,
      });

      if (!res.success) {
        setError(res.error || "Failed to create initial administrator account.");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  };

  return (
    <div className="w-full max-w-2xl space-y-6 py-8">
      {/* Brand Banner */}
      <div className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#6d5dfc] to-[#27c6a5] flex items-center justify-center text-white shadow-lg shadow-[#6d5dfc]/25">
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#6d5dfc] to-[#27c6a5] bg-clip-text text-transparent">
            CoreMenu Setup
          </h1>
          <Badge variant="info" className="font-mono text-[10px]">
            First-Run Wizard
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Create your primary household administrator account to lock setup and launch your self-hosted kitchen workspace.
        </p>
      </div>

      <Card className="border-border/60 shadow-2xl">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Household Kitchen & Admin Account
          </CardTitle>
          <CardDescription className="text-xs">
            This setup endpoint locks automatically once the first household administrator is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="setup-name">Full Name</Label>
                <Input
                  id="setup-name"
                  placeholder="Nicolas Kim"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="setup-email">Admin Email</Label>
                <Input
                  id="setup-email"
                  type="email"
                  placeholder="chef@household.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="setup-password">Password (min 8 chars)</Label>
                <Input
                  id="setup-password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="setup-confirm-password">Confirm Password</Label>
                <Input
                  id="setup-confirm-password"
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="setup-household">Household Name</Label>
                <Input
                  id="setup-household"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="setup-units">Preferred Units</Label>
                <select
                  id="setup-units"
                  value={preferredUnits}
                  onChange={(e) => setPreferredUnits(e.target.value as UnitSystem)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="metric">Metric (g / ml / °C)</option>
                  <option value="imperial">Imperial (oz / cup / °F)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-currency">Currency</Label>
                  <select
                    id="setup-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                    <option value="NZD">NZD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setup-budget">Weekly Budget</Label>
                  <Input
                    id="setup-budget"
                    type="number"
                    min="0"
                    step="5"
                    value={weeklyGroceryBudget}
                    onChange={(e) => setWeeklyGroceryBudget(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Seed Mode Selector */}
            <div className="space-y-2 pt-1">
              <Label>Initial Kitchen Data</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSeedMode("demo")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    seedMode === "demo"
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-emerald-500" />
                      Load Demo Recipes & Plan
                    </span>
                    <Badge variant="success" className="text-[9px]">
                      Recommended
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Includes 8 meal-prep recipes, a sample weekly plan, pantry items, leftover stash, and an active grocery list.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSeedMode("clean")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    seedMode === "clean"
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-sky-500" />
                      Start Clean
                    </span>
                    <Badge variant="outline" className="text-[9px]">
                      Blank
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Empty cookbook, planner, pantry, and grocery workspace ready for your own household recipes.
                  </p>
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-500" />
                Passwords hashed with memory-hard scrypt + HttpOnly cookie
              </p>
              <Button type="submit" disabled={isPending} className="gap-1.5">
                {isPending ? "Initializing..." : "Create Admin & Launch CoreMenu"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
