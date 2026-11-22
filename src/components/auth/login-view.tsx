"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Lock, AlertCircle, ArrowRight } from "lucide-react";
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
import { loginAction } from "@/actions/auth";

export function LoginView() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await loginAction({ email, password });
      if (!res.success) {
        setError(res.error || "Sign in failed.");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  };

  return (
    <div className="w-full max-w-md space-y-6 py-8">
      <div className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#6d5dfc] to-[#27c6a5] flex items-center justify-center text-white shadow-lg shadow-[#6d5dfc]/25">
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-[#6d5dfc] to-[#27c6a5] bg-clip-text text-transparent">
          CoreMenu
        </h1>
        <p className="text-xs text-muted-foreground">
          Self-Hosted Recipe Book, Meal Prep Planner & Smart Groceries
        </p>
      </div>

      <Card className="border-border/60 shadow-2xl">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Sign In
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your household account credentials to access CoreMenu.
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

            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="chef@household.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={isPending} className="w-full gap-1.5">
              {isPending ? "Signing In..." : "Sign In to Kitchen"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
