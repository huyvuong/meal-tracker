import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { foods, mealItems, meals, relations } from "../db/schema";
import { editedMealDateTime, localMealDateTime, mealDateUrl, parseLocalMealDateTime, parseMealDateRange } from "../lib/meal-date";
import type { CreateMealInput, UpdateMealInput } from "../lib/meal-input";

const postgres = new PGlite();
const db = drizzle({ client: postgres, relations });
let userId: string | null = "user_a";
let queries = 0;
const findMany = db.query.meals.findMany.bind(db.query.meals);
const findFirst = db.query.meals.findFirst.bind(db.query.meals);
const insert = db.insert.bind(db);
const update = db.update.bind(db);
let writes = 0;
let failWrites = false;
const revalidated: string[] = [];
const revalidationTypes: (string | undefined)[] = [];
const signInReturns: (string | undefined)[] = [];

mock.module("server-only", { namedExports: {} });
mock.module("../node_modules/@clerk/nextjs/dist/cjs/server/index.js", {
  namedExports: {
    auth: async () => ({
      userId,
      redirectToSignIn: (options?: { returnBackUrl?: string }) => { signInReturns.push(options?.returnBackUrl); throw new Error("Sign in required"); },
    }),
  },
});
mock.module("../node_modules/@clerk/nextjs/dist/esm/server/index.js", {
  namedExports: {
    auth: async () => ({
      userId,
      redirectToSignIn: (options?: { returnBackUrl?: string }) => { signInReturns.push(options?.returnBackUrl); throw new Error("Sign in required"); },
    }),
  },
});
mock.module("../db/index.ts", {
  namedExports: {
    db: {
      insert: (...args: Parameters<typeof insert>) => {
        writes++;
        if (failWrites) throw new Error("Private database details");
        return insert(...args);
      },
      update: (...args: Parameters<typeof update>) => {
        writes++;
        if (failWrites) throw new Error("Private database details");
        return update(...args);
      },
      query: { foods: db.query.foods, mealItems: db.query.mealItems, meals: { findMany: (...args: Parameters<typeof findMany>) => {
        queries++;
        return findMany(...args);
      }, findFirst: (...args: Parameters<typeof findFirst>) => {
        queries++;
        return findFirst(...args);
      } } },
    },
  },
});
mock.module("../node_modules/next/cache.js", { namedExports: {
  revalidatePath: (path: string, type?: string) => { revalidated.push(path); revalidationTypes.push(type); },
} });
mock.module("../node_modules/next/navigation.js", { namedExports: {
  notFound: () => { throw new Error("Meal not found"); },
} });

let getMealsForDay: typeof import("./meals").getMealsForDay;
let createMeal: typeof import("./meals").createMeal;
let getMealById: typeof import("./meals").getMealById;
let updateMeal: typeof import("./meals").updateMeal;
let createMealAction: typeof import("../app/dashboard/meals/new/actions").createMealAction;
let updateMealAction: typeof import("../app/dashboard/meals/[mealId]/actions").updateMealAction;
let editMealLayout: typeof import("../app/dashboard/meals/[mealId]/layout").default;
const start = "2026-10-07T07:00:00.000Z";
const end = "2026-10-08T07:00:00.000Z";
const timeZone = "America/Los_Angeles";

before(async () => {
  ({ getMealsForDay, createMeal, getMealById, updateMeal } = await import("./meals"));
  ({ createMealAction } = await import("../app/dashboard/meals/new/actions"));
  ({ updateMealAction } = await import("../app/dashboard/meals/[mealId]/actions"));
  ({ default: editMealLayout } = await import("../app/dashboard/meals/[mealId]/layout"));
  await migrate(db, { migrationsFolder: "./drizzle" });
});
beforeEach(() => { userId = "user_a"; queries = 0; writes = 0; failWrites = false; revalidated.length = 0; revalidationTypes.length = 0; signInReturns.length = 0; });
after(async () => { mock.restoreAll(); await postgres.close(); });

test("unauthenticated requests stop before querying, including invalid filters", async () => {
  userId = null;
  await assert.rejects(getMealsForDay(start, end, timeZone), /Sign in required/);
  await assert.rejects(getMealsForDay(), /Sign in required/);
  assert.equal(queries, 0);
});

