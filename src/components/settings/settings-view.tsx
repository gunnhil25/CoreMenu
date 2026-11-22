"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Lock,
  Home,
  Users,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  changeMyPasswordAction,
  createUserAdminAction,
  deleteUserAdminAction,
  resetHouseholdDataAction,
  updateMyProfileAction,
  updateUserAdminAction,
} from "@/actions/auth";
import {
  addQuickStapleAction,
  deleteQuickStapleAction,
} from "@/actions/grocery";
import {
  importHouseholdBackupAction,
  updateHouseholdSettingsAction,
} from "@/actions/settings";
import {
  AISLE_CATEGORIES,
  type AisleCategory,
  type HouseholdSettingsRecord,
  type QuickStapleRecord,
  type SafeUser,
  type UnitSystem,
} from "@/lib/types";

interface SettingsViewProps {
  initialUser: SafeUser;
  initialSettings: HouseholdSettingsRecord;
  initialUsers: SafeUser[];
  initialQuickStaples: QuickStapleRecord[];
}

export function SettingsView({
  initialUser,
  initialSettings,
  initialUsers,
  initialQuickStaples,
}: SettingsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  // Profile & Macro state
  const [pName, setPName] = useState(initialUser.name);
  const [pEmail, setPEmail] = useState(initialUser.email);
  const [pUnits, setPUnits] = useState<UnitSystem>(initialUser.preferredUnits);
  const [pCurrency, setPCurrency] = useState(initialUser.currency);
  const [pKcal, setPKcal] = useState(String(initialUser.dailyCalorieGoal));
  const [pProtein, setPProtein] = useState(String(initialUser.dailyProteinGoal));
  const [pCarbs, setPCarbs] = useState(String(initialUser.dailyCarbsGoal));
  const [pFat, setPFat] = useState(String(initialUser.dailyFatGoal));

  // Password state
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

  // Household settings state (admin)
  const [hName, setHName] = useState(initialSettings.householdName);
  const [hCurrency, setHCurrency] = useState(initialSettings.currency);
  const [hBudget, setHBudget] = useState(initialSettings.weeklyGroceryBudget);
  const [hStores, setHStores] = useState(initialSettings.defaultStores.join(", "));

  // Quick staples
  const [staples, setStaples] = useState<QuickStapleRecord[]>(initialQuickStaples);
  const [sName, setSName] = useState("");
  const [sQty, setSQty] = useState("1");
  const [sUnit, setSUnit] = useState("unit");
  const [sAisle, setSAisle] = useState<AisleCategory>("Dairy & Eggs");
  const [sStore, setSStore] = useState("Woolworths");
  const [sCost, setSCost] = useState("4.00");

  // Users admin
  const [users, setUsers] = useState<SafeUser[]>(initialUsers);
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRole, setURole] = useState<"admin" | "user">("user");

  const showMsg = (type: "ok" | "err", text: string) => {
    setBanner({ type, text });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateMyProfileAction({
        name: pName,
        email: pEmail,
        preferredUnits: pUnits,
        currency: pCurrency,
        dailyCalorieGoal: parseInt(pKcal, 10) || 2200,
        dailyProteinGoal: parseInt(pProtein, 10) || 150,
        dailyCarbsGoal: parseInt(pCarbs, 10) || 220,
        dailyFatGoal: parseInt(pFat, 10) || 70,
      });
      if (res.success) {
        showMsg("ok", "Profile & nutrition goals updated.");
        router.refresh();
      } else {
        showMsg("err", res.error || "Failed to update profile.");
      }
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await changeMyPasswordAction({
        currentPassword: curPw,
        newPassword: newPw,
      });
      if (res.success) {
        setCurPw("");
        setNewPw("");
        showMsg("ok", "Password changed successfully.");
      } else {
        showMsg("err", res.error || "Failed to change password.");
      }
    });
  };

  const handleSaveHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateHouseholdSettingsAction({
        householdName: hName,
        currency: hCurrency,
        weeklyGroceryBudget: parseFloat(hBudget) || 220,
        defaultStores: hStores
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (res.success) {
        showMsg("ok", "Household settings saved.");
        router.refresh();
      } else {
        showMsg("err", res.error || "Failed to update household settings.");
      }
    });
  };

  const handleAddStaple = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName.trim()) return;
    startTransition(async () => {
      const res = await addQuickStapleAction({
        name: sName,
        defaultQuantity: parseFloat(sQty) || 1,
        defaultUnit: sUnit,
        aisle: sAisle,
        store: sStore || null,
        estimatedCost: sCost ? parseFloat(sCost) : null,
      });
      if (res.success && res.staple) {
        setStaples((prev) => [...prev, res.staple!]);
        setSName("");
        showMsg("ok", "Quick staple added.");
      }
    });
  };

  const handleDeleteStaple = (id: string) => {
    setStaples((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      await deleteQuickStapleAction(id);
    });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createUserAdminAction({
        name: uName,
        email: uEmail,
        password: uPassword,
        role: uRole,
      });
      if (res.success && res.user) {
        setUsers((prev) => [...prev, res.user!]);
        setUName("");
        setUEmail("");
        setUPassword("");
        showMsg("ok", `Created household member ${res.user.name}.`);
      } else {
        showMsg("err", res.error || "Failed to create user.");
      }
    });
  };

  const handleToggleUserActive = (u: SafeUser) => {
    startTransition(async () => {
      const res = await updateUserAdminAction({
        targetUserId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: !u.isActive,
      });
      if (res.success && res.user) {
        setUsers((prev) => prev.map((x) => (x.id === u.id ? res.user! : x)));
      } else {
        showMsg("err", res.error || "Cannot update user.");
      }
    });
  };

  const handleDeleteUser = (id: string) => {
    startTransition(async () => {
      const res = await deleteUserAdminAction(id);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        showMsg("ok", "User removed.");
      } else {
        showMsg("err", res.error || "Cannot delete user.");
      }
    });
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    startTransition(async () => {
      const res = await importHouseholdBackupAction(text);
      if (res.success) {
        showMsg("ok", `Imported backup with ${res.recipeCount} recipes!`);
        router.refresh();
      } else {
        showMsg("err", res.error || "Invalid backup JSON.");
      }
    });
  };

  const handleReset = (mode: "clean" | "demo") => {
    startTransition(async () => {
      const res = await resetHouseholdDataAction(mode);
      if (res.success) {
        showMsg(
          "ok",
          mode === "demo"
            ? "Loaded fresh demo recipes, meal plan, pantry, and grocery list."
            : "Household workspace reset to clean empty state."
        );
        router.refresh();
      } else {
        showMsg("err", res.error || "Reset failed.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Settings & Household
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage your profile, daily macro goals, household stores, quick staples, user accounts, and JSON/Markdown backups.
        </p>
      </div>

      {banner && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            banner.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {banner.type === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile">
            <User className="h-3.5 w-3.5 mr-1.5" />
            Profile & Macros
          </TabsTrigger>
          <TabsTrigger value="household">
            <Home className="h-3.5 w-3.5 mr-1.5" />
            Household & Staples
          </TabsTrigger>
          {initialUser.role === "admin" && (
            <TabsTrigger value="users">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Users ({users.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="data">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Backups & Export
          </TabsTrigger>
        </TabsList>

        {/* PROFILE & MACROS */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile & Daily Nutrition Goals</CardTitle>
              <CardDescription>
                Customize your default unit system and daily calorie/macro targets used on the Dashboard and Planner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-name">Display Name</Label>
                    <Input
                      id="prof-name"
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-email">Email</Label>
                    <Input
                      id="prof-email"
                      type="email"
                      value={pEmail}
                      onChange={(e) => setPEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-units">Preferred Units</Label>
                    <select
                      id="prof-units"
                      value={pUnits}
                      onChange={(e) => setPUnits(e.target.value as UnitSystem)}
                      className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                    >
                      <option value="metric">Metric (g / ml / °C)</option>
                      <option value="imperial">Imperial (oz / cup / °F)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-currency">Currency</Label>
                    <Input
                      id="prof-currency"
                      maxLength={3}
                      value={pCurrency}
                      onChange={(e) => setPCurrency(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="goal-kcal">Daily Calories (kcal)</Label>
                    <Input
                      id="goal-kcal"
                      type="number"
                      min="800"
                      value={pKcal}
                      onChange={(e) => setPKcal(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="goal-protein">Protein Goal (g)</Label>
                    <Input
                      id="goal-protein"
                      type="number"
                      min="20"
                      value={pProtein}
                      onChange={(e) => setPProtein(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="goal-carbs">Carbs Goal (g)</Label>
                    <Input
                      id="goal-carbs"
                      type="number"
                      min="20"
                      value={pCarbs}
                      onChange={(e) => setPCarbs(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="goal-fat">Fat Goal (g)</Label>
                    <Input
                      id="goal-fat"
                      type="number"
                      min="10"
                      value={pFat}
                      onChange={(e) => setPFat(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isPending}>
                  Save Profile & Goals
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleChangePassword}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="cur-pw">Current Password</Label>
                  <Input
                    id="cur-pw"
                    type="password"
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">New Password (min 8 chars)</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    minLength={8}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" variant="outline" disabled={isPending}>
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOUSEHOLD & QUICK STAPLES */}
        <TabsContent value="household" className="space-y-6">
          {initialUser.role === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Household Kitchen Settings</CardTitle>
                <CardDescription>
                  Shared name, weekly grocery budget target, and preferred supermarket tags.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveHousehold} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="hh-name">Household Name</Label>
                      <Input
                        id="hh-name"
                        value={hName}
                        onChange={(e) => setHName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hh-currency">Currency</Label>
                      <Input
                        id="hh-currency"
                        maxLength={3}
                        value={hCurrency}
                        onChange={(e) => setHCurrency(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hh-budget">Weekly Grocery Budget</Label>
                      <Input
                        id="hh-budget"
                        type="number"
                        step="5"
                        min="0"
                        value={hBudget}
                        onChange={(e) => setHBudget(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hh-stores">Supermarkets / Stores (comma separated)</Label>
                    <Input
                      id="hh-stores"
                      value={hStores}
                      onChange={(e) => setHStores(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isPending}>
                    Save Household Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Staples Manager</CardTitle>
              <CardDescription>
                Recurring non-recipe items (milk, coffee, foil) that can be added to any grocery list with one tap.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={handleAddStaple}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
              >
                <div className="md:col-span-3 space-y-1">
                  <Label className="text-[10px]">Staple Name</Label>
                  <Input
                    placeholder="Sparkling water"
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-[10px]">Qty</Label>
                  <Input value={sQty} onChange={(e) => setSQty(e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Unit</Label>
                  <Input value={sUnit} onChange={(e) => setSUnit(e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Aisle</Label>
                  <select
                    value={sAisle}
                    onChange={(e) => setSAisle(e.target.value as AisleCategory)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    {AISLE_CATEGORIES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px]">Store</Label>
                  <Input value={sStore} onChange={(e) => setSStore(e.target.value)} />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label className="text-[10px]">Est $</Label>
                  <Input value={sCost} onChange={(e) => setSCost(e.target.value)} />
                </div>
                <div className="md:col-span-1">
                  <Button type="submit" disabled={isPending} className="w-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {staples.map((st) => (
                  <div
                    key={st.id}
                    className="p-2.5 rounded-lg border flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold">{st.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {st.defaultQuantity} {st.defaultUnit} • {st.aisle}
                        {st.store ? ` • ${st.store}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStaple(st.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete staple ${st.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADMIN USER MANAGEMENT */}
        {initialUser.role === "admin" && (
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Add Household Member
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleCreateUser}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
                >
                  <div className="space-y-1">
                    <Label className="text-[10px]">Name</Label>
                    <Input
                      placeholder="Partner Name"
                      value={uName}
                      onChange={(e) => setUName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Email</Label>
                    <Input
                      type="email"
                      placeholder="partner@household.local"
                      value={uEmail}
                      onChange={(e) => setUEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Password (min 8)</Label>
                    <Input
                      type="password"
                      minLength={8}
                      value={uPassword}
                      onChange={(e) => setUPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Role</Label>
                    <select
                      value={uRole}
                      onChange={(e) => setURole(e.target.value as "admin" | "user")}
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
                    >
                      <option value="user">Member (User)</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={isPending}>
                    Create Member
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Household Accounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{u.name}</span>
                        <Badge
                          variant={u.role === "admin" ? "info" : "outline"}
                          className="uppercase text-[9px]"
                        >
                          {u.role}
                        </Badge>
                        {!u.isActive && (
                          <Badge variant="destructive" className="text-[9px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleUserActive(u)}
                        disabled={u.id === initialUser.id}
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={u.id === initialUser.id}
                        className="text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* BACKUPS & DATA OWNERSHIP */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export & Backup Ownership</CardTitle>
              <CardDescription>
                Download your entire CoreMenu household database as JSON or portable Markdown recipes anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <a href="/api/export/json">
                  <Download className="h-4 w-4 mr-2" />
                  Export Full JSON Backup
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/api/export/markdown">
                  <Download className="h-4 w-4 mr-2" />
                  Export Cookbook (.md)
                </a>
              </Button>
            </CardContent>
          </Card>

          {initialUser.role === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Restore or Reset Kitchen</CardTitle>
                <CardDescription>
                  Restore from a `coremenu-v1` JSON backup or switch between Demo Recipes and a Clean slate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="block mb-2">Import JSON Backup</Label>
                  <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed px-4 text-xs font-semibold cursor-pointer hover:bg-muted/40">
                    <Upload className="h-4 w-4" />
                    Choose coremenu-backup.json
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={handleImportJson}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="pt-3 border-t flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleReset("demo")}
                    disabled={isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Reload Demo Recipes & Plan
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleReset("clean")}
                    disabled={isPending}
                  >
                    Reset to Clean Empty Kitchen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
