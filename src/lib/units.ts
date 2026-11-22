import type { UnitSystem } from "@/lib/types";

const UNIT_ALIASES: Record<string, string> = {
  "": "",
  g: "g",
  gram: "g",
  grams: "g",
  gm: "g",
  gms: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  mg: "mg",
  ml: "ml",
  mls: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  t: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  c: "cup",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  "fl oz": "fl oz",
  floz: "fl oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  tin: "tin",
  tins: "tin",
  bunch: "bunch",
  bunches: "bunch",
  slice: "slice",
  slices: "slice",
  fillet: "fillet",
  fillets: "fillet",
  breast: "breast",
  breasts: "breast",
  thigh: "thigh",
  thighs: "thigh",
  egg: "egg",
  eggs: "egg",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  sprig: "sprig",
  sprigs: "sprig",
  head: "head",
  heads: "head",
  stalk: "stalk",
  stalks: "stalk",
  jar: "jar",
  jars: "jar",
  pack: "pack",
  packs: "pack",
  packet: "pack",
  packets: "pack",
  bag: "bag",
  bags: "bag",
  bottle: "bottle",
  bottles: "bottle",
  scoop: "scoop",
  scoops: "scoop",
  sheet: "sheet",
  sheets: "sheet",
  unit: "unit",
  units: "unit",
  each: "unit",
  whole: "unit",
};

const WEIGHT_IN_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_IN_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  "fl oz": 29.5735,
  cup: 240,
};

const IMPERIAL_UNITS = new Set(["oz", "lb", "fl oz", "cup"]);

export function normalizeUnit(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/\s+/g, " ");
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

