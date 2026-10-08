import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { NeonHttpClient } from "drizzle-orm/neon-http/session";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";

import { foods, meals, relations } from "../db/schema";
import { calculateItemNutrition, summarizeMealNutrition } from "../db/nutrition";
import type { AddMealItemInput, CreateAndLogFoodInput } from "../lib/meal-item-input";

const postgres = new PGlite();
const fixtures = pgliteDrizzle({ client: postgres, relations });
let userId: string | null = "user_a";
let accesses = 0;
let failWrites = false;
let failBatchItem = false;
let batches = 0;
const revalidated: Array<[string, string | undefined]> = [];
type QuerySpec = { statement: string; params: unknown[]; options: { arrayMode: boolean } };

// Exercise the installed Neon HTTP Drizzle driver (including its real db.batch)
// against local PostgreSQL. Neon query promises are lazy until awaited or batched.
async function execute(client: Pick<PGlite, "query">, spec: QuerySpec) {
  accesses++;
  if (failWrites && /^(insert|update|delete)/i.test(spec.statement)) throw new Error("Private database diagnostic");
  const result = await client.query(spec.statement, spec.params);
  const rows = result.rows.map((row) => {
    const values = Object.values(row as Record<string, unknown>).map((value) => value instanceof Date ? value.toISOString() : value);
    return spec.options.arrayMode ? values : row;
  });
  return { rows };
}
const client = {
  query(statement: string, params: unknown[] = [], options = { arrayMode: false }) {
    const spec = { statement, params, options };
    return {
      spec,
      then: <T, U>(resolve: (value: { rows: unknown[] }) => T, reject: (error: unknown) => U) => execute(postgres, spec).then(resolve, reject),
    };
  },
  async transaction(queries: Array<{ spec: QuerySpec }>) {
    batches++;
    return postgres.transaction(async (tx) => {
      const results = [];
      for (const [index, query] of queries.entries()) {
        if (index === 1 && failBatchItem) throw new Error("Private item insert diagnostic");
        results.push(await execute(tx, query.spec));
      }
      return results;
    });
  },
};
const db = neonDrizzle({ client: client as unknown as NeonHttpClient, relations });
mock.module("server-only", { namedExports: {} });
for (const clerkModule of ["../node_modules/@clerk/nextjs/dist/cjs/server/index.js", "../node_modules/@clerk/nextjs/dist/esm/server/index.js"]) {
  mock.module(clerkModule, { namedExports: { auth: async () => ({ userId }) } });
}
mock.module("../db/index.ts", { namedExports: { db } });
mock.module("../node_modules/next/cache.js", { namedExports: { revalidatePath: (path: string, type?: string) => revalidated.push([path, type]) } });
let helpers: typeof import("./meal-items");
let catalog: typeof import("./foods");
let actions: typeof import("../app/dashboard/meals/[mealId]/actions");
before(async () => {
  helpers = await import("./meal-items");
  catalog = await import("./foods");
  actions = await import("../app/dashboard/meals/[mealId]/actions");
  await migrate(fixtures, { migrationsFolder: "./drizzle" });
});
beforeEach(async () => {
  await fixtures.execute(sql`truncate meal_items, meals, foods`);
  userId = "user_a"; accesses = 0; batches = 0; failWrites = false; failBatchItem = false; revalidated.length = 0;
});
after(async () => { mock.restoreAll(); await postgres.close(); });

async function meal(owner = "user_a") {
  const [row] = await fixtures.insert(meals).values({ userId: owner, mealType: "lunch", eatenAt: new Date("2026-10-07T19:00:00Z") }).returning();
  return row;
}
async function food(name = "Apple", owner = "user_a", isArchived = false) {
  const [row] = await fixtures.insert(foods).values({ userId: owner, name, isArchived, caloriesPerUnit: "95.01", proteinGPerUnit: "0", carbsGPerUnit: null, fatGPerUnit: "0.3" }).returning();
  return row;
}
function newFood(mealId: string): CreateAndLogFoodInput {
  return { mealId, name: "  Pear  ", quantity: "1.125", caloriesPerUnit: "20.01", proteinGPerUnit: "0", carbsGPerUnit: null, fatGPerUnit: "0.1" };
}
function refreshed(mealId: string) {
  assert.deepEqual(revalidated, [[`/dashboard/meals/${mealId}`, "layout"], ["/dashboard", undefined]]);
}

