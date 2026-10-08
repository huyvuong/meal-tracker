import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateItemNutrition, summarizeMealNutrition } from "./nutrition";

const apple = {
  quantity: "2.000",
  caloriesPerUnitSnapshot: "95.00",
  proteinGPerUnitSnapshot: "0.50",
  carbsGPerUnitSnapshot: "25.00",
  fatGPerUnitSnapshot: "0.30",
};

test("two 95-calorie units calculate 190 calories and consumed macros", () => {
  assert.deepEqual(calculateItemNutrition(apple), {
    calories: "190", proteinG: "1", carbsG: "50", fatG: "0.6",
  });
});

test("fractional quantities preserve exact decimal results without rounding", () => {
  assert.equal(calculateItemNutrition({ ...apple, quantity: "0.125" }).calories, "11.875");
  assert.equal(calculateItemNutrition({
    ...apple, quantity: "0.333", caloriesPerUnitSnapshot: "0.01",
  }).calories, "0.00333");
  assert.equal(summarizeMealNutrition([
    { ...apple, quantity: "1", caloriesPerUnitSnapshot: "0.10" },
    { ...apple, quantity: "1", caloriesPerUnitSnapshot: "0.20" },
  ]).calories, "0.3");
});

test("large products remain exact beyond JavaScript's safe integer range", () => {
  assert.equal(calculateItemNutrition({
    ...apple, quantity: "9999999.999", caloriesPerUnitSnapshot: "99999999.99",
  }).calories, "999999999800000.00001");
});

test("unknown values propagate per nutrient and flag incomplete meals", () => {
  const unknown = { ...apple, caloriesPerUnitSnapshot: null, proteinGPerUnitSnapshot: null };
  assert.equal(calculateItemNutrition(unknown).calories, null);
  assert.deepEqual(summarizeMealNutrition([apple, unknown]), {
    calories: null, proteinG: null, carbsG: "100", fatG: "1.2", isComplete: false,
  });
  assert.equal(summarizeMealNutrition([apple]).isComplete, true);
  assert.equal(calculateItemNutrition({ ...apple, caloriesPerUnitSnapshot: "0.00" }).calories, "0");
});

test("reject invalid inputs rather than silently approximating", () => {
  for (const quantity of ["0", "-1", "NaN", "1e3", "0.0001"]) {
    assert.throws(() => calculateItemNutrition({ ...apple, quantity }));
  }
  for (const caloriesPerUnitSnapshot of ["-1", "NaN", "Infinity", "0.001"]) {
    assert.throws(() => calculateItemNutrition({ ...apple, caloriesPerUnitSnapshot }));
  }
});
