import "server-only";

import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { foods, mealItems } from "@/db/schema";
import { mealIdSchema } from "@/lib/meal-input";
import { addMealItemSchema, createAndLogFoodSchema, updateMealItemQuantitySchema, removeMealItemSchema, type AddMealItemInput, type CreateAndLogFoodInput, type UpdateMealItemQuantityInput, type RemoveMealItemInput } from "@/lib/meal-item-input";

export class MealItemError extends Error {}
const unavailable = () => new MealItemError("This meal or food entry is unavailable.");

async function authenticatedUser() {
  const { userId } = await auth();
  if (!userId) throw new MealItemError("Please sign in to change this meal.");
  return userId;
}

async function requireMeal(mealId: string, userId: string) {
  const meal = await db.query.meals.findFirst({ columns: { id: true }, where: { id: mealId, userId } });
  if (!meal) throw unavailable();
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

export async function getMealItems(mealId: string) {
  const userId = await authenticatedUser();
  if (!mealIdSchema.safeParse(mealId).success) return [];
  await requireMeal(mealId, userId);
  return db.query.mealItems.findMany({
    columns: { id: true, foodId: true, quantity: true, foodNameSnapshot: true, caloriesPerUnitSnapshot: true, proteinGPerUnitSnapshot: true, carbsGPerUnitSnapshot: true, fatGPerUnitSnapshot: true },
    where: { mealId, userId },
    orderBy: { createdAt: "asc", id: "asc" },
  });
}

export async function addMealItem(input: AddMealItemInput) {
  const userId = await authenticatedUser();
  const { mealId, foodId, quantity } = addMealItemSchema.parse(input);
  await requireMeal(mealId, userId);
  const food = await db.query.foods.findFirst({
    columns: { name: true, caloriesPerUnit: true, proteinGPerUnit: true, carbsGPerUnit: true, fatGPerUnit: true },
    where: { id: foodId, userId, isArchived: false },
  });
  if (!food) throw unavailable();
  try {
    await db.insert(mealItems).values({
      userId, mealId, foodId, quantity, foodNameSnapshot: food.name,
      caloriesPerUnitSnapshot: food.caloriesPerUnit, proteinGPerUnitSnapshot: food.proteinGPerUnit,
      carbsGPerUnitSnapshot: food.carbsGPerUnit, fatGPerUnitSnapshot: food.fatGPerUnit,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new MealItemError("This food is already logged. Edit its quantity below.");
    throw error;
  }
}

export async function createAndLogFood(input: CreateAndLogFoodInput) {
  const userId = await authenticatedUser();
  const { mealId, name, quantity, caloriesPerUnit, proteinGPerUnit, carbsGPerUnit, fatGPerUnit } = createAndLogFoodSchema.parse(input);
  await requireMeal(mealId, userId);
  const foodId = randomUUID();
  try {
    // Neon HTTP batches execute in one transaction; a failed item insert also rolls back the food.
    await db.batch([
      db.insert(foods).values({ id: foodId, userId, name, caloriesPerUnit, proteinGPerUnit, carbsGPerUnit, fatGPerUnit }),
      db.insert(mealItems).values({ userId, mealId, foodId, quantity, foodNameSnapshot: name, caloriesPerUnitSnapshot: caloriesPerUnit, proteinGPerUnitSnapshot: proteinGPerUnit, carbsGPerUnitSnapshot: carbsGPerUnit, fatGPerUnitSnapshot: fatGPerUnit }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new MealItemError("A saved food already has this name. Select it from saved foods. Archived names cannot be reused.");
    throw error;
  }
}

async function requireItem(mealId: string, itemId: string, userId: string) {
  await requireMeal(mealId, userId);
  const item = await db.query.mealItems.findFirst({ columns: { foodId: true }, where: { id: itemId, mealId, userId } });
  if (!item) throw unavailable();
  // Archived foods remain valid historical references.
  const food = await db.query.foods.findFirst({ columns: { id: true }, where: { id: item.foodId, userId } });
  if (!food) throw unavailable();
}

export async function updateMealItemQuantity(input: UpdateMealItemQuantityInput) {
  const userId = await authenticatedUser();
  const { mealId, itemId, quantity } = updateMealItemQuantitySchema.parse(input);
  await requireItem(mealId, itemId, userId);
  const updated = await db.update(mealItems).set({ quantity })
    .where(and(eq(mealItems.id, itemId), eq(mealItems.mealId, mealId), eq(mealItems.userId, userId)))
    .returning({ id: mealItems.id });
  if (!updated.length) throw unavailable();
}

export async function removeMealItem(input: RemoveMealItemInput) {
  const userId = await authenticatedUser();
  const { mealId, itemId } = removeMealItemSchema.parse(input);
  await requireItem(mealId, itemId, userId);
  const removed = await db.delete(mealItems)
    .where(and(eq(mealItems.id, itemId), eq(mealItems.mealId, mealId), eq(mealItems.userId, userId)))
    .returning({ id: mealItems.id });
  if (!removed.length) throw unavailable();
}