test("reads only the session user's meals and items within a half-open local day", async () => {
  const [own, other] = await db.insert(meals).values([
    { userId: "user_a", mealType: "breakfast", eatenAt: new Date(start) },
    { userId: "user_b", mealType: "lunch", eatenAt: new Date(start) },
    { userId: "user_a", mealType: "dinner", eatenAt: new Date(end) },
    { userId: "user_a", mealType: "snack", eatenAt: new Date("2026-10-07T06:59:59Z") },
  ]).returning();
  const [ownFood, otherFood] = await db.insert(foods).values([
    { userId: "user_a", name: "Current catalog name" },
    { userId: "user_b", name: "Private food" },
  ]).returning();
  await db.insert(mealItems).values([
    { userId: "user_a", mealId: own.id, foodId: ownFood.id, foodNameSnapshot: "Recorded food", quantity: "2" },
    { userId: "user_b", mealId: other.id, foodId: otherFood.id, foodNameSnapshot: "Private food", quantity: "1" },
  ]);

  const result = await getMealsForDay(start, end, timeZone);
  assert.deepEqual(result.meals, [{
    id: own.id, mealType: "breakfast", eatenAt: new Date(start),
    items: [{ foodNameSnapshot: "Recorded food", quantity: "2.000" }],
  }]);

  // Session changes must never reuse another user's previously fetched result.
  userId = "user_b";
  const otherResult = await getMealsForDay(start, end, timeZone);
  assert.deepEqual(otherResult.meals.map((meal) => meal.id), [other.id]);
  assert.equal(otherResult.meals[0].items[0].foodNameSnapshot, "Private food");
  userId = "user_without_meals";
  assert.deepEqual((await getMealsForDay(start, end, timeZone)).meals, []);
});

test("missing or manipulated date filters never cause an unscoped query", async () => {
  for (const args of [
    [], ["invalid", end, timeZone], [end, start, timeZone],
    [start, "2026-10-10T07:00:00Z", timeZone], [start, end, "invalid-zone"],
    ["2026-10-07T07:01:00Z", "2026-10-08T07:01:00Z", timeZone],
  ]) {
    assert.deepEqual(await getMealsForDay(...args), { range: null, meals: [] });
  }
  assert.equal(queries, 0);
});

test("accepts 23-hour and 25-hour daylight-saving days", () => {
  const spring = parseMealDateRange("2026-03-08T08:00:00Z", "2026-03-09T07:00:00Z", timeZone);
  const autumn = parseMealDateRange("2026-11-01T07:00:00Z", "2026-11-02T08:00:00Z", timeZone);
  assert.ok(spring);
  assert.ok(autumn);
  assert.equal(spring.end.getTime() - spring.start.getTime(), 23 * 3600000);
  assert.equal(autumn.end.getTime() - autumn.start.getTime(), 25 * 3600000);
});

const validMeal: CreateMealInput = {
  mealType: "other", eatenAt: "2026-10-07T23:30:00.000Z", start, end, timeZone,
};

test("creates an empty meal owned by the verified session, ignoring extra helper ownership fields", async () => {
  userId = "creator";
  const input = { userId: "someone_else", mealType: "snack" as const, eatenAt: new Date(validMeal.eatenAt) };
  await createMeal(input);
  const stored = await db.query.meals.findMany({ where: { userId: "creator" }, with: { items: true } });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].mealType, "snack");
  assert.equal(stored[0].eatenAt.toISOString(), validMeal.eatenAt);
  assert.deepEqual(stored[0].items, []);
  assert.equal(writes, 1);
});

test("signed-out helper and action requests reject before database access or revalidation", async () => {
  userId = null;
  await assert.rejects(createMeal({ mealType: "lunch", eatenAt: new Date(start) }), /Sign in required/);
  const result = await createMealAction(validMeal);
  assert.equal(result.success, false);
  assert.equal(writes, 0);
  assert.equal(queries, 0);
  assert.deepEqual(revalidated, []);
});

