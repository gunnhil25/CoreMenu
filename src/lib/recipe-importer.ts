import crypto from "crypto";
import type {
  DifficultyLevel,
  MealType,
  RecipeIngredient,
  RecipeStep,
} from "@/lib/types";
import { classifyAisle } from "@/lib/grocery-engine";
import { normalizeUnit, roundClean } from "@/lib/units";

export interface ImportedRecipeDraft {
  title: string;
  description: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  mealType: MealType;
  cuisine: string;
  difficulty: DifficultyLevel;
  prepTimeMin: number;
  cookTimeMin: number;
  servings: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  caloriesPerServing: number | null;
  proteinPerServing: number | null;
  carbsPerServing: number | null;
  fatPerServing: number | null;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const KNOWN_UNITS = new Set([
  "g",
  "gram",
  "grams",
  "kg",
  "kilogram",
  "kilograms",
  "ml",
  "milliliter",
  "milliliters",
  "millilitre",
  "millilitres",
  "l",
  "liter",
  "liters",
  "litre",
  "litres",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tbs",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "fl oz",
  "clove",
  "cloves",
  "can",
  "cans",
  "tin",
  "tins",
  "bunch",
  "bunches",
  "slice",
  "slices",
  "fillet",
  "fillets",
  "breast",
  "breasts",
  "thigh",
  "thighs",
  "egg",
  "eggs",
  "piece",
  "pieces",
  "pc",
  "pcs",
  "pinch",
  "pinches",
  "dash",
  "sprig",
  "sprigs",
  "head",
  "stalk",
  "stalks",
  "jar",
  "pack",
  "packet",
  "packets",
  "bag",
  "bottle",
  "scoop",
  "scoops",
  "sheet",
  "sheets",
  "unit",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

export function validateImportUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Please enter a valid recipe URL (starting with https://).");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be imported.");
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) {
    throw new Error("URL hostname is missing.");
  }

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80") ||
    isPrivateIpv4(host)
  ) {
    throw new Error("Importing from local or private network addresses is blocked.");
  }

  return parsed;
}

export function parseIsoDurationMinutes(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(trimmed);
  if (!match) return 0;
  const days = parseInt(match[1] || "0", 10);
  const hours = parseInt(match[2] || "0", 10);
  const mins = parseInt(match[3] || "0", 10);
  const secs = parseInt(match[4] || "0", 10);
  return days * 1440 + hours * 60 + mins + (secs >= 30 ? 1 : 0);
}

export function extractTimerMinutes(instruction: string): number | null {
  if (!instruction) return null;

  const hrMinMatch = /(\d+)\s*(?:hours?|hrs?)\s*(?:and\s*)?(\d+)?\s*(?:minutes?|mins?)?/i.exec(
    instruction
  );
  if (hrMinMatch) {
    const hrs = parseInt(hrMinMatch[1], 10);
    const mins = hrMinMatch[2] ? parseInt(hrMinMatch[2], 10) : 0;
    const total = hrs * 60 + mins;
    return total > 0 ? total : null;
  }

  const minRangeMatch = /(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:minutes?|mins?|min)\b/i.exec(
    instruction
  );
  if (minRangeMatch) {
    const high = parseInt(minRangeMatch[2], 10);
    return high > 0 ? high : null;
  }

  const singleMinMatch = /(\d+)\s*(?:minutes?|mins?|min)\b/i.exec(instruction);
  if (singleMinMatch) {
    const mins = parseInt(singleMinMatch[1], 10);
    return mins > 0 ? mins : null;
  }

  return null;
}

function parseNumericToken(token: string): number | null {
  let clean = token.trim();
  for (const [glyph, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (clean === glyph) return roundClean(val, 3);
    if (clean.endsWith(glyph)) {
      const lead = parseFloat(clean.slice(0, -1));
      if (!Number.isNaN(lead)) return roundClean(lead + val, 3);
    }
  }
  if (/^\d+\/\d+$/.test(clean)) {
    const [num, den] = clean.split("/").map(Number);
    if (den > 0) return roundClean(num / den, 3);
  }
  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    return parseFloat(clean);
  }
  return null;
}

export function parseIngredientLine(rawLine: string): RecipeIngredient {
  let line = rawLine.trim().replace(/^[-*•]\s*/, "").replace(/\s+/g, " ");
  let quantity: number | null = null;
  let unit = "";
  let prepNote = "";

  // Extract parenthetical prep notes or trailing comma prep notes later
  const tokens = line.split(" ");
  let idx = 0;

  // Handle ranges like "1-2 cups" -> take upper/first number cleanly
  if (tokens[0] && /^\d+(?:\.\d+)?[-–]\d+(?:\.\d+)?$/.test(tokens[0])) {
    const parts = tokens[0].split(/[-–]/).map(Number);
    quantity = parts[1] || parts[0] || null;
    idx = 1;
  } else {
    const first = tokens[0] ? parseNumericToken(tokens[0]) : null;
    if (first !== null) {
      quantity = first;
      idx = 1;
      // Mixed number like "1 1/2"
      const second = tokens[1] ? parseNumericToken(tokens[1]) : null;
      if (second !== null && second < 1) {
        quantity = roundClean(quantity + second, 3);
        idx = 2;
      }
    }
  }

  // Handle "fl oz" two-word unit
  if (
    tokens[idx] &&
    tokens[idx + 1] &&
    `${tokens[idx]} ${tokens[idx + 1]}`.toLowerCase() === "fl oz"
  ) {
    unit = "fl oz";
    idx += 2;
  } else if (tokens[idx]) {
    const candidate = tokens[idx].toLowerCase().replace(/[.,]$/, "");
    if (KNOWN_UNITS.has(candidate)) {
      unit = normalizeUnit(candidate);
      idx += 1;
      if (tokens[idx]?.toLowerCase() === "of") idx += 1;
    }
  }

  let remainder = tokens.slice(idx).join(" ").trim();
  if (!remainder) remainder = line;

  const commaIdx = remainder.indexOf(",");
  if (commaIdx > 1) {
    prepNote = remainder.slice(commaIdx + 1).trim();
    remainder = remainder.slice(0, commaIdx).trim();
  }

  const cleanName = remainder || rawLine.trim();

  return {
    id: crypto.randomUUID(),
    name: cleanName,
    quantity,
    unit: unit || (quantity !== null ? "unit" : ""),
    prepNote: prepNote || undefined,
    aisle: classifyAisle(cleanName),
  };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function isRecipeType(typeVal: unknown): boolean {
  if (typeof typeVal === "string") {
    return typeVal.toLowerCase().includes("recipe");
  }
  if (Array.isArray(typeVal)) {
    return typeVal.some((t) => typeof t === "string" && t.toLowerCase().includes("recipe"));
  }
  return false;
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (isRecipeType(obj["@type"])) {
      return obj;
    }
    if (Array.isArray(obj["@graph"])) {
      const found = findRecipeNode(obj["@graph"]);
      if (found) return found;
    }
  }
  return null;
}

function extractImageUrl(imageVal: unknown): string | null {
  if (!imageVal) return null;
  if (typeof imageVal === "string") return imageVal.trim() || null;
  if (Array.isArray(imageVal)) {
    for (const item of imageVal) {
      const res = extractImageUrl(item);
      if (res) return res;
    }
    return null;
  }
  if (typeof imageVal === "object") {
    const obj = imageVal as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url.trim() || null;
  }
  return null;
}

function extractServings(yieldVal: unknown): number {
  if (typeof yieldVal === "number" && Number.isFinite(yieldVal) && yieldVal > 0) {
    return Math.round(yieldVal);
  }
  const text = Array.isArray(yieldVal) ? String(yieldVal[0] ?? "") : String(yieldVal ?? "");
  const match = /\d+/.exec(text);
  if (match) {
    const parsed = parseInt(match[0], 10);
    if (parsed > 0 && parsed <= 100) return parsed;
  }
  return 4;
}

function extractNutritionNum(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) return roundClean(val, 1);
  if (typeof val !== "string") return null;
  const match = /[\d.]+/.exec(val);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return Number.isNaN(parsed) ? null : roundClean(parsed, 1);
}

