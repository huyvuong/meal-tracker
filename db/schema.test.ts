import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { calculateItemNutrition, summarizeMealNutrition } from "./nutrition";
import { foods, mealItems, meals, relations, type Food, type NewMealItem } from "./schema";

const postgres = new PGlite();
const db = drizzle({ client: postgres, relations });
const eatenAt = new Date("2026-10-07T12:30:00-07:00");

before(async () => {
  // Apply the actual versioned SQL, rather than recreating tables from the schema.
  await migrate(db, { migrationsFolder: "./drizzle" });
});
beforeEach(async () => {
  await db.execute(sql`truncate meal_items, meals, foods`);
});
after(async () => { await postgres.close(); });

async function createMeal(userId = "user_a") {
  const [meal] = await db.insert(meals).values({ userId, mealType: "lunch", eatenAt }).returning();
  return meal;
}

async function createFood(name = "Apple", userId = "user_a") {
  const [food] = await db.insert(foods).values({
    userId, name, caloriesPerUnit: "95", proteinGPerUnit: "0.5",
    carbsGPerUnit: "25", fatGPerUnit: "0.3",
  }).returning();
  return food;
}

// Future authenticated write operations must copy every snapshot in the same way.
function itemValues(mealId: string, food: Food, quantity?: string): NewMealItem {
  return {
    userId: food.userId, mealId, foodId: food.id, quantity,
    foodNameSnapshot: food.name,
    caloriesPerUnitSnapshot: food.caloriesPerUnit,
    proteinGPerUnitSnapshot: food.proteinGPerUnit,
    carbsGPerUnitSnapshot: food.carbsGPerUnit,
    fatGPerUnitSnapshot: food.fatGPerUnit,
  };
}

function hasPgCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  return ("code" in error && error.code === code)
    || ("cause" in error && hasPgCode(error.cause, code));
}

test("generated UUID/timestamp/defaults, multiple foods, and all relation directions", async () => {
  const meal = await createMeal();
  const apple = await createFood();
  const pear = await createFood("Pear");
  const items = await db.insert(mealItems).values([
    itemValues(meal.id, apple, "2"), itemValues(meal.id, pear),
  ]).returning();
  assert.equal(items.length, 2);
  assert.equal(items[1].quantity, "1.000");
  assert.equal(apple.isArchived, false);
  assert.equal(apple.caloriesPerUnit, "95.00");
  for (const row of [meal, apple, ...items]) {
    assert.match(row.id, /^[0-9a-f-]{36}$/);
    assert.ok(row.createdAt instanceof Date);
  }
  assert.equal(meal.eatenAt.toISOString(), "2026-10-07T19:30:00.000Z");
  const logged = await db.query.meals.findFirst({
    where: { id: meal.id, userId: "user_a" }, with: { items: { with: { food: true, meal: true } } },
  });
  assert.equal(logged?.items.length, 2);
  const loggedApple = logged?.items.find((item) => item.foodId === apple.id);
  assert.ok(loggedApple);
  assert.equal(loggedApple.food.name, "Apple");
  assert.equal(loggedApple.quantity, "2.000");
  assert.equal(loggedApple.caloriesPerUnitSnapshot, "95.00");
  assert.equal(calculateItemNutrition(loggedApple).calories, "190");
  assert.ok(logged?.items.every((item) => item.meal.id === meal.id));
  const catalog = await db.query.foods.findFirst({ where: { id: apple.id }, with: { mealItems: true } });
  assert.equal(catalog?.mealItems.length, 1);
  assert.equal(await db.query.meals.findFirst({ where: { id: meal.id, userId: "user_b" } }), undefined);
  assert.equal(calculateItemNutrition(items[0]).calories, "190");
  await assert.rejects(db.insert(mealItems).values(itemValues(meal.id, apple)),
    (error) => hasPgCode(error, "23505"));
  // The same food may appear in a different meal.
  const secondMeal = await createMeal();
  await db.insert(mealItems).values(itemValues(secondMeal.id, apple));
});

test("catalog names are case/space insensitive per user, including archived foods", async () => {
  const food = await createFood();
  await assert.rejects(db.insert(foods).values({ userId: "user_a", name: "  aPPle  " }),
    (error) => hasPgCode(error, "23505"));
  await db.update(foods).set({ isArchived: true }).where(eq(foods.id, food.id));
  await assert.rejects(db.insert(foods).values({ userId: "user_a", name: "apple" }),
    (error) => hasPgCode(error, "23505"));
  await createFood("Apple", "user_b");
  const pear = await createFood("Pear");
  await assert.rejects(db.update(foods).set({ name: " apple " }).where(eq(foods.id, pear.id)),
    (error) => hasPgCode(error, "23505"));
});

test("composite foreign keys reject both forms of ownership mismatch and reassignment", async () => {
  const mealA = await createMeal();
  const mealB = await createMeal("user_b");
  const foodA = await createFood();
  const foodB = await createFood("Pear", "user_b");
  await assert.rejects(db.insert(mealItems).values(itemValues(mealB.id, foodA)),
    (error) => hasPgCode(error, "23503"));
  await assert.rejects(db.insert(mealItems).values({ ...itemValues(mealA.id, foodB), userId: "user_a" }),
    (error) => hasPgCode(error, "23503"));
  const [item] = await db.insert(mealItems).values(itemValues(mealA.id, foodA)).returning();
  await assert.rejects(db.update(mealItems).set({ userId: "user_b" }).where(eq(mealItems.id, item.id)),
    (error) => hasPgCode(error, "23503"));
  await assert.rejects(db.update(meals).set({ userId: "user_b" }).where(eq(meals.id, mealA.id)),
    (error) => hasPgCode(error, "23503"));
  await assert.rejects(db.update(foods).set({ userId: "user_b" }).where(eq(foods.id, foodA.id)),
    (error) => hasPgCode(error, "23503"));
});

