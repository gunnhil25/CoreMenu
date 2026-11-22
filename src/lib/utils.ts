import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "AUD"
): string {
  if (amount === null || amount === undefined || amount === "") return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return "$0.00";

  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "";
  const d =
    typeof dateString === "string"
      ? /^\d{4}-\d{2}-\d{2}$/.test(dateString)
        ? new Date(`${dateString}T00:00:00`)
        : new Date(dateString)
      : dateString;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const dt = parseIsoDate(iso);
  dt.setDate(dt.getDate() + deltaDays);
  return toIsoDate(dt);
}

export function getWeekStartMonday(refDate: Date | string = new Date()): string {
  const dt =
    typeof refDate === "string"
      ? parseIsoDate(refDate)
      : new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const day = dt.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return toIsoDate(dt);
}

export function getWeekDates(weekStartIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(weekStartIso, i));
}

export function formatDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m";
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180) || "recipe"
  );
}

export function daysUntilIso(targetIso: string | null | undefined, fromIso?: string): number | null {
  if (!targetIso || !/^\d{4}-\d{2}-\d{2}$/.test(targetIso)) return null;
  const base = parseIsoDate(fromIso || toIsoDate(new Date()));
  const target = parseIsoDate(targetIso);
  return Math.round((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}