function extractSteps(instructions: unknown): RecipeStep[] {
  const steps: RecipeStep[] = [];
  const pushText = (text: string, section?: string) => {
    const clean = decodeHtmlEntities(text);
    if (!clean) return;
    steps.push({
      id: crypto.randomUUID(),
      section: section || undefined,
      instruction: clean,
      timerMinutes: extractTimerMinutes(clean),
    });
  };

  if (typeof instructions === "string") {
    for (const line of instructions.split(/\r?\n+/)) {
      pushText(line);
    }
    return steps;
  }

  if (!Array.isArray(instructions)) return steps;

  for (const item of instructions) {
    if (typeof item === "string") {
      pushText(item);
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const typeStr = String(obj["@type"] ?? "");
      if (typeStr.includes("HowToSection") && Array.isArray(obj.itemListElement)) {
        const secName = typeof obj.name === "string" ? decodeHtmlEntities(obj.name) : undefined;
        for (const sub of obj.itemListElement) {
          if (typeof sub === "string") pushText(sub, secName);
          else if (sub && typeof sub === "object") {
            const subObj = sub as Record<string, unknown>;
            if (typeof subObj.text === "string") pushText(subObj.text, secName);
            else if (typeof subObj.name === "string") pushText(subObj.name, secName);
          }
        }
      } else if (typeof obj.text === "string") {
        pushText(obj.text);
      } else if (typeof obj.name === "string") {
        pushText(obj.name);
      }
    }
  }

  return steps;
}

function inferMealType(categoryVal: unknown): MealType {
  const text = (Array.isArray(categoryVal) ? categoryVal.join(" ") : String(categoryVal ?? "")).toLowerCase();
  if (text.includes("breakfast") || text.includes("brunch")) return "breakfast";
  if (text.includes("lunch") || text.includes("salad") || text.includes("sandwich")) return "lunch";
  if (text.includes("snack")) return "snack";
  if (text.includes("dessert") || text.includes("sweet") || text.includes("cake")) return "dessert";
  if (text.includes("prep")) return "prep";
  return "dinner";
}

