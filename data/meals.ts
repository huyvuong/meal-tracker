import "server-only";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { meals } from "@/db/schema";
import { parseMealDateRange } from "@/lib/meal-date";
import { mealIdSchema, mealTypes, type MealType } from "@/lib/meal-input";

export async function getMealById(mealId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required");
  if (!mealIdSchema.safeParse(mealId).success) return null;

  return await db.query.meals.findFirst({
    columns: { id: true, mealType: true, eatenAt: true },
    where: { id: mealId, userId },
  }) ?? null;
}

export async function updateMeal(input: { mealId: string; mealType: MealType; eatenAt: Date }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required");
  if (!mealIdSchema.safeParse(input.mealId).success
    || !mealTypes.includes(input.mealType) || !Number.isFinite(input.eatenAt.getTime())) {
    throw new Error("Invalid meal");
  }

  const updated = await db.update(meals)
    .set({ mealType: input.mealType, eatenAt: input.eatenAt })
    .where(and(eq(meals.id, input.mealId), eq(meals.userId, userId)))
    .returning({ id: meals.id });
  return updated.length > 0;
}

export async function createMeal(input: { mealType: MealType; eatenAt: Date }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required");
  if (!mealTypes.includes(input.mealType) || !Number.isFinite(input.eatenAt.getTime())) {
    throw new Error("Invalid meal");
  }

  // Empty meals are drafts; this operation deliberately creates no meal items.
  await db.insert(meals).values({ userId, mealType: input.mealType, eatenAt: input.eatenAt });
}

export async function getMealsForDay(
  start?: string,
  end?: string,
  timeZone?: string,
) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const range = parseMealDateRange(start, end, timeZone);
  if (!range) return { range: null, meals: [] };

  const meals = await db.query.meals.findMany({
    columns: { id: true, mealType: true, eatenAt: true },
    where: { userId, eatenAt: { gte: range.start, lt: range.end } },
    orderBy: { eatenAt: "asc", id: "asc" },
    with: {
      items: {
        columns: { foodNameSnapshot: true, quantity: true },
        where: { userId },
        orderBy: { createdAt: "asc", id: "asc" },
      },
    },
  });

  return { range, meals };
}