test("logs trusted snapshots and exact totals, updates only quantity, removes only the item", async () => {
  const m = await meal(); const f = await food();
  assert.deepEqual(await actions.addMealItemAction({ mealId: m.id, foodId: f.id, quantity: "2.125" }), { success: true });
  refreshed(m.id);
  const [item] = await helpers.getMealItems(m.id);
  assert.deepEqual(item, { id: item.id, foodId: f.id, quantity: "2.125", foodNameSnapshot: "Apple", caloriesPerUnitSnapshot: "95.01", proteinGPerUnitSnapshot: "0.00", carbsGPerUnitSnapshot: null, fatGPerUnitSnapshot: "0.30" });
  assert.deepEqual(summarizeMealNutrition([item]), { calories: "201.89625", proteinG: "0", carbsG: null, fatG: "0.6375", isComplete: false });
  await fixtures.update(foods).set({ name: "New catalog name", caloriesPerUnit: "999", isArchived: true }).where(eq(foods.id, f.id));
  const before = await fixtures.query.mealItems.findFirst({ where: { id: item.id } });
  revalidated.length = 0;
  assert.deepEqual(await actions.updateMealItemQuantityAction({ mealId: m.id, itemId: item.id, quantity: "0.001" }), { success: true });
  refreshed(m.id);
  assert.deepEqual(await fixtures.query.mealItems.findFirst({ where: { id: item.id } }), { ...before, quantity: "0.001" });
  assert.equal(calculateItemNutrition((await helpers.getMealItems(m.id))[0]).calories, "0.09501");
  revalidated.length = 0;
  assert.deepEqual(await actions.removeMealItemAction({ mealId: m.id, itemId: item.id }), { success: true });
  refreshed(m.id);
  assert.deepEqual(await helpers.getMealItems(m.id), []);
  assert.ok(await fixtures.query.foods.findFirst({ where: { id: f.id } }));
  assert.deepEqual(await fixtures.query.meals.findFirst({ where: { id: m.id } }), m);
});

test("creates a private food and item atomically with matching trimmed snapshots and saves for later meals", async () => {
  const m = await meal();
  assert.deepEqual(await actions.createAndLogFoodAction(newFood(m.id)), { success: true });
  assert.equal(batches, 1);
  refreshed(m.id);
  const [f] = await fixtures.query.foods.findMany();
  const [item] = await helpers.getMealItems(m.id);
  assert.equal(f.userId, "user_a"); assert.equal(f.name, "Pear");
  assert.equal(item.foodNameSnapshot, f.name); assert.equal(item.foodId, f.id);
  assert.equal(item.caloriesPerUnitSnapshot, f.caloriesPerUnit);
  assert.equal(item.proteinGPerUnitSnapshot, "0.00"); assert.equal(item.carbsGPerUnitSnapshot, null);
  assert.deepEqual(await catalog.listSavedFoods(), [{ id: f.id, name: "Pear" }]);
  const m2 = await meal();
  await helpers.addMealItem({ mealId: m2.id, foodId: f.id, quantity: "1" });
  assert.equal((await helpers.getMealItems(m2.id)).length, 1);
  userId = "user_b"; assert.deepEqual(await catalog.listSavedFoods(), []);
});

test("failed second batch insert leaves no orphan food or item and no revalidation", async () => {
  const m = await meal(); failBatchItem = true;
  const result = await actions.createAndLogFoodAction(newFood(m.id));
  assert.equal(result.success, false); assert.doesNotMatch(JSON.stringify(result), /Private/);
  assert.equal(batches, 1);
  assert.deepEqual(await fixtures.query.foods.findMany(), []);
  assert.deepEqual(await fixtures.query.mealItems.findMany(), []);
  assert.deepEqual(revalidated, []);
});

