"use server";

import { revalidatePath } from "next/cache";

import { createMeal } from "@/data/meals";
import { dashboardDateUrl } from "@/lib/meal-date";
import { createMealSchema, type CreateMealInput, type CreateMealResult, type MealFieldErrors } from "@/lib/meal-input";

export async function createMealAction(input: CreateMealInput): Promise<CreateMealResult> {
  const parsed = createMealSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: MealFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] === "mealType" ? "mealType" : "eatenAt";
      fieldErrors[field] ??= field === "mealType" ? "Choose a meal type." : "Enter a valid local date and time.";
    }
    return { success: false, message: "Check the meal details and try again.", fieldErrors };
  }

  const { mealType, eatenAt, start, end, timeZone } = parsed.data;
  const destination = dashboardDateUrl(new Date(start), new Date(end), timeZone);
  try {
    await createMeal({ mealType, eatenAt: new Date(eatenAt) });
  } catch {
    return { success: false, message: "Unable to create the meal. Please check that you’re signed in and try again." };
  }

  revalidatePath("/dashboard");
  return { success: true, destination };
}
