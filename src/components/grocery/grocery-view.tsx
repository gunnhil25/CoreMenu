"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  Download,
  Check,
  Store,
  Layers,
  EyeOff,
  Eye,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addGroceryItemAction,
  addQuickStapleToListAction,
  clearCheckedItemsAction,
  completeGroceryListAction,
  createGroceryListAction,
  deleteGroceryItemAction,
  deleteGroceryListAction,
  getGroceryWorkspaceAction,
  toggleGroceryItemAction,
} from "@/actions/grocery";
import { formatGroceryListAsText } from "@/lib/grocery-engine";
import { formatQuantity } from "@/lib/units";
import { formatCurrency } from "@/lib/utils";
import {
  AISLE_CATEGORIES,
  type AisleCategory,
  type GroceryItemRecord,
  type GroceryListRecord,
  type HouseholdSettingsRecord,
  type QuickStapleRecord,
} from "@/lib/types";

interface GroceryViewProps {
  initialLists: GroceryListRecord[];
  initialActiveList: GroceryListRecord | null;
  initialItems: GroceryItemRecord[];
  quickStaples: QuickStapleRecord[];
  settings: HouseholdSettingsRecord;
}

export function GroceryView({
  initialLists,
  initialActiveList,
  initialItems,
  quickStaples,
  settings,
}: GroceryViewProps) {
  const [isPending, startTransition] = useTransition();
  const [lists, setLists] = useState<GroceryListRecord[]>(initialLists);
  const [activeList, setActiveList] = useState<GroceryListRecord | null>(
    initialActiveList
  );
  const [items, setItems] = useState<GroceryItemRecord[]>(initialItems);

  const [groupBy, setGroupBy] = useState<"aisle" | "store">("aisle");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [hideChecked, setHideChecked] = useState(false);
  const [copiedBanner, setCopiedBanner] = useState(false);

  // Add manual item state
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newUnit, setNewUnit] = useState("unit");
  const [newAisle, setNewAisle] = useState<AisleCategory>("Produce");
  const [newStore, setNewStore] = useState("");
  const [newCost, setNewCost] = useState("");

  // New list modal
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Complete shop modal
  const [completeOpen, setCompleteOpen] = useState(false);
  const [actualTotal, setActualTotal] = useState(
    initialActiveList?.estimatedTotal ?? "0.00"
  );
  const [restockPantry, setRestockPantry] = useState(true);

  // Persist offline snapshot of active grocery list for weak-signal supermarket use
  useEffect(() => {
    if (!activeList) return;
    try {
      window.localStorage.setItem(
        `coremenu-grocery-cache-${activeList.id}`,
        JSON.stringify({ list: activeList, items })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [activeList, items]);

  const switchList = (listId: string) => {
    startTransition(async () => {
      const ws = await getGroceryWorkspaceAction(listId);
      setLists(ws.lists);
      setActiveList(ws.activeList);
      setItems(ws.items);
      if (ws.activeList) {
        setActualTotal(ws.activeList.actualTotal ?? ws.activeList.estimatedTotal);
      }
    });
  };

  const handleToggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isChecked: !item.isChecked } : item
      )
    );
    startTransition(async () => {
      const res = await toggleGroceryItemAction(id);
      if (res.success && res.item) {
        setItems((prev) => prev.map((i) => (i.id === id ? res.item! : i)));
      }
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !newName.trim()) return;
    startTransition(async () => {
      const res = await addGroceryItemAction({
        listId: activeList.id,
        name: newName,
        quantity: newQty ? parseFloat(newQty) : null,
        unit: newUnit,
        aisle: newAisle,
        store: newStore || null,
        estimatedCost: newCost ? parseFloat(newCost) : null,
      });
      if (res.success && res.item) {
        setItems((prev) => [...prev, res.item!]);
        const ws = await getGroceryWorkspaceAction(activeList.id);
        setActiveList(ws.activeList);
        setLists(ws.lists);
        setNewName("");
        setNewCost("");
      }
    });
  };

  const handleAddQuickStaple = (stapleId: string) => {
    if (!activeList) return;
    startTransition(async () => {
      const res = await addQuickStapleToListAction({
        listId: activeList.id,
        stapleId,
      });
      if (res.success && res.item) {
        setItems((prev) => [...prev, res.item!]);
        const ws = await getGroceryWorkspaceAction(activeList.id);
        setActiveList(ws.activeList);
        setLists(ws.lists);
      }
    });
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await deleteGroceryItemAction(id);
      if (activeList) {
        const ws = await getGroceryWorkspaceAction(activeList.id);
        setActiveList(ws.activeList);
        setLists(ws.lists);
      }
    });
  };

  const handleClearChecked = () => {
    if (!activeList) return;
    setItems((prev) => prev.filter((i) => !i.isChecked));
    startTransition(async () => {
      await clearCheckedItemsAction(activeList.id);
      const ws = await getGroceryWorkspaceAction(activeList.id);
      setActiveList(ws.activeList);
      setLists(ws.lists);
    });
  };

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createGroceryListAction({ name: newListName });
      if (res.success && res.list) {
        setNewListOpen(false);
        setNewListName("");
        const ws = await getGroceryWorkspaceAction(res.list.id);
        setLists(ws.lists);
        setActiveList(ws.activeList);
        setItems(ws.items);
      }
    });
  };

  const handleCompleteShop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList) return;
    startTransition(async () => {
      const res = await completeGroceryListAction({
        listId: activeList.id,
        actualTotal: actualTotal ? parseFloat(actualTotal) : null,
        restockCheckedToPantry: restockPantry,
      });
      if (res.success) {
        setCompleteOpen(false);
        const ws = await getGroceryWorkspaceAction(activeList.id);
        setLists(ws.lists);
        setActiveList(ws.activeList);
      }
    });
  };

  const handleDeleteList = () => {
    if (!activeList) return;
    startTransition(async () => {
      await deleteGroceryListAction(activeList.id);
      const ws = await getGroceryWorkspaceAction();
      setLists(ws.lists);
      setActiveList(ws.activeList);
      setItems(ws.items);
    });
  };

  const handleCopyChecklist = async () => {
    if (!activeList) return;
    const text = formatGroceryListAsText(activeList, items);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBanner(true);
      setTimeout(() => setCopiedBanner(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (hideChecked && item.isChecked) return false;
      if (storeFilter !== "all" && (item.store || "Unassigned") !== storeFilter) {
        return false;
      }
      return true;
    });
  }, [items, hideChecked, storeFilter]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, GroceryItemRecord[]>();
    for (const item of filteredItems) {
      const key = groupBy === "aisle" ? item.aisle : item.store || "Any Store";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filteredItems, groupBy]);

  const checkedCount = items.filter((i) => i.isChecked).length;
  const estTotal = activeList ? parseFloat(activeList.estimatedTotal) || 0 : 0;
  const weeklyBudget = parseFloat(settings.weeklyGroceryBudget) || 220;
  const budgetPct = weeklyBudget > 0 ? Math.min(100, Math.round((estTotal / weeklyBudget) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Smart Grocery Lists
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Merged ingredients from your meal plan, grouped by aisle or store, with CoreCapital/CoreNest CSV export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/planner">Generate from Planner</Link>
          </Button>
          <Button size="sm" onClick={() => setNewListOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New List
          </Button>
        </div>
      </div>

      {/* List Switcher & Budget Bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Label htmlFor="grocery-list-select" className="shrink-0">
                Active List
              </Label>
              <select
                id="grocery-list-select"
                value={activeList?.id ?? ""}
                onChange={(e) => switchList(e.target.value)}
                className="h-9 flex-1 max-w-sm rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {lists.length === 0 && <option value="">No grocery lists yet</option>}
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.status.toUpperCase()})
                  </option>
                ))}
              </select>
              {activeList && (
                <Badge
                  variant={activeList.status === "completed" ? "success" : "info"}
                  className="uppercase text-[10px]"
                >
                  {activeList.status}
                </Badge>
              )}
            </div>

            {activeList && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyChecklist}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  {copiedBanner ? "Copied!" : "Copy Checklist"}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/export/grocery/${activeList.id}?format=csv`}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export CSV
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setActualTotal(activeList.actualTotal ?? activeList.estimatedTotal);
                    setCompleteOpen(true);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                  Complete Shop
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDeleteList}
                  title="Delete list"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {activeList && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t items-center">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>
                    Estimated Basket:{" "}
                    <strong className="font-mono">
                      {formatCurrency(estTotal, settings.currency)}
                    </strong>
                    {activeList.actualTotal && (
                      <span className="ml-2 text-emerald-500 font-mono">
                        (Actual: {formatCurrency(activeList.actualTotal, settings.currency)})
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    Budget: {formatCurrency(weeklyBudget, settings.currency)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      estTotal > weeklyBudget ? "bg-destructive" : "bg-emerald-500"
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {checkedCount} / {items.length} checked
                </span>
                {checkedCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleClearChecked}
                    disabled={isPending}
                    className="h-7 text-xs"
                  >
                    Clear Checked
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!activeList ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <h3 className="font-semibold text-base">No grocery lists yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Generate a merged shopping list from your Meal Planner or create a blank list to add items manually.
            </p>
            <div className="flex justify-center gap-2">
              <Button size="sm" asChild>
                <Link href="/planner">Go to Meal Planner</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNewListOpen(true)}>
                New Blank List
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quick Staples Bar */}
          {quickStaples.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  1-Tap Quick Staples
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 flex flex-wrap gap-2">
                {quickStaples.map((st) => (
                  <Button
                    key={st.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddQuickStaple(st.id)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                    {st.name}
                    {st.store && (
                      <span className="text-[10px] text-muted-foreground">
                        @{st.store}
                      </span>
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* View Controls & Add Item Form */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={groupBy === "aisle" ? "default" : "outline"}
                    onClick={() => setGroupBy("aisle")}
                  >
                    <Layers className="h-3.5 w-3.5 mr-1.5" />
                    Group by Aisle
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={groupBy === "store" ? "default" : "outline"}
                    onClick={() => setGroupBy("store")}
                  >
                    <Store className="h-3.5 w-3.5 mr-1.5" />
                    Group by Store
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={hideChecked ? "secondary" : "outline"}
                    onClick={() => setHideChecked((v) => !v)}
                  >
                    {hideChecked ? (
                      <>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Show Checked
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 mr-1.5" /> Hide Checked
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStoreFilter("all")}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      storeFilter === "all"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Stores
                  </button>
                  {settings.defaultStores.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStoreFilter(s)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        storeFilter === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Item Inline Form */}
              <form
                onSubmit={handleAddItem}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-3 border-t items-end"
              >
                <div className="md:col-span-4 space-y-1">
                  <Label htmlFor="add-gi-name" className="text-[10px]">
                    Add Item
                  </Label>
                  <Input
                    id="add-gi-name"
                    placeholder="e.g. Greek yoghurt, paper towel..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label htmlFor="add-gi-qty" className="text-[10px]">
                    Qty
                  </Label>
                  <Input
                    id="add-gi-qty"
                    type="number"
                    step="any"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label htmlFor="add-gi-unit" className="text-[10px]">
                    Unit
                  </Label>
                  <Input
                    id="add-gi-unit"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="add-gi-aisle" className="text-[10px]">
                    Aisle
                  </Label>
                  <select
                    id="add-gi-aisle"
                    value={newAisle}
                    onChange={(e) => setNewAisle(e.target.value as AisleCategory)}
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
                  <Label htmlFor="add-gi-store" className="text-[10px]">
                    Store / Cost
                  </Label>
                  <div className="flex gap-1">
                    <select
                      id="add-gi-store"
                      value={newStore}
                      onChange={(e) => setNewStore(e.target.value)}
                      className="h-9 flex-1 rounded-lg border border-input bg-background px-1.5 text-xs min-w-0"
                    >
                      <option value="">Any</option>
                      {settings.defaultStores.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="$"
                      className="w-16 px-2"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={isPending} className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Grouped Shopping Rows */}
          {groupedItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No items match the current filters.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groupedItems.map(([groupName, groupItems]) => (
                <Card key={groupName}>
                  <CardHeader className="p-4 pb-2 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold">{groupName}</CardTitle>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {groupItems.filter((i) => i.isChecked).length}/{groupItems.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    {groupItems.map((item) => {
                      const qtyText = [formatQuantity(item.quantity), item.unit]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                            item.isChecked
                              ? "bg-muted/35 opacity-60"
                              : "bg-background/60 hover:bg-muted/30"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleItem(item.id)}
                            className="flex items-start gap-3 flex-1 text-left min-w-0"
                          >
                            <span
                              className={`h-6 w-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                item.isChecked
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-input bg-background"
                              }`}
                            >
                              {item.isChecked && <Check className="h-4 w-4" />}
                            </span>
                            <div className="min-w-0 space-y-0.5">
                              <p
                                className={`text-sm font-medium ${
                                  item.isChecked ? "line-through" : ""
                                }`}
                              >
                                {qtyText && (
                                  <span className="font-mono font-bold text-primary mr-1.5">
                                    {qtyText}
                                  </span>
                                )}
                                {item.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.store && (
                                  <Badge variant="secondary" className="text-[9px] py-0">
                                    {item.store}
                                  </Badge>
                                )}
                                {item.inPantryFlag !== "none" && (
                                  <Badge
                                    variant={
                                      item.inPantryFlag === "stocked" ? "success" : "warning"
                                    }
                                    className="text-[9px] py-0"
                                  >
                                    {item.pantryNote || "In Pantry"}
                                  </Badge>
                                )}
                                {item.sourceRecipes.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                                    For: {item.sourceRecipes.join(", ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.estimatedCost && (
                              <span className="text-xs font-mono text-muted-foreground">
                                {formatCurrency(item.estimatedCost, settings.currency)}
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={`Delete ${item.name}`}
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* New Blank List Dialog */}
      <Dialog open={newListOpen} onOpenChange={setNewListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Grocery List</DialogTitle>
            <DialogDescription>
              Start an ad-hoc shopping list for top-up runs or events.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateList} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-list-name">List Name</Label>
              <Input
                id="new-list-name"
                placeholder="Midweek Fresh Top-Up"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewListOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Create List
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete Shop Dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Grocery Shop</DialogTitle>
            <DialogDescription>
              Record your final receipt spend (useful for CoreCapital / CoreNest tracking) and optionally restock checked items into your Pantry.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCompleteShop} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="actual-spend">Actual Receipt Total ({settings.currency})</Label>
              <Input
                id="actual-spend"
                type="number"
                step="0.01"
                min="0"
                value={actualTotal}
                onChange={(e) => setActualTotal(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={restockPantry}
                onChange={(e) => setRestockPantry(e.target.checked)}
              />
              Add checked items automatically into Pantry / Fridge inventory
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCompleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Mark Shop Completed"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