export function parseRecipeFromHtml(
  html: string,
  sourceUrl: string | null = null
): ImportedRecipeDraft {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let recipeNode: Record<string, unknown> | null = null;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      recipeNode = findRecipeNode(parsed);
      if (recipeNode) break;
    } catch {
      // Ignore malformed JSON-LD block and continue searching
    }
  }

  if (!recipeNode) {
    throw new Error(
      "No structured schema.org Recipe metadata was found on this page. Try pasting the recipe text into the Plain Text importer instead."
    );
  }

  const title = decodeHtmlEntities(String(recipeNode.name || "Imported Recipe"));
  const description = decodeHtmlEntities(String(recipeNode.description || ""));
  const prepTimeMin = parseIsoDurationMinutes(recipeNode.prepTime);
  const cookTimeMin = parseIsoDurationMinutes(recipeNode.cookTime);
  const totalTimeMin = parseIsoDurationMinutes(recipeNode.totalTime);

  const effectivePrep = prepTimeMin || (totalTimeMin > 0 ? Math.min(20, totalTimeMin) : 15);
  const effectiveCook =
    cookTimeMin || (totalTimeMin > effectivePrep ? totalTimeMin - effectivePrep : 20);

  const rawIngredients = Array.isArray(recipeNode.recipeIngredient)
    ? recipeNode.recipeIngredient
    : [];
  const ingredients = rawIngredients
    .map((x) => decodeHtmlEntities(String(x)))
    .filter(Boolean)
    .map((line) => parseIngredientLine(line));

  const steps = extractSteps(recipeNode.recipeInstructions);

  const nutrition =
    recipeNode.nutrition && typeof recipeNode.nutrition === "object"
      ? (recipeNode.nutrition as Record<string, unknown>)
      : null;

  const caloriesVal = nutrition ? extractNutritionNum(nutrition.calories) : null;
  const rawKeywords = recipeNode.keywords;
  const tags = Array.isArray(rawKeywords)
    ? rawKeywords.map((k) => String(k).trim()).filter(Boolean)
    : typeof rawKeywords === "string"
    ? rawKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  const cuisineRaw = recipeNode.recipeCuisine;
  const cuisine = Array.isArray(cuisineRaw)
    ? String(cuisineRaw[0] ?? "")
    : String(cuisineRaw ?? "");

  return {
    title,
    description,
    imageUrl: extractImageUrl(recipeNode.image),
    sourceUrl,
    mealType: inferMealType(recipeNode.recipeCategory),
    cuisine: decodeHtmlEntities(cuisine),
    difficulty: steps.length > 8 ? "medium" : "easy",
    prepTimeMin: effectivePrep,
    cookTimeMin: effectiveCook,
    servings: extractServings(recipeNode.recipeYield),
    tags: tags.slice(0, 8),
    ingredients,
    steps,
    caloriesPerServing: caloriesVal !== null ? Math.round(caloriesVal) : null,
    proteinPerServing: nutrition ? extractNutritionNum(nutrition.proteinContent) : null,
    carbsPerServing: nutrition ? extractNutritionNum(nutrition.carbohydrateContent) : null,
    fatPerServing: nutrition ? extractNutritionNum(nutrition.fatContent) : null,
  };
}

export function parseRecipeFromPlainText(
  title: string,
  rawIngredients: string,
  rawSteps: string
): ImportedRecipeDraft {
  const ingredients = rawIngredients
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => parseIngredientLine(line));

  const steps = rawSteps
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^\d+[.)]\s*/, ""))
    .filter(Boolean)
    .map((instruction) => ({
      id: crypto.randomUUID(),
      instruction,
      timerMinutes: extractTimerMinutes(instruction),
    }));

  return {
    title: title.trim() || "Untitled Recipe",
    description: "",
    imageUrl: null,
    sourceUrl: null,
    mealType: "dinner",
    cuisine: "",
    difficulty: "easy",
    prepTimeMin: 15,
    cookTimeMin: 20,
    servings: 4,
    tags: [],
    ingredients,
    steps,
    caloriesPerServing: null,
    proteinPerServing: null,
    carbsPerServing: null,
    fatPerServing: null,
  };
}

export async function importRecipeFromUrl(rawUrl: string): Promise<ImportedRecipeDraft> {
  const validated = validateImportUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(validated.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "CoreMenu-RecipeImporter/1.0 (+https://github.com/gunnhil25/CoreMenu)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Website returned HTTP ${res.status}.`);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 3 * 1024 * 1024) {
      throw new Error("Remote page exceeds the 3MB size limit.");
    }

    const html = await res.text();
    if (html.length > 3 * 1024 * 1024) {
      throw new Error("Remote page exceeds the 3MB size limit.");
    }

    return parseRecipeFromHtml(html, validated.toString());
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timed out waiting for recipe site (8s limit).");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