test("action validates all arguments and rejects manipulated ownership and destinations", async () => {
  const invalidInputs = [
    null, {}, { ...validMeal, mealType: "" }, { ...validMeal, mealType: "brunch" },
    { ...validMeal, eatenAt: "invalid" }, { ...validMeal, eatenAt: "2026-02-30T12:00:00Z" },
    { ...validMeal, eatenAt: end }, { ...validMeal, eatenAt: "2026-10-07T06:59:59Z" },
    { ...validMeal, start: "bad" }, { ...validMeal, end: start },
    { ...validMeal, timeZone: "invalid" }, { ...validMeal, timeZone: null },
    { ...validMeal, userId: "someone_else" }, { ...validMeal, destination: "https://example.com" },
  ];
  for (const input of invalidInputs) {
    const result = await createMealAction(input as CreateMealInput);
    assert.equal(result.success, false);
  }
  assert.equal(writes, 0);
  assert.deepEqual(revalidated, []);
});

test("action returns safe write failures and revalidates only after a successful insert", async () => {
  failWrites = true;
  const failure = await createMealAction(validMeal);
  assert.equal(failure.success, false);
  assert.ok(!JSON.stringify(failure).includes("Private database details"));
  assert.deepEqual(revalidated, []);

  failWrites = false;
  userId = "action_creator";
  const result = await createMealAction(validMeal);
  assert.ok(result.success);
  const url = new URL(result.destination, "http://localhost");
  assert.equal(url.pathname, "/dashboard");
  assert.equal(url.searchParams.get("start"), start);
  assert.equal(url.searchParams.get("end"), end);
  assert.equal(url.searchParams.get("timeZone"), timeZone);
  assert.deepEqual(revalidated, ["/dashboard"]);
  const daily = await getMealsForDay(start, end, timeZone);
  assert.equal(daily.meals.length, 1);
  assert.deepEqual(daily.meals[0].items, []);
});