test("duplicate and concurrent additions never increment quantities or create additional rows", async () => {
  const m = await meal(); const f = await food();
  const input = { mealId: m.id, foodId: f.id, quantity: "3" };
  const results = await Promise.all([actions.addMealItemAction(input), actions.addMealItemAction(input)]);
  assert.equal(results.filter((r) => r.success).length, 1);
  const failed = results.find((r) => !r.success); assert.ok(failed && !failed.success);
  assert.match(failed.message, /already logged.*quantity/);
  revalidated.length = 0;
  assert.equal((await actions.addMealItemAction({ ...input, quantity: "99" })).success, false);
  const items = await helpers.getMealItems(m.id);
  assert.equal(items.length, 1); assert.equal(items[0].quantity, "3.000");
  assert.deepEqual(revalidated, []);
});

test("duplicate normalized catalog names including archived names cannot overwrite nutrition", async () => {
  const m = await meal(); const f = await food("Pear");
  const results = await Promise.all([actions.createAndLogFoodAction(newFood(m.id)), actions.createAndLogFoodAction({ ...newFood(m.id), name: "pEaR" })]);
  assert.ok(results.every((r) => !r.success));
  assert.equal((await fixtures.query.foods.findMany()).length, 1);
  assert.deepEqual(await fixtures.query.foods.findFirst({ where: { id: f.id } }), f);
  await fixtures.update(foods).set({ isArchived: true }).where(eq(foods.id, f.id));
  const result = await actions.createAndLogFoodAction(newFood(m.id));
  assert.ok(!result.success); assert.match(result.message, /saved food.*name/);
  assert.deepEqual(await fixtures.query.mealItems.findMany(), []);
  assert.deepEqual(revalidated, []);
});

test("concurrent create-and-log submissions commit exactly one pair", async () => {
  const m = await meal();
  const results = await Promise.all([actions.createAndLogFoodAction(newFood(m.id)), actions.createAndLogFoodAction(newFood(m.id))]);
  assert.equal(results.filter((r) => r.success).length, 1);
  assert.equal((await fixtures.query.foods.findMany()).length, 1);
  assert.equal((await fixtures.query.mealItems.findMany()).length, 1);
});

test("signed-out reads and all helper/action writes stop before any database access", async () => {
  userId = null; const mealId = randomUUID(); const foodId = randomUUID(); const itemId = randomUUID();
  const input = { mealId, foodId, itemId, quantity: "1" };
  await assert.rejects(catalog.listSavedFoods()); await assert.rejects(helpers.getMealItems(mealId));
  await assert.rejects(helpers.addMealItem({ mealId, foodId, quantity: "1" }));
  await assert.rejects(helpers.createAndLogFood(newFood(mealId)));
  await assert.rejects(helpers.updateMealItemQuantity({ mealId, itemId, quantity: "1" }));
  await assert.rejects(helpers.removeMealItem({ mealId, itemId }));
  for (const result of [await actions.addMealItemAction({ mealId, foodId, quantity: "1" }), await actions.createAndLogFoodAction(newFood(mealId)), await actions.updateMealItemQuantityAction({ mealId: input.mealId, itemId, quantity: "1" }), await actions.removeMealItemAction({ mealId, itemId })]) assert.equal(result.success, false);
  assert.equal(accesses, 0); assert.deepEqual(revalidated, []);
});

test("missing and foreign meal, food and item IDs have identical safe failures; related IDs cannot be swapped", async () => {
  const own = await meal(); const other = await meal("user_b"); const own2 = await meal();
  const f = await food(); const privateFood = await food("Secret", "user_b");
  await helpers.addMealItem({ mealId: own.id, foodId: f.id, quantity: "1" });
  const [item] = await helpers.getMealItems(own.id);
  const missing = randomUUID();
  assert.deepEqual(await actions.addMealItemAction({ mealId: other.id, foodId: f.id, quantity: "1" }), await actions.addMealItemAction({ mealId: missing, foodId: f.id, quantity: "1" }));
  assert.deepEqual(await actions.addMealItemAction({ mealId: own.id, foodId: privateFood.id, quantity: "1" }), await actions.addMealItemAction({ mealId: own.id, foodId: missing, quantity: "1" }));
  assert.equal((await actions.createAndLogFoodAction(newFood(other.id))).success, false);
  await assert.rejects(helpers.getMealItems(other.id)); await assert.rejects(helpers.getMealItems(missing));
  assert.deepEqual(await actions.updateMealItemQuantityAction({ mealId: own.id, itemId: missing, quantity: "2" }), await actions.updateMealItemQuantityAction({ mealId: own2.id, itemId: item.id, quantity: "2" }));
  assert.deepEqual(await actions.removeMealItemAction({ mealId: own.id, itemId: missing }), await actions.removeMealItemAction({ mealId: own2.id, itemId: item.id }));
  userId = "user_b";
  assert.equal((await actions.updateMealItemQuantityAction({ mealId: own.id, itemId: item.id, quantity: "2" })).success, false);
  assert.equal((await actions.removeMealItemAction({ mealId: own.id, itemId: item.id })).success, false);
  assert.equal((await fixtures.query.mealItems.findFirst({ where: { id: item.id } }))?.quantity, "1.000");
  assert.deepEqual(revalidated, []);
});