export function roundClean(val: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

export function scaleQuantity(
  quantity: number | null | undefined,
  baseServings: number,
  targetServings: number
): number | null {
  if (quantity === null || quantity === undefined || Number.isNaN(quantity)) {
    return null;
  }
  const safeBase = baseServings > 0 ? baseServings : 1;
  const safeTarget = targetServings > 0 ? targetServings : 1;
  return roundClean((quantity * safeTarget) / safeBase, 3);
}

const FRACTION_LABELS: Array<[number, string]> = [
  [0.125, "⅛"],
  [0.25, "¼"],
  [0.333, "⅓"],
  [0.375, "⅜"],
  [0.5, "½"],
  [0.625, "⅝"],
  [0.667, "⅔"],
  [0.75, "¾"],
  [0.875, "⅞"],
];

export function formatQuantity(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "";
  if (num === 0) return "0";

  if (num >= 10) {
    return String(roundClean(num, 1));
  }

  const whole = Math.floor(num);
  const frac = num - whole;

  if (frac < 0.04) {
    return String(whole);
  }
  if (frac > 0.96) {
    return String(whole + 1);
  }

  for (const [target, glyph] of FRACTION_LABELS) {
    if (Math.abs(frac - target) <= 0.025) {
      return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }

  return String(roundClean(num, 2));
}

export function convertIngredientUnit(
  quantity: number | null | undefined,
  rawUnit: string,
  targetSystem: UnitSystem
): { quantity: number | null; unit: string } {
  const unit = normalizeUnit(rawUnit);
  if (quantity === null || quantity === undefined || Number.isNaN(quantity)) {
    return { quantity: null, unit };
  }

  if (targetSystem === "metric") {
    if (unit === "oz" || unit === "lb") {
      const grams = quantity * WEIGHT_IN_GRAMS[unit];
      if (grams >= 1000) {
        return { quantity: roundClean(grams / 1000, 2), unit: "kg" };
      }
      return {
        quantity: grams >= 10 ? Math.round(grams) : roundClean(grams, 1),
        unit: "g",
      };
    }
    if (unit === "cup" || unit === "fl oz") {
      const ml = quantity * VOLUME_IN_ML[unit];
      if (ml >= 1000) {
        return { quantity: roundClean(ml / 1000, 2), unit: "l" };
      }
      return {
        quantity: ml >= 10 ? Math.round(ml / 5) * 5 : roundClean(ml, 1),
        unit: "ml",
      };
    }
    return { quantity: roundClean(quantity, 2), unit };
  }

  // targetSystem === "imperial"
  if (unit === "g" || unit === "kg") {
    const grams = quantity * WEIGHT_IN_GRAMS[unit];
    const oz = grams / WEIGHT_IN_GRAMS.oz;
    if (oz >= 16) {
      return { quantity: roundClean(grams / WEIGHT_IN_GRAMS.lb, 2), unit: "lb" };
    }
    return { quantity: roundClean(oz, 1), unit: "oz" };
  }

  if (unit === "ml" || unit === "l") {
    const ml = quantity * VOLUME_IN_ML[unit];
    if (ml < 15) {
      return { quantity: roundClean(ml / VOLUME_IN_ML.tsp, 2), unit: "tsp" };
    }
    if (ml < 60) {
      return { quantity: roundClean(ml / VOLUME_IN_ML.tbsp, 2), unit: "tbsp" };
    }
    if (ml < 240) {
      return { quantity: roundClean(ml / VOLUME_IN_ML["fl oz"], 1), unit: "fl oz" };
    }
    return { quantity: roundClean(ml / VOLUME_IN_ML.cup, 2), unit: "cup" };
  }

  return { quantity: roundClean(quantity, 2), unit };
}

export function convertInstructionTemperatures(
  text: string,
  targetSystem: UnitSystem
): string {
  if (!text) return text;
  const regex = /(\b\d{2,3}(?:\.\d+)?)\s*(?:°|deg(?:rees?)?\s*)([CF])\b|(\b\d{3})\s*([CF])\b/gi;
  return text.replace(regex, (full, n1, u1, n2, u2) => {
    const numStr = n1 ?? n2;
    const unitRaw = (u1 ?? u2 ?? "").toUpperCase();
    const val = parseFloat(numStr);
    if (Number.isNaN(val)) return full;

    if (targetSystem === "metric" && unitRaw === "F") {
      const c = Math.round(((val - 32) * 5) / 9);
      return `${c}°C`;
    }
    if (targetSystem === "imperial" && unitRaw === "C") {
      const f = Math.round((val * 9) / 5 + 32);
      return `${f}°F`;
    }
    return full;
  });
}

export function mergeQuantities(
  q1: number | null,
  rawU1: string,
  q2: number | null,
  rawU2: string
): { quantity: number | null; unit: string } | null {
  const u1 = normalizeUnit(rawU1);
  const u2 = normalizeUnit(rawU2);

  if (u1 === u2) {
    if (q1 === null && q2 === null) {
      return { quantity: null, unit: u1 };
    }
    const sum = roundClean((q1 ?? 0) + (q2 ?? 0), 2);
    if (u1 === "g" && sum >= 1000) {
      return { quantity: roundClean(sum / 1000, 2), unit: "kg" };
    }
    if (u1 === "ml" && sum >= 1000) {
      return { quantity: roundClean(sum / 1000, 2), unit: "l" };
    }
    return { quantity: sum, unit: u1 };
  }

  // One unit missing -> adopt the present unit
  if (!u1 && u2) {
    return { quantity: roundClean((q1 ?? 0) + (q2 ?? 0), 2), unit: u2 };
  }
  if (u1 && !u2) {
    return { quantity: roundClean((q1 ?? 0) + (q2 ?? 0), 2), unit: u1 };
  }

  // Compatible weight family
  if (u1 in WEIGHT_IN_GRAMS && u2 in WEIGHT_IN_GRAMS) {
    const g1 = (q1 ?? 0) * WEIGHT_IN_GRAMS[u1];
    const g2 = (q2 ?? 0) * WEIGHT_IN_GRAMS[u2];
    const totalG = g1 + g2;
    if (IMPERIAL_UNITS.has(u1) && IMPERIAL_UNITS.has(u2)) {
      const oz = totalG / WEIGHT_IN_GRAMS.oz;
      if (oz >= 16) {
        return { quantity: roundClean(totalG / WEIGHT_IN_GRAMS.lb, 2), unit: "lb" };
      }
      return { quantity: roundClean(oz, 1), unit: "oz" };
    }
    if (totalG >= 1000) {
      return { quantity: roundClean(totalG / 1000, 2), unit: "kg" };
    }
    return { quantity: roundClean(totalG, 1), unit: "g" };
  }

  // Compatible volume family
  if (u1 in VOLUME_IN_ML && u2 in VOLUME_IN_ML) {
    const ml1 = (q1 ?? 0) * VOLUME_IN_ML[u1];
    const ml2 = (q2 ?? 0) * VOLUME_IN_ML[u2];
    const totalMl = ml1 + ml2;

    if (u1 === "tsp" && u2 === "tbsp") {
      return totalMl >= 15
        ? { quantity: roundClean(totalMl / 15, 2), unit: "tbsp" }
        : { quantity: roundClean(totalMl / 5, 2), unit: "tsp" };
    }
    if (u1 === "tbsp" && u2 === "tsp") {
      return { quantity: roundClean(totalMl / 15, 2), unit: "tbsp" };
    }
    if (IMPERIAL_UNITS.has(u1) && IMPERIAL_UNITS.has(u2)) {
      return { quantity: roundClean(totalMl / VOLUME_IN_ML.cup, 2), unit: "cup" };
    }
    if (totalMl >= 1000) {
      return { quantity: roundClean(totalMl / 1000, 2), unit: "l" };
    }
    return { quantity: roundClean(totalMl, 1), unit: "ml" };
  }

  return null;
}