test("local datetime conversion and action destinations cover midnight, DST, past and future dates", async () => {
  const originalTimeZone = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    assert.equal(localMealDateTime(new Date("2026-10-08T06:59:00Z")), "2026-10-07T23:59");
    assert.equal(parseLocalMealDateTime("2026-03-08T02:30"), null);
    assert.equal(parseLocalMealDateTime("2026-02-30T12:00"), null);
    for (const value of ["2000-01-01T00:00", "2099-12-31T23:59", "2026-10-07T23:59", "2026-10-08T00:00", "2026-03-08T03:00", "2026-11-01T01:30"]) {
      const timestamp = parseLocalMealDateTime(value);
      assert.ok(timestamp);
      const url = new URL(mealDateUrl(timestamp), "http://localhost");
      const input = { ...validMeal, eatenAt: timestamp.toISOString(), start: url.searchParams.get("start")!, end: url.searchParams.get("end")! };
      const result = await createMealAction(input);
      assert.ok(result.success, value);
      assert.equal(result.destination, url.pathname + url.search);
      const range = parseMealDateRange(input.start, input.end, timeZone);
      assert.ok(range);
      assert.ok(timestamp >= range.start && timestamp < range.end);
      const daily = await getMealsForDay(input.start, input.end, timeZone);
      assert.ok(daily.meals.some((meal) => meal.eatenAt.getTime() === timestamp.getTime()));
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test("individual reads expose only owned edit fields and hide malformed, missing, and cross-user IDs", async () => {
  const [own, other] = await db.insert(meals).values([
    { userId: "user_a", mealType: "lunch", eatenAt: new Date(start) },
    { userId: "user_b", mealType: "dinner", eatenAt: new Date(start) },
  ]).returning();
  assert.deepEqual(await getMealById(own.id), { id: own.id, mealType: "lunch", eatenAt: own.eatenAt });
  assert.equal(await getMealById(other.id), null);
  assert.equal(await getMealById("00000000-0000-4000-8000-000000000000"), null);
  const beforeInvalid = queries;
  assert.equal(await getMealById("invalid"), null);
  assert.equal(queries, beforeInvalid);
  userId = "user_b";
  assert.equal(await getMealById(own.id), null);
  assert.equal((await getMealById(other.id))?.id, other.id);
});

test("signed-out edit reads, helpers, and actions stop before any database operation", async () => {
  userId = null;
  const mealId = "00000000-0000-4000-8000-000000000000";
  await assert.rejects(getMealById(mealId), /Sign in required/);
  await assert.rejects(getMealById("invalid"), /Sign in required/);
  await assert.rejects(updateMeal({ mealId, mealType: "lunch", eatenAt: new Date(start) }), /Sign in required/);
  assert.equal((await updateMealAction({ ...validMeal, mealId })).success, false);
  assert.equal(queries, 0);
  assert.equal(writes, 0);
  assert.deepEqual(revalidated, []);
});

test("edit layout redirects to sign-in with its return URL and uses one not-found result for inaccessible IDs", async () => {
  const [own, other] = await db.insert(meals).values([
    { userId: "user_a", mealType: "lunch", eatenAt: new Date(start) },
    { userId: "user_b", mealType: "dinner", eatenAt: new Date(start) },
  ]).returning();
  const render = (mealId: string) => {
    const boundary = editMealLayout({ children: "form", params: Promise.resolve({ mealId }) });
    assert.equal(boundary.props.fallback.props["aria-label"], "Loading meal editor");
    const content = boundary.props.children;
    return content.type(content.props);
  };
  userId = null;
  await assert.rejects(render(own.id), /Sign in required/);
  assert.deepEqual(signInReturns, [`/dashboard/meals/${own.id}`]);
  assert.equal(queries, 0);
  userId = "user_a";
  for (const id of ["invalid", "00000000-0000-4000-8000-000000000000", other.id]) {
    await assert.rejects(render(id), /Meal not found/);
  }
  const result = await render(own.id);
  assert.deepEqual(result.props.meal, { id: own.id, mealType: "lunch", eatenAt: start, items: [], foods: await db.query.foods.findMany({ columns: { id: true, name: true }, where: { userId: "user_a", isArchived: false }, orderBy: { name: "asc", id: "asc" } }) });
  assert.equal(result.props.children, "form");
});

test("update validates strict arguments and helper business rules before writing", async () => {
  const input: UpdateMealInput = { ...validMeal, mealId: "00000000-0000-4000-8000-000000000000" };
  for (const invalid of [
    null, {}, { ...input, mealId: "bad" }, { ...input, mealId: null },
    { ...input, mealType: "brunch" }, { ...input, eatenAt: "invalid" },
    { ...input, eatenAt: "2026-02-30T12:00:00Z" }, { ...input, eatenAt: end },
    { ...input, eatenAt: "2026-10-07T06:59:59Z" }, { ...input, start: "bad" },
    { ...input, end: start }, { ...input, timeZone: "invalid" },
    { ...input, userId: "user_b" }, { ...input, createdAt: start },
    { ...input, destination: "https://example.com" },
  ]) {
    assert.equal((await updateMealAction(invalid as UpdateMealInput)).success, false);
  }
  await assert.rejects(updateMeal({ mealId: "bad", mealType: "lunch", eatenAt: new Date(start) }), /Invalid meal/);
  await assert.rejects(updateMeal({ mealId: input.mealId, mealType: "lunch", eatenAt: new Date("bad") }), /Invalid meal/);
  assert.equal(writes, 0);
  assert.equal(queries, 0);
  assert.deepEqual(revalidated, []);
});

test("missing and inaccessible updates have the same safe failure without revalidation", async () => {
  const [other] = await db.insert(meals).values({ userId: "user_b", mealType: "breakfast", eatenAt: new Date(start) }).returning();
  const inaccessible = await updateMealAction({ ...validMeal, mealId: other.id });
  const missing = await updateMealAction({ ...validMeal, mealId: "00000000-0000-4000-8000-000000000000" });
  assert.equal(inaccessible.success, false);
  assert.deepEqual(inaccessible, missing);
  assert.deepEqual(await db.query.meals.findFirst({ where: { id: other.id } }), other);
  assert.deepEqual(revalidated, []);
});

test("updates preserve ownership, creation time, items, and snapshots; repeated saves add no records", async () => {
  const [meal] = await db.insert(meals).values({ userId: "editor", mealType: "breakfast", eatenAt: new Date(start) }).returning();
  const [food] = await db.insert(foods).values({ userId: "editor", name: "Editor catalog food", caloriesPerUnit: "999" }).returning();
  const [item] = await db.insert(mealItems).values({
    userId: "editor", mealId: meal.id, foodId: food.id, quantity: "2.5", foodNameSnapshot: "Historical name",
    caloriesPerUnitSnapshot: "100", proteinGPerUnitSnapshot: "2", carbsGPerUnitSnapshot: "3", fatGPerUnitSnapshot: "4",
  }).returning();
  userId = "editor";
  const input = { ...validMeal, mealId: meal.id };
  failWrites = true;
  const failure = await updateMealAction(input);
  assert.equal(failure.success, false);
  assert.ok(!JSON.stringify(failure).includes("Private database details"));
  assert.deepEqual(await db.query.meals.findFirst({ where: { id: meal.id } }), meal);
  assert.deepEqual(revalidated, []);
  failWrites = false;
  const result = await updateMealAction(input);
  assert.ok(result.success);
  assert.equal(result.destination, mealDateUrlForInput(input));
  assert.deepEqual(revalidated, ["/dashboard", `/dashboard/meals/${meal.id}`]);
  assert.deepEqual(revalidationTypes, [undefined, "layout"]);
  assert.equal(queries, 0, "one scoped update needs no preliminary read");
  assert.equal(writes, 2, "one failed and one successful update");
  for (let attempt = 0; attempt < 2; attempt++) assert.ok((await updateMealAction(input)).success);
  assert.deepEqual(await db.query.meals.findMany({ where: { userId: "editor" } }), [
    { ...meal, mealType: "other", eatenAt: new Date(input.eatenAt) },
  ]);
  assert.deepEqual(await db.query.mealItems.findMany({ where: { mealId: meal.id } }), [item]);
  // The helper explicitly selects editable fields even when called with extra fields.
  await updateMeal({ mealId: meal.id, mealType: "snack", eatenAt: new Date(input.eatenAt), ...{ userId: "user_b", createdAt: new Date(end) } });
  const stored = await db.query.meals.findFirst({ where: { id: meal.id } });
  assert.equal(stored?.userId, "editor");
  assert.deepEqual(stored?.createdAt, meal.createdAt);
});

function mealDateUrlForInput(input: CreateMealInput) {
  return `/dashboard?${new URLSearchParams({ start: input.start, end: input.end, timeZone: input.timeZone })}`;
}

test("edit prefill preserves precision and the later DST occurrence; changed dates choose their local day", async () => {
  const originalTimeZone = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    const original = "2026-11-01T09:30:42.123Z";
    assert.equal(localMealDateTime(new Date(original)), "2026-11-01T01:30");
    assert.equal(editedMealDateTime("2026-11-01T01:30", original)?.toISOString(), original);
    assert.equal(editedMealDateTime("2026-03-08T02:30", original), null);
    assert.equal(editedMealDateTime("2026-02-30T12:00", original), null);
    const [meal] = await db.insert(meals).values({ userId: "user_a", mealType: "lunch", eatenAt: new Date(original) }).returning();
    for (const value of ["2026-11-01T01:30", "2026-10-07T23:59", "2026-10-08T00:00", "2026-03-08T03:00", "2026-11-02T00:00"]) {
      const timestamp = editedMealDateTime(value, original);
      assert.ok(timestamp);
      const url = new URL(mealDateUrl(timestamp), "http://localhost");
      const input = { ...validMeal, mealId: meal.id, eatenAt: timestamp.toISOString(), start: url.searchParams.get("start")!, end: url.searchParams.get("end")! };
      const result = await updateMealAction(input);
      assert.ok(result.success);
      assert.equal(result.destination, url.pathname + url.search);
      assert.ok((await getMealsForDay(input.start, input.end, timeZone)).meals.some((record) => record.id === meal.id));
      assert.equal((await getMealById(meal.id))?.eatenAt.toISOString(), timestamp.toISOString());
    }
    // Cancel uses the original timestamp even after entering a different day.
    const cancel = new URL(mealDateUrl(new Date(original)), "http://localhost");
    assert.equal(cancel.searchParams.get("start"), "2026-11-01T07:00:00.000Z");
    assert.equal(cancel.searchParams.get("end"), "2026-11-02T08:00:00.000Z");
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});