test("catalog edits preserve every snapshot, referenced food deletion is restricted, meal deletion cascades", async () => {
  const meal = await createMeal();
  const food = await createFood();
  const [original] = await db.insert(mealItems).values(itemValues(meal.id, food, "2")).returning();
  await db.update(foods).set({
    name: "Edited apple", caloriesPerUnit: "100", proteinGPerUnit: null,
    carbsGPerUnit: "30", fatGPerUnit: "1", isArchived: true,
  }).where(eq(foods.id, food.id));
  const [historical] = await db.select().from(mealItems).where(eq(mealItems.id, original.id));
  assert.deepEqual(historical, original);
  assert.equal(calculateItemNutrition(historical).calories, "190");
  await assert.rejects(db.delete(foods).where(eq(foods.id, food.id)),
    (error) => hasPgCode(error, "23001"));
  await db.delete(meals).where(eq(meals.id, meal.id));
  assert.equal((await db.select().from(mealItems)).length, 0);
  assert.equal((await db.select().from(foods)).length, 1);
  await db.delete(foods).where(eq(foods.id, food.id));
});

test("fractional quantities and nullable nutrition retain exact strings and incomplete summaries", async () => {
  const meal = await createMeal();
  const food = await createFood();
  const [known] = await db.insert(mealItems).values(itemValues(meal.id, food, "0.125")).returning();
  assert.equal(known.quantity, "0.125");
  assert.equal(calculateItemNutrition(known).calories, "11.875");
  const [unknownFood] = await db.insert(foods).values({ name: "Unknown", userId: "user_a" }).returning();
  assert.equal(unknownFood.caloriesPerUnit, null);
  assert.equal(unknownFood.proteinGPerUnit, null);
  assert.equal(unknownFood.carbsGPerUnit, null);
  assert.equal(unknownFood.fatGPerUnit, null);
  const [unknown] = await db.insert(mealItems).values({
    userId: "user_a", mealId: meal.id, foodId: unknownFood.id, foodNameSnapshot: unknownFood.name,
  }).returning();
  assert.deepEqual(calculateItemNutrition(unknown), { calories: null, proteinG: null, carbsG: null, fatG: null });
  assert.equal(summarizeMealNutrition([known, unknown]).isComplete, false);
});

test("database rejects invalid names, quantities, and every nutrition field on inserts and updates", async () => {
  for (const name of ["", "   ", "\t\n"]) {
    await assert.rejects(db.insert(foods).values({ name, userId: "user_a" }),
      (error) => hasPgCode(error, "23514"));
  }
  const meal = await createMeal();
  const food = await createFood();
  for (const quantity of ["0", "-1", "NaN"]) {
    await assert.rejects(db.insert(mealItems).values(itemValues(meal.id, food, quantity)),
      (error) => hasPgCode(error, "23514"));
  }
  for (const foodNameSnapshot of ["", " \t\n"]) {
    await assert.rejects(db.insert(mealItems).values({ ...itemValues(meal.id, food), foodNameSnapshot }),
      (error) => hasPgCode(error, "23514"));
  }
  const [item] = await db.insert(mealItems).values(itemValues(meal.id, food)).returning();
  for (const value of ["-0.01", "NaN"]) {
    for (const field of ["caloriesPerUnit", "proteinGPerUnit", "carbsGPerUnit", "fatGPerUnit"] as const) {
      await assert.rejects(db.insert(foods).values({ name: "Invalid", userId: "user_a", [field]: value }),
        (error) => hasPgCode(error, "23514"));
      await assert.rejects(db.update(foods).set({ [field]: value }).where(eq(foods.id, food.id)),
        (error) => hasPgCode(error, "23514"));
    }
    for (const field of ["caloriesPerUnitSnapshot", "proteinGPerUnitSnapshot", "carbsGPerUnitSnapshot", "fatGPerUnitSnapshot"] as const) {
      await assert.rejects(db.update(mealItems).set({ [field]: value }).where(eq(mealItems.id, item.id)),
        (error) => hasPgCode(error, "23514"));
    }
  }
  await assert.rejects(db.update(mealItems).set({ quantity: "0" }).where(eq(mealItems.id, item.id)),
    (error) => hasPgCode(error, "23514"));
  await assert.rejects(db.insert(meals).values({ userId: "user_a", eatenAt, mealType: sql`'invalid'` }),
    (error) => hasPgCode(error, "22P02"));
});

test("schema stores no totals and uses the required timezone and decimal types", async () => {
  const columns = await postgres.query<{
    table_name: string; column_name: string; data_type: string;
    numeric_precision: number | null; numeric_scale: number | null;
  }>(`select table_name, column_name, data_type, numeric_precision, numeric_scale
      from information_schema.columns where table_schema = 'public'
      and table_name in ('foods', 'meals', 'meal_items')`);
  assert.ok(columns.rows.every((column) => !column.column_name.includes("total")));
  assert.equal(columns.rows.find((column) => column.column_name === "eaten_at")?.data_type, "timestamp with time zone");
  for (const column of columns.rows.filter((column) => column.column_name === "created_at")) {
    assert.equal(column.data_type, "timestamp with time zone");
  }
  for (const column of columns.rows.filter((column) => column.data_type === "numeric")) {
    assert.equal(column.numeric_precision, 10);
    assert.equal(column.numeric_scale, column.column_name === "quantity" ? 3 : 2);
  }
});

test("versioned migration can be applied again without changes", async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  const result = await postgres.query<{ count: number }>('select count(*)::int as count from drizzle.__drizzle_migrations');
  assert.equal(result.rows[0].count, 1);
});
