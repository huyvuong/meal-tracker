import type { MealItem } from "./schema";

type NutritionItem = Pick<
  MealItem,
  | "quantity"
  | "caloriesPerUnitSnapshot"
  | "proteinGPerUnitSnapshot"
  | "carbsGPerUnitSnapshot"
  | "fatGPerUnitSnapshot"
>;

export type Nutrition = {
  calories: string | null;
  proteinG: string | null;
  carbsG: string | null;
  fatG: string | null;
};

// Quantities have three decimal places; per-unit nutrition has two.
// Multiply scaled integers to preserve all five resulting decimal places.
function scaledInteger(value: string, scale: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error("Expected a nonnegative decimal string");
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > scale) {
    throw new Error(`Expected at most ${scale} decimal places`);
  }
  return BigInt(whole + fraction.padEnd(scale, "0"));
}

function formatNutrition(value: bigint): string {
  const digits = value.toString().padStart(6, "0");
  const whole = digits.slice(0, -5);
  const fraction = digits.slice(-5).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function calculateItemNutrition(item: NutritionItem): Nutrition {
  const quantity = scaledInteger(item.quantity, 3);
  if (quantity === BigInt(0)) {
    throw new Error("Quantity must be positive");
  }
  const consumed = (perUnit: string | null) =>
    perUnit === null ? null : formatNutrition(quantity * scaledInteger(perUnit, 2));

  return {
    calories: consumed(item.caloriesPerUnitSnapshot),
    proteinG: consumed(item.proteinGPerUnitSnapshot),
    carbsG: consumed(item.carbsGPerUnitSnapshot),
    fatG: consumed(item.fatGPerUnitSnapshot),
  };
}

// A total is unknown if any item lacks that nutrient. Known zero stays zero.
export function summarizeMealNutrition(
  items: readonly NutritionItem[],
): Nutrition & { isComplete: boolean } {
  const consumed = items.map(calculateItemNutrition);
  const total = (key: keyof Nutrition): string | null => {
    let sum = BigInt(0);
    for (const item of consumed) {
      const value = item[key];
      if (value === null) return null;
      sum += scaledInteger(value, 5);
    }
    return formatNutrition(sum);
  };
  const nutrition = {
    calories: total("calories"),
    proteinG: total("proteinG"),
    carbsG: total("carbsG"),
    fatG: total("fatG"),
  };
  return {
    ...nutrition,
    isComplete: Object.values(nutrition).every((value) => value !== null),
  };
}