test("archived foods are excluded from selection but historical snapshots stay readable and editable", async () => {
  const m = await meal(); const f = await food(); const archived = await food("Archived", "user_a", true);
  await food("Private", "user_b");
  assert.deepEqual(await catalog.listSavedFoods(), [{ id: f.id, name: f.name }]);
  assert.equal((await actions.addMealItemAction({ mealId: m.id, foodId: archived.id, quantity: "1" })).success, false);
  await helpers.addMealItem({ mealId: m.id, foodId: f.id, quantity: "1" });
  await fixtures.update(foods).set({ isArchived: true }).where(eq(foods.id, f.id));
  const [item] = await helpers.getMealItems(m.id); assert.equal(item.foodNameSnapshot, "Apple");
  assert.deepEqual(await catalog.listSavedFoods(), []);
  assert.equal((await actions.updateMealItemQuantityAction({ mealId: m.id, itemId: item.id, quantity: "2" })).success, true);
});

test("actions reject invalid IDs, precision, range, names, numbers and unexpected snapshot/ownership fields before querying", async () => {
  const mealId = randomUUID(); const foodId = randomUUID(); const itemId = randomUUID();
  const add = { mealId, foodId, quantity: "1" };
  for (const input of [null, {}, { ...add, mealId: "bad" }, { ...add, foodId: "bad" }, { ...add, userId: "user_b" }, { ...add, foodNameSnapshot: "Forged" }, ...["0", "0.000", "-1", "1.0001", "10000000", "1e2", "NaN", ".5", "", 1, null].map((quantity) => ({ ...add, quantity }))]) {
    assert.equal((await actions.addMealItemAction(input as AddMealItemInput)).success, false);
  }
  for (const input of [{ ...newFood(mealId), userId: "user_b" }, { ...newFood(mealId), isArchived: false }, ...["", "  ", "2 apples", "two apples", "half an apple", "½ apple", "a".repeat(121)].map((name) => ({ ...newFood(mealId), name })), ...["-1", "1.001", "100000000", "Infinity", 0].map((caloriesPerUnit) => ({ ...newFood(mealId), caloriesPerUnit }))]) {
    assert.equal((await actions.createAndLogFoodAction(input as CreateAndLogFoodInput)).success, false);
  }
  assert.equal((await actions.updateMealItemQuantityAction({ mealId, itemId: "bad", quantity: "1" })).success, false);
  assert.equal((await actions.removeMealItemAction({ mealId, itemId, ...{ userId: "user_b" } })).success, false);
  assert.equal(accesses, 0); assert.deepEqual(revalidated, []);
});

test("numeric boundaries are accepted and failed item operations return no success or revalidation", async () => {
  const m = await meal();
  await helpers.createAndLogFood({ ...newFood(m.id), quantity: "9999999.999", caloriesPerUnit: "99999999.99" });
  const [item] = await helpers.getMealItems(m.id);
  assert.equal(item.quantity, "9999999.999"); assert.equal(item.caloriesPerUnitSnapshot, "99999999.99");
  const f = await food(); failWrites = true;
  for (const result of [await actions.addMealItemAction({ mealId: m.id, foodId: f.id, quantity: "1" }), await actions.updateMealItemQuantityAction({ mealId: m.id, itemId: item.id, quantity: "2" }), await actions.removeMealItemAction({ mealId: m.id, itemId: item.id })]) {
    assert.equal(result.success, false); assert.doesNotMatch(JSON.stringify(result), /Private/);
  }
  assert.deepEqual(revalidated, []);
  assert.equal((await fixtures.query.mealItems.findMany()).length, 1);
});
