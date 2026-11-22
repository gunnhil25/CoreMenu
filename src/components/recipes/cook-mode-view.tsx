"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  X,
  Sun,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logRecipeCookedAction } from "@/actions/recipes";
import {
  convertIngredientUnit,
  convertInstructionTemperatures,
  formatQuantity,
  scaleQuantity,
} from "@/lib/units";
import { generateId } from "@/lib/utils";
import type { RecipeRecord, UnitSystem } from "@/lib/types";

interface CookTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

function playDoneChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Ignore audio context blocks
  }
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CookModeView({
  recipe,
  initialServings,
  initialUnits,
}: {
  recipe: RecipeRecord;
  initialServings: number;
  initialUnits: UnitSystem;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [stepIdx, setStepIdx] = useState(0);
  const [servings, setServings] = useState(initialServings);
  const [units, setUnits] = useState<UnitSystem>(initialUnits);
  const [showIngredients, setShowIngredients] = useState(true);
  const [checkedIngs, setCheckedIngs] = useState<Set<string>>(new Set());

  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [timers, setTimers] = useState<CookTimer[]>([]);

  const [finishOpen, setFinishOpen] = useState(false);
  const [saveStash, setSaveStash] = useState(false);
  const [stashPortions, setStashPortions] = useState("4");
  const [stashLocation, setStashLocation] = useState<"fridge" | "freezer">("fridge");

  const steps = recipe.steps.length > 0
    ? recipe.steps
    : [{ id: "fallback", instruction: "No preparation steps recorded.", timerMinutes: null }];

  const currentStep = steps[Math.min(stepIdx, steps.length - 1)];

  // Wake Lock toggle
  useEffect(() => {
    setWakeLockSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  const toggleWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    if (wakeLockActive) {
      setWakeLockActive(false);
      return;
    }
    try {
      await navigator.wakeLock.request("screen");
      setWakeLockActive(true);
    } catch {
      setWakeLockActive(false);
    }
  }, [wakeLockActive]);

  // Countdown tick
  useEffect(() => {
    const id = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.running || t.remainingSeconds <= 0) return t;
          const nextSec = t.remainingSeconds - 1;
          if (nextSec === 0) {
            playDoneChime();
            return { ...t, remainingSeconds: 0, running: false };
          }
          return { ...t, remainingSeconds: nextSec };
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finishOpen) return;
      if (e.key === "ArrowRight") setStepIdx((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setStepIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, finishOpen]);

  const startTimer = (minutes: number, label: string) => {
    const secs = Math.max(1, Math.round(minutes * 60));
    setTimers((prev) => [
      ...prev,
      {
        id: generateId(),
        label,
        totalSeconds: secs,
        remainingSeconds: secs,
        running: true,
      },
    ]);
  };

  const handleFinishCook = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await logRecipeCookedAction({
        recipeId: recipe.id,
        servingsMade: servings,
        rating: recipe.rating || 5,
        saveLeftovers: saveStash
          ? {
              portions: Math.max(1, parseInt(stashPortions, 10) || 2),
              storageLocation: stashLocation,
              useByDays: stashLocation === "freezer" ? 45 : 4,
            }
          : null,
      });
      router.push(`/recipes/${recipe.id}`);
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Cook Mode Top Bar */}
      <header className="h-16 border-b bg-card/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/recipes/${recipe.id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Exit Cook Mode
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate">{recipe.title}</h1>
            <p className="text-[11px] text-muted-foreground">
              Step {stepIdx + 1} of {steps.length} • {servings} servings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setUnits((u) => (u === "metric" ? "imperial" : "metric"))}
            className="hidden sm:inline-flex text-xs"
          >
            {units === "metric" ? "Metric" : "Imperial"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant={showIngredients ? "default" : "outline"}
            onClick={() => setShowIngredients((v) => !v)}
          >
            <ListChecks className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Ingredients</span>
          </Button>

          {wakeLockSupported && (
            <Button
              type="button"
              size="sm"
              variant={wakeLockActive ? "default" : "outline"}
              onClick={toggleWakeLock}
              title="Keep screen awake while cooking"
            >
              <Sun className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">
                {wakeLockActive ? "Awake On" : "Keep Awake"}
              </span>
            </Button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-[#6d5dfc] to-[#27c6a5] transition-all duration-300"
          style={{ width: `${Math.round(((stepIdx + 1) / steps.length) * 100)}%` }}
        />
      </div>

      {/* Main Kitchen Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step Focus Pane */}
        <div className={showIngredients ? "lg:col-span-8 space-y-6" : "lg:col-span-12 space-y-6"}>
          <Card className="border-primary/25 shadow-xl">
            <CardContent className="p-6 sm:p-10 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="text-xs font-mono px-3 py-1">
                    STEP {stepIdx + 1} / {steps.length}
                  </Badge>
                  {currentStep.section && (
                    <Badge variant="secondary" className="text-xs">
                      {currentStep.section}
                    </Badge>
                  )}
                </div>

                {currentStep.timerMinutes && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      startTimer(
                        currentStep.timerMinutes!,
                        `Step ${stepIdx + 1} (${currentStep.timerMinutes}m)`
                      )
                    }
                    className="gap-1.5"
                  >
                    <Timer className="h-4 w-4" />
                    Start {currentStep.timerMinutes}m Timer
                  </Button>
                )}
              </div>

              <p className="text-xl sm:text-3xl font-medium leading-relaxed tracking-tight">
                {convertInstructionTemperatures(currentStep.instruction, units)}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={stepIdx === 0}
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="h-5 w-5 mr-1" />
                  Previous
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startTimer(5, "Quick 5m Timer")}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  +5m Timer
                </Button>

                {stepIdx < steps.length - 1 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
                  >
                    Next Step
                    <ChevronRight className="h-5 w-5 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setFinishOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-1.5" />
                    Finish & Log Cook
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Timers Strip */}
          {timers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="active-timers-bar">
              {timers.map((t) => (
                <Card
                  key={t.id}
                  className={
                    t.remainingSeconds === 0
                      ? "border-emerald-500 bg-emerald-500/10"
                      : ""
                  }
                >
                  <CardContent className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold">{t.label}</p>
                      <p className="text-2xl font-mono font-extrabold tabular-nums">
                        {formatClock(t.remainingSeconds)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={t.running ? "Pause timer" : "Resume timer"}
                        onClick={() =>
                          setTimers((prev) =>
                            prev.map((x) =>
                              x.id === t.id ? { ...x, running: !x.running } : x
                            )
                          )
                        }
                      >
                        {t.running ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label="Reset timer"
                        onClick={() =>
                          setTimers((prev) =>
                            prev.map((x) =>
                              x.id === t.id
                                ? {
                                    ...x,
                                    remainingSeconds: x.totalSeconds,
                                    running: false,
                                  }
                                : x
                            )
                          )
                        }
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Dismiss timer"
                        onClick={() =>
                          setTimers((prev) => prev.filter((x) => x.id !== t.id))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Side Ingredient Checklist */}
        {showIngredients && (
          <Card className="lg:col-span-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm">Ingredients</h2>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                  >
                    -
                  </Button>
                  <span className="text-xs font-mono px-1">{servings} srv</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setServings((s) => s + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {recipe.ingredients.map((ing) => {
                  const scaled = scaleQuantity(ing.quantity, recipe.servings, servings);
                  const conv = convertIngredientUnit(scaled, ing.unit, units);
                  const qtyStr = formatQuantity(conv.quantity);
                  const done = checkedIngs.has(ing.id);

                  return (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() =>
                        setCheckedIngs((prev) => {
                          const next = new Set(prev);
                          if (next.has(ing.id)) next.delete(ing.id);
                          else next.add(ing.id);
                          return next;
                        })
                      }
                      className={`w-full text-left p-2 rounded-lg border text-xs transition-colors ${
                        done ? "opacity-50 line-through bg-muted/40" : "hover:bg-muted/30"
                      }`}
                    >
                      <span className="font-mono font-bold text-primary mr-1">
                        {[qtyStr, conv.unit].filter(Boolean).join(" ")}
                      </span>
                      <span>{ing.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Finish Modal */}
      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nice Cook! Log Meal & Leftovers</DialogTitle>
            <DialogDescription>
              Mark {recipe.title} as cooked today and optionally add prepped containers to your stash.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFinishCook} className="space-y-4">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={saveStash}
                onChange={(e) => setSaveStash(e.target.checked)}
              />
              Store remaining portions in Fridge / Freezer Stash
            </label>

            {saveStash && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px]">Portions</Label>
                  <Input
                    type="number"
                    min="1"
                    value={stashPortions}
                    onChange={(e) => setStashPortions(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Location</Label>
                  <select
                    value={stashLocation}
                    onChange={(e) =>
                      setStashLocation(e.target.value as "fridge" | "freezer")
                    }
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    <option value="fridge">Fridge</option>
                    <option value="freezer">Freezer</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFinishOpen(false)}>
                Keep Cooking
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Log & Return to Recipe"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
